// Add missing i18n keys to both zh-CN and en-US locale files
const fs = require('fs');
const path = require('path');

const missingKeys = {
  base: [
    '质量状态已变更', '下载失败', '下载成功', '保存成功', '创建成功', '删除失败', '删除成功', '操作失败', '请输入名称'
  ],
  eam: [
    '技术规格已保存', '财务信息已保存', '润滑记录已保存，下次到期日已更新', '上报失败', '上报成功', '保存失败', '创建失败', '创建成功', '更新成功', '请填写润滑油型号', '请填写设备ID', '请填写设备ID和日期'
  ],
  erp: [
    '创建成功', '更新成功', '付款记录成功', '收款记录成功', '审批成功', '已发货', '已发送', '已拒绝', '已接受', '成本卷积计算完成', '物流信息已更新', '订单已确认', '销售订单已创建', '请填写付款金额和日期', '请填写收款金额和日期', '请填写科目编码和名称', '请填写编码和名称', '请选择客户', '请选择订单日期'
  ],
  mes: [
    '创建成功', '更新成功', '删除成功', '完工登记成功', '开工成功', '异常报工已记录', '操作成功', '退料成功', '领料成功', '重试指令已发送', '未找到工单', '请填写完成数量', '请填写异常类型和原因', '请填写物料编码和数量', '请输入工单号', '请输入计划数量', '请选择物料'
  ],
  outsourcing: [
    '创建成功', '发料单创建成功', '发料确认成功', '取消成功', '审核成功', '导出成功', '收货单创建成功', '收货确认成功', '确认成功', '结算单创建成功'
  ],
  plm: [
    '创建成功', '更新成功', '删除成功', '新增成功', '新建成功', '保存成功', '修改成功', '激活成功', '废止成功', '签发成功', '覆盖成功', '触发成功', '上传成功', '取消成功', '审批通过', '已提交审批', '已拒绝', '评估已确认', '重试已发起', '复制成功，新路线已创建为草稿状态', '请选择物料', '请选择日期', '请选择文件', '请选择关联 ECR', '请填写覆盖原因', '请填写描述', '请填写工序名称', '请输入工序编码', '请输入工序名称', '请输入路线编码', '请输入路线名称', '文件大小不能超过 50MB'
  ],
  qms: [
    '创建成功', '更新成功', '创建失败', '处置成功', '处置失败', '录入成功', '录入失败', '数据点录入成功', '结果录入成功', '新版本已发布', '验证结果已提交', '请填写检验项目ID和测量值', '请输入检验项目ID'
  ],
  scm: [
    '创建成功', '更新成功', '创建失败', '处理成功', '确认成功', '对账已确认', '已关闭', '已取消', '已批准', '已拒绝', '已接收', '已提交审批', '供应商已选定', '询价已发送', '协议已过期', '采购订单已创建', '请填写申请数量', '请填写拒绝原因', '请选择供应商', '请选择物料', '请选择订单日期'
  ],
  traceability: [
    '追溯完成', '导出成功', '补录成功', '冻结指令已发送', '评估已发起', '筛选已应用', '未找到对应批次', '请输入追溯码', '请输入批次号', '请输入问题批次追溯码', '请描述问题原因', '报告生成中，请稍后下载', '报告生成中，请稍后在报告列表查看'
  ],
  wms: [
    '创建成功', '更新成功', '删除成功', '入库成功', '出库成功', '冻结成功', '解冻成功', '库存调整成功', '复核完成', '盘点已开始', '审批通过，库存已调整', '请填写完整信息'
  ]
};

