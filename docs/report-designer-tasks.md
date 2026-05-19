# 报表设计器 + 文件在线预览 — 详细任务文档

> 创建时间：2026-05-18
> 关联主文档：task-list.md #78-#81

---

## 一、报表设计器

### 1.1 技术选型

| 组件 | 推荐方案 | 说明 |
|------|----------|------|
| 大屏拖拽框架 | `@vue-flow/core` 或自研 Grid 布局 | 轻量级，支持拖拽、缩放、吸附 |
| 图表库 | `ECharts`（已有） | 已在监控页使用，功能全面 |
| 表格组件 | 现有 `MTable` 扩展 | 复用项目已有组件 |
| PDF 导出 | `jspdf` + `html2canvas` | 前端直接生成，无需后端 |
| Excel 导出 | `exceljs` | 支持样式、公式、多 Sheet |
| 数据源查询 | 后端统一 API | 避免前端直连数据库 |

### 1.2 数据模型设计

#### 报表定义表 `rpt_report_definition`

```sql
CREATE TABLE rpt_report_definition (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id     VARCHAR(50) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  type          VARCHAR(20) NOT NULL,  -- DASHBOARD | TABLE | CHART | MIXED
  layout        JSON NOT NULL,         -- 布局配置（组件位置、尺寸）
  components    JSON NOT NULL,         -- 组件列表（图表配置、表格列定义等）
  data_sources  JSON NOT NULL,         -- 数据源配置（API 端点、参数映射）
  is_template   TINYINT DEFAULT 0,     -- 是否为模板
  status        VARCHAR(20) DEFAULT 'ACTIVE',
  created_by    BIGINT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    TIMESTAMP NULL,
  INDEX idx_rpt_def_tenant (tenant_id),
  INDEX idx_rpt_def_template (is_template, status)
);
```

#### 报表快照表 `rpt_report_snapshot`（历史版本）

```sql
CREATE TABLE rpt_report_snapshot (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id     VARCHAR(50) NOT NULL,
  report_id     BIGINT NOT NULL,
  version       INT NOT NULL,
  layout        JSON NOT NULL,
  components    JSON NOT NULL,
  data_sources  JSON NOT NULL,
  created_by    BIGINT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rpt_snap_report (report_id, version DESC)
);
```

### 1.3 后端任务

| # | 任务 | 说明 | 复杂度 |
|---|------|------|--------|
| R1 | 创建实体 `RptReportDefinition` + `RptReportSnapshot` | TypeORM 实体定义 | 低 |
| R2 | 创建 `RptModule` + `RptController` + `RptService` | CRUD + 版本管理 | 中 |
| R3 | 数据源查询 API `POST /api/v1/rpt/query` | 接收数据源配置，执行查询返回结果 | 中 |
| R4 | 预设模板种子数据 | 生产看板、销售分析、质量统计等预设模板 | 低 |
| R5 | 报表权限控制 | `rpt:report:view` / `rpt:report:edit` / `rpt:report:export` | 低 |
| R6 | 报表导出 API `POST /api/v1/rpt/:id/export` | 后端渲染 PDF（可选，也可前端生成） | 中 |

### 1.4 前端任务

| # | 任务 | 说明 | 复杂度 |
|---|------|------|--------|
| F1 | 报表列表页 `views/rpt/list/index.vue` | 报表 CRUD 列表，模板选择 | 低 |
| F2 | 报表设计器主页面 `views/rpt/designer/index.vue` | 画布 + 组件面板 + 属性面板 | 高 |
| F3 | 组件库 — 图表组件 | ECharts 封装：折线图、柱状图、饼图、仪表盘、雷达图 | 中 |
| F4 | 组件库 — 表格组件 | 可配置列、排序、分页的表格 | 中 |
| F5 | 组件库 — 指标卡组件 | 数字展示、趋势箭头、同比环比 | 低 |
| F6 | 组件库 — 文本/图片组件 | 静态内容展示 | 低 |
| F7 | 组件库 — 筛选器组件 | 日期范围、下拉选择、输入框 | 低 |
| F8 | 拖拽布局引擎 | 组件拖拽到画布、调整大小、对齐吸附 | 高 |
| F9 | 数据源配置面板 | 选择 API 端点、映射字段、设置参数 | 中 |
| F10 | 报表预览页 `views/rpt/preview/index.vue` | 只读渲染，支持交互（筛选、下钻） | 中 |
| F11 | PDF 导出 | jspdf + html2canvas 前端生成 | 中 |
| F12 | Excel 导出 | exceljs 前端生成 | 中 |
| F13 | 报表模板市场 | 预设模板浏览、一键复制到租户 | 低 |

