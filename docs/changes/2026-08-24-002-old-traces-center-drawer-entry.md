# DD-20260824-002：旧痕迹中央抽屉入口

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 |
| 创建时间 | 2026-08-24 11:34 CST |
| 最后更新 | 2026-08-24 18:01 CST |
| 当前阶段 | 用户已验收抽屉功能，任务完成 |
| 源码基线 | `c200eec`；工作区另有并行未提交改动 |
| 实现提交 | 本次提交（由 Git 记录） |
| 关联任务 | 用户要求实现旧痕迹入口，并确认采用中央实体抽屉、简短开合动画、DOM 等价入口和指定日期打开本子的范围 |

> 用户已在上一轮方案说明后明确要求“实现该需求”。本文把已经说明的范围固化为最终执行清单；本次授权不包含提交、推送或 PR。

## 1. 给阅读者的结论

本任务将现有三抽屉桌的中央宽抽屉变成“旧痕迹”空间入口。用户可以点击中央抽屉或桌面上的 DOM 等价按钮，让抽屉短距离滑出并打开按月份组织的历史索引；选择某一天后，本子直接打开到该日期，展示当天保存的正文与日记贴纸。

左右窄抽屉继续保持无功能，不显示未开放占位。抽屉开合只属于当前页面的临时交互状态，不写入 IndexedDB；正文、贴纸和日期仍以既有 repository 数据为事实来源。

## 2. 用户需求

- 用户希望实现旧痕迹入口。
- 用户询问并确认当前抽屉是否为实体建模、是否需要开合动画，以及三个抽屉是否都要分配功能。
- Codex 基于当前源码建议：只启用中央宽抽屉；使用约 300ms 的确定性线性滑出动画；历史内容使用 DOM 展示；左右抽屉不提前分配功能；提供移动端、键盘和 WebGL 降级可用的 DOM 等价入口。
- 用户随后明确要求“实现该需求”，构成对上述范围的实施授权。

## 3. 当前源码事实

- `src/scene/models/create-desk-model.ts` 为左、中、右抽屉分别创建独立 `Group`、抽屉面和简化箱体；中央宽抽屉节点是 `drawer-center`。
- 三只抽屉均携带 `{ axis: [0, 0, 1], limits: [0, 0.86], role: 'linear-slide' }` 动作描述，并拥有独立 slide socket。黄铜旋钮使用实例化网格，通过 knob socket 和 `updateAttachments()` 跟随抽屉。
- `src/scene/DeskScene.tsx` 的 `DeskBody` 当前只创建并静态挂载整个模型，没有读取抽屉 action、没有动画进度，也没有抽屉点击入口。
- `src/state/app-store.ts` 已能合并正文日期与日记贴纸日期，按相邻页加载正文和完整贴纸，并通过 `journalCursor` 翻页；`loadJournalPages()` 每次默认把游标放在今天。
- `DailyEntryRepository` 当前提供 `getByDate()`、`listDates()` 和 `save()`；`StickerRepository` 提供 `listJournalDates()` 和逐日期完整贴纸读取，但没有轻量历史摘要查询。
- `JournalPanel` 只在 `notebookPhase === 'editing'` 时挂载，然后调用 `loadJournalPages()`；目前不存在“以指定历史日期为初始游标打开”的 intent。
- `src/app/App.tsx` 的桌面命令只有镜头、本子、铭牌和贴纸工作台；WebGL 不可用时只提供“打开本子”降级入口。
- `docs/product/mvp.md` 第 4.4 节批准了“抽屉或等价空间物件进入过去记录”，第 5 节场景 C 要求按日期找到记录并看到关联贴纸，当前实现覆盖仍把“旧痕迹入口与台灯”列为尚未实现。
- `docs/decisions/2026-08-06-002-local-first-data-and-scene-projection.md` 要求业务状态保持可序列化、Three.js 只投影状态并发出 intent、信息面板使用 DOM、未经批准不增加第二个 WebGL Canvas。
- 当前工作区的 `src/app/App.tsx`、`src/scene/DeskScene.tsx` 和 `docs/architecture/system-overview.html` 已包含其他未提交改动；本任务必须增量实施，不覆盖或回退无关内容。

合理推断：现有抽屉分件、滑动轴和旋钮附件结构足够支持受控开合，不需要重建桌子；旧痕迹索引若直接逐日期加载完整贴纸 PNG，会产生不必要的 Blob 解码和内存成本，因此应增加轻量摘要查询。