// English translations map
const enMap = {
  '质量状态已变更': 'Quality status changed',
  '下载失败': 'Download failed',
  '下载成功': 'Download successful',
  '保存成功': 'Saved successfully',
  '创建成功': 'Created successfully',
  '删除失败': 'Delete failed',
  '删除成功': 'Deleted successfully',
  '操作失败': 'Operation failed',
  '请输入名称': 'Please enter a name',
  '技术规格已保存': 'Technical specs saved',
  '财务信息已保存': 'Finance info saved',
  '润滑记录已保存，下次到期日已更新': 'Lubrication record saved, next due date updated',
  '上报失败': 'Report failed',
  '上报成功': 'Reported successfully',
  '保存失败': 'Save failed',
  '创建失败': 'Create failed',
  '更新成功': 'Updated successfully',
  '请填写润滑油型号': 'Please fill in lubricant model',
  '请填写设备ID': 'Please fill in equipment ID',
  '请填写设备ID和日期': 'Please fill in equipment ID and date',
  '付款记录成功': 'Payment recorded successfully',
  '收款记录成功': 'Receipt recorded successfully',
  '审批成功': 'Approved successfully',
  '已发货': 'Shipped',
  '已发送': 'Sent',
  '已拒绝': 'Rejected',
  '已接受': 'Accepted',
  '成本卷积计算完成': 'Cost rollup completed',
  '物流信息已更新': 'Logistics info updated',
  '订单已确认': 'Order confirmed',
  '销售订单已创建': 'Sales order created',
  '请填写付款金额和日期': 'Please fill in payment amount and date',
  '请填写收款金额和日期': 'Please fill in receipt amount and date',
  '请填写科目编码和名称': 'Please fill in account code and name',
  '请填写编码和名称': 'Please fill in code and name',
  '请选择客户': 'Please select a customer',
  '请选择订单日期': 'Please select order date',
  '完工登记成功': 'Completion registered successfully',
  '开工成功': 'Started successfully',
  '异常报工已记录': 'Abnormal report recorded',
  '操作成功': 'Operation successful',
  '退料成功': 'Material returned successfully',
  '领料成功': 'Material picked successfully',
  '重试指令已发送': 'Retry command sent',
  '未找到工单': 'Work order not found',
  '请填写完成数量': 'Please fill in completion quantity',
  '请填写异常类型和原因': 'Please fill in exception type and reason',
  '请填写物料编码和数量': 'Please fill in material code and quantity',
  '请输入工单号': 'Please enter work order number',
  '请输入计划数量': 'Please enter planned quantity',
  '请选择物料': 'Please select material',
  '发料单创建成功': 'Issue order created successfully',
  '发料确认成功': 'Issue confirmed successfully',
  '取消成功': 'Cancelled successfully',
  '审核成功': 'Audited successfully',
  '导出成功': 'Exported successfully',
  '收货单创建成功': 'Receipt order created successfully',
  '收货确认成功': 'Receipt confirmed successfully',
  '确认成功': 'Confirmed successfully',
  '结算单创建成功': 'Settlement order created successfully',
  '新增成功': 'Added successfully',
  '新建成功': 'Created successfully',
  '激活成功': 'Activated successfully',
  '废止成功': 'Obsolete successfully',
  '签发成功': 'Published successfully',
  '覆盖成功': 'Overwritten successfully',
  '触发成功': 'Triggered successfully',
  '上传成功': 'Uploaded successfully',
  '修改成功': 'Modified successfully',
  '审批通过': 'Approved',
  '已提交审批': 'Submitted for approval',
  '评估已确认': 'Assessment confirmed',
  '重试已发起': 'Retry initiated',
  '复制成功，新路线已创建为草稿状态': 'Copied, new routing created as draft',
  '请选择日期': 'Please select a date',
  '请选择文件': 'Please select a file',
  '请选择关联 ECR': 'Please select related ECR',
  '请填写覆盖原因': 'Please fill in overwrite reason',
  '请填写描述': 'Please fill in description',
  '请填写工序名称': 'Please fill in operation name',
  '请输入工序编码': 'Please enter operation code',
  '请输入工序名称': 'Please enter operation name',
  '请输入路线编码': 'Please enter routing code',
  '请输入路线名称': 'Please enter routing name',
  '文件大小不能超过 50MB': 'File size cannot exceed 50MB',
  '处置成功': 'Disposed successfully',
  '处置失败': 'Dispose failed',
  '录入成功': 'Entered successfully',
  '录入失败': 'Entry failed',
  '数据点录入成功': 'Data point entered successfully',
  '结果录入成功': 'Result entered successfully',
  '新版本已发布': 'New version published',
  '验证结果已提交': 'Verification result submitted',
  '请填写检验项目ID和测量值': 'Please fill in inspection item ID and measured value',
  '请输入检验项目ID': 'Please enter inspection item ID',
  '处理成功': 'Processed successfully',
  '对账已确认': 'Reconciliation confirmed',
  '已关闭': 'Closed',
  '已取消': 'Cancelled',
  '已批准': 'Approved',
  '已接收': 'Received',
  '供应商已选定': 'Supplier selected',
  '询价已发送': 'RFQ sent',
  '协议已过期': 'Agreement expired',
  '采购订单已创建': 'Purchase order created',
  '请填写申请数量': 'Please fill in request quantity',
  '请填写拒绝原因': 'Please fill in rejection reason',
  '请选择供应商': 'Please select a supplier',
  '请选择订单日期': 'Please select order date',
  '追溯完成': 'Trace completed',
  '补录成功': 'Supplementary record successful',
  '冻结指令已发送': 'Freeze command sent',
  '评估已发起': 'Assessment initiated',
  '筛选已应用': 'Filter applied',
  '未找到对应批次': 'No matching batch found',
  '请输入追溯码': 'Please enter trace code',
  '请输入批次号': 'Please enter batch number',
  '请输入问题批次追溯码': 'Please enter problem batch trace code',
  '请描述问题原因': 'Please describe the problem reason',
  '报告生成中，请稍后下载': 'Report generating, please download later',
  '报告生成中，请稍后在报告列表查看': 'Report generating, check report list later',
  '入库成功': 'Inbound successful',
  '出库成功': 'Outbound successful',
  '冻结成功': 'Frozen successfully',
  '解冻成功': 'Unfrozen successfully',
  '库存调整成功': 'Inventory adjusted successfully',
  '复核完成': 'Review completed',
  '盘点已开始': 'Stocktake started',
  '审批通过，库存已调整': 'Approved, inventory adjusted',
  '请填写完整信息': 'Please fill in complete information',
  '确认成功': 'Confirmed successfully',
};

