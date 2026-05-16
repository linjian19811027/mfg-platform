const fs = require('fs')
const files = [
  'src/views/base/batch/index.vue',
  'src/views/base/work-center/index.vue',
  'src/views/mes/auto-receipt-config/index.vue',
  'src/views/mes/dashboard/index.vue',
  'src/views/outsourcing/orders/index.vue',
  'src/views/plm/document/index.vue',
  'src/views/sys/organization/index.vue',
  'src/views/sys/role/index.vue',
  'src/views/sys/tenant/index.vue',
  'src/views/sys/uom/index.vue',
  'src/views/traceability/batches/index.vue'
]
files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8')
  const hasI18n = c.includes('useI18n')
  const hasT = c.includes("const { t }")
  console.log(f + ': useI18n=' + hasI18n + ', t=' + hasT)
})
