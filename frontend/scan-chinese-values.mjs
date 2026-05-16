import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve('C:\\mfg-platform_copy\\frontend\\src\\locale\\en-US');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

const chineseRegex = /[\u4e00-\u9fff]/;
const lineRegex = /^[\s']*([^']+)'[\s]*:[\s]*'(.+)'[\s]*,?[\s]*$/;
const lineRegex2 = /^[\s]*"([^"]+)"[\s]*:[\s]*"(.+)"[\s]*,?[\s]*$/;

const mixedResults = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Only check lines that are key-value pairs
    const m1 = lineRegex.exec(line);
    const m2 = lineRegex2.exec(line);
    const m = m1 || m2;
    if (m) {
      const key = m[1];
      const value = m[2];
      // Check if VALUE contains Chinese characters
      if (chineseRegex.test(value)) {
        mixedResults.push({ file, line: i+1, key, value, raw: line.trim() });
      }
    }
  }
}

// Group by file
const byFile = {};
for (const r of mixedResults) {
  if (!byFile[r.file]) byFile[r.file] = [];
  byFile[r.file].push(r);
}

console.log(`\n=== TOTAL: ${mixedResults.length} entries with Chinese in English VALUES ===\n`);
for (const [file, items] of Object.entries(byFile)) {
  console.log(`\n--- ${file} (${items.length} issues) ---`);
  items.forEach(r => console.log(`  L${r.line}: ${r.key} => ${r.value}`));
}
