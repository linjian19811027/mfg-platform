import fs from 'fs';
import path from 'path';

const dir = path.resolve('C:\\mfg-platform_copy\\frontend\\src\\locale\\en-US');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

const chineseRegex = /[\u4e00-\u9fff]/;
// Match locale value: the part between single quotes after the colon
// Handles escaped quotes like \'
const lineRegex = /^\s*'[^']*'\s*:\s*'((?:[^'\\]|\\.)*)'\s*[,}]/;

const results = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(lineRegex);
    if (match) {
      const value = match[1];
      // Unescape for checking
      const unescaped = value.replace(/\\'/g, "'");
      if (chineseRegex.test(unescaped)) {
        results.push({ file, line: i + 1, text: line.trim() });
      }
    }
  }
}

console.log(`Found ${results.length} lines with Chinese in en-US VALUES:\n`);
const grouped = {};
for (const r of results) {
  if (!grouped[r.file]) grouped[r.file] = [];
  grouped[r.file].push(r);
}
for (const [file, items] of Object.entries(grouped)) {
  console.log(`\n=== ${file} (${items.length} lines) ===`);
  items.forEach(r => console.log(`  L${r.line}: ${r.text}`));
}
