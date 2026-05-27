---
name: auto-lifecycle-tester
description: 工业级全链路功能审计猎手。具备动态菜单感知、任务状态持久化、断点续测、弹层组件穿透及业务数据闭环校验能力。
dependencies: playwright-core, typescript, lodash-es
---

# 全链路数据生命周期闭环测试猎手 (Master SOP v3)

## 0. 启动凭证与环境协议
- 凭证注入：启动后自动填充，禁止人工交互
  - Tenant: `DEFAULT`
  - Username: `admin`
  - Password: `Admin@123456`
- 环境锁定：默认 `http://localhost:5173`（可由 `E2E_BASE_URL` 覆盖）
- 浏览器策略：
  - 默认 `chromium` + `headless: true`
  - 启用崩溃保护：单模块执行，模块结束后可重建 context
  - 任一页面检测到白屏/崩溃，立即 `browser.close()` 并进入诊断模式

## 1. 任务队列与状态持久化 (Checkpointing)
- 状态文件：`test-state.json`
- 启动时：
  1. 若 `test-state.json` 不存在：登录后扫描侧边栏 `a-menu-item` 生成清单
  2. 若存在：加载并从首个 `pending` 任务继续
- 清单结构：
```json
{
  "meta": { "baseUrl": "", "startedAt": "", "updatedAt": "", "version": "3.0" },
  "modules": {
    "/path": {
      "name": "",
      "status": "pending|running|completed|failed|skipped",
      "hasTimePicker": false,
      "hasTabs": false,
      "tabNames": [],
      "actions": [
        {
          "id": "action-001",
          "name": "",
          "type": "create|edit|view|delete|toggle|execute|export|import|unknown",
          "status": "pending|running|completed|failed|skipped",
          "retries": 0,
          "error": ""
        }
      ]
    }
  }
}
```
- 原子落库：每完成一个动作立即写盘；异常时先写失败状态再抛出

## 2. 动态权限探索协议 (Dynamic Discovery)
- 禁止静态路由表；必须登录后从 UI 侧边栏实时发现菜单
- 黑名单（路径与标题双重过滤）：
  - `login`, `403`, `404`
  - `sys/user`, `sys/role`, `sys/permission`, `auth`
- 菜单可见性判定：
  - 必须是可点击、非折叠占位、非隐藏节点
  - 去重后生成模块任务

## 3. 页面功能分析协议 (Page Analysis)
### 3.1 页面类型判定
每个页面必须先判定类型再决定测试策略：
- **CRUD 列表页**: 有 `<table>` + 新建按钮 + 操作列
- **树形结构页**: 有 `.arco-tree-node` (如 ERP/科目管理、系统管理/组织架构)
- **看板/Dashboard**: 有 `<canvas>` 或 `[class*="dashboard"]`
- **报表页**: 只有查询条件 + 导出按钮
- **只读页面**: 有表格但无新建/编辑按钮

### 3.2 Tab 子功能检测
**必须检测页面是否有 Tab 切换！** 很多页面有多个 Tab，每个 Tab 是独立功能：
```js
// 检测 Tab 的方法
const tabs = document.querySelectorAll('[role="tab"], .arco-tabs-tab');
// 或检测 flex 布局的可点击子元素
const divs = document.querySelectorAll('main div');
for (const d of divs) {
  const children = Array.from(d.children);
  if (children.length >= 2 && children.length <= 8) {
    const texts = children.map(c => c.textContent?.trim()).filter(t => t && t.length < 15);
    if (texts.length >= 2 && getComputedStyle(d).display.includes('flex')) {
      if (getComputedStyle(children[0]).cursor === 'pointer') {
        // 这是 Tab 组
      }
    }
  }
}
```
- **每个 Tab 都要单独测试其 CRUD 功能**
- 典型案例: WMS/仓库管理 有 3 个 Tab (仓库管理/库区管理/货位管理)

