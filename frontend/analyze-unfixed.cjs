const d = require('./unfixed-translations.json');
// Extract unique Chinese values that need translation
const u = {};
d.forEach(e => {
  if (!u[e.value]) u[e.value] = { keys: [], cnValues: new Set() };
  u[e.value].keys.push(e.key);
  if (e.cnValue) u[e.value].cnValues.add(e.cnValue);
});

const sorted = Object.entries(u).sort((a, b) => b[1].keys.length - a[1].keys.length);
console.log('Unique unfixed values:', sorted.length);
sorted.forEach(([v, info]) => {
  console.log(JSON.stringify(v) + ' (' + info.keys.length + ' keys) CN: ' + [...info.cnValues].join('|'));
});
