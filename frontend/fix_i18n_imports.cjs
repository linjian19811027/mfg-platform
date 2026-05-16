// Add useI18n import and const { t } = useI18n() to Vue files that use t() but lack useI18n
const fs = require('fs');
const path = require('path');

const files = [
  'src/views/plm/standard-operation/index.vue',
  'src/views/erp/account/index.vue',
  'src/views/erp/cost-center/index.vue',
  'src/views/erp/financial-report/index.vue',
  'src/views/erp/sales-analytics/index.vue',
  'src/views/mes/dashboard/index.vue',
  'src/views/eam/analytics/index.vue',
  'src/views/qms/spc/index.vue',
  'src/views/scm/analytics/index.vue',
  'src/views/base/work-center/index.vue',
  'src/views/traceability/dashboard/index.vue',
  'src/views/traceability/index.vue',
  'src/views/aps/gantt/index.vue',
  'src/views/sys/monitor/index.vue',
  'src/views/sys/numbering/index.vue',
  'src/views/sys/permission/index.vue',
];

let fixed = 0;
files.forEach(fp => {
  if (!fs.existsSync(fp)) { console.log('NOT FOUND: ' + fp); return; }
  let c = fs.readFileSync(fp, 'utf8');
  
  // Check if there's a <script setup> block
  if (!c.includes('<script setup')) {
    console.log('NO <script setup>: ' + fp);
    return;
  }
  
  // Find existing vue import line or first import
  const hasVueImport = /import\s*\{[^}]*\}\s*from\s*['"]vue['"]/.test(c);
  const hasI18nImport = /import\s*\{[^}]*useI18n[^}]*\}\s*from\s*['"]vue-i18n['"]/.test(c);
  
  if (hasI18nImport) {
    // Already imported but not destructured - skip
    console.log('Already has vue-i18n import: ' + fp);
    return;
  }
  
  // Add useI18n import
  if (!hasI18nImport) {
    // Find the last import line and add after it
    const importRe = /^import\s+.*$/gm;
    let lastImportMatch;
    let lastImportIndex = -1;
    while ((m = importRe.exec(c)) !== null) {
      lastImportIndex = m.index + m[0].length;
    }
    
    if (lastImportIndex !== -1) {
      c = c.substring(0, lastImportIndex) + "\nimport { useI18n } from 'vue-i18n'" + c.substring(lastImportIndex);
    } else {
      // Add after <script setup lang="ts">
      c = c.replace(/<script setup lang="ts">/, "<script setup lang=\"ts\">\nimport { useI18n } from 'vue-i18n'");
    }
  }
  
  // Add const { t } = useI18n() after imports / before first function/ref
  // Find a good insertion point: after last import, before first const/let/function
  if (!/const\s*\{\s*t\s*\}\s*=\s*useI18n/.test(c)) {
    // Find last import line end
    const importRe2 = /^import\s+.*$/gm;
    let lastImportEnd = -1;
    while ((m = importRe2.exec(c)) !== null) {
      lastImportEnd = m.index + m[0].length;
    }
    
    if (lastImportEnd !== -1) {
      c = c.substring(0, lastImportEnd) + "\nconst { t } = useI18n()" + c.substring(lastImportEnd);
    }
  }
  
  fs.writeFileSync(fp, c, 'utf8');
  fixed++;
  console.log('Fixed: ' + fp);
});

console.log(`\nTotal files fixed: ${fixed}`);
