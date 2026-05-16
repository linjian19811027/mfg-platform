/**
 * Fix TS6133: Remove unused `const { t } = useI18n()` from files 
 * that only use $t() in templates (not t() in script)
 * 
 * More precise: check if t( appears in script OUTSIDE of the declaration line
 */
const fs = require('fs')
const path = require('path')

function fixFile(fp) {
  let content = fs.readFileSync(fp, 'utf8')
  const lines = content.split('\n')
  
  let inScript = false
  let scriptStart = -1
  let scriptEnd = -1
  let hasTDeclaration = false
  let hasUseI18nImport = false
  let declarationLine = -1
  let importLine = -1
  let tUsedInScript = false
  
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l.match(/<script\s+setup/)) { inScript = true; scriptStart = i }
    if (l.match(/<\/script>/) && inScript) { scriptEnd = i; inScript = false }
    
    if (inScript) {
      if (l.includes('useI18n') && l.includes('import')) { hasUseI18nImport = true; importLine = i }
      if (l.match(/const\s*\{\s*t\s*\}\s*=\s*useI18n/)) { hasTDeclaration = true; declarationLine = i }
      
      // Check for t() usage that is NOT the declaration
      if (i !== declarationLine && i !== importLine) {
        // Match t(' or t(" — actual calls, not $t or part of other identifiers
        // Be careful: match standalone t( call, not part of $t( or const { t }
        const stripped = l.replace(/const\s*\{[^}]*t[^}]*\}\s*=\s*useI18n/, '') // remove declaration
        if (stripped.match(/\bt\s*\(\s*['"`]/)) {
          tUsedInScript = true
        }
      }
    }
  }
  
  if (!hasTDeclaration) return false // nothing to fix
  if (tUsedInScript) return false    // t is actually used
  
  // Remove the declaration line
  lines[declarationLine] = ''
  
  // Remove the import line
  if (importLine >= 0) {
    // Check if useI18n is the only import
    const importContent = lines[importLine]
    if (importContent.match(/import\s*\{\s*useI18n\s*\}\s*from/)) {
      lines[importLine] = ''
    } else {
      // Multiple imports, just remove useI18n
      lines[importLine] = importContent.replace(/,\s*useI18n|useI18n\s*,?\s*/g, '')
    }
  }
  
  // Clean up empty lines
  const newContent = lines.join('\n').replace(/\n{3,}/g, '\n\n')
  
  if (newContent !== content) {
    fs.writeFileSync(fp, newContent, 'utf8')
    return true
  }
  return false
}

let total = 0, fixed = 0
const fixedFiles = []
function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f)
    const st = fs.statSync(fp)
    if (st.isDirectory()) walk(fp)
    else if (f.endsWith('.vue')) { total++; if (fixFile(fp)) { fixed++; fixedFiles.push(fp) } }
  })
}

walk('src/views')
console.log(`Scanned: ${total}, Fixed: ${fixed}`)
fixedFiles.forEach(f => console.log(`  ${f}`))