### 3.3 多表格页面检测
有些页面有多个 `<table>`，每个对应不同 Tab：
```js
const tables = document.querySelectorAll('table');
// 遍历每个 table 检查 headers 和 rows
```

### 3.4 操作按钮检测
**必须同时检测 `<a>` 和 `<button>` 元素！** 不同模块使用不同元素：
```js
const ops = [];
row.querySelectorAll('a.arco-link, button.arco-btn-text, button').forEach(el => {
  const t = el.textContent?.trim();
  if (t && t.length < 10 && !ops.includes(t)) ops.push(t);
});
```

## 4. 通用动作引擎 (Universal Action Engine)
### 4.1 动作识别（不依赖固定文案）
- 优先级顺序：
  1. `data-testid` / `aria-label` / `title`
  2. 按钮文本关键字
  3. icon class 语义（`edit/delete/eye/play/send/check/close/download/upload`）
- 类型映射（可多语言）：
  - `create`: 新增/创建/add/new
  - `edit`: 编辑/修改/edit/update
  - `view`: 查看/详情/view/detail
  - `delete`: 删除/作废/移除/delete/remove/cancel
  - `execute`: 生效/下发/计算/执行/审核/发布/提交/过账/完工
  - `toggle`: 启用/停用/开关
  - `export/import`: 导入/导出/upload/download
  - 未命中 => `unknown`，记录到 `unhandled_actions.md`

### 4.2 表格操作列遍历
- 扫描首屏可见行（默认前 5 行，避免高成本）
- 对每行操作列的所有按钮逐个执行
- 每个动作执行后必须做"反馈判定"：
  - 任一满足即认为有反馈：
    - 成功/失败消息 (`a-message`)
    - 弹窗打开/关闭状态变化
    - 网络响应返回（`status in 200..299`）
    - 列表数据或字段发生变化
  - 无反馈 => 记入 `unhandled_actions.md`

## 5. Arco 组件穿透与稳定定位策略（核心）

### 5.0 关键原则
- **Select/Dropdown 的选项**: 必须用 `page.mouse.move/down/up`（不能用 JS click）
- **保存/取消按钮**: 必须用 JS `btn.click()`（不能用 mouse.click）
- **文本输入**: 用 `nativeInputValueSetter` + dispatchEvent
- **所有下拉选择后必须按 Escape 关闭弹层**

### 5.1 普通 Select 下拉选择
```js
// 1. 获取触发器坐标
const trigger = formItem.querySelector('.arco-select-view');
const rect = trigger.getBoundingClientRect();
// 2. 点击触发器打开弹层
await page.mouse.click(rect.x + rect.width/2, rect.y + rect.height/2);
await page.waitForTimeout(600);
// 3. 在可见弹层中找到选项并 mouse 点击
const opt = popup.querySelector('.arco-select-option');
const optRect = opt.getBoundingClientRect();
await page.mouse.move(optRect.x + optRect.width/2, optRect.y + optRect.height/2);
await page.waitForTimeout(50);
await page.mouse.down();
await page.waitForTimeout(30);
await page.mouse.up();
await page.waitForTimeout(300);
// 4. 关闭弹层
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
```
- **弹层容器**: `.arco-trigger-popup`（不是 `.arco-select-dropdown`）
- **可见性判断**: `popup.offsetHeight > 0 && getComputedStyle(popup).display !== 'none'`
- **选项选择器**: `li.arco-select-option` 或 `.arco-select-option:not(.arco-select-option-content)`
- **绝对不能用**: `element.click()` — Arco Select 监听 mousedown/mouseup，不响应 click

### 5.2 远程搜索 Select (如物料选择器)
- **识别方式**: `input.arco-select-view-input` 且 placeholder 含"搜索"
```js
// 1. 点击搜索框
await page.mouse.click(searchX, searchY);
await page.waitForTimeout(300);
// 2. 输入搜索关键词
await page.keyboard.type('MAT', { delay: 50 });
await page.waitForTimeout(1000); // 等待 API 返回
// 3. mouse 点击第一个选项
await page.mouse.move(optX, optY);
await page.waitForTimeout(50);
await page.mouse.down();
await page.waitForTimeout(30);
await page.mouse.up();
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
```
- **搜索关键词**: 用已有数据的前缀如 'MAT'，不要用 'AT'（可能匹配不到）