### 1.5 大屏设计器交互设计

```
┌─────────────────────────────────────────────────────────────┐
│  报表设计器                                    [预览] [导出] [保存] │
├──────────┬──────────────────────────────────┬───────────────┤
│ 组件面板  │         画布区域                   │  属性面板      │
│          │                                  │               │
│ [图表]    │  ┌─────────┐  ┌─────────┐       │  组件属性      │
│  折线图   │  │  指标卡   │  │  柱状图  │       │  - 标题       │
│  柱状图   │  │  12,345  │  │  █████  │       │  - 数据源     │
│  饼图    │  │  ↑ 12%   │  │  █████  │       │  - 颜色       │
│  仪表盘   │  └─────────┘  └─────────┘       │  - 字体       │
│          │                                  │               │
│ [表格]    │  ┌─────────────────────────┐    │  布局属性      │
│  数据表格  │  │  明细表格               │    │  - X / Y      │
│          │  │  列1  列2  列3  列4      │    │  - 宽 / 高     │
│ [指标]    │  │  ...  ...  ...  ...     │    │  - 层级       │
│  数字卡   │  └─────────────────────────┘    │               │
│  趋势卡   │                                  │               │
│          │                                  │               │
│ [其他]    │                                  │               │
│  文本    │                                  │               │
│  图片    │                                  │               │
│  筛选器   │                                  │               │
└──────────┴──────────────────────────────────┴───────────────┘
```

### 1.6 预设报表模板

| 模板名 | 类型 | 包含组件 | 适用模块 |
|--------|------|----------|----------|
| 生产日报 | 大屏 | 产量指标卡、工单进度图、质量饼图、异常趋势 | MES |
| 仓储看板 | 大屏 | 库存指标卡、周转率图、安全库存预警表 | WMS |
| 销售分析 | 报表 | 销售趋势折线图、客户排名表、区域分布饼图 | ERP |
| 供应商绩效 | 报表 | 交期达成率、质量合格率、价格对比表 | SCM |
| 设备 OEE | 大屏 | OEE 仪表盘、故障趋势、维保计划表 | EAM |
| 质量统计 | 报表 | 不合格品趋势、SPC 控制图、CAPA 跟踪表 | QMS |
| 财务概览 | 报表 | 收入支出趋势、应收账款账龄、现金流表 | ERP |

### 1.7 执行计划

```
Phase 1（1 周）：基础框架
  → R1 实体定义
  → R2 CRUD API
  → F1 报表列表页
  → F8 拖拽布局引擎（Grid 方案）

Phase 2（2 周）：组件开发
  → F3-F7 各类组件
  → F9 数据源配置
  → R3 数据源查询 API

Phase 3（1 周）：导出 + 模板
  → F11 PDF 导出
  → F12 Excel 导出
  → R4 预设模板
  → F13 模板市场

Phase 4（1 周）：预览 + 优化
  → F10 报表预览页
  → R5 权限控制
  → 响应式适配
```

---

## 二、文件在线预览与编辑

### 2.1 功能需求

| 功能 | 说明 |
|------|------|
| PDF 预览 | 内嵌 PDF 阅读器，支持翻页、缩放、搜索 |
| 图片预览 | 支持 JPG/PNG/GIF/SVG，缩放、旋转 |
| Office 文档预览 | Word/Excel/PPT 在线查看（不依赖本地 Office） |
| 文本预览 | TXT/CSV/JSON/XML 语法高亮 |
| 在线编辑 | 纯文本文件可在线编辑保存 |
| 版本管理 | 编辑后保留历史版本 |

### 2.2 技术选型

