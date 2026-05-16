// Extract all Chinese i18n keys from Vue files and output which keys each locale file needs
const fs = require('fs');
const path = require('path');

const dirs = ['plm', 'wms', 'erp', 'mes', 'eam', 'qms', 'scm', 'base', 'outsourcing', 'traceability'];
const allKeys = {};

dirs.forEach(d => {
  function walk(dir) {
    fs.readdirSync(dir).forEach(f => {
      const fp = path.join(dir, f);
      if (fs.statSync(fp).isDirectory()) walk(fp);
      else if (f.endsWith('.vue')) {
        const c = fs.readFileSync(fp, 'utf8');
        // Match t('module.chinese') patterns
        const re = /t\('([\w-]+\.[\u4e00-\u9fff][^']*)'\)/g;
        let m;
        while ((m = re.exec(c)) !== null) {
          const key = m[1];
          // Module prefix is the first segment
          const mod = key.split('.')[0];
          if (!allKeys[mod]) allKeys[mod] = new Set();
          allKeys[mod].add(key);
        }
      }
    });
  }
  walk(path.join('src', 'views', d));
});

// Also check aps
function walkAps(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) walkAps(fp);
    else if (f.endsWith('.vue')) {
      const c = fs.readFileSync(fp, 'utf8');
      const re = /t\('([\w-]+\.[\u4e00-\u9fff][^']*)'\)/g;
      let m;
      while ((m = re.exec(c)) !== null) {
        const key = m[1];
        const mod = key.split('.')[0];
        if (!allKeys[mod]) allKeys[mod] = new Set();
        allKeys[mod].add(key);
      }
    }
  });
}
walkAps(path.join('src', 'views', 'aps'));

// Now check existing locale files
const localeDir = path.join('src', 'locale', 'zh-CN');
const missingByModule = {};

Object.keys(allKeys).forEach(mod => {
  const localeFile = path.join(localeDir, mod + '.ts');
  let existingContent = '';
  if (fs.existsSync(localeFile)) {
    existingContent = fs.readFileSync(localeFile, 'utf8');
  }
  
  const missing = [];
  allKeys[mod].forEach(key => {
    // Check if the key path exists in the locale content
    // The key like 'base.质量状态已变更' means we need '质量状态已变更' in the base locale
    const keyParts = key.split('.');
    const leafKey = keyParts[keyParts.length - 1];
    // Simple check: look for the leaf key as a property
    const keyPattern = new RegExp(`['"]${leafKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*:`);
    if (!keyPattern.test(existingContent)) {
      missing.push(key);
    }
  });
  
  if (missing.length > 0) {
    missingByModule[mod] = missing;
  }
});

// Output results
Object.keys(missingByModule).sort().forEach(mod => {
  console.log(`\n=== ${mod} (missing ${missingByModule[mod].length} keys) ===`);
  missingByModule[mod].sort().forEach(k => console.log(`  ${k}`));
});