### 5.3 Tree-Select 树选择（如物料分类）
```js
// 1. JS click 触发器打开树
formItem.querySelector('.arco-select-view').click();
await page.waitForTimeout(600);
// 2. 找到第一个叶节点并 mouse 点击
const leaf = document.querySelector('.arco-tree-node-is-leaf .arco-tree-node-title');
const rect = leaf.getBoundingClientRect();
await page.mouse.move(rect.x + rect.width/2, rect.y + rect.height/2);
await page.waitForTimeout(50);
await page.mouse.down();
await page.waitForTimeout(30);
await page.mouse.up();
```

### 5.4 DatePicker 日期选择器
```js
// 1. 点击后缀图标打开 picker
await page.evaluate(() => { icon.click(); });
await page.waitForTimeout(600);
// 2. 用 locator.click({force:true}) 点击日期格子
await page.locator('.arco-trigger-popup .arco-picker-cell')
  .filter({ hasText: /^15$/ })
  .first()
  .click({ force: true });
```

### 5.5 TimePicker 时间选择器
**未解决！** 7 种方法全部失败。遇到 TimePicker 的页面标记为 `skipped`。

### 5.6 InputNumber 数值输入
**需要改源码！** 将 `MForm/index.vue` 中的 `<a-input-number>` 替换为 `<a-input inputmode="numeric">`。
- TS 注意: Arco `a-input` 的 type 只支持 `"text" | "password"`，用 `inputmode="numeric"` 替代
- 填充: `page.locator('input[type="number"]').fill('100', { force: true })`

### 5.7 文本输入
```js
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, value);
input.dispatchEvent(new Event('input', { bubbles: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));
```

### 5.8 Textarea
同上，用 `HTMLTextAreaElement.prototype.value` 的 setter。

### 5.9 保存按钮
**必须用 JS click！** mouse.click 会被 drawer 遮罩拦截：
```js
await page.evaluate(() => {
  document.querySelectorAll('.arco-drawer-body button').forEach(btn => {
    if (btn.textContent?.trim() === '保存') btn.click();
  });
});
```

### 5.10 Popconfirm 确认框
删除操作通常用 Popconfirm 而非 Modal：
```js
const pc = document.querySelector('.arco-popconfirm, .arco-popover');
if (pc) {
  for (const b of pc.querySelectorAll('button')) {
    if (b.textContent?.trim() === '确定') { b.click(); return; }
  }
}
```

## 6. 数据闭环校验 (Integrity Assertions)
### 6.1 新增闭环
- 记录 `Count_Initial`
- 完成新增后断言 `Count_Final > Count_Initial`
- 列表中必须出现测试编码（如 `AT-${timestamp}`）
- **必须检查数据完整性**: 新增的行每列是否都有值，不能只有操作列有按钮

### 6.2 修改闭环
- 修改关键字段后提交
- 重新查询并断言字段值已变更（禁止只看 toast）
- 验证方式: `beforeRow.cells[1] !== afterRow.cells[1]`

### 6.3 删除闭环
- **注意**: 系统可能使用逻辑删除（软删除）
- 验证方式:
  1. 检查 API 响应状态码（204 也是成功）
  2. 刷新页面后检查列表数量是否减少
  3. 不要只依赖前端 toast 消息

### 6.4 状态变更闭环
- 记录变更前的状态字段值
- 执行状态变更操作
- 验证状态字段值已改变

## 7. 模块间数据依赖处理
- 很多模块依赖其他模块的数据（如发货单依赖销售订单、库区依赖仓库）
- **测试顺序**: 按依赖链从基础模块到业务模块
- **依赖链示例**:
  - 物料 → BOM → 工单 → 领料 → 入库
  - 仓库 → 库区 → 货位 → 库存
  - 客户 → 销售订单 → 发货单 → 退货单
  - 供应商 → 采购订单 → 到货记录
