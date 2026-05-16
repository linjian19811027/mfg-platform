// Check Vue files that use t() but don't import useI18n
const fs = require('fs');
const path = require('path');

const dirs = ['plm', 'wms', 'erp', 'mes', 'eam', 'qms', 'scm', 'base', 'outsourcing', 'traceability', 'aps', 'sys'];
const issues = [];

dirs.forEach(d => {
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
      const fp = path.join(dir, f);
      if (fs.statSync(fp).isDirectory()) walk(fp);
      else if (f.endsWith('.vue')) {
        const c = fs.readFileSync(fp, 'utf8');
        const usesT = /\bt\(['"]/.test(c);
        const hasUseI18n = /useI18n/.test(c);
        const hasImportI18n = /import.*useI18n/.test(c);
        if (usesT && !hasUseI18n) {
          issues.push({ file: fp, hasUseI18n, hasImportI18n });
        }
      }
    });
  }
  walk(path.join('src', 'views', d));
});

if (issues.length === 0) {
  console.log('All Vue files using t() have useI18n imported!');
} else {
  console.log(`Found ${issues.length} files using t() without useI18n:`);
  issues.forEach(i => console.log(`  ${i.file} (useI18n: ${i.hasUseI18n}, import: ${i.hasImportI18n})`));
}
