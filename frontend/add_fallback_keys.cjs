// Add fallback message keys to locale files
const fs = require('fs');
const path = require('path');

const newKeys = {
  mes: ['删除失败', '加载失败', '操作失败', '重试失败'],
  outsourcing: ['加载失败', '导出失败', '操作失败'],
  plm: ['修改失败', '加载失败', '操作失败', '触发失败'],
  sys: ['加载失败'],
  traceability: ['冻结失败', '加载失败', '加载看板失败', '加载覆盖率失败', '导出失败', '生成失败', '评估失败', '追溯失败'],
};

const enMap = {
  '删除失败': 'Delete failed',
  '加载失败': 'Load failed',
  '操作失败': 'Operation failed',
  '重试失败': 'Retry failed',
  '导出失败': 'Export failed',
  '修改失败': 'Modify failed',
  '触发失败': 'Trigger failed',
  '冻结失败': 'Freeze failed',
  '加载看板失败': 'Load dashboard failed',
  '加载覆盖率失败': 'Load coverage failed',
  '生成失败': 'Generate failed',
  '评估失败': 'Assessment failed',
  '追溯失败': 'Trace failed',
};

Object.keys(newKeys).forEach(mod => {
  // zh-CN
  const zhPath = path.join('src', 'locale', 'zh-CN', mod + '.ts');
  let zhContent = fs.readFileSync(zhPath, 'utf8');
  const zhKeys = newKeys[mod].filter(k => !zhContent.includes(`'${k}':`)).map(k => `  '${k}': '${k}'`).join(',\n');
  if (zhKeys) {
    const lastBrace = zhContent.lastIndexOf('}');
    const beforeBrace = zhContent.substring(0, lastBrace).trimEnd();
    const needsComma = !beforeBrace.endsWith(',') && !beforeBrace.endsWith('{');
    zhContent = zhContent.substring(0, lastBrace) + (needsComma ? ',\n' : '\n') + zhKeys + ',\n' + zhContent.substring(lastBrace);
    fs.writeFileSync(zhPath, zhContent, 'utf8');
  }
  
  // en-US
  const enPath = path.join('src', 'locale', 'en-US', mod + '.ts');
  let enContent = fs.readFileSync(enPath, 'utf8');
  const enKeys = newKeys[mod].filter(k => !enContent.includes(`'${k}':`)).map(k => `  '${k}': '${enMap[k] || k}'`).join(',\n');
  if (enKeys) {
    const lastBrace = enContent.lastIndexOf('}');
    const beforeBrace = enContent.substring(0, lastBrace).trimEnd();
    const needsComma = !beforeBrace.endsWith(',') && !beforeBrace.endsWith('{');
    enContent = enContent.substring(0, lastBrace) + (needsComma ? ',\n' : '\n') + enKeys + ',\n' + enContent.substring(lastBrace);
    fs.writeFileSync(enPath, enContent, 'utf8');
  }
  
  console.log(`Added keys to ${mod}`);
});
console.log('Done!');
