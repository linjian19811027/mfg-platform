import { writeFileSync, readdirSync, statSync, readFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'src');
const baselinePath = join(__dirname, 'any-baseline.json');

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (p.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const findings = [];
for (const file of walk(root)) {
  const rel = relative(join(__dirname, '..'), file).replace(/\\/g, '/');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (/\bany\b/.test(line) || /Record<string,\s*any>/.test(line) || /as any\b/.test(line)) {
      findings.push(`${rel}:${idx + 1}:${line.trim()}`);
    }
  });
}

findings.sort();
writeFileSync(baselinePath, JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2));
console.log(`baseline written: ${findings.length} findings`);
