// Round 2: Fix remaining unfixed Chinese entries in en-US locale files
const fs = require('fs');
const path = require('path');

const enDir = path.resolve('C:\\mfg-platform_copy\\frontend\\src\\locale\\en-US');
const chineseRegex = /[\u4e00-\u9fff]/;

// Massively expanded Chinese to English translation dictionary
const cn2en = {
  // Longest phrases first (important for greedy matching)
  '建议冻结阻止出库': 'Recommend freeze to block outbound',
  '个在库批次吗？冻结后这些批次将无法出库': ' in-stock batches? After freezing, these batches cannot be shipped out',
  '确定要冻结': 'Are you sure to freeze',
  '需立即联系客户': 'Need to contact customer immediately',
  'MRP 计算已触发，请稍后刷新查看结果': 'MRP calculation triggered, please refresh later to view results',
  '确认发布MRP计划将自动生成采购建议和生产工单建议': 'Confirm publishing MRP plan will auto-generate purchase and production work order suggestions',
  '以下工单正在使用该路线，请先处理完成后再废止：': 'The following work orders are using this routing, please complete them before deactivating:',
  'drawerMode === \'create\' ? \'新建标准工序\' : \'编辑标准工序\'': 'drawerMode === \'create\' ? \'Create Standard Operation\' : \'Edit Standard Operation\'',
  'drawerMode === \'create\' ? \'Create标准工序\' : \'Edit标准工序\'': 'drawerMode === \'create\' ? \'Create Standard Operation\' : \'Edit Standard Operation\'',
  'editing ? \'Edit安全库存\' : \'Create安全库存\'': 'editing ? \'Edit Safety Stock\' : \'Create Safety Stock\'',
  'editing ? \'编辑安全库存\' : \'新建安全库存\'': 'editing ? \'Edit Safety Stock\' : \'Create Safety Stock\'',
  '双倍余额递减法': 'Double Declining Balance',
  '含数据缺失节点': 'With missing data nodes',
  '含Data Missing节点': 'With missing data nodes',
  '冻结原因：': 'Freeze reason: ',
  'Frozen原因：': 'Freeze reason: ',
  '监控生产进度': 'Monitor production progress',
  '监控Production进度': 'Monitor production progress',
  '风险等级分布': 'Risk Level Distribution',
  'View详细报告': 'View Detailed Report',
  '查看详细报告': 'View Detailed Report',
  '追溯覆盖率': 'Traceability Coverage',
  '生成追溯报告': 'Generate Traceability Report',
  '应用筛选': 'Apply Filter',
  '库存热力图（按库区）': 'Inventory Heatmap (by Zone)',
  '收发存趋势（近 7 天）': 'Receipt/Issue/Balance Trend (Last 7 Days)',
  '盘盈（增加）': 'Surplus (Increase)',
  '盘亏（减少）': 'Shortage (Decrease)',
  '无（顶级组织）': 'None (Top-level Organization)',
  '成品检验(FQC)': 'Finished Product Inspection (FQC)',
  '出货检验(OQC)': 'Outgoing Inspection (OQC)',
  '成品Inspection(FQC)': 'Finished Product Inspection (FQC)',
  '出货Inspection(OQC)': 'Outgoing Inspection (OQC)',
  '工序Action要点Description': 'Operation Key Points Description',
  'MRP 计算已触发，请稍后RefreshView结果': 'MRP calculation triggered, please refresh later to view results',
  'MRP 计划已发布': 'MRP plan has been published',
  '确认将批次': 'Confirm batch',
  '的质量状态变更为': 'quality status changed to',
  '确认删除该标准工序？删除后使用该工序的路线不受影响。': 'Confirm deleting this standard operation? Routes using it will not be affected.',
  'Confirm以下拣货Quantity并完成复核：': 'Confirm the following picking quantities and complete verification:',
  '请输入Batch号': 'Please enter Batch No.',
  '请说明补录原因': 'Please explain the reason for supplementary entry',
  '当前库存': 'Current Stock',
  '最小库存': 'Min Stock',
  '最大库存': 'Max Stock',
  '安全库存': 'Safety Stock',
  '再订购点': 'Reorder Point',
  '安全库存量': 'Safety Stock Qty',
  '低于安全库存': 'Below Safety Stock',
  'Create安全库存': 'Create Safety Stock',
  'Edit安全库存': 'Edit Safety Stock',
  'Create拣货任务': 'Create Picking Task',
  '新建拣货任务': 'Create Picking Task',
  'Create盘点单': 'Create Inventory Count',
  '新建盘点单': 'Create Inventory Count',
  '录入/View': 'Enter/View',
  '录入/查看': 'Enter/View',
  
  // Common status phrases
  '已Confirm': 'Confirmed',
  '已确认': 'Confirmed',
  '已发货': 'Shipped',
  '已消耗': 'Consumed',
  '已发送': 'Sent',
  '已接受': 'Accepted',
  '已发料': 'Issued',
  '已收货': 'Received',
  '已结算': 'Settled',
  '已解决': 'Resolved',
  '已Frozen': 'Frozen',
  '已冻结': 'Frozen',
  '未Frozen': 'Not Frozen',
  '未冻结': 'Not Frozen',
  '手动Frozen': 'Manual Freeze',
  '手动冻结': 'Manual Freeze',
  
  // Process states
  '待计算': 'Pending Calculation',
  '待执行': 'Pending Execution',
  '执行中': 'Executing',
  '调查中': 'Investigating',
  '盘点中': 'Counting',
  '计数中': 'Counting',
  '审核中': 'Under Review',
  
  // Common verbs/nouns
  '发布': 'Publish',
  '激活': 'Activate',
  '废止': 'Deactivate',
  '拒绝': 'Reject',
  '解冻': 'Unfreeze',
  '开放': 'Open',
  '严重': 'Critical',
  '重要': 'Major',
  '轻微': 'Minor',
  '无效': 'Invalid',
  '试用': 'Trial',
  '正式': 'Official',
  '登录': 'Login',
  
  // Cost terms
  '人工成本': 'Labor Cost',
  '材料成本': 'Material Cost',
  '制造费用': 'Manufacturing Overhead',
  '备件成本': 'Spare Parts Cost',
  '外委成本': 'Outsourcing Cost',
  
  // Equipment types
  '检测设备': 'Testing Equipment',
  '动力设备': 'Power Equipment',
  '运输设备': 'Transport Equipment',
  '仓储设备': 'Storage Equipment',
  '办公设备': 'Office Equipment',
  
  // Business
  '币种': 'Currency',
  '型号': 'Model',
  '厂商': 'Manufacturer',
  '联系人': 'Contact',
  '联系电话': 'Contact Phone',
  '业务模块': 'Business Module',
  '累计占比': 'Cumulative %',
  '直线法': 'Straight-Line Method',
  
  // Quality
  'Fault次数': 'Fault Count',
  '故障次数': 'Fault Count',
  '预测需求': 'Forecast Demand',
  'View结果': 'View Results',
  '查看结果': 'View Results',
  
  // Mixed EN/CN patterns
  'Batch号': 'Batch No.',
  'items码模板': 'Barcode Template',
  '条码模板': 'Barcode Template',
  '对象Type': 'Object Type',
  '对象类型': 'Object Type',
  '来源Type': 'Source Type',
  '来源类型': 'Source Type',
  
  // WMS specific
  '调拨Outbound': 'Transfer Outbound',
  '调拨出库': 'Transfer Outbound',
  '销售Outbound': 'Sales Outbound',
  '销售出库': 'Sales Outbound',
  '今日Inbound量': 'Today\'s Inbound Qty',
  '今日入库量': 'Today\'s Inbound Qty',
  '预警Material数': 'Alert Material Count',
  '预警物料数': 'Alert Material Count',
  '库存看板': 'Inventory Dashboard',
  '总 SKU 数': 'Total SKU Count',
  '容器': 'Container',
  '货位': 'Location',
  '仓库（可选）': 'Warehouse (Optional)',
  '仓库Code': 'Warehouse Code',
  '仓库Name': 'Warehouse Name',
  '库区Code': 'Zone Code',
  '库区Name': 'Zone Name',
  '货位Code': 'Location Code',
  
  // Short words
  '高:': 'High:',
  '中:': 'Medium:',
  '低:': 'Low:',
  '高': 'High',
  '中': 'Medium',
  '低': 'Low',
  '日': 'Day',
  '周': 'Week',
  '月': 'Month',
  
  // Template literal strings (keep backticks and expressions)

  
  // Common mixed patterns with English words embedded
  '建议Frozen阻止Outbound': 'Recommend freeze to block outbound',
  
  // More short/common terms
  '平均值': 'Average',
  '覆盖率': 'Coverage Rate',
  '普通': 'Normal',
  '暂存': 'Temporary',
  '隔离': 'Quarantine',
  '占用': 'Occupied',
  '禁用': 'Disabled',
  '更新成功': 'Updated Successfully',
  '创建成功': 'Created Successfully',
  '周转率': 'Turnover Rate',
  '台账': 'Ledger',
  '收发存': 'Receipt/Issue/Balance',
  'Query台账': 'Query Ledger',
  'Query收发存': 'Query Receipt/Issue/Balance',
  'View/执行': 'View/Execute',
  '复核': 'Verify',
  '待拣货': 'Pending Picking',
  '拣货中': 'Picking',
  '原材料仓': 'Raw Material Warehouse',
  '成品仓': 'Finished Goods Warehouse',
  '半成品仓': 'Semi-finished Warehouse',
  '其他': 'Other',
  '全部': 'All',
  '仅预警': 'Alerts Only',
  '如': 'e.g.',
  '如 ': 'e.g. ',
  '最后更新：': 'Last Updated: ',
  '请输入': 'Please enter',
  '请选择': 'Please select',
  '请输入SupplierID': 'Please enter Supplier ID',
  '请输入工序Name': 'Please enter Operation Name',
  '请输入MaterialID': 'Please enter Material ID',
  '请输入计划Quantity': 'Please enter Planned Quantity',
  '请选择计划交期': 'Please select Planned Due Date',
  '逾期': 'Overdue',
  '本月结算金额': 'Monthly Settlement Amount',
  
  // More single/double character
  '新增': 'Create',
  '新建': 'Create',
  '编辑': 'Edit',
  '删除': 'Delete',
  '保存': 'Save',
  '取消': 'Cancel',
  '确认': 'Confirm',
  '提交': 'Submit',
  '审核': 'Review',
  '审批': 'Approve',
  '启用': 'Enable',
  '停用': 'Disable',
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
  '打印': 'Print',
  '预览': 'Preview',
  '详情': 'Details',
  '操作': 'Action',
  '状态': 'Status',
  '类型': 'Type',
  '分类': 'Category',
  '编码': 'Code',
  '名称': 'Name',
  '描述': 'Description',
  '备注': 'Remark',
  '序号': 'No.',
  '数量': 'Quantity',
  '单位': 'Unit',
  '金额': 'Amount',
  '日期': 'Date',
  '时间': 'Time',
  '开始时间': 'Start Time',
  '结束时间': 'End Time',
  '开始日期': 'Start Date',
  '结束日期': 'End Date',
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
  '颜色': 'Color',
  '排序': 'Sort',
  '密码': 'Password',
  '角色': 'Role',
  '权限': 'Permission',
  '菜单': 'Menu',
  '正常': 'Normal',
  '异常': 'Abnormal',
  '已启用': 'Enabled',
  '已停用': 'Disabled',
  '草稿': 'Draft',
  '生效': 'Active',
  '失效': 'Inactive',
  '冻结': 'Frozen',
  '在制': 'WIP',
  '冲突': 'Conflict',
  '计算中': 'Calculating',
  '暂无数据': 'No Data',
  '必填': 'Required',
  '选填': 'Optional',
  '不可撤销': 'Irreversible',
  '是否确认': 'Are you sure',
  '共': 'Total',
  '条': 'items',
  '页': 'Page',
  '是': 'Yes',
  '否': 'No',
  '无': 'None',
  '未知': 'Unknown',
  '可用': 'Available',
  '不可用': 'Unavailable',
  '不能为空': 'Cannot be empty',
  '标准工序': 'Standard Operation',
  '标准作业时间': 'Standard Duration',
  '换模/准备时间': 'Setup Time',
  '工序Code': 'Operation Code',
  '工序Name': 'Operation Name',
  '默认工作中心': 'Default Work Center',
  '标准工时': 'Std Hours',
  '准备时间': 'Setup Time',
  '工序': 'Operation',
  '工单': 'Work Order',
  '工单号': 'Work Order No.',
  '工艺路线': 'Routing',
  '工艺': 'Process',
  '工作中心': 'Work Center',
  '生产线': 'Production Line',
  '设备': 'Equipment',
  '物料': 'Material',
  '产品': 'Product',
  '批次': 'Batch',
  '批次号': 'Batch No.',
  '报工': 'Production Report',
  '良品数': 'Good Qty',
  '不良品数': 'Defect Qty',
  '报废数': 'Scrap Qty',
  '计划数量': 'Planned Qty',
  '完成数量': 'Completed Qty',
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
  '采购': 'Procurement',
  '采购订单': 'Purchase Order',
  '供应商': 'Supplier',
  '客户': 'Customer',
  '销售订单': 'Sales Order',
  '交货日期': 'Delivery Date',
  '交期': 'Due Date',
  '员工': 'Employee',
  '部门': 'Department',
  '岗位': 'Position',
  '维修': 'Repair',
  '保养': 'Maintenance',
  '检验': 'Inspection',
  '合格': 'Qualified',
  '不合格': 'Unqualified',
  '缺陷': 'Defect',
  '报废': 'Scrap',
  '返工': 'Rework',
  '追溯': 'Traceability',
  '召回': 'Recall',
  '系统': 'System',
  '设置': 'Settings',
  '配置': 'Configuration',
  '日志': 'Log',
  '参数': 'Parameter',
  '运行模式：': 'Run Mode: ',
  '待排程': 'To Schedule',
  '已取消': 'Cancelled',
  '延迟天数': 'Delay Days',
  '需求来源': 'Demand Source',
  '请输入规则编码': 'Please enter rule code',
  '请输入规则名称': 'Please enter rule name',
  '请输入规则描述': 'Please enter rule description',
  '编号规则': 'Numbering Rule',
  '编号前缀': 'Prefix',
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
};

