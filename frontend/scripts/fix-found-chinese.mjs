/**
 * Fix __FOUND_CHINESE__ keys in en-US locale files by replacing them
 * with the corresponding key from zh-CN files (matched by pair position).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const enDir = path.resolve(__dirname, '../src/locale/en-US');
const zhDir = path.resolve(__dirname, '../src/locale/zh-CN');

const files = fs.readdirSync(enDir).filter(f => f.endsWith('.ts'));

// Regex for normal quoted key-value pairs
const kvRegex = /^\s*'([^']*)'\s*:\s*'((?:[^'\\]|\\.)*)'\s*[,}]/;
// Regex for __FOUND_CHINESE__ entries (no quotes around key)
const fcRegex = /^\s*__FOUND_CHINESE__\s*:\s*'((?:[^'\\]|\\.)*)'\s*[,}]/;

let totalFixed = 0;

for (const file of files) {
  const enContent = fs.readFileSync(path.join(enDir, file), 'utf-8');
  if (!enContent.includes('__FOUND_CHINESE__')) continue;

  const zhContent = fs.readFileSync(path.join(zhDir, file), 'utf-8');

  // Parse zh-CN into ordered key-value pairs
  const zhPairs = [];
  for (const line of zhContent.split('\n')) {
    const m = line.match(kvRegex);
    if (m) zhPairs.push(m[1]);
  }

  // Parse en-US: for each __FOUND_CHINESE__, use the zh-CN key at same pair index
  const enLines = enContent.split('\n');
  let pairIdx = 0;
  let fixCount = 0;
  const newLines = [];

  for (const line of enLines) {
    const fcMatch = line.match(fcRegex);
    if (fcMatch) {
      // This is a __FOUND_CHINESE__ line - get zh-CN key at current pair index
      if (pairIdx < zhPairs.length) {
        const zhKey = zhPairs[pairIdx];
        const enValue = fcMatch[1];
        const indent = line.match(/^(\s*)/)[1];
        newLines.push(`${indent}'${zhKey}': '${enValue}',`);
        fixCount++;
      } else {
        newLines.push(line);
      }
      pairIdx++;
    } else {
      // Check if it's a normal key-value line to advance pair index
      const kvMatch = line.match(kvRegex);
      if (kvMatch) pairIdx++;
      newLines.push(line);
    }
  }

  fs.writeFileSync(path.join(enDir, file), newLines.join('\n'), 'utf-8');
  console.log(`${file}: fixed ${fixCount} __FOUND_CHINESE__ keys`);
  totalFixed += fixCount;
}

console.log(`\nTotal fixed: ${totalFixed}`);
