// Precise fix: Only replace the VALUE part of en-US entries that contain Chinese characters
// Uses exact key-value matching to avoid corrupting properly translated entries
const fs = require('fs');
const path = require('path');

const enDir = path.resolve('C:\\mfg-platform_copy\\frontend\\src\\locale\\en-US');
const cnDir = path.resolve('C:\\mfg-platform_copy\\frontend\\src\\locale\\zh-CN');
const chineseRegex = /[\u4e00-\u9fff]/;

// Parse a locale .ts file into an array of { key, value, raw } entries
function parseLocaleFile(content) {
  const entries = [];
  // Match: 'key': 'value', or "key": "value",
  // Handle escaped quotes, backticks, template literals etc.
  const regex = /^\s*'([^']+)'\s*:\s*'((?:[^'\\]|\\.)*)'\s*(,?)\s*$/gm;
  let m;
  while ((m = regex.exec(content)) !== null) {
    entries.push({
      key: m[1],
      value: m[2],
      comma: m[3],
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0]
    });
  }
  return entries;
}

// Comprehensive translation map: Chinese value → English value
// Only for values that appear in en-US files (which should be English but have Chinese)
const translationMap = {
  // === Standard Operation (标准工序库) - Priority fix ===
  'Create标准工序': 'Create Standard Operation',
  'Edit标准工序': 'Edit Standard Operation',
  '如 OP-WELD-01': 'e.g. OP-WELD-01',
  '如 手工电弧焊': 'e.g. Manual Arc Welding',
  '标准作业时间': 'Standard Duration',
  '换模/准备时间': 'Setup/Changeover Time',
  '工序Action要点Description': 'Operation Key Points',
  '工序Code': 'Operation Code',
  '工序Name': 'Operation Name',
  '默认工作中心': 'Default Work Center',
  '标准工时': 'Standard Hours',
  '准备时间': 'Setup Time',
  '已Enable': 'Enabled',
  '已Disable': 'Disabled',
  '工序Code/Name': 'Operation Code/Name',
  '准备时间 (分钟)': 'Setup Time (min)',
  '描述': 'Description',
  
  // === APS module ===
  '日': 'Day',
  '周': 'Week',
  '月': 'Month',
  '开始日期': 'Start Date',
  '结束日期': 'End Date',
  '待排程': 'Pending Scheduling',
  '已Cancel': 'Cancelled',
  '冲突': 'Conflict',
  '触发 MRP 计算': 'Trigger MRP Calculation',
  '计算中': 'Calculating',
  '失败': 'Failed',
  '待计算': 'Pending Calculation',
  'View结果': 'View Results',
  '发布': 'Publish',
  '预测需求': 'Forecast Demand',
  'MRP 计算已触发，请稍后RefreshView结果': 'MRP calculation triggered, please refresh later to view results',
  'MRP 计划已发布': 'MRP plan has been published',
  '产能负荷率': 'Capacity Load Rate',
  '资源产能负荷率': 'Resource Capacity Load Rate',
  '交期风险工单预计延迟': 'Due Date Risk Work Orders (Estimated Delay)',
  '计划周期天': 'Planning Cycle (Days)',
  '计划周期': 'Planning Cycle',
  '触发时间': 'Trigger Time',
  '完成时间': 'Completion Time',
  '物料名称': 'Material Name',
  '需求量': 'Demand Qty',
  '可用库存': 'Available Inventory',
  '建议采购量': 'Suggested Purchase Qty',
  '建议生产量': 'Suggested Production Qty',
  '警告当前没有启用的优先级规则排': 'Warning: No enabled priority rules for scheduling',
  '规则名称': 'Rule Name',
  '规则类型': 'Rule Type',
  '权重系数': 'Weight Factor',
  '效率系数': 'Efficiency Factor',
  '资源类型': 'Resource Type',
  '资源ID': 'Resource ID',
  '新增日历': 'Create Calendar',
  '班次类型': 'Shift Type',
  '是否工作日': 'Is Workday',
  '资源': 'Resource',
  '时间周期': 'Time Period',
  '产能': 'Capacity',
  '延迟天数': 'Delay Days',
  '需求来源': 'Demand Source',
  'MRP计算结果': 'MRP Calculation Result',
  '批次号': 'Batch No.',
  
  // === Common ===
  '操作': 'Action',
  '状态': 'Status',
  '启用': 'Enable',
  '停用': 'Disable',
  '保存': 'Save',
  '新增': 'Create',
  '新建': 'Create',
  '编辑': 'Edit',
  '删除': 'Delete',
  '确认': 'Confirm',
  '取消': 'Cancel',
  '提交': 'Submit',
  '审核': 'Review',
  '审批': 'Approve',
  '查看': 'View',
  '搜索': 'Search',
  '查询': 'Query',
  '筛选': 'Filter',
  '导入': 'Import',
  '导出': 'Export',
  '下载': 'Download',
  '上传': 'Upload',
  '重置': 'Reset',
  '刷新': 'Refresh',
  '返回': 'Back',
  '复制': 'Copy',
  '选择': 'Select',
  '详情': 'Details',
  '类型': 'Type',
  '分类': 'Category',
  '编码': 'Code',
  '名称': 'Name',
  '备注': 'Remark',
  '序号': 'No.',
  '数量': 'Quantity',
  '单位': 'Unit',
  '金额': 'Amount',
  '日期': 'Date',
  '时间': 'Time',
  '开始时间': 'Start Time',
  '结束时间': 'End Time',
  '创建时间': 'Created At',
  '更新时间': 'Updated At',
  '创建人': 'Created By',
  '更新人': 'Updated By',
  '编号': 'No.',
  '标题': 'Title',
  '内容': 'Content',
  '优先级': 'Priority',
  '级别': 'Level',
  '版本': 'Version',
  '标签': 'Tag',
  '排序': 'Sort',
  '密码': 'Password',
  '角色': 'Role',
  '权限': 'Permission',
  '菜单': 'Menu',
  '暂无数据': 'No Data',
  '必填': 'Required',
  '选填': 'Optional',
  '是': 'Yes',
  '否': 'No',
  '无': 'None',
  '未知': 'Unknown',
  '可用': 'Available',
  '全部': 'All',
  '其他': 'Other',
  '共': 'Total',
  '页': 'Page',
  
  // Status values
  '正常': 'Normal',
  '异常': 'Abnormal',
  '已启用': 'Enabled',
  '已停用': 'Disabled',
  '已确认': 'Confirmed',
  '已Confirm': 'Confirmed',
  '已取消': 'Cancelled',
  '已冻结': 'Frozen',
  '已Frozen': 'Frozen',
  '未Frozen': 'Not Frozen',
  '未冻结': 'Not Frozen',
  '草稿': 'Draft',
  '生效': 'Active',
  '失效': 'Inactive',
  '冻结': 'Freeze',
  '在制': 'WIP',
  '进行中': 'In Progress',
  '已完成': 'Completed',
  '未开始': 'Not Started',
  '已关闭': 'Closed',
  '成功': 'Success',
  '错误': 'Error',
  '警告': 'Warning',
  '信息': 'Info',
  '开放': 'Open',
  '严重': 'Critical',
  '重要': 'Major',
  '轻微': 'Minor',
  '无效': 'Invalid',
  '登录': 'Login',
  '激活': 'Activate',
  '废止': 'Deactivate',
  '拒绝': 'Reject',
  '解冻': 'Unfreeze',
  '试用': 'Trial',
  '正式': 'Official',
  
  // Process states
  '待执行': 'Pending Execution',
  '执行中': 'Executing',
  '调查中': 'Investigating',
  '审核中': 'Under Review',
  '盘点中': 'Counting',
  '计数中': 'Counting',
  
  // Common messages
  '操作成功': 'Operation Successful',
  '更新成功': 'Updated Successfully',
  '创建成功': 'Created Successfully',
  '删除成功': 'Deleted Successfully',
  '保存成功': 'Saved Successfully',
  '提交成功': 'Submitted Successfully',
  '已发货': 'Shipped',
  '已消耗': 'Consumed',
  '已发送': 'Sent',
  '已接受': 'Accepted',
  '已发料': 'Issued',
  '已收货': 'Received',
  '已结算': 'Settled',
  '已解决': 'Resolved',
  
  // Cost terms
  '人工成本': 'Labor Cost',
  '材料成本': 'Material Cost',
  '制造费用': 'Manufacturing Overhead',
  '备件成本': 'Spare Parts Cost',
  '外委成本': 'Outsourcing Cost',
  '币种': 'Currency',
  '累计占比': 'Cumulative %',
  
  // Equipment
  '检测设备': 'Testing Equipment',
  '动力设备': 'Power Equipment',
  '运输设备': 'Transport Equipment',
  '仓储设备': 'Storage Equipment',
  '办公设备': 'Office Equipment',
  '故障次数': 'Fault Count',
  'Fault次数': 'Fault Count',
  '型号': 'Model',
  '厂商': 'Manufacturer',
  '设备编号': 'Equipment No.',
  '设备名称': 'Equipment Name',
  '设备类型': 'Equipment Type',
  '设备状态': 'Equipment Status',
  '故障': 'Fault',
  '故障描述': 'Fault Description',
  '维修': 'Repair',
  '保养': 'Maintenance',
  '巡检': 'Patrol Inspection',
  
  // Quality
  '检验': 'Inspection',
  '合格': 'Qualified',
  '不合格': 'Unqualified',
  '缺陷': 'Defect',
  '不良': 'Defective',
  '报废': 'Scrap',
  '返工': 'Rework',
  '成品检验(FQC)': 'Finished Inspection (FQC)',
  '出货检验(OQC)': 'Outgoing Inspection (OQC)',
  '成品Inspection(FQC)': 'Finished Inspection (FQC)',
  '出货Inspection(OQC)': 'Outgoing Inspection (OQC)',
  
  // Manufacturing
  '工序': 'Operation',
  '工单': 'Work Order',
  '工单号': 'Work Order No.',
  '工艺路线': 'Routing',
  '工作中心': 'Work Center',
  '生产线': 'Production Line',
  '设备': 'Equipment',
  '物料': 'Material',
  '产品': 'Product',
  '批次': 'Batch',
  '报工': 'Production Report',
  '良品数': 'Good Qty',
  '不良品数': 'Defect Qty',
  '报废数': 'Scrap Qty',
  '计划数量': 'Planned Qty',
  '完成数量': 'Completed Qty',
  '合格数量': 'Qualified Qty',
  '不合格数量': 'Unqualified Qty',
  '良品率': 'Yield Rate',
  '报废率': 'Scrap Rate',
  
  // WMS
  '仓库': 'Warehouse',
  '库区': 'Zone',
  '库位': 'Location',
  '入库': 'Inbound',
  '出库': 'Outbound',
  '移库': 'Transfer',
  '盘点': 'Inventory Count',
  '库存': 'Inventory',
  '领料': 'Material Picking',
  '退料': 'Material Return',
  '拣货': 'Picking',
  '上架': 'Putaway',
  '仓库Code': 'Warehouse Code',
  '仓库Name': 'Warehouse Name',
  '库区Code': 'Zone Code',
  '库区Name': 'Zone Name',
  '货位Code': 'Location Code',
  '原材料仓': 'Raw Material Warehouse',
  '成品仓': 'Finished Goods Warehouse',
  '半成品仓': 'Semi-finished Warehouse',
  '普通': 'Normal',
  '暂存': 'Temporary',
  '隔离': 'Quarantine',
  '占用': 'Occupied',
  '禁用': 'Disabled',
  '周转率': 'Turnover Rate',
  '台账': 'Ledger',
  '收发存': 'Receipt/Issue/Balance',
  'Query台账': 'Query Ledger',
  'Query收发存': 'Query Receipt/Issue/Balance',
  'View/执行': 'View/Execute',
  '复核': 'Verify',
  '待拣货': 'Pending Picking',
  '拣货中': 'Picking',
  '低于安全库存': 'Below Safety Stock',
  '安全库存量': 'Safety Stock Qty',
  '安全库存': 'Safety Stock',
  '当前库存': 'Current Stock',
  '最小库存': 'Min Stock',
  '最大库存': 'Max Stock',
  '再订购点': 'Reorder Point',
  '仓库（可选）': 'Warehouse (Optional)',
  '仅预警': 'Alerts Only',
  '最后更新：': 'Last Updated: ',
  
  // ERP/SCM
  '采购': 'Procurement',
  '采购订单': 'Purchase Order',
  '供应商': 'Supplier',
  '客户': 'Customer',
  '销售订单': 'Sales Order',
  '联系人': 'Contact',
  '联系电话': 'Contact Phone',
  '交货日期': 'Delivery Date',
  '交期': 'Due Date',
  
  // HR
  '员工': 'Employee',
  '部门': 'Department',
  '岗位': 'Position',
  '入职日期': 'Join Date',
  '离职日期': 'Leave Date',
  '考勤': 'Attendance',
  '薪资': 'Salary',
  '绩效': 'Performance',
  
  // Traceability
  '追溯': 'Traceability',
  '召回': 'Recall',
  '追溯覆盖率': 'Traceability Coverage',
  '生成追溯报告': 'Generate Traceability Report',
  '应用筛选': 'Apply Filter',
  '风险等级分布': 'Risk Level Distribution',
  '需立即联系客户': 'Contact customer immediately',
  '监控生产进度': 'Monitor production progress',
  
  // System
  '系统': 'System',
  '设置': 'Settings',
  '配置': 'Configuration',
  '日志': 'Log',
  '参数': 'Parameter',
  '业务模块': 'Business Module',
  '运行模式：': 'Run Mode: ',
  '无（顶级组织）': 'None (Top-level Organization)',
  
  // Mixed CN/EN patterns
  'Batch号': 'Batch No.',
  '请输入Batch号': 'Please enter Batch No.',
  '请输入SupplierID': 'Please enter Supplier ID',
  '请输入工序Name': 'Please enter Operation Name',
  '请输入MaterialID': 'Please enter Material ID',
  '请输入计划Quantity': 'Please enter Planned Quantity',
  '请选择计划交期': 'Please select Planned Due Date',
  '来源Type': 'Source Type',
  '销售Outbound': 'Sales Outbound',
  '调拨Outbound': 'Transfer Outbound',
  '对象Type': 'Object Type',
  '今日Inbound量': 'Today\'s Inbound Qty',
  '预警Material数': 'Alert Material Count',
  'Confirm以下拣货Quantity并完成复核：': 'Confirm the following picking quantities and complete verification:',
  'items码模板': 'Barcode Template',
  'Create安全库存': 'Create Safety Stock',
  'Edit安全库存': 'Edit Safety Stock',
  'Create盘点单': 'Create Inventory Count',
  'Create拣货任务': 'Create Picking Task',
  '录入/View': 'Enter/View',
  '建议Frozen阻止Outbound': 'Recommend freeze to block outbound',
  '手动Frozen': 'Manual Freeze',
  '手动冻结': 'Manual Freeze',
  '库存看板': 'Inventory Dashboard',
  '总 SKU 数': 'Total SKU Count',
  '库存热力图（按库区）': 'Inventory Heatmap (by Zone)',
  '收发存趋势（近 7 天）': 'Receipt/Issue/Balance Trend (Last 7 Days)',
  '盘盈（增加）': 'Surplus (Increase)',
  '盘亏（减少）': 'Shortage (Decrease)',
  '逾期': 'Overdue',
  '本月结算金额': 'Monthly Settlement Amount',
  
  // More specific phrases
  '直线法': 'Straight-Line Method',
  '双倍余额递减法': 'Double Declining Balance Method',
  '请说明补录原因': 'Please explain supplementary entry reason',
  '冻结原因：': 'Freeze Reason: ',
  '确定要冻结': 'Confirm to freeze',
  '个在库批次吗？冻结后这些批次将无法出库': ' in-stock batches? Frozen batches cannot be shipped',
  '高:': 'High:',
  '中:': 'Medium:',
  '低:': 'Low:',
  '容器': 'Container',
  '货位': 'Location',
  '平均值': 'Average',
  '覆盖率': 'Coverage Rate',
  '小时': 'Hour',
  '分钟': 'Minute',
  '秒': 'Second',
  '今天': 'Today',
  '昨天': 'Yesterday',
  '本月': 'This Month',
  '上月': 'Last Month',
  '本年': 'This Year',
  '去年': 'Last Year',
  '最近': 'Recent',
  '自定义': 'Custom',
  '季度': 'Quarter',
  '年': 'Year',
  '如': 'e.g.',
  '如 ': 'e.g. ',
  '请输入': 'Please enter',
  '请选择': 'Please select',
  '请输入规则编码': 'Please enter rule code',
  '请输入规则名称': 'Please enter rule name',
  '请输入规则描述': 'Please enter rule description',
  '编号规则': 'Numbering Rule',
  '编号前缀': 'Prefix',
  
  // More status/pattern fixes
  '已审批': 'Approved',
  '待审核': 'Pending Review',
  '已审核': 'Reviewed',
  '待审批': 'Pending Approval',
  '已完成 ': 'Completed',
  '生产中': 'In Production',
  '已入库': 'Received',
  '已出库': 'Shipped',
  '已收货': 'Received',
  '退货中': 'Returning',
  '待收货': 'Pending Receipt',
  '待发货': 'Pending Shipment',
  '已退货': 'Returned',
  '已划扣': 'Deducted',
  '已分配': 'Allocated',
  '部分分配': 'Partially Allocated',
  '部分出库': 'Partially Shipped',
  '部分收货': 'Partially Received',
  
  // Specific modules
  'MRP计算结果': 'MRP Calculation Result',
  '确认发布MRP计划将自动生成采': 'Confirm publishing MRP plan will auto-generate',
  '触发MRP计算': 'Trigger MRP Calculation',
  '计划周期天': 'Planning Cycle (Days)',
  
  // Phrases with context
  '确认删除该标准工序？删除后使用该工序的路线不受影响。': 'Confirm deleting this standard operation? Routes using it will not be affected.',
  '确认将批次': 'Confirm batch',
  '的质量状态变更为': ' quality status changed to',
};

// Process each file - ONLY replace the exact value part, keeping key unchanged
const files = fs.readdirSync(enDir).filter(f => f.endsWith('.ts'));
let totalFixed = 0;
let totalUnfixed = 0;
const unfixedEntries = [];

for (const file of files) {
  const enPath = path.join(enDir, file);
  let content = fs.readFileSync(enPath, 'utf-8');
  let modified = false;
  
  // Parse entries
  const entries = parseLocaleFile(content);
  
  // Process in reverse order to preserve string positions
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const value = entry.value;
    
    // Skip if no Chinese characters
    if (!chineseRegex.test(value)) continue;
    
    // Look up exact translation
    const translated = translationMap[value];
    if (translated) {
      // Replace only the value part
      const oldLine = entry.raw;
      const newLine = oldLine.replace(
        new RegExp(`'${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'(\\s*,?\\s*)$`, 'gm'),
        `'${translated}'$1`
      );
      if (newLine !== oldLine) {
        content = content.slice(0, entry.start) + newLine + content.slice(entry.end);
        modified = true;
        totalFixed++;
      }
    } else {
      // Try partial matching - replace Chinese substrings within the value
      let newValue = value;
      let anyChange = false;
      
      // Sort by length descending for greedy matching
      const sortedKeys = Object.keys(translationMap).sort((a, b) => b.length - a.length);
      for (const cn of sortedKeys) {
        if (newValue.includes(cn)) {
          newValue = newValue.split(cn).join(translationMap[cn]);
          anyChange = true;
        }
      }
      
      if (anyChange && !chineseRegex.test(newValue)) {
        const oldLine = entry.raw;
        const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const newLine = oldLine.replace(
          new RegExp(`'${escapedValue}'(\\s*,?\\s*)$`, 'gm'),
          `'${newValue}'$1`
        );
        if (newLine !== oldLine) {
          content = content.slice(0, entry.start) + newLine + content.slice(entry.end);
          modified = true;
          totalFixed++;
        }
      } else {
        totalUnfixed++;
        unfixedEntries.push({ file, key: entry.key, value, cnValue: '' });
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(enPath, content, 'utf-8');
    console.log(`Fixed entries in ${file}`);
  }
}

console.log(`\nTotal fixed: ${totalFixed}`);
console.log(`Still unfixed: ${totalUnfixed}`);

// Save unfixed for review
if (unfixedEntries.length > 0) {
  fs.writeFileSync(
    path.resolve('C:\\mfg-platform_copy\\frontend', 'unfixed-r3.json'),
    JSON.stringify(unfixedEntries, null, 2)
  );
  console.log(`Unfixed entries saved to unfixed-r3.json`);
  
  // Show unique unfixed values
  const uniqueVals = {};
  for (const e of unfixedEntries) {
    if (!uniqueVals[e.value]) uniqueVals[e.value] = 0;
    uniqueVals[e.value]++;
  }
  const sorted = Object.entries(uniqueVals).sort((a, b) => b[1] - a[1]);
  console.log('\nTop unfixed values:');
  sorted.slice(0, 50).forEach(([v, c]) => console.log(`  ${JSON.stringify(v)} (${c})`));
}