// Process each file
const files = fs.readdirSync(enDir).filter(f => f.endsWith('.ts'));
let totalFixed = 0;
let totalUnfixed = 0;
const unfixedEntries = [];

for (const file of files) {
  const enPath = path.join(enDir, file);
  let content = fs.readFileSync(enPath, 'utf-8');
  let modified = false;
  
  // Sort dictionary keys by length (longest first) for greedy matching
  const sortedKeys = Object.keys(cn2en).sort((a, b) => b.length - a.length);
  
  // Line-by-line replacement
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!chineseRegex.test(lines[i])) continue;
    
    let line = lines[i];
    let changed = false;
    
    for (const cn of sortedKeys) {
      if (line.includes(cn)) {
        line = line.split(cn).join(cn2en[cn]);
        changed = true;
      }
    }
    
    if (changed && !chineseRegex.test(line)) {
      lines[i] = line;
      modified = true;
      totalFixed++;
    } else if (changed && chineseRegex.test(line)) {
      // Partially translated but still has Chinese - keep trying
      // Do another pass
      for (const cn of sortedKeys) {
        if (line.includes(cn)) {
          line = line.split(cn).join(cn2en[cn]);
        }
      }
      if (!chineseRegex.test(line)) {
        lines[i] = line;
        modified = true;
        totalFixed++;
      } else {
        // Extract key from line
        const keyMatch = line.match(/['"]([^'"]+)['"]/);
        const key = keyMatch ? keyMatch[1] : `line:${i}`;
        unfixedEntries.push({ file, key, line: line.trim() });
        totalUnfixed++;
      }
    } else if (!changed) {
      // Couldn't match any dictionary entry
      const keyMatch = line.match(/['"]([^'"]+)['"]/);
      const key = keyMatch ? keyMatch[1] : `line:${i}`;
      unfixedEntries.push({ file, key, line: line.trim() });
      totalUnfixed++;
    }
  }
  
  if (modified) {
    content = lines.join('\n');
    fs.writeFileSync(enPath, content, 'utf-8');
    console.log(`Fixed entries in ${file}`);
  }
}

console.log(`\nRound 2 - Total fixed: ${totalFixed}`);
console.log(`Still unfixed: ${totalUnfixed}`);

if (unfixedEntries.length > 0) {
  // Group unique unfixed values
  const uniqueVals = {};
  for (const e of unfixedEntries) {
    // Extract the value part from the line
    const valMatch = e.line.match(/:\s*['"](.+?)['"]/);
    if (valMatch) {
      const val = valMatch[1];
      if (!uniqueVals[val]) uniqueVals[val] = [];
      uniqueVals[val].push(`${e.file}:${e.key}`);
    }
  }
  
  console.log('\n=== REMAINING UNFIXED UNIQUE VALUES ===');
  const sorted = Object.entries(uniqueVals).sort((a, b) => b[1].length - a[1].length);
  for (const [val, keys] of sorted) {
    console.log(`${JSON.stringify(val)} (${keys.length} keys)`);
  }
  
  fs.writeFileSync(
    path.resolve('C:\\mfg-platform_copy\\frontend', 'unfixed-translations-r2.json'),
    JSON.stringify(unfixedEntries, null, 2)
  );
}
