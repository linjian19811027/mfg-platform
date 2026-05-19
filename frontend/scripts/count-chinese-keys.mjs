import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zhDir = path.resolve(__dirname, '../src/locale/zh-CN');
const enDir = path.resolve(__dirname, '../src/locale/en-US');

const files = fs.readdirSync(zhDir).filter(f => f.endsWith('.ts') && f !== 'index.ts');

// Count keys with Chinese characters
const chineseKeyRegex = /'([^']*[\u4e00-\u9fff][^']*)'\s*:/g;

let totalChineseKeys = 0;
let totalKeys = 0;

for (const file of files) {
  const zhContent = fs.readFileSync(path.join(zhDir, file), 'utf-8');
  const enContent = fs.readFileSync(path.join(enDir, file), 'utf-8');
  
  const zhKeys = [...zhContent.matchAll(chineseKeyRegex)].map(m => m[1]);
  const enKeys = [...enContent.matchAll(chineseKeyRegex)].map(m => m[1]);
  
  const allKeyRegex = /'([^']+)'\s*:/g;
  const allZh = [...zhContent.matchAll(allKeyRegex)].map(m => m[1]);
  
  console.log(`${file}: ${zhKeys.length}/${allZh.length} Chinese keys in zh-CN, ${enKeys.length} Chinese keys in en-US`);
  totalChineseKeys += zhKeys.length;
  totalKeys += allZh.length;
}

console.log(`\nTotal: ${totalChineseKeys}/${totalKeys} keys contain Chinese characters`);
