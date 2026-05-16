/**
 * i18n 校验：检查 en-US 本地化文件的 value 中是否混入中文字符
 * 用法：node scripts/check-i18n-en.mjs
 * CI 中使用：有中文则返回 exit code 1
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../src/locale/en-US');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

const chineseRegex = /[\u4e00-\u9fff]/;
const lineRegex = /^\s*'[^']*'\s*:\s*'((?:[^'\\]|\\.)*)'\s*[,}]/;

const errors = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(lineRegex);
    if (match) {
      const value = match[1].replace(/\\'/g, "'");
      if (chineseRegex.test(value)) {
        errors.push({ file, line: i + 1, text: line.trim() });
      }
    }
  }
}

if (errors.length === 0) {
  console.log('✅ i18n check passed: no Chinese characters found in en-US values.');
  process.exit(0);
} else {
  console.error(`❌ i18n check failed: found ${errors.length} line(s) with Chinese in en-US values:\n`);
  const grouped = {};
  for (const e of errors) {
    if (!grouped[e.file]) grouped[e.file] = [];
    grouped[e.file].push(e);
  }
  for (const [file, items] of Object.entries(grouped)) {
    console.error(`  ${file} (${items.length} lines):`);
    items.forEach(e => console.error(`    L${e.line}: ${e.text}`));
  }
  console.error('\nPlease translate all Chinese values to English in the en-US locale files.');
  process.exit(1);
}
