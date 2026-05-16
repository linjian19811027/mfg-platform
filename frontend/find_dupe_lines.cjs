const fs = require('fs');
const path = require('path');
function findDupes(filePath) {
  const c = fs.readFileSync(filePath, 'utf8');
  const lines = c.split('\n');
  const seen = {};
  const dupes = [];
  lines.forEach(function(line, i) {
    const m = line.match(/'([^']+)'\s*:/);
    if (m) {
      const key = m[1];
      if (seen[key] !== undefined) {
        dupes.push({ key: key, first: seen[key]+1, second: i+1, firstLine: lines[seen[key]].trim(), secondLine: line.trim() });
      } else {
        seen[key] = i;
      }
    }
  });
  return dupes;
}
var files = ['zh-CN/hr.ts', 'en-US/hr.ts'];
files.forEach(function(f) {
  var dupes = findDupes(path.join('src/locale', f));
  if (dupes.length) {
    console.log(f + ':');
    dupes.forEach(function(d) {
      console.log('  ' + d.key + ' at lines ' + d.first + ' and ' + d.second);
      console.log('    L' + d.first + ': ' + d.firstLine);
      console.log('    L' + d.second + ': ' + d.secondLine);
    });
  }
});
