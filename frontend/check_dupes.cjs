const fs = require('fs');
const path = require('path');
const dirs = ['zh-CN', 'en-US'];
dirs.forEach(function(dir) {
  const dirPath = path.join('src/locale', dir);
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.ts'));
  files.forEach(function(f) {
    const filePath = path.join(dirPath, f);
    const c = fs.readFileSync(filePath, 'utf8');
    const keys = [];
    const re = /'([^']+)'\s*:/g;
    let m;
    while (m = re.exec(c)) keys.push(m[1]);
    const seen = new Set();
    const dupes = new Set();
    keys.forEach(function(k) {
      if (seen.has(k)) dupes.add(k);
      seen.add(k);
    });
    if (dupes.size) {
      console.log(dir + '/' + f + ': DUPLICATES (' + dupes.size + '): ' + Array.from(dupes).join(', '));
    } else {
      console.log(dir + '/' + f + ': OK (' + keys.length + ' keys)');
    }
  });
});

