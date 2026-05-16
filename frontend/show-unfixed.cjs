const d = require('./unfixed-r3.json');
const u = {};
d.forEach(e => { if (!u[e.value]) u[e.value] = 0; u[e.value]++; });
const sorted = Object.entries(u).sort((a, b) => b[1] - a[1]);
sorted.forEach(([v, c]) => console.log(`  '${v}': '',  // ${c} keys`));
