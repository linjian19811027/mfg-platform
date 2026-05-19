/**
 * Audit: frontend column dataIndex vs backend entity field names
 * Reports mismatches where the frontend references a field name that doesn't exist in the backend entity.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// --- Step 1: Extract backend entity fields ---
const entityDir = path.join(root, 'backend/src/modules');
const entityFields = {}; // entityName -> Set of fieldNames

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full);
    else if (e.name.endsWith('.entity.ts')) parseEntity(full);
  }
}

function camelToSnake(str) {
  // e.g. workCenterCode -> work_center_code
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function parseEntity(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Extract entity class name from @Entity('table_name') or className
  const classMatch = content.match(/export\s+class\s+(\w+)/);
  if (!classMatch) return;
  const className = classMatch[1];

  const fields = new Set();
  // Match column property names: propertyName: Type  (after @Column, @ManyToOne, etc.)
  // We look for class property declarations
  const propRegex = /^\s+(?:public\s+)?(\w+)(?:\??)\s*:\s*(\w+)/gm;
  let m;
  while ((m = propRegex.exec(content)) !== null) {
    const fieldName = m[1];
    // Skip constructor params and common non-field names
    if (['id', 'constructor'].includes(fieldName)) { fields.add(fieldName); continue; }
    fields.add(fieldName);
  }

  // Also try to extract from @Column({ name: 'xxx' }) to get DB column names mapped
  const colNameRegex = /@Column\s*\(\s*\{[^}]*name:\s*'(\w+)'[^}]*\}/g;
  const dbColNames = new Set();
  while ((m = colNameRegex.exec(content)) !== null) {
    dbColNames.add(m[1]);
  }

  // Also extract @JoinColumn name
  const joinColRegex = /@JoinColumn\s*\(\s*\{[^}]*name:\s*'(\w+)'[^}]*\}/g;
  while ((m = joinColRegex.exec(content)) !== null) {
    dbColNames.add(m[1]);
  }

  entityFields[className] = { fields, dbColNames, filePath };
}

walkDir(entityDir);
console.log(`Parsed ${Object.keys(entityFields).length} backend entities\n`);

// --- Step 2: Extract frontend column dataIndex from Vue files ---
const viewsDir = path.join(root, 'frontend/src/views');
const mismatches = [];

// Map: frontend view folder -> backend entity class (heuristic)
// We'll try to auto-detect by looking at API calls in the Vue files
function extractColumns(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const columns = [];

  // Match dataIndex: 'xxx' or dataIndex:"xxx"
  const dataIndexRegex = /dataIndex\s*:\s*['"](\w+)['"]/g;
  let m;
  while ((m = dataIndexRegex.exec(content)) !== null) {
    columns.push(m[1]);
  }

  return columns;
}

function extractApiEndpoint(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Look for API URLs like /api/xxx or useXxxService patterns
  const apiRegex = /(?:url|api|endpoint)\s*[:=]\s*['"`]([^'"`\s]+)['"`]/g;
  const apis = [];
  let m;
  while ((m = apiRegex.exec(content)) !== null) {
    apis.push(m[1]);
  }
  return apis;
}

function extractFormFields(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fields = [];
  // Match a-form-item field="xxx" or v-model="record.xxx" or formModel.xxx
  const fieldRegex = /(?:field|name)\s*=\s*['"](\w+)['"]/g;
  let m;
  while ((m = fieldRegex.exec(content)) !== null) {
    fields.push(m[1]);
  }
  return fields;
}

// Walk all Vue files
function walkViews(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...walkViews(full));
    } else if (e.name.endsWith('.vue')) {
      results.push(full);
    }
  }
  return results;
}

const vueFiles = walkViews(viewsDir);
console.log(`Scanning ${vueFiles.length} Vue files...\n`);

// Build a lookup: entity fields by normalized key
// We need to map Vue files to their corresponding entities
// Strategy: look at the file path and API calls to determine the entity

// Quick mapping based on directory names
const dirToEntityPrefix = {
  'aps': 'Aps',
  'base': 'Mfg|Sys',
  'eam': 'Eam',
  'erp': 'Erp',
  'hr': 'Hr',
  'mes': 'Mes',
  'outsourcing': 'Outsourcing',
  'plm': 'Plm',
  'qms': 'Qms',
  'scm': 'Scm',
  'sys': 'Sys',
  'traceability': 'Trace',
  'wms': 'Wms',
};

// Read all Vue files and extract columns + match to entities
for (const vueFile of vueFiles) {
  const relPath = path.relative(viewsDir, vueFile).replace(/\\/g, '/');
  const columns = extractColumns(vueFile);
  const formFields = extractFormFields(vueFile);
  const allFrontendFields = [...new Set([...columns, ...formFields])];

  if (allFrontendFields.length === 0) continue;

  // Determine which backend entity this view maps to
  // Read the file content to find API/entity references
  const content = fs.readFileSync(vueFile, 'utf-8');

  // Look for import patterns that reference entity/service names
  const importEntityRegex = /from\s+['"]@?\/?(?:api|services?)\/([^'"]+)['"]/g;
  const apiImports = [];
  let im;
  while ((im = importEntityRegex.exec(content)) !== null) {
    apiImports.push(im[1]);
  }

  // Try to find the entity class name from the content
  // Look for patterns like: useXxxStore, xxxService, /api/xxx
  const serviceMatch = content.match(/(?:use|create)(\w+)(?:Store|Service|Api)/);

  // For each frontend field, check if it exists in ANY matching entity
  const module = relPath.split('/')[0];
  const viewName = relPath.split('/')[1];

  // Find candidate entities
  const prefix = dirToEntityPrefix[module] || '';
  const candidates = Object.keys(entityFields).filter(k => {
    if (!prefix) return true;
    return prefix.split('|').some(p => k.startsWith(p));
  });

  // Further narrow by view name matching entity name
  const viewNameLower = viewName.toLowerCase().replace(/[-_]/g, '');
  const narrowCandidates = candidates.filter(k => {
    const entityBase = k.toLowerCase()
      .replace(/^(aps|eam|erp|hr|mes|mfg|outsourcing|plm|qms|scm|sys|wms|trace)/, '')
      .replace(/entity$/, '');
    return entityBase.includes(viewNameLower) || viewNameLower.includes(entityBase);
  });

  const finalCandidates = narrowCandidates.length > 0 ? narrowCandidates : candidates;

  for (const field of allFrontendFields) {
    let found = false;
    const matchedEntities = [];

    for (const entityName of finalCandidates) {
      const { fields, dbColNames } = entityFields[entityName];
      // Check direct match
      if (fields.has(field)) {
        found = true;
        matchedEntities.push(entityName);
        continue;
      }
      // Check camelCase <-> snake_case conversion
      const snakeField = camelToSnake(field);
      const camelField = field; // already camelCase
      // Check if DB column name matches
      if (dbColNames.has(snakeField) || dbColNames.has(field)) {
        found = true;
        matchedEntities.push(entityName);
        continue;
      }
      // Check if any entity field's snake_case matches
      for (const ef of fields) {
        if (camelToSnake(ef) === snakeField || ef.toLowerCase() === field.toLowerCase()) {
          found = true;
          matchedEntities.push(entityName);
          break;
        }
      }
    }

    if (!found) {
      // Check against ALL entities as a last resort
      for (const entityName of Object.keys(entityFields)) {
        const { fields } = entityFields[entityName];
        if (fields.has(field)) {
          found = true;
          break;
        }
      }
    }

    if (!found) {
      // Skip common meta fields that are typically in base entities
      const metaFields = ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'updatedBy',
        'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by',
        'createTime', 'updateTime', 'createBy', 'updateBy', 'create_time', 'update_time',
        'status', 'remark', 'description', 'name', 'code', 'type', 'sort', 'enabled',
        'tenantId', 'tenant_id', 'orgId', 'org_id', 'key', 'action', 'index', 'children',
        'total', 'current', 'pageSize', 'page', 'size', 'count', 'label', 'value',
        'title', 'icon', 'path', 'component', 'redirect', 'hidden', 'parentId', 'parent_id',
        'level', 'sortOrder', 'sort_order', 'isActive', 'is_active', 'isEnabled', 'is_enabled',
        'row', 'col', 'span', 'data', 'loading', 'visible', 'disabled', 'rules', 'model',
        'options', 'placeholder', 'required', 'width', 'fixed', 'align', 'ellipsis',
        'oper', 'operation', 'actions', 'handle', 'operate', '编辑', '删除', '查看', '操作'];
      if (metaFields.includes(field)) continue;

      mismatches.push({ file: relPath, field });
    }
  }
}

// Deduplicate and sort
const seen = new Set();
const unique = [];
for (const m of mismatches) {
  const key = `${m.file}|${m.field}`;
  if (!seen.has(key)) {
    seen.add(key);
    unique.push(m);
  }
}

// Group by file
const byFile = {};
for (const m of unique) {
  if (!byFile[m.file]) byFile[m.file] = [];
  byFile[m.file].push(m.field);
}

console.log('=== FRONTEND dataIndex / field NOT FOUND IN ANY BACKEND ENTITY ===\n');
for (const [file, fields] of Object.entries(byFile).sort()) {
  console.log(`📁 ${file}`);
  for (const f of fields) {
    console.log(`   ❌ ${f}`);
  }
  console.log();
}

console.log(`\nTotal mismatches: ${unique.length} fields across ${Object.keys(byFile).length} files`);
