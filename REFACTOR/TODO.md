# 分步实施 TODO 计划表

## Summary
这份 TODO 表按“先拆核心热点，再清理重复实现，最后固化边界和文档”的顺序组织。每一步都尽量做到可独立提交、可单独回归，避免一次性大重构把风险堆在一起。

## TODO Checklist

### Step 1 - 拆分 `LibraryWorkspace` 外层结构
- [ ] 明确 `LibraryWorkspace` 的最终职责只保留页面装配与状态分流。
- [ ] 抽出 bootstrap / ready 两大渲染分支，避免主组件同时承载所有 UI 分支。
- [ ] 将 setup、invalid-config、load-failed、loading-config 这些状态界面拆为独立展示组件。
- [ ] 保持现有行为不变，只调整结构，不改交互规则。
- [ ] 回归检查：启动配置流、错误态、ready 态切换保持一致。

### Step 2 - 拆分 library 数据 hooks
- [ ] 抽出 `useCollections`，负责 collection 加载、错误、展开基础状态。
- [ ] 抽出 `useLibraryItems`，负责 item list 加载、搜索、collection filter 关联刷新。
- [ ] 抽出 `useItemDetail`，负责右侧详情加载与错误态。
- [ ] 抽出 `useExpandedItemState`，负责 item expansion 与附件列表加载。
- [ ] 统一这几类 hook 的异步状态模型，避免继续手写重复的 `loading/error/reset` 模式。
- [ ] 回归检查：collection 切换、搜索、item 选择、展开附件行为不变。

### Step 3 - 拆分三栏 UI 组件
- [ ] 抽出 `CollectionPane`。
- [ ] 抽出 `ItemPane`。
- [ ] 抽出 `DetailPane`。
- [ ] 让 pane 组件尽量只接收数据和回调，不内嵌数据获取逻辑。
- [ ] 将无结果、加载中、错误态等局部占位内容下沉到各 pane 内部。
- [ ] 回归检查：三栏布局、按钮行为、筛选显示和提示文案不回退。

### Step 4 - 抽离虚拟列表和纯函数工具
- [ ] 将 `VirtualizedItemList` 从 `LibraryWorkspace.tsx` 中移出。
- [ ] 抽出虚拟滚动计算工具：row height、row offset、visible window。
- [ ] 抽出 collection tree 构建、node count、attachment display name、expanded height 计算等纯函数。
- [ ] 给虚拟滚动和 expansion 高度策略补最少量说明性注释。
- [ ] 回归检查：长列表滚动、展开行高度、overscan 行为不变。

### Step 5 - 拆分 `ZoteroService` 的内部职责
- [ ] 保留 `ZoteroService` 作为对外协调入口，不先改公开 API。
- [ ] 抽出 data-dir validation 模块。
- [ ] 抽出 readonly database access 模块。
- [ ] 抽出 collection queries 模块。
- [ ] 抽出 item/detail queries 模块。
- [ ] 抽出 attachment/path resolution 模块。
- [ ] 抽出 row mapper / formatter 模块。
- [ ] 回归检查：`getZoteroConfig`、`listCollections`、`listItems`、`getItemDetail`、`resolveItemDefaultPdf` 返回保持一致。

### Step 6 - 消除主进程重复查询和规则散落
- [ ] 收敛 `listItems` 与 `getItemDetail` 中重复的 title/date 查询片段。
- [ ] 统一 creator rows 聚合和 creatorsText 格式化位置。
- [ ] 单独固定 default PDF 选择规则，避免它继续散落在 service 主类内部。
- [ ] 为 snapshot fallback 策略补注释，说明何时触发、为什么存在。
- [ ] 回归检查：多 PDF 条目、无 PDF 条目、锁库时 fallback 行为正常。

### Step 7 - 清理 PDF 相关重复实现
- [ ] 确认 `src/renderer/src/pdf/pdfViewer.tsx` 是正式 reader 入口。
- [ ] 处理 `src/renderer/src/components/PDFViewer.tsx`：
  - [ ] 若废弃则删除。
  - [ ] 若暂留则迁移为明确的 `legacy` 位置并标注不参与当前主流程。
- [ ] 梳理 `AppShell` 到正式 PDF viewer 的引用链，确保入口唯一。
- [ ] 回归检查：reader tab 仍能正常打开 PDF。

### Step 8 - 清理 `pdfToolBar.tsx` 遗留代码
- [ ] 删除大段失效注释代码，尤其是旧框架语法残留。
- [ ] 保留仍有价值的思路时，将其转移到文档或 issue，而不是留在主组件中。
- [ ] 清理明显临时 `console.*` 调试输出。
- [ ] 如果 toolbar 仍偏大，继续拆出按钮组或 action helpers。
- [ ] 回归检查：缩放、旋转、上传调试入口等当前有效功能保持可用。

### Step 9 - 统一 renderer 状态边界与命名
- [ ] 明确 app shell / library / reader 三层状态边界。
- [ ] 统一命名规则：
  - [ ] `Workspace` 只用于应用级工作区。
  - [ ] `Pane` 只用于三栏区域。
  - [ ] `Viewer` / `Reader` 只用于 PDF 阅读器。
- [ ] 检查 `components`、`app`、`pdf`、`zotero` 目录是否还存在职责混放。
- [ ] 必要时调整目录结构，让业务实现不要再落入通用 `components`。
- [ ] 回归检查：重命名和迁移后导入关系清晰且无循环依赖。

### Step 10 - 固化工程文档和回归基线
- [ ] 更新 `TODO.md`，将“功能推进”与“结构治理”分成两条主线。
- [ ] 新增简短架构文档，说明 renderer/preload/main 分层。
- [ ] 文档化当前正式 PDF viewer 入口和 Zotero 只读访问策略。
- [ ] 为关键纯函数和查询模块补最小单元测试。
- [ ] 沉淀手工回归清单：
  - [ ] Zotero 配置流
  - [ ] collection 过滤
  - [ ] 搜索
  - [ ] item detail
  - [ ] default PDF 打开
  - [ ] reader tab 基本行为

## 实施节奏建议
1. 第一轮提交只做 Step 1-4，目标是拆掉 `LibraryWorkspace`。
2. 第二轮提交做 Step 5-6，目标是拆掉 `ZoteroService`。
3. 第三轮提交做 Step 7-8，目标是清理 PDF 重复实现和遗留代码。
4. 第四轮提交做 Step 9-10，目标是统一边界并补足文档与测试。

## Assumptions
- 默认这是一次“结构治理”计划，不顺手扩展新功能。
- 默认每个 step 都应该能独立通过基本回归，不依赖一次性合并大改。
- 默认对外 preload API 和用户可见功能保持稳定，除非某一步明确需要小范围调整。
