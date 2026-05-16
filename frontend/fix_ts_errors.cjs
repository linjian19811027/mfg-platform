/**
 * Fix all i18n-related TypeScript compilation errors:
 * 1. Fix `useI18n` import order (must be before `const { t } = useI18n()`)
 * 2. Fix `$t()` used in <script> section (should be `t()`)
 * 3. Add missing `useI18n` imports
 * 4. Fix `Record<string, string>` typed as callable (resourceStatusLabel)
 */
const fs = require('fs')
const path = require('path')

const fixes = [
  // ── 1. aps/calendar/index.vue: $t in script → t ──
  {
    file: 'src/views/aps/calendar/index.vue',
    fix(content) {
      // Replace $t( with t( in script section only
      const scriptMatch = content.match(/(<script setup[^>]*>)([\s\S]*?)(<\/script>)/)
      if (!scriptMatch) return content
      const scriptContent = scriptMatch[2].replace(/\$t\(/g, 't(')
      return content.replace(scriptMatch[0], scriptMatch[1] + scriptContent + scriptMatch[3])
    }
  },
  // ── 2. aps/resource/index.vue: fix import order + Record<string, string> not callable ──
  {
    file: 'src/views/aps/resource/index.vue',
    fix(content) {
      // Fix import order: move useI18n import before const { t }
      content = content.replace(
        /const \{ t \} = useI18n\(\)\nimport \{ useI18n \} from 'vue-i18n'/,
        `import { useI18n } from 'vue-i18n'\nconst { t } = useI18n()`
      )
      // Fix resourceStatusLabel: Record<string, string> is not callable, change to function
      content = content.replace(
        /const resourceStatusLabel: Record<string, string> = \{[\s\S]*?\}/,
        `const resourceStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      AVAILABLE: t('aps.resource.status.available'),
      MAINTENANCE: t('aps.resource.status.maintenance'),
      REPAIR: t('aps.resource.status.repair'),
      BREAKDOWN: t('aps.resource.status.breakdown'),
    }
    return map[status] ?? status
  }`
      )
      // Fix resourceStatusColor same pattern
      content = content.replace(
        /const resourceStatusColor: Record<string, string> = \{[\s\S]*?\}/,
        `const resourceStatusColor = (status: string): string => {
    const map: Record<string, string> = {
      AVAILABLE: 'green',
      MAINTENANCE: 'orange',
      REPAIR: 'red',
      BREAKDOWN: 'red',
    }
    return map[status] ?? 'gray'
  }`
      )
      // Fix template usage: resourceStatusColor(record.status as string) → resourceStatusColor(record.status as string)
      // Already uses function call syntax, no change needed
      return content
    }
  },
  // ── 3. base/certification-types/index.vue: fix import order ──
  {
    file: 'src/views/base/certification-types/index.vue',
    fix(content) {
      return content.replace(
        /const \{ t \} = useI18n\(\)\nimport \{ useI18n \} from 'vue-i18n'/,
        `import { useI18n } from 'vue-i18n'\nconst { t } = useI18n()`
      )
    }
  },
  // ── 4. base/shifts/index.vue: fix import order ──
  {
    file: 'src/views/base/shifts/index.vue',
    fix(content) {
      return content.replace(
        /const \{ t \} = useI18n\(\)\nimport \{ useI18n \} from 'vue-i18n'/,
        `import { useI18n } from 'vue-i18n'\nconst { t } = useI18n()`
      )
    }
  },
  // ── 5. hr/schedules/index.vue: add useI18n import + const { t } ──
  {
    file: 'src/views/hr/schedules/index.vue',
    fix(content) {
      // Check if useI18n is already imported
      if (content.includes("import { useI18n } from 'vue-i18n'")) return content
      // Add import after other imports
      const scriptStart = content.indexOf('<script setup lang="ts">')
      if (scriptStart === -1) return content
      const afterScript = scriptStart + '<script setup lang="ts">'.length
      
      // Find the end of imports section (after the last import line)
      const afterImports = content.indexOf('// ── 状态')
      if (afterImports === -1) return content
      
      const importSection = content.substring(afterScript, afterImports)
      // Add useI18n import
      const newImportSection = importSection + "\nimport { useI18n } from 'vue-i18n'\nconst { t } = useI18n()\n"
      return content.substring(0, afterScript) + newImportSection + content.substring(afterImports)
    }
  },
  // ── 6. hr/work-hours/dashboard.vue: add useI18n import + const { t } ──
  {
    file: 'src/views/hr/work-hours/dashboard.vue',
    fix(content) {
      if (content.includes("import { useI18n } from 'vue-i18n'")) return content
      // Add after other imports
      const afterImportLine = content.indexOf("import { getWorkHourDashboard } from '@/api/hr'")
      if (afterImportLine === -1) return content
      const lineEnd = content.indexOf('\n', afterImportLine)
      return content.substring(0, lineEnd + 1) + 
        "\nimport { useI18n } from 'vue-i18n'\nconst { t } = useI18n()\n" +
        content.substring(lineEnd + 1)
    }
  },
]

let fixed = 0
for (const { file, fix } of fixes) {
  const fullPath = path.join(__dirname, file)
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${file}`)
    continue
  }
  let content = fs.readFileSync(fullPath, 'utf-8')
  const before = content
  content = fix(content)
  if (content !== before) {
    fs.writeFileSync(fullPath, content, 'utf-8')
    console.log(`FIXED: ${file}`)
    fixed++
  } else {
    console.log(`NO CHANGE: ${file}`)
  }
}
console.log(`\nTotal: ${fixed} files fixed`)
