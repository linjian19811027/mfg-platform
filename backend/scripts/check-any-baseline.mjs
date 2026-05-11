import { readFileSync, readdirSync, statSync } from 'fs';
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

function collectFindings() {
  const files = walk(root);
  const findings = [];
  for (const file of files) {
    const rel = relative(join(__dirname, '..'), file).replace(/\\/g, '/');
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (/\bany\b/.test(line) || /Record<string,\s*any>/.test(line) || /as any\b/.test(line)) {
        findings.push(`${rel}:${idx + 1}:${line.trim()}`);
      }
    });
  }
  return findings;
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const current = collectFindings();
const baselineSet = new Set(baseline.findings ?? []);
const newOnes = current.filter((f) => !baselineSet.has(f));

if (newOnes.length > 0) {
  console.error('[any-guard] new any usage detected:');
  for (const item of newOnes) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`[any-guard] passed. current findings=${current.length}, baseline=${baselineSet.size}`);
