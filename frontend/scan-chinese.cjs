// Generate full list of mixed CN/EN entries for manual review
const fs = require('fs');
const path = require('path');

const enDir = path.resolve('C:\\mfg-platform_copy\\frontend\\src\\locale\\en-US');
const cnDir = path.resolve('C:\\mfg-platform_copy\\frontend\\src\\locale\\zh-CN');
const chineseRegex = /[\u4e00-\u9fff]/;
const files = fs.readdirSync(enDir).filter(f => f.endsWith('.ts'));
const badEntries = [];

for (const file of files) {
  const enContent = fs.readFileSync(path.join(enDir, file), 'utf-8');
  const cnContent = fs.readFileSync(path.join(cnDir, file), 'utf-8');
  const parsePairs = (content) => {
    const pairs = {};
    const regex = /['"]([^'"]+)['"]\s*:\s*['"]((?:[^'"\\]|\\.|\\\\|\\n|\\t)*)['"]/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
      pairs[m[1]] = m[2];
    }
    return pairs;
  };
  const enPairs = parsePairs(enContent);
  const cnPairs = parsePairs(cnContent);
  for (const [key, value] of Object.entries(enPairs)) {
    if (chineseRegex.test(value)) {
      badEntries.push({ file, key, enValue: value, cnValue: cnPairs[key] || '' });
    }
  }
}

// Output as JSON for processing
const outDir = path.resolve('C:\\mfg-platform_copy\\frontend');
fs.writeFileSync(path.join(outDir, 'bad-translations.json'), JSON.stringify(badEntries, null, 2));
console.log(`Wrote ${badEntries.length} entries to bad-translations.json`);