Object.keys(missingKeys).forEach(mod => {
  const zhPath = path.join('src', 'locale', 'zh-CN', mod + '.ts');
  const enPath = path.join('src', 'locale', 'en-US', mod + '.ts');
  
  // Process zh-CN
  let zhContent = fs.readFileSync(zhPath, 'utf8');
  // Find the last closing brace and add keys before it
  // We need to add keys at the appropriate nesting level
  // For simplicity, add them as flat keys under the module's top-level export
  const zhKeys = missingKeys[mod].map(k => `  '${k}': '${k}'`).join(',\n');
  
  // Find the last `}` and insert before it
  const lastBrace = zhContent.lastIndexOf('}');
  if (lastBrace !== -1) {
    // Check if we need a comma
    const beforeBrace = zhContent.substring(0, lastBrace).trimEnd();
    const needsComma = beforeBrace.endsWith(',') === false && beforeBrace.endsWith('{') === false && beforeBrace.endsWith(':') === false;
    const insert = (needsComma ? ',\n' : '\n') + zhKeys + ',\n';
    zhContent = zhContent.substring(0, lastBrace) + insert + zhContent.substring(lastBrace);
    fs.writeFileSync(zhPath, zhContent, 'utf8');
    console.log(`Added ${missingKeys[mod].length} keys to zh-CN/${mod}.ts`);
  }
  
  // Process en-US
  let enContent = fs.readFileSync(enPath, 'utf8');
  const enKeys = missingKeys[mod].map(k => {
    const en = enMap[k] || k;
    return `  '${k}': '${en}'`;
  }).join(',\n');
  
  const lastBraceEn = enContent.lastIndexOf('}');
  if (lastBraceEn !== -1) {
    const beforeBraceEn = enContent.substring(0, lastBraceEn).trimEnd();
    const needsCommaEn = beforeBraceEn.endsWith(',') === false && beforeBraceEn.endsWith('{') === false && beforeBraceEn.endsWith(':') === false;
    const insertEn = (needsCommaEn ? ',\n' : '\n') + enKeys + ',\n';
    enContent = enContent.substring(0, lastBraceEn) + insertEn + enContent.substring(lastBraceEn);
    fs.writeFileSync(enPath, enContent, 'utf8');
    console.log(`Added ${missingKeys[mod].length} keys to en-US/${mod}.ts`);
  }
});

console.log('\nDone!');
