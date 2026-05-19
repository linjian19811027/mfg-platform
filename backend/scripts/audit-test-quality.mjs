import fs from 'fs'
import path from 'path'

const root = process.cwd()
const testDir = path.join(root, 'test')

const targets = [
  path.join(testDir, 'business-scenarios.spec.ts'),
  path.join(testDir, 'complete-api-test.spec.ts'),
  path.join(testDir, 'complete-api-test-fixed.spec.ts'),
]

const issues = []

function pushIssue(file, line, rule, snippet) {
  issues.push({ file: path.relative(root, file), line, rule, snippet: snippet.trim() })
}

for (const file of targets) {
  if (!fs.existsSync(file)) continue
  const content = fs.readFileSync(file, 'utf8')
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('expect(true).toBe(true)')) {
      pushIssue(file, i + 1, 'empty-assertion', line)
    }
    if (line.includes('expect([200, 201, 204]).toContain(') || line.includes('expect([200, 201]).toContain(')) {
      pushIssue(file, i + 1, 'weak-status-assertion', line)
    }
  }
}

if (issues.length > 0) {
  console.error(`Test quality audit failed: ${issues.length} issue(s) found`)
  for (const issue of issues.slice(0, 200)) {
    console.error(`- ${issue.file}:${issue.line} [${issue.rule}] ${issue.snippet}`)
  }
  if (issues.length > 200) {
    console.error(`... truncated ${issues.length - 200} more issue(s)`)
  }
  process.exit(1)
}

console.log('Test quality audit passed')
