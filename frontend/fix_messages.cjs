const fs = require('fs');
const path = require('path');

const dirs = ['plm', 'wms', 'erp', 'mes', 'eam', 'qms', 'scm', 'base', 'outsourcing', 'traceability'];
let count = 0;
const changes = [];

dirs.forEach(d => {
  function walk(dir) {
    fs.readdirSync(dir).forEach(f => {
      const fp = path.join(dir, f);
      if (fs.statSync(fp).isDirectory()) walk(fp);
      else if (f.endsWith('.vue')) {
        let c = fs.readFileSync(fp, 'utf8');
        const orig = c;
        // Replace Message.success/error/warning/info('中文...') with t() calls
        const re = /Message\.(success|error|warning|info)\(['"]([\u4e00-\u9fff][^'"]*)['"]\)/g;
        c = c.replace(re, (m, method, msg) => {
          // Create a key from the Chinese message - use the message directly as key
          return `Message.${method}(t('${d}.${msg}'))`;
        });
        if (c !== orig) {
          fs.writeFileSync(fp, c, 'utf8');
          count++;
          changes.push(fp);
        }
      }
    });
  }
  walk(path.join('src', 'views', d));
});

console.log('Total files fixed: ' + count);
changes.forEach(c => console.log('  ' + c));