## 4. 目标与非目标

### 4.1 目标

- 只把中央宽抽屉设为旧痕迹空间入口，支持 3D 点击和 DOM 等价按钮。
- 中央抽屉按确定性进度沿既有 Z 轴滑出/收回，旋钮同步移动；reduced-motion 直接落到稳定端点。
- 打开一个可访问的 DOM 历史索引，按月份组织所有早于今天且含正文或日记贴纸的日期。
- 每条历史摘要显示日期、正文标题/短摘要和贴纸数量；只有贴纸的日期也必须出现。
- 选择日期后关闭历史索引与抽屉，并让本子直接打开到该日期；之后仍可使用既有翻页、阅读和历史正文编辑能力。
- 历史读取失败时保留可重试或关闭路径，不把空结果伪装成成功。
- 保持单 Canvas、local-first 数据边界和既有贴纸/本子互斥规则。

### 4.2 非目标

- 不给左、右抽屉分配功能，不显示“敬请期待”等占位。
- 不实现物理导轨、抽屉碰撞、拖拽开合、声音、内部物件或制造级抽屉结构。
- 不持久化抽屉开合、历史面板展开或上次阅读日期。
- 不增加全文搜索、标签、收藏、日历编辑、删除历史、数据导出或云同步。
- 不改变今天作为新贴纸“放到日记”目标的既有语义。
- 不提交、推送、创建 PR，也不处理当前工作区中与本任务无关的音频方案。

## 5. 方案说明

1. 桌面稳定且没有贴纸选择/制作流程时，中央抽屉面和旋钮区域可点击；桌面动作区同时增加“旧痕迹”DOM 按钮。两者发出同一个 `requestPastTracesOpen` intent。
2. 打开 intent 会关闭自由视角、清除桌面贴纸选择并把历史入口置为 `opening`。中央抽屉在约 300ms 内从进度 0 移到 1；不改变用户当前固定机位。
3. 抽屉到达打开端点后进入 `open`，挂载 DOM 历史索引。DOM 拥有标题、关闭按钮、载入/错误/空状态和按月份分组的日期列表；焦点进入面板，Escape 与关闭按钮均可退出。
4. 历史索引由正文列表和日记贴纸日期计数合并得到，只包含 `< selectedDate` 的日期。摘要按日期倒序，月份也从近到远；正文缺失时显示“仅有贴纸”，贴纸为零时不显示贴纸数量。
5. 用户选择日期后记录待打开日期、关闭面板并让抽屉收回。关闭端点到达后复用本子既有开合状态机进入指定日期；不会在抽屉仍打开时同时播放本子动画。
6. `loadJournalPages()` 读取一次性的目标日期作为初始游标并加载该日期及左邻页；普通“打开本子”仍以今天作为初始页。目标日期缺失于最新日期并集时回退今天并显示读取错误，不伪造空历史页。
7. WebGL 初始化失败时，降级区域同时提供“打开本子”和“旧痕迹”；DOM 入口不依赖抽屉动画即可工作。

## 6. 预计改动与影响评估

- `src/domain/past-trace.ts`：新增只读 `PastTraceSummary` 及正文/贴纸索引合并函数，集中处理过去日期过滤、倒序和显示摘要。
- `src/domain/daily-entry.ts`、`src/domain/sticker.ts`：扩展 repository 接口以读取轻量正文列表和按日期贴纸计数，不改变现有记录结构。
- `src/persistence/daily-entry-repository.ts`：增加按日期读取全部正文的只读查询。
- `src/persistence/sticker-repository.ts`：增加不读取 definition/render Blob 的日记贴纸日期计数查询。
- `src/state/app-store.ts`：新增旧痕迹阶段、载入状态、摘要集合、错误、待打开日期及打开/关闭/重试/选择动作；让日记初始游标可以消费指定日期。
- `src/features/history/PastTracesPanel.tsx`：新增 DOM 历史索引、月份分组、空/错/载入状态、键盘关闭和日期选择。
- `src/scene/DeskScene.tsx`：让 `DeskBody` 消费旧痕迹阶段，驱动中央抽屉进度、更新实例旋钮附件，并提供中央抽屉透明命中面或等价确定性命中逻辑。
- `src/app/App.tsx`：增加桌面 DOM 等价入口、历史面板挂载、WebGL 降级入口和与其他桌面工具的互斥显示。
- `src/styles.css`：增加历史面板、分组列表、桌面入口和响应式布局；不重写现有通用控件视觉。
- 自动测试：扩展领域、repository、store、App、DeskScene/模型相关测试，覆盖摘要、状态机、指定日期、抽屉端点、附件更新和降级入口。
- `docs/product/mvp.md`：实施后把旧痕迹入口改为当前已实现事实，台灯继续保持尚未实现。
- `docs/architecture/system-overview.html`：实施后使用 `$bun-html-docs` 同步历史查询、状态所有权、3D intent、DOM 面板和失败链路。
- 本记录：回写真正实施文件、行为、偏差、验证和验收状态。

