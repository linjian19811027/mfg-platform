// Auto-fix: replace Chinese in en-US locale files with proper English translations
// Strategy: for each key in en-US that contains Chinese chars, use the zh-CN value as reference
// to produce a proper English translation
const fs = require('fs');
const path = require('path');

const enDir = path.resolve('C:\\mfg-platform_copy\\frontend\\src\\locale\\en-US');
const cnDir = path.resolve('C:\\mfg-platform_copy\\frontend\\src\\locale\\zh-CN');
const chineseRegex = /[\u4e00-\u9fff]/;

// Comprehensive Chinese-to-English dictionary for manufacturing domain
const dict = {
  // --- Common verbs/actions ---
  '新建': 'Create', '创建': 'Create', '编辑': 'Edit', '删除': 'Delete', '查看': 'View',
  '搜索': 'Search', '查询': 'Search', '筛选': 'Filter', '导出': 'Export', '导入': 'Import',
  '保存': 'Save', '取消': 'Cancel', '确认': 'Confirm', '提交': 'Submit', '审核': 'Approve',
  '审批': 'Approve', '驳回': 'Reject', '撤回': 'Withdraw', '关闭': 'Close', '返回': 'Back',
  '刷新': 'Refresh', '重置': 'Reset', '复制': 'Copy', '下载': 'Download', '上传': 'Upload',
  '启用': 'Enable', '停用': 'Disable', '激活': 'Activate', '废止': 'Obsolete',
  '添加': 'Add', '移除': 'Remove', '修改': 'Modify', '变更': 'Change',
  '打印': 'Print', '预览': 'Preview', '选择': 'Select', '清空': 'Clear',
  '展开': 'Expand', '收起': 'Collapse', '排序': 'Sort', '分组': 'Group',
  '上报': 'Report', '接单': 'Accept', '派工': 'Dispatch', '报工': 'Report Work',
  '领料': 'Pick Material', '退料': 'Return Material', '入库': 'Inbound', '出库': 'Outbound',
  '发料': 'Issue', '收料': 'Receive', '盘点': 'Count', '调拨': 'Transfer',
  '冻结': 'Freeze', '解冻': 'Unfreeze', '锁定': 'Lock', '解锁': 'Unlock',
  '分配': 'Allocate', '合并': 'Merge', '拆分': 'Split', '转换': 'Convert',
  '触发': 'Trigger', '执行': 'Execute', '监控': 'Monitor', '追溯': 'Trace',
  '召回': 'Recall', '释放': 'Release', '占用': 'Occupy', '预留': 'Reserve',
  '完成': 'Complete', '开始': 'Start', '结束': 'End', '暂停': 'Pause', '恢复': 'Resume',
  '终止': 'Terminate', '取消报工': 'Cancel Report',
  
  // --- Common nouns ---
  '基本信息': 'Basic Info', '详细信息': 'Detail Info', '操作': 'Action', '操作人': 'Operator',
  '状态': 'Status', '类型': 'Type', '分类': 'Category', '编码': 'Code', '名称': 'Name',
  '描述': 'Description', '备注': 'Remark', '数量': 'Quantity', '金额': 'Amount',
  '日期': 'Date', '时间': 'Time', '序号': 'Seq', '编号': 'No.',
  '规则': 'Rule', '模板': 'Template', '方案': 'Plan', '策略': 'Strategy',
  '版本': 'Version', '标签': 'Tag', '附件': 'Attachment', '图片': 'Image',
  '文档': 'Document', '表格': 'Spreadsheet', '视频': 'Video', '音频': 'Audio',
  '参数': 'Parameter', '配置': 'Config', '设置': 'Settings', '选项': 'Option',
  '权限': 'Permission', '角色': 'Role', '用户': 'User', '组织': 'Organization',
  '部门': 'Department', '岗位': 'Position', '员工': 'Employee', '租户': 'Tenant',
  '菜单': 'Menu', '按钮': 'Button', '页面': 'Page', '模块': 'Module',
  '系统': 'System', '日志': 'Log', '记录': 'Record', '历史': 'History',
  '通知': 'Notification', '消息': 'Message', '预警': 'Alert', '提醒': 'Reminder',
  
  // --- Manufacturing specific ---
  '工序': 'Operation', '工序名称': 'Operation Name', '工序编码': 'Operation Code',
  '工序Code': 'Operation Code', '工序Name': 'Operation Name',
  '标准工序': 'Standard Operation', '标准工序库': 'Standard Operation Library',
  '工艺路线': 'Routing', '工作中心': 'Work Center', '默认工作中心': 'Default Work Center',
  '标准工时': 'Std Duration', '标准作业时间': 'Std Duration',
  '准备时间': 'Setup Time', '换模/准备时间': 'Changeover/Setup Time',
  '描述': 'Description', '要点': 'Key Points',
  '工单': 'Work Order', '生产工单': 'Work Order', '子工单': 'Sub Work Order',
  '批次': 'Batch', '批号': 'Batch No.', '产品': 'Product', '物料': 'Material',
  '零件': 'Part', '组件': 'Component', '半成品': 'Semi-finished', '成品': 'Finished Good',
  '原料': 'Raw Material', 'BOM': 'BOM', 'BOM管理': 'BOM Management',
  '生产': 'Production', '生产计划': 'Production Plan', '生产订单': 'Production Order',
  '排程': 'Schedule', '排产': 'Scheduling', '产能': 'Capacity',
  '设备': 'Equipment', '设备类别': 'Equipment Category', '设备编号': 'Equipment Code',
  '故障': 'Fault', '故障现象': 'Fault Symptom', '维修': 'Maintenance', '保养': 'Maintenance',
  '点检': 'Inspection', '润滑': 'Lubrication', '巡检': 'Patrol Inspection',
  '质量': 'Quality', '质量检验': 'Quality Inspection', '质量Inspection记录': 'Quality Inspection Records',
  '检验': 'Inspection', '检验项': 'Inspection Item', '检测': 'Test',
  '合格': 'Qualified', '不合格': 'Unqualified', '良品': 'Good', '不良品': 'Defect',
  '报废': 'Scrap', '返工': 'Rework', '让步接收': 'Concession Accept',
  '仓库': 'Warehouse', '库位': 'Location', '库区': 'Zone', '容器': 'Container',
  '库存': 'Inventory', '在库': 'In Stock', '在库数量': 'In Stock Qty',
  '在库待发数量': 'Pending Ship Qty', '入库单': 'Inbound Order', '出库单': 'Outbound Order',
  '拣货': 'Picking', '拣货任务': 'Picking Task', '上架': 'Putaway',
  '盘点': 'Inventory Count', '盘点明细': 'Count Detail',
  '调拨': 'Transfer', '移库': 'Move', '补货': 'Replenishment',
  '供应商': 'Supplier', '客户': 'Customer', '采购': 'Purchase', '采购单': 'Purchase Order',
  '销售': 'Sales', '销售单': 'Sales Order', '发货': 'Ship', '收货': 'Receive',
  '外包': 'Outsourcing', '委外': 'Outsourcing',
  '变更': 'Change', '变更申请': 'Change Request', '变更通知': 'Change Notice',
  'ECR': 'ECR', 'ECN': 'ECN', 'ECN执行计划': 'ECN Execution Plan',
  
  // --- Status words ---
  '已计划': 'Planned', '已开始': 'Started', '已完成': 'Completed', '已取消': 'Cancelled',
  '已关闭': 'Closed', '已提交': 'Submitted', '已审核': 'Approved', '已驳回': 'Rejected',
  '已启用': 'Enabled', '已停用': 'Disabled', '已激活': 'Activated', '已废止': 'Obsoleted',
  '已上报': 'Reported', '已逾期': 'Overdue', '已过期': 'Expired', '即将到期': 'Expiring Soon',
  '已分配': 'Allocated', '已预留': 'Reserved', '已冻结': 'Frozen', '已释放': 'Released',
  '已入库': 'Inbounded', '已出库': 'Outbounded', '已收货': 'Received', '已发货': 'Shipped',
  '草稿': 'Draft', '进行中': 'In Progress', '待处理': 'Pending', '待审核': 'Pending Approval',
  '响应中': 'Responding', '诊断中': 'Diagnosing', '维修中': 'Repairing',
  '逾期': 'Overdue', '逾期润滑': 'Overdue Lubrication',
  
  // --- Priority/Level ---
  '严重程度': 'Severity', '高': 'High', '中': 'Medium', '低': 'Low',
  '紧急': 'Urgent', '一般': 'Normal',
  'A类（关键）': 'Class A (Critical)', 'B类（重要）': 'Class B (Important)', 'C类（一般）': 'Class C (General)',
  
  // --- Equipment specific ---
  '安装日期': 'Install Date', '额定功率': 'Rated Power', '额定电压': 'Rated Voltage',
  '额定电流': 'Rated Current', '转速': 'Speed', '精度等级': 'Accuracy Grade',
  '工作温度范围': 'Operating Temp Range', '防护等级': 'Protection Grade',
  '资产编号': 'Asset Code', '原值': 'Original Value', '净值': 'Net Value',
  '折旧方法': 'Depreciation Method', '折旧年限': 'Depreciation Life',
  '累计折旧': 'Accumulated Depreciation', '残值率': 'Residual Rate',
  '购置日期': 'Purchase Date', '车间': 'Workshop',
  '次数': 'Count', '完整': 'Complete',
  
  // --- Common phrases ---
  '请输入': 'Please input', '请选择': 'Please select', '请填写': 'Please fill in',
  '确认删除': 'Confirm Delete', '确认变更': 'Confirm Change',
  '无权限访问': 'No Permission', '您没有访问该页面的权限': 'You do not have permission to access this page',
  '返回首页': 'Back to Home',
  '变更记录接口待后端开发，数据暂不可用': 'Change log API pending backend development, data temporarily unavailable',
  '添加项目': 'Add Item', '点检完成，发现异常项！': 'Inspection completed, abnormalities found!',
  '点检完成，一切正常': 'Inspection completed, all normal',
  '原因分析': 'Root Cause Analysis', '解决方案': 'Solution', '预防措施': 'Preventive Measure',
  '知识条目': 'Knowledge Entry',
  '含数据缺失节点': 'Contains Missing Data Nodes',
  '冻结原因': 'Freeze Reason', '净变化': 'Net Change',
  '来源单据': 'Source Document',
  '个角色': 'Role(s)', '模块的所有权限集合': 'All permissions of the module',
  '只能包含字母、数字、横线和下划线': 'Only letters, numbers, hyphens and underscores allowed',
  '件': 'pcs', '天': 'day(s)', '分钟': 'min', '年': 'year(s)', '元': 'CNY',
  '手工电弧焊': 'Manual Arc Welding',
  '监控生产进度': 'Monitor Production Progress',
  '查看详细报告': 'View Detail Report',
  '总节点数': 'Total Nodes',
  '正向追溯': 'Forward Trace', '反向追溯': 'Backward Trace',
  '延迟': 'Delay', '正常': 'Normal', '异常': 'Abnormal',
  '规则编码': 'Rule Code', '规则名称': 'Rule Name',
  '质量状态': 'Quality Status', '质量Status': 'Quality Status',
  '库存流水': 'Inventory Ledger', '基本信息': 'Basic Info',
  '请选择新状态': 'Please select new status', '请选择新Status': 'Please select new status',
  '请填写变更原因': 'Please fill in the change reason',
  'Change变更': 'Confirm Change',
  
  // --- Mixed patterns that appear ---
  'Create标准工序': 'Create Standard Operation',
  'Edit标准工序': 'Edit Standard Operation',
  '已Enable': 'Enabled', '已Disable': 'Disabled',
  '工序Action要点Description': 'Operation Key Points & Description',
  '工序Code': 'Operation Code', '工序Name': 'Operation Name',
  '请输入SupplierID': 'Please input Supplier ID',
  '请输入工序Name': 'Please input Operation Name',
  '请输入MaterialID': 'Please input Material ID',
  '请输入计划Quantity': 'Please input Planned Quantity',
  '请选择计划交期': 'Please select Planned Delivery Date',
  '上报Fault': 'Report Fault',
  'Fault现象': 'Fault Symptom',
  'Create点检记录': 'Create Inspection Record',
  '点检完成，一切Normal': 'Inspection completed, all normal',
  'Create知识items目': 'Create Knowledge Entry',
  'Frozen原因': 'Freeze Reason',
  '含Data Missing节点': 'Contains Missing Data Nodes',
  '监控Production进度': 'Monitor Production Progress',
  'View详细报告': 'View Detail Report',
  '规则Code': 'Rule Code', '规则Name': 'Rule Name',
  '如 手工电弧焊': 'e.g. Manual Arc Welding',
  '准备时间 (分钟)': 'Setup Time (min)',
  '描述': 'Description',
  'Confirm变更': 'Confirm Change',
  '质量Inspection记录': 'Quality Inspection Records',
  '逾期润滑': 'Overdue Lubrication',
  '拣货任务': 'Picking Task',
  '盘点明细': 'Count Detail',
};

