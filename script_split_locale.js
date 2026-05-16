const fs = require('fs');
const path = require('path');

const BASE = path.resolve('C:\\mfg-platform_copy\\frontend\\src\\locale');

function splitLocaleFile(lang) {
  const filePath = path.join(BASE, `${lang}.ts`);
  const content = fs.readFileSync(filePath, 'utf-8');

  const lines = content.split('\n');
  // First line: export default {
  // Last line (trimmed match): };
  const bodyLines = lines.slice(1, -1);

  // Collect ALL keys grouped by module prefix
  // Each entry: { line: string, module: string }
  const moduleLines = {};  // modName -> string[]

  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      // Comment or blank — attach to current module or skip
      // We'll just skip comments to avoid the interleaving issue
      continue;
    }
    const match = trimmed.match(/^'([^.]+)\./);
    if (!match) continue;
    const mod = match[1];
    if (!moduleLines[mod]) moduleLines[mod] = [];
    moduleLines[mod].push(line);
  }

  // Also grab all comments/blank lines that appeared between module lines
  // Actually simpler: just process key-value lines. The comments from the
  // original flat file won't be copied. That's fine — they're noise.

  // Create output directory
  const outDir = path.join(BASE, lang);
  fs.mkdirSync(outDir, { recursive: true });

  // Write each module file
  const sortedMods = Object.keys(moduleLines).sort();
  for (const mod of sortedMods) {
    const modLines = moduleLines[mod];
    // Ensure the last line has no trailing comma
    if (modLines.length > 0) {
      modLines[modLines.length - 1] = modLines[modLines.length - 1].replace(/,$/, '');
    }
    const fileContent = `export default {\n${modLines.join('\n')}\n}\n`;
    fs.writeFileSync(path.join(outDir, `${mod}.ts`), fileContent, 'utf-8');
  }

  // Write index.ts in lang folder
  const importLines = sortedMods.map(m => `import ${m} from './${m}';`);
  const spreadLines = sortedMods.map(m => `  ...${m},`).join('\n');
  const indexContent = `// Auto-generated from ${lang}.ts\n${importLines.join('\n')}\n\nexport default {\n${spreadLines}\n}\n`;
  fs.writeFileSync(path.join(outDir, `index.ts`), indexContent, 'utf-8');

  console.log(`✓ Split ${lang}.ts into ${sortedMods.length} module files (${Object.values(moduleLines).reduce((a,b) => a + b.length, 0)} total keys)`);
}

splitLocaleFile('zh-CN');
splitLocaleFile('en-US');
// Also keep the original flat files as fallback
console.log('Done!');