- **远程搜索 Select 无选项**: 如果搜索关键词匹配不到数据，说明前置模块没有测试数据
- **解决方案**: 先确保前置模块有数据，再测试依赖模块

## 8. 常见 Bug 模式检测
### 8.1 i18n 模板表达式
检测抽屉标题是否包含 JS 表达式：
```js
const title = document.querySelector('.arco-drawer-title')?.textContent?.trim();
if (title?.includes('?') && title?.includes(':')) {
  // 这是未解析的 Vue 模板表达式，记录为 Bug
}
```

### 8.2 i18n key 未翻译
检测标题/按钮/表头是否显示英文 key：
```js
if (title?.includes('.') && !title?.includes(' ') && title?.length < 30) {
  // 可能是 i18n key
}
```

### 8.3 查看按钮打开新建抽屉
"查看"操作应该打开只读详情页或抽屉，不应打开新建表单。

### 8.4 Tab 共用 Drawer 组件
多个 Tab 的表单不应共用同一个 Drawer，否则字段会混乱。

## 9. 组件交互踩坑记录

### 9.1 Select 选中后仍报"不能为空"
- 部分 Select 组件即使用 mouse.down/up 选中，后端仍报空
- 可能原因: 这些组件的 v-model 绑定方式不同，或使用了自定义 onChange 处理
- 排查方向: 检查组件源码中的 `@change` 或 `v-model` 绑定方式

### 9.2 远程搜索 Select 搜索关键词
- 搜索 'AT' 可能匹配不到数据（取决于已有数据）
- 更安全的关键词: 用已有数据的前缀，如 'MAT'、数字等
- 或者先清空搜索框再输入，避免残留字符影响

### 9.3 nativeInputValueSetter 对多字段不稳定
- 对多个字段循环使用 nativeInputValueSetter 时，只有最后一个生效
- 解决: 对每个字段单独操作，或改用 `locator.fill({force:true})`

### 9.4 Drawer 遮罩拦截问题
- Arco Drawer 的 `.arco-drawer-mask` 会拦截所有 mouse 事件
- Select 弹层不受影响（teleport 到 body 下）
- InputNumber/TimePicker 受影响（在 Drawer 内部）
- `fill({force:true})` 能绕过遮罩但不触发 v-model

### 9.5 测试脚本设计教训
- 遇到组件交互困难时不要放弃，应该找到正确的交互方式
- 自己的技术问题要立即记录，避免下次重复踩坑
- 一次性覆盖所有模块，不要一个一个测

## 10. 故障熔断与诊断 (Fault Tolerance)
- 轻微 Bug：写入 `business_bug.md`，继续执行
- 严重故障（白屏/崩溃）：
  1. 立即停止当前模块
  2. 关闭浏览器释放内存
  3. 进入诊断模式：定位对应 `.vue` 页面源码、记录可疑堆栈位置
  4. 输出"阻断级"结论并终止本轮

## 11. 报告输出规范
| 业务模块 | 页面路径 | Tab | 操作类型 | 测试数据 | 接口状态 | 数据验证 | 结论 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |

- 额外产物：
  - `test-state.json`：断点状态
  - `unhandled_actions.md`：未识别/无反馈动作
  - `business_bug.md`：业务缺陷记录
  - `audit-report-final.md`：最终汇总报告
  - `page-inventory.md`：页面功能清单

## 12. 执行原则
- **一次性覆盖所有模块**: 不要一个一个测，应该批量脚本一次跑完
- **不要等用户追问才继续**: 发现问题记录后立即继续下一个模块
- **自己的技术问题要立即记录**: 避免下次重复踩坑
- 先保活、再覆盖、后深挖
- 任何一步失败必须可恢复、可追踪、可复现
- 不修改业务系统源码；仅通过测试脚本与状态文件运行
