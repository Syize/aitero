# 项目拆分与梳理优先级计划

## Summary
目标不是立刻“全面重写”，而是先拆掉当前最影响维护效率的结构性热点，再整理边界、清理遗留实现，最后补足规范和回归检查。优先级判断基于两个标准：`改动收益 / 风险比` 和 `是否会持续阻塞后续功能迭代`。

默认原则：
- 先拆 `LibraryWorkspace` 和 `ZoteroService` 这两个高耦合中心。
- 保持现有 `src/renderer/src/pdf` 阅读器体系不重构，只做边界清理和接入适配。
- 先做结构重组，再做 UI 细节优化和体验 polish。

## Priority 1 - 拆 `LibraryWorkspace`，建立清晰的 renderer 分层
这是当前最高优先级，因为它已经同时承载启动流、数据加载、交互状态、虚拟列表和三栏 UI，会持续拖慢任何后续库侧功能迭代。

关键改动：
- 把 `LibraryWorkspace` 拆成 3 层：
  - `bootstrap/ready` 状态切换层
  - library data/state hooks 层
  - 纯展示组件层
- 至少抽出以下独立单元：
  - `useCollections`
  - `useLibraryItems`
  - `useItemDetail`
  - `useExpandedItemState`
  - `CollectionPane`
  - `ItemPane`
  - `DetailPane`
- 把虚拟列表和其计算逻辑独立成单独模块，例如 `VirtualizedItemList` + `virtualization utils`，不要继续留在 workspace 主文件尾部。
- 把 collection tree 构建、attachment 显示名、expanded height 计算等纯函数移到独立 `utils` 文件。
- 为复杂但非直观的逻辑补最少量注释：
  - 虚拟滚动窗口计算
  - item expansion 高度策略
  - bootstrap 状态切换意图

完成标准：
- `LibraryWorkspace.tsx` 只保留页面装配职责，控制在 200-300 行量级。
- 每个 hook 只负责一类异步状态，不再出现一个文件内多套重复 `loading/error/data/reset` 链路。
- 三栏 UI 的后续变更可以只改对应 pane，不需要通读整个 workspace。

## Priority 2 - 拆 `ZoteroService`，把主进程能力按职责切开
这是第二优先级，因为它现在是主进程侧的“基础设施汇聚点”，继续堆功能会很快失控，而且 SQL/校验/路径解析耦在一起，后续改查询或扩字段会很痛苦。

关键改动：
- 将 `ZoteroService` 拆成职责明确的模块：
  - config / validation
  - readonly database access
  - item queries
  - collection queries
  - attachment resolution
  - row mappers / formatters
- 保留 `ZoteroService` 作为薄协调层，对外 API 不变，内部只负责 orchestration。
- 抽出重复 SQL 片段或最小查询构建辅助，至少消除 `listItems` 和 `getItemDetail` 中标题/日期字段 join 的重复。
- 给“直连数据库失败时回退 snapshot”的策略补注释，明确这是兼容 Zotero 锁库的读取策略。
- 为 path resolve 和 default PDF 选择规则单独留出纯函数模块，后面若扩展 attachment chooser UI，不需要再碰 service 主文件。

完成标准：
- `service.ts` 不再接近 1000 行，主类本身应收缩为协调入口。
- 查询规则、校验规则、附件解析规则分别可单独阅读和测试。
- 后续若增加 item 字段、详情字段或查询筛选条件，只需要改对应 query 模块。

## Priority 3 - 清理 PDF 相关重复实现和遗留代码
这项优先级高于一般清理，因为当前仓库里已经存在“看起来像正式实现、但实际上不是”的代码，会持续误导维护者。

关键改动：
- 明确 `src/renderer/src/pdf/pdfViewer.tsx` 是当前正式 reader 入口。
- 处理 `src/renderer/src/components/PDFViewer.tsx`：
  - 如果确认废弃，删除或迁移到明确的 `legacy/` 目录。
  - 如果要保留参考价值，必须重命名并在文件头标明 `legacy/unreferenced`。
