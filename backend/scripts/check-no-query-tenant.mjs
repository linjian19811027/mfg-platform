import { readdirSync, statSync, readFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'src', 'modules');

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (p.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const violations = [];
for (const file of walk(root)) {
  const rel = relative(join(__dirname, '..'), file).replace(/\\/g, '/');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes("@Query('tenantId')") || line.includes('@Query("tenantId")')) {
      violations.push(`${rel}:${i + 1}:${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error('[tenant-guard] found forbidden query tenantId usage:');
  for (const v of violations) console.error(`- ${v}`);
  process.exit(1);
}

console.log('[tenant-guard] passed.');