### 6.1 核心数据结构变化

- 新增运行时 `PastTraceSummary`：`date`、`title`、`textPreview`、`stickerCount`、`hasEntry`。它由现有 IndexedDB 记录派生，不持久化。
- 新增旧痕迹 UI 状态，预计包含 `closed | opening | open | closing` 阶段、`idle | loading | ready | error` 载入状态、摘要集合、错误文本和一次性 `pendingJournalDate`。
- `DailyEntry`、`StickerInstance`、数据库表和 IndexedDB 版本保持不变。
- 普通本子入口继续以 `selectedDate`（今天）初始化；旧痕迹入口只通过一次性目标日期决定本次打开游标，不改变贴纸 placement 目标。

### 6.2 上下游与跨模块影响

- 上游入口：3D 抽屉和 DOM 按钮共享 store intent，防止两套行为分叉。
- 数据：repository 执行轻量只读查询；历史面板不直接访问 Dexie，也不解码历史贴纸 PNG。
- 场景：Three.js 只读取序列化阶段/进度并发出 intent；不把模型节点存入 Zustand。
- 动画：抽屉进度只移动 `drawerCenter` 或其 slide socket，并在变化后调用现有 `updateAttachments()`，左右抽屉保持零进度。
- 本子：指定日期仅改变 `loadJournalPages()` 初始游标；既有翻页、dirty guard、历史编辑和关闭恢复保持不变。
- 贴纸：历史摘要计数不改变图片 asset、definition 或 instance；进入旧痕迹时与选择/制作/放置流程互斥。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 抽屉动画与实例旋钮脱节 | 只移动抽屉组但不刷新实例矩阵 | 旋钮悬浮在原位 | 每次进度变化调用既有 `updateAttachments()`；测试中央旋钮矩阵随抽屉移动 |
| 点击抽屉与桌面贴纸交互冲突 | 命中面在贴纸放置或选择时仍可用 | 误开历史面板 | 只在桌面稳定、sticker workflow idle、无选中贴纸时启用命中 |
| 历史索引加载大量 Blob | 逐日期调用完整 `listJournal()` | 打开缓慢、内存上涨 | 新增只读日期计数查询，不读取 definition/render/source asset |
| 指定日期被今天覆盖 | `loadJournalPages()` 仍硬编码今天游标 | 选择后打开错误页面 | 一次性目标日期测试正文日期、贴纸-only 日期与普通今天入口 |
| 面板和本子动画重叠 | 选择日期立即打开本子 | 空间状态混乱、重复输入 | 先关闭面板和抽屉，到达 closed 端点后再发出本子打开 intent |
| WebGL 或动画不可用 | Canvas 初始化失败或 reduced-motion | 无法进入历史 | DOM 降级入口直接打开同一历史面板；reduced-motion 直接切端点 |
| 工作区重叠改动被覆盖 | `App.tsx`、`DeskScene.tsx`、架构 HTML 已有用户改动 | 丢失并行任务成果 | 基于当前工作树增量编辑，逐块复核 diff，不还原无关内容 |

回退方式：移除旧痕迹派生状态、DOM 面板、中央抽屉 intent/动画和 repository 只读摘要方法，恢复普通本子始终以今天初始化。数据库 schema 未变化，不需要迁移或清理用户数据；其他并行任务改动必须保留。

## 8. 验证与验收

