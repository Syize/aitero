# Aitero 首版主界面与 Zotero 文献库接入计划

## Summary
目标是把当前“仅 PDF 阅读器”扩展为一个桌面文献管理主界面，首版采用 `本地 Zotero 数据目录手动选择`、`只读接入`、`三栏主界面`、`应用内多标签 PDF 阅读器` 的方案。主窗口固定承载文献库界面，双击文献后在顶部新增 PDF 标签页；首版只为 PDF 打开标签，不把所有视图都标签化。

## Implementation Changes
### 1. 应用壳与导航
- 将当前 `App -> PDFViewer` 的单页结构改为应用壳：顶部标签栏 + 主内容区。
- 主内容区至少包含两类视图：
  1. `LibraryWorkspace`：三栏主界面。
  2. `ReaderWorkspace`：复用现有 PDF 阅读器能力，按标签承载。
- 不引入复杂路由库；首版用应用内状态驱动视图切换即可，避免在 Electron 首版过早增加 URL 路由复杂度。
- 标签模型固定为：
  - 一个不可关闭的主库标签。
  - 多个可关闭的 PDF 阅读标签。
  - 激活标签决定当前内容区显示的 workspace。

### 2. Zotero 数据接入
- 在主进程新增只读 Zotero 数据服务，负责：
  - 保存和读取用户选定的 Zotero 数据目录。
  - 校验目录内关键文件是否存在。
  - 读取 Zotero SQLite 中的 collections、items、creators、itemData、attachments 所需最小字段。
  - 解析 PDF 附件真实路径。
- Renderer 不直接碰文件系统和 SQLite；统一经 preload 暴露的只读 API 调用主进程。
- 首版目录策略：
  - 首次启动若未配置目录，进入“选择 Zotero 数据目录”流程。
  - 由用户手动选择，保存配置，后续启动自动复用。
- 首版数据范围：
  - 读取文献条目、集合树、作者、年份、标题、附件信息。
  - 不写入 Zotero 数据库，不修改附件，不回写阅读状态。
- 首版附件打开规则：
  - 双击文献时优先打开稳定规则下的“默认 PDF”。
  - 若存在多个 PDF，先按固定优先级选择一个；其余附件可在右侧详情区列出，后续再扩展切换能力。
  - 若没有 PDF，阻止打开并给出提示。

### 3. 三栏主界面
- 左栏：集合树
  - 至少支持“全部文献”与真实 collection 树。
  - 点击 collection 后刷新中栏列表。
- 中栏：文献列表
  - 显示首版核心字段：标题、作者摘要信息、年份。
  - 支持按 `标题 / 作者 / 年份` 搜索过滤。
  - 双击文献触发“解析默认 PDF 并新开阅读标签”。
- 右栏：详情面板
  - 显示文献基础元数据与附件列表。
  - 用于解释“该条目无 PDF”或“有多个附件”的状态。
- UI 风格上参考 Zotero 的信息密度和布局逻辑，但不追求 1:1 复刻；首版优先保证层级清晰和桌面效率。

### 4. PDF 阅读器接入
- 保留现有 `src/renderer/src/pdf` 体系，不重写阅读器。
- 新增一个“按路径/二进制载入 PDF”的适配层，让阅读器不再只依赖 toolbar 中的手动上传。
- 将当前上传按钮降级为阅读器内部调试入口或后续移除，主入口改为文献列表双击打开。
- Reader 标签状态至少包含：
  - `tabId`
  - `itemId`
  - `attachmentId`
  - `title`
  - `pdfPath`
  - 可选的初始页码/阅读状态占位
- 关闭标签时只销毁对应 reader 实例，不影响其他标签或主库页。

### 5. 状态与类型
- 新增应用级状态，不与现有 `PDFProvider` 混在一起。
- 建议新增最小接口/类型：
  - `ZoteroLibrarySummary`
  - `ZoteroCollectionNode`
  - `ZoteroItemListEntry`
  - `ZoteroItemDetail`
  - `ZoteroAttachment`
  - `WorkspaceTab`
  - `ReaderTabState`
  - `LibraryFilterState`
- preload API 至少包括：
  - `selectZoteroDataDir()`
  - `getZoteroConfig()`
  - `listCollections()`
  - `listItems(query, collectionId)`
  - `getItemDetail(itemId)`
  - `resolveItemDefaultPdf(itemId)`
- 数据访问层与 UI 层之间只传结构化 DTO，不把 SQLite 表结构直接泄漏到组件。

## Public APIs / Interfaces
- `window.api.zotero.*`：新增只读 Zotero IPC API，作为 renderer 唯一数据入口。
- 应用级 tab/workspace store：负责主库标签与 reader 标签管理。
- `PDFViewer` 或其上层新增外部输入接口：允许根据 `pdfPath` 或加载后的文件对象直接打开指定 PDF，而不是只靠用户本地上传。

## Test Plan
- 启动时未配置 Zotero 目录：
  - 显示选择目录入口。
  - 选择无效目录时给出错误提示。
  - 选择有效目录后能进入主界面。
- 集合树与文献列表：
  - 能加载全部文献。
  - 点击 collection 后列表按 collection 过滤。
  - 搜索可按标题、作者、年份过滤结果。
- 双击打开：
  - 有 PDF 的文献可新开标签并进入阅读器。
  - 无 PDF 的文献不会打开标签，并显示提示。
  - 多个 PDF 的文献按默认规则打开一个稳定附件。
- 标签行为：
  - 可连续打开多个 PDF。
  - 切换标签不会破坏其他标签状态。
  - 关闭一个 reader 标签不会影响主库页和其他 reader。
- 阅读器接入：
  - 从主界面打开的 PDF 保持现有缩放、旋转、文字选择能力可用。
- 回归检查：
  - 现有手动加载 PDF 的开发路径在过渡期仍可工作，直到被明确移除。

## Assumptions
- 首版仅支持“本机已存在的 Zotero 数据目录”，不处理 Zotero 账户登录和 Web API 同步。
- 首版只读，不写回 Zotero 数据库，也不做注释、标签、笔记同步。
- 首版只为 PDF 阅读器提供多标签；主界面本身固定为单个库工作区。
- 首版不处理复杂条目类型差异，只覆盖“文献条目 + PDF 附件”这一主路径。
- 若后续你希望把计划沉淀到仓库中，默认应落到根目录 `TODO.md`，便于你继续细化阶段顺序。