// Parse a locale TS file into { key: value } pairs, preserving structure
function parseLocaleFile(content) {
  const pairs = {};
  // Match patterns like 'key': 'value' or "key": "value"
  const regex = /^\s*['"]([^'"]+)['"]\s*:\s*['"]((?:[^'"\\]|\\.|\\\\)*)['"]/gm;
  let m;
  while ((m = regex.exec(content)) !== null) {
    pairs[m[1]] = { value: m[2], index: m.index, length: m[0].length, fullMatch: m[0] };
  }
  return pairs;
}

// Translate a Chinese string to English using dictionary
function translateToEnglish(cnValue, existingEnValue) {
  // If the existing EN value is a mixed CN/EN string, we need to translate
  // Strategy: try full match first, then try replacing Chinese parts
  
  // Full match
  if (dict[cnValue]) return dict[cnValue];
  
  // Try to replace Chinese segments in the mixed string
  let result = existingEnValue || cnValue;
  
  // Sort dictionary keys by length (longest first) for greedy matching
  const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);
  
  for (const cn of sortedKeys) {
    const en = dict[cn];
    if (result.includes(cn)) {
      result = result.split(cn).join(en);
    }
  }
  
  // If still contains Chinese after replacement, try character-by-character for remaining
  if (chineseRegex.test(result)) {
    // Common single character mappings
    const charMap = {
      '的': ' ', '和': ' & ', '或': ' or ', '中': '', '了': '',
      '在': 'In ', '不': 'Not ', '无': 'No ', '有': 'Has ',
      '是': 'Is ', '可': 'Can ', '将': 'Will ',
    };
    for (const [ch, en] of Object.entries(charMap)) {
      result = result.split(ch).join(en);
    }
  }
  
  // Clean up extra spaces
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