- 自动测试：覆盖过去日期过滤与倒序、正文/贴纸-only 合并、贴纸计数不读 Blob、打开/关闭阶段、普通今天入口、指定日期初始游标、错误重试、抽屉端点和旋钮附件。
- 构建与静态检查：运行聚焦测试、`npm run check`、`git diff --check`，并逐项核对批准清单与真实差异。
- 浏览器验收：按项目规则使用 `ego-browser` 访问固定地址 `http://127.0.0.1:5164`；若端口被占用则报告冲突，不改端口。桌面和移动端验证空态、含正文日期、贴纸-only 日期、中央抽屉点击、DOM 入口、关闭、Escape、选择日期、本子直接定位、返回桌面、WebGL 单 Canvas和无横向溢出。
- reduced-motion：浏览器或聚焦自动测试确认抽屉直接落到稳定端点且功能相同。
- 持久化与恢复：使用测试 origin 创建历史正文和日记贴纸，刷新后索引与指定日期内容一致；不写入抽屉状态或上次阅读日期。
- 成功标准：中央抽屉和 DOM 入口都能可靠找到过去内容；选择日期只打开对应页面；左右抽屉无误导交互；现有日记、贴纸、镜头和单 Canvas 行为无回归。

## 9. 待确认项与决策

无阻塞待确认项。用户已经批准以下明确决策：

1. 只启用中央宽抽屉作为旧痕迹入口，左右抽屉保持无功能。
2. 使用简短确定性滑出动画，不实现物理模拟。
3. 历史内容由 DOM 信息面板承载，3D 只表达空间入口和开合。
4. 提供 DOM 等价入口；选择历史日期后本子直接定位该日。

## 10. 最终批准方案

2026-08-24 用户在已收到中央抽屉、约 300ms 动画、DOM 等价入口、指定日期打开和左右抽屉不分配功能的说明后，明确要求“实现该需求”。最终执行清单：

1. 增加不读取图片 Blob 的历史摘要查询和派生类型。
2. 增加旧痕迹载入/开合状态机与一次性目标日期。
3. 实现中央抽屉点击、约 300ms 滑出/收回、实例旋钮同步和 reduced-motion。
4. 实现按月份分组的 DOM 历史索引、DOM 等价入口、空/错/载入状态和键盘关闭。
5. 选择日期后先关闭抽屉，再复用本子开合并直接定位对应日期。
6. 扩展自动测试，同步产品、架构和任务文档。
7. 执行完整工程检查和 `ego-browser` 桌面/移动/恢复验收，完成后更新为“待验收”。

## 11. 实施记录

已按批准清单完成，未改变数据库 schema，也未给左右抽屉分配功能：

- 领域与 persistence：新增 `src/domain/past-trace.ts` 及测试；扩展 `DailyEntryRepository.listEntries()` 和 `StickerRepository.listJournalDateCounts()`，历史索引只聚合正文与日记 instance 日期，不读取贴纸 definition/render/source Blob。
- 状态：`src/state/app-store.ts` 新增 `closed | opening | open | closing` 入口阶段、载入/错误/重试状态、派生摘要、WebGL 降级路径和一次性 `journalInitialDate`。选择历史日期会先收回抽屉，再沿既有本子状态机打开；普通本子仍从今天开始。
- 场景：`src/scene/models/create-desk-model.ts` 新增 `setDeskDrawerProgress()`；`src/scene/DeskScene.tsx` 只为中央抽屉增加透明命中面和约 300ms 动画，并在每帧刷新实例化黄铜旋钮附件。左右抽屉保持原位、无命中；reduced-motion 直接切到稳定端点。
- DOM：新增 `src/features/history/PastTracesPanel.tsx` 与测试；`src/app/App.tsx` 增加桌面“旧痕迹”按钮、历史面板和 WebGL fallback 等价入口；`src/styles.css` 增加桌面与 390 × 844 响应式布局。面板支持月份、日期、标题、正文预览、贴纸数量、贴纸-only、载入、错误、重试、空态、Escape、背景和关闭按钮。
- 测试：扩展 repository、store、App 和模型测试，覆盖轻量查询、排序/过滤、贴纸-only、状态机、错误重试、指定日期、普通今天入口、抽屉端点与旋钮跟随。
- 文档：同步 `docs/product/mvp.md`、`docs/architecture/system-overview.html`、`docs/index.html` 和本记录。浏览器验收发现共享 `docs/assets/docs-reader.js` 在 `file://` 下复制失败，因此补充本地 `execCommand('copy')` 回退；未改变产品运行时代码。