- 清理 `pdfToolBar.tsx` 中大量注释掉的旧实现块，尤其是混杂旧框架语法的内容。
- 保留真正有迁移价值的思路时，不保留在主组件里；改为迁移到文档或 issue 列表。
- 清理明显的临时 `console.*` 调试输出，只保留必要错误处理通道。

完成标准：
- PDF viewer 入口单一、唯一。
- `pdfToolBar.tsx` 只保留实际生效代码。
- 新维护者不会再因为文件名或遗留实现误判当前架构。

## Priority 4 - 统一状态模型和模块边界命名
这一步是在前两项拆分后做，目的是把“结构拆开”进一步提升为“长期稳定的工程边界”。

关键改动：
- 统一 renderer 中的异步状态建模方式，至少在 library 相关 hooks 中采用一致的 `idle/loading/ready/error` 表达。
- 明确 app 层、library 层、pdf reader 层三种状态边界：
  - app shell / tabs
  - library browsing / filters / selection
  - reader runtime / document state
- 收敛命名：
  - `Workspace` 只用于应用级工作区概念
  - `Pane` 用于三栏子区域
  - `Viewer/Reader` 用于 PDF 阅读器
- 重新梳理目录结构，让 `app`、`zotero`、`pdf`、`components` 的边界更稳定；避免 `components` 里继续混入完整业务实现。

完成标准：
- 读目录结构就能推断职责边界。
- 业务状态不会继续漂移到不相干的 provider 或组件中。
- 后续新增功能时，工程师能快速判断代码应该落在哪一层。

## Priority 5 - 文档化和回归基线
这一步不是最后才做，而是在前三项完成后尽快补上，防止结构整理后又重新发散。

关键改动：
- 更新 `TODO.md`，把“功能阶段计划”和“结构治理计划”分开，不再混在一个清单里。
- 新增一份简短的架构说明，至少覆盖：
  - renderer / preload / main 边界
  - library workspace 组成
  - Zotero 只读访问策略
  - PDF reader 的正式入口
- 为关键纯函数和查询模块补最小单元测试；为主要用户流补最小回归清单：
  - 启动配置流
  - collection 过滤
  - item 搜索
  - detail 加载
  - open default PDF
- 保留一份“已知暂不处理”的列表，例如：
  - richer metadata search
  - attachment chooser
  - write-back
  - reading-state persistence

完成标准：
- 新人接手时不需要从大文件逆向理解架构。
- 结构性重构后有最小回归基线，避免整理完再引入行为退化。

## Test Plan
- `LibraryWorkspace` 拆分后：
  - bootstrap 各状态仍能正确切换
  - collection 选择、搜索、item 选择、attachment expansion 行为不变
  - 虚拟列表滚动和展开高度计算不回归
- `ZoteroService` 拆分后：
  - list collections / list items / get item detail / resolve default PDF 行为与当前一致
  - invalid dir、locked database、snapshot fallback 仍然正常
- PDF 清理后：
  - 当前 reader tab 打开路径不变
  - toolbar 的缩放、旋转、载入逻辑不回归
  - 不再存在未引用但看似正式的 viewer 实现
- 回归验证：
  - 现有 `TODO.md` 中 Phase 4-8 已完成能力保持可用
  - 未完成能力不被误实现或误删除

## Assumptions
- 默认不重写 PDF 阅读器架构，只整理入口、遗留代码和边界。
- 默认先做“结构拆分”，不顺手扩展新功能。
- 默认允许在拆分过程中新增少量中间层文件和 hooks，但不改变 preload/public API 形状，除非为消除明显耦合确有必要。
- 默认优先顺序为：
  1. `LibraryWorkspace`
  2. `ZoteroService`
  3. PDF 重复实现与遗留代码清理
  4. 状态/目录边界统一
  5. 文档与回归基线
