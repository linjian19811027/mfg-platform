// Fix e.message || '中文' patterns in Vue files
const fs = require('fs');
const path = require('path');

const dirs = ['plm', 'wms', 'erp', 'mes', 'eam', 'qms', 'scm', 'base', 'outsourcing', 'traceability', 'aps', 'sys'];
let count = 0;
const newKeys = new Set();

function walk(dir, mod) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) walk(fp, mod);
    else if (f.endsWith('.vue')) {
      let c = fs.readFileSync(fp, 'utf8');
      const orig = c;
      // Replace e.message || '中文' and error.message || '中文' patterns
      const re = /(\w+\.message)\s*\|\|\s*['"]([\u4e00-\u9fff][^'"]*)['"]/g;
      c = c.replace(re, (m, prop, msg) => {
        newKeys.add(`${mod}.${msg}`);
        return `${prop} || t('${mod}.${msg}')`;
      });
      if (c !== orig) {
        fs.writeFileSync(fp, c, 'utf8');
        count++;
        console.log('Fixed: ' + fp);
      }
    }
  });
}

dirs.forEach(d => walk(path.join('src', 'views', d), d));

console.log(`\nTotal files fixed: ${count}`);
console.log('\nNew keys needed:');
const keysByMod = {};
newKeys.forEach(k => {
  const mod = k.split('.')[0];
  const leaf = k.substring(mod.length + 1);
  if (!keysByMod[mod]) keysByMod[mod] = [];
  keysByMod[mod].push(leaf);
});
Object.keys(keysByMod).sort().forEach(mod => {
  console.log(`\n${mod}:`);
  keysByMod[mod].sort().forEach(k => console.log(`  ${k}`));
});