方案偏差：无产品范围、主要交互、数据结构或架构偏差。唯一附带修正是上述本地 HTML 复制回退，它来自本任务强制文档直接打开验收。

## 12. 验证结果

- `npm run check`：通过。ESLint 通过；Vitest 23 个文件、100 项测试全部通过；TypeScript 与 Vite production build 通过；文档引用检查通过。构建只保留既有大 chunk 警告。
- `git diff --check`：通过，无空白错误。
- `ego-browser` 桌面 `1440 × 900`：通过中央抽屉真实画布命中、`opening -> open`、约 300ms 滑出/收回、DOM 等价入口、焦点进入关闭按钮、Escape、正文日期、贴纸-only 日期及计数、选择后直接打开正确日期、刷新恢复、单 Canvas、无横向溢出。模型自动测试同时确认最大位移 `0.86` 与中央黄铜旋钮附件跟随。
- `ego-browser` 移动 `390 × 844` / DPR 2：五个桌面动作以 3+2 排列，最长“贴纸工作台”在按钮内换行；底部历史面板、日期行、关闭按钮和滚动内容均在视口内，无页面横向溢出，仍为单 Canvas。
- reduced-motion：媒体查询命中后，点击入口立即得到稳定 `open` 端点和可用面板。
- WebGL 降级：临时让 WebGL context 不可用后，降级区同时显示“打开本子”和“旧痕迹”；后者直接打开相同 DOM 历史面板。撤销模拟并刷新后恢复正常单 Canvas。
- 持久化：在隔离浏览器 origin 中写入带明确 `codex-old-traces-*` ID 的正文与贴纸-only 验收数据，刷新后仍可检索和定位；验收后只删除这些临时记录，原有 `2026-08-06` 数据保持存在。
- 本地 HTML：直接打开 `docs/architecture/system-overview.html`，在 1440 × 900 和 390 × 844 验证全文搜索成功/空结果、ArrowUp/ArrowDown/Enter/Escape、目录与 active 状态、复制“已复制”、Wiki focus/click、表格内部滚动、无页面横向溢出，以及唯一 `docs-home-navigation` 到 `docs/index.html`。文档首页显示本任务入口。
- 未覆盖：浏览器 origin 已存在一条历史正文，因此未破坏性清空数据来制造可视空态；空态由 `PastTracesPanel` 与 store 自动测试覆盖。未在真实移动 GPU 上衡量性能；本功能未增加 Canvas 或图片摘要加载。

## 13. 文档同步检查

- 产品文档：已把旧痕迹入口更新为当前实现事实；台灯仍明确保持未实现。
- 架构文档：已按 `$bun-html-docs` 同步运行时、中央抽屉投影、轻量查询、状态所有权、指定日期、本地数据、失败路径、源码地图与验证证据。
- 决策文档：无需修改；实现继续遵守 local-first、场景投影、DOM 信息面板和单 Canvas ADR。
- 文档入口：`docs/index.html` 为手工任务表，已增加本任务及敞口模型补充任务，并按用户验收结果标记“已完成”。
- 引用检查：`npm run check` 中的文档引用检查通过，本地 HTML 直接打开与交互通过。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-24 11:34 CST | 用户 / Codex | 用户在中央抽屉、简短动画、DOM 等价入口、指定日期打开和左右抽屉不分配功能的明确说明后要求“实现该需求”；Codex 将其记录为实施授权。 |
| 2026-08-24 11:34 CST | Codex | 完成源码、MVP、架构与 ADR 只读核对，创建已批准执行记录；尚未修改业务源码。 |
| 2026-08-24 11:36 CST | Codex | 按最终执行清单开始实施，状态更新为“实施中”。 |
| 2026-08-24 12:28 CST | Codex | 完成源码、自动测试、production build、桌面/移动/WebGL 降级/reduced-motion 与本地 HTML 验证；清理隔离浏览器临时数据，状态更新为“待验收”。 |
| 2026-08-24 17:58 CST | 用户 / Codex | 用户确认抽屉功能实现已验收并明确要求提交；实施未超出批准范围，任务更新为已完成并纳入本次提交。 |
| 2026-08-24 18:01 CST | Codex | 提交前联合复核通过：22 个测试文件、96 项测试、lint、TypeScript/Vite production build、文档引用和差异空白检查均通过；最终主包为 1,211.92 kB / 343.59 kB gzip，仅保留既有大 chunk 警告。 |