| 文件类型 | 预览方案 | 编辑方案 |
|----------|----------|----------|
| PDF | `pdf.js`（Mozilla 开源） | 不支持（只读） |
| 图片 | 原生 `<img>` + 查看器 | 不支持（只读） |
| Word/Excel/PPT | `mammoth.js`(Word) / `SheetJS`(Excel) | `OnlyOffice` 或 `Collabora`（重量级） |
| 纯文本 | `CodeMirror 6` / `Monaco Editor` | 同预览，可编辑 |
| CSV | `SheetJS` 渲染为表格 | 可编辑表格 |

### 2.3 后端任务

| # | 任务 | 说明 | 复杂度 |
|---|------|------|--------|
| D1 | 文件预览 API `GET /api/v1/files/:id/preview` | 返回文件流 + Content-Disposition: inline | 低 |
| D2 | 文件版本管理 | 上传同名文件时保留旧版本 | 中 |
| D3 | 文件编辑保存 API `PUT /api/v1/files/:id/content` | 接收编辑后的文本内容，创建新版本 | 低 |
| D4 | Office 文档转换 API（可选） | LibreOffice/Pandoc 后端转换 Office → PDF | 高 |

### 2.4 前端任务

| # | 任务 | 说明 | 复杂度 |
|---|------|------|--------|
| V1 | 文件预览组件 `components/FilePreview/index.vue` | 根据文件类型自动选择预览方式 | 中 |
| V2 | PDF 预览器 | 集成 `pdf.js`，支持翻页/缩放/搜索 | 中 |
| V3 | 图片查看器 | 缩放/旋转/全屏 | 低 |
| V4 | 文本编辑器 | 集成 `CodeMirror 6`，语法高亮，保存按钮 | 中 |
| V5 | CSV/Excel 表格预览 | `SheetJS` 渲染为可排序表格 | 低 |
| V6 | Office 文档预览 | `mammoth.js`(Word) 或 iframe 嵌入在线预览服务 | 中 |
| V7 | 版本历史面板 | 显示文件修改历史，支持回滚 | 低 |
| V8 | 集成到文件管理页面 | 文件列表增加"预览"按钮 | 低 |

### 2.5 预览组件交互

```
┌─────────────────────────────────────────────────┐
│  文件预览                          [下载] [编辑] [关闭] │
├─────────────────────────────────────────────────┤
│                                                 │
│   ┌─────────────────────────────────────────┐   │
│   │                                         │   │
│   │         文件内容预览区域                   │   │
│   │                                         │   │
│   │   PDF: 翻页控件 + 缩放                    │   │
│   │   图片: 缩放/旋转                         │   │
│   │   文本: 语法高亮编辑器                     │   │
│   │   Excel: 可排序表格                       │   │
│   │                                         │   │
│   └─────────────────────────────────────────┘   │
│                                                 │
│  版本历史：v3 (2026-05-18) | v2 | v1            │
└─────────────────────────────────────────────────┘
```

### 2.6 执行计划

```
Phase 1（3 天）：基础预览
  → V1 文件预览组件框架
  → V2 PDF 预览
  → V3 图片查看器
  → V8 集成到文件管理页面

Phase 2（3 天）：文本编辑
  → V4 文本编辑器（CodeMirror 6）
  → D3 文件编辑保存 API
  → D2 文件版本管理
  → V7 版本历史面板

Phase 3（2 天）：Office 文档
  → V5 CSV/Excel 预览
  → V6 Word 预览（mammoth.js）
  → D1 预览 API 优化
```

---

## 三、新增依赖

```json
{
  "dependencies": {
    "pdfjs-dist": "^4.0.0",
    "codemirror": "^6.0.0",
    "@codemirror/lang-json": "^6.0.0",
    "@codemirror/lang-sql": "^6.0.0",
    "@codemirror/lang-xml": "^6.0.0",
    "mammoth": "^1.6.0",
    "xlsx": "^0.18.5",
    "jspdf": "^2.5.0",
    "html2canvas": "^1.4.0",
    "exceljs": "^4.4.0"
  }
}
```

---

## 四、与主任务清单的关联

| 主清单编号 | 对应子任务 |
|-----------|-----------|
| #78 大屏设计器 | R1-R6, F1-F13 |
| #79 报表模板管理 | R4, F13 |
| #80 报表数据源配置 | R3, F9 |
| #81 报表导出 | F11, F12, R6 |
| 新增：文件在线预览 | D1-D4, V1-V8 |
