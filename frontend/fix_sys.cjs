const fs = require('fs');
const path = require('path');

// Fix sys module Vue files
const sysDir = path.join('src', 'views', 'sys');
let count = 0;

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) walk(fp);
    else if (f.endsWith('.vue')) {
      let c = fs.readFileSync(fp, 'utf8');
      const orig = c;
      const re = /Message\.(success|error|warning|info)\(['"]([\u4e00-\u9fff][^'"]*)['"]\)/g;
      c = c.replace(re, (m, method, msg) => {
        return `Message.${method}(t('sys.${msg}'))`;
      });
      if (c !== orig) {
        fs.writeFileSync(fp, c, 'utf8');
        count++;
        console.log('Fixed: ' + fp);
      }
    }
  });
}
walk(sysDir);

// Also fix the one wms file
const wmsFile = path.join('src', 'views', 'wms', 'inventory-count', 'index.vue');
let c = fs.readFileSync(wmsFile, 'utf8');
const orig = c;
c = c.replace(/Message\.info\('请在列表页点击"审批"按钮完成审批'\)/, "Message.info(t('wms.请在列表页点击审批按钮完成审批'))");
if (c !== orig) {
  fs.writeFileSync(wmsFile, c, 'utf8');
  count++;
  console.log('Fixed: ' + wmsFile);
}

console.log('Total files fixed: ' + count);
