import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'src', 'modules');

const forbiddenEntityPatterns = [/@ManyToOne\s*\(/, /@OneToOne\s*\(/, /@JoinColumn\s*\(/];
const forbiddenSqlPatterns = [/FOREIGN\s+KEY/i, /REFERENCES\s+`?\w+`?\s*\(/i];
const legacyAllowList = [
  'src/modules/hr/migrations/001_hr_tables.sql',
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const files = walk(root);
const violations = [];

for (const file of files) {
  const normalized = file.replace(/\\/g, '/');
  if (legacyAllowList.some((p) => normalized.endsWith(p))) continue;

  if (file.endsWith('.entity.ts')) {
    const text = readFileSync(file, 'utf8');
    if (forbiddenEntityPatterns.some((re) => re.test(text))) {
      violations.push({ file, reason: 'entity relation decorator that may generate FK' });
    }
  }

  if (file.endsWith('.sql')) {
    const text = readFileSync(file, 'utf8');
    if (forbiddenSqlPatterns.some((re) => re.test(text))) {
      violations.push({ file, reason: 'sql contains FOREIGN KEY/REFERENCES' });
    }
  }
}

if (violations.length > 0) {
  console.error('[arch-check] foreign key related violations:');
  for (const v of violations) {
    console.error(`- ${v.file}: ${v.reason}`);
  }
  process.exit(1);
}

console.log('[arch-check] passed: no foreign key decorators or sql constraints found.');
