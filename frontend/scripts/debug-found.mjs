import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const enFile = path.resolve(__dirname, '../src/locale/en-US/sys.ts');
const content = fs.readFileSync(enFile, 'utf-8');
const lines = content.split('\n');

// Find all __FOUND_CHINESE__ lines and show context
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('__FOUND_CHINESE__')) {
    console.log(`L${i+1}: ${JSON.stringify(lines[i])}`);
  }
}