// Process each file
const files = fs.readdirSync(enDir).filter(f => f.endsWith('.ts'));
let totalFixed = 0;
const fixes = [];

for (const file of files) {
  const enPath = path.join(enDir, file);
  const cnPath = path.join(cnDir, file);
  
  let enContent = fs.readFileSync(enPath, 'utf-8');
  const cnContent = fs.existsSync(cnPath) ? fs.readFileSync(cnPath, 'utf-8') : '';
  
  const enPairs = parseLocaleFile(enContent);
  const cnPairs = parseLocaleFile(cnContent);
  
  // Collect replacements to make (process in reverse order to preserve indices)
  const replacements = [];
  
  for (const [key, info] of Object.entries(enPairs)) {
    if (!chineseRegex.test(info.value)) continue;
    
    // Get the Chinese value for reference
    const cnValue = cnPairs[key]?.value || info.value;
    
    // Translate
    const newEnValue = translateToEnglish(cnValue, info.value);
    
    if (newEnValue !== info.value && !chineseRegex.test(newEnValue)) {
      replacements.push({
        index: info.index,
        length: info.fullMatch.length,
        oldMatch: info.fullMatch,
        key,
        oldValue: info.value,
        newValue: newEnValue,
      });
    } else if (chineseRegex.test(newEnValue)) {
      // Still has Chinese - log it for manual review
      fixes.push({ file, key, cnValue, oldEn: info.value, newEn: newEnValue, stillHasChinese: true });
    }
  }
  
  // Apply replacements in reverse order
  replacements.sort((a, b) => b.index - a.index);
  for (const r of replacements) {
    const oldStr = `'${r.key}': '${r.oldValue}'`;
    const newStr = `'${r.key}': '${r.newValue}'`;
    // Also try double quotes
    const oldStr2 = `"${r.key}": "${r.oldValue}"`;
    const newStr2 = `"${r.key}": "${r.newValue}"`;
    
    if (enContent.includes(oldStr)) {
      enContent = enContent.replace(oldStr, newStr);
      totalFixed++;
      fixes.push({ file, key: r.key, cnValue: cnPairs[r.key]?.value || '', oldEn: r.oldValue, newEn: r.newValue });
    } else if (enContent.includes(oldStr2)) {
      enContent = enContent.replace(oldStr2, newStr2);
      totalFixed++;
      fixes.push({ file, key: r.key, cnValue: cnPairs[r.key]?.value || '', oldEn: r.oldValue, newEn: r.newValue });
    }
  }
  
  fs.writeFileSync(enPath, enContent, 'utf-8');
}

// Write fix report
const reportPath = path.resolve('C:\\mfg-platform_copy\\frontend\\fix-report.json');
fs.writeFileSync(reportPath, JSON.stringify({ totalFixed, fixes }, null, 2), 'utf-8');

console.log(`Fixed ${totalFixed} entries across ${files.length} files`);
console.log(`Report written to fix-report.json`);

// Count remaining Chinese
let remaining = 0;
for (const file of files) {
  const enContent = fs.readFileSync(path.join(enDir, file), 'utf-8');
  const enPairs = parseLocaleFile(enContent);
  for (const [key, info] of Object.entries(enPairs)) {
    if (chineseRegex.test(info.value)) remaining++;
  }
}
console.log(`Remaining entries with Chinese: ${remaining}`);
