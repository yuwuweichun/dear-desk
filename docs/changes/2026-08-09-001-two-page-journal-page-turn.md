# DD-20260809-001：双页日记本与仿真翻页

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 |
| 创建时间 | 2026-08-09 18:25 CST |
| 最后更新 | 2026-08-09 19:30 CST |
| 当前阶段 | 开发者（用户）已验收，任务完成 |
| 源码基线 | `0a842fc`；当前 `main` 工作区有未提交的贴纸系统改动 |
| 实现提交 | 本记录所在提交：`feat(journal): add two-page page turns` |
| 关联任务 | 用户要求把单页日记改为双页本子，点击左页向前、右页向后，并提供仿真翻页 |

> 用户已明确要求用仿真翻页替代 MVP 的轻量反馈约束，并回复“请继续”。本文据此进入已批准状态。当前工作区存在 `DD-20260808-002` 的未提交实现，本任务必须在其现状上增量修改，不得回退或覆盖。

## 1. 给阅读者的结论

日记现已改为可见的双页跨页：默认右页是今天，左页是最近一条更早的有内容页面；浏览过去时，点击左页进入上一页，点击右页回到下一页。正文日期、贴纸-only 日期和今天组成稳定页序，完全空白的历史日期不生成页面。

翻页使用 DOM/CSS 3D 透视、绕书脊旋转、正反面、纸面明暗和投影实现受控的仿真视觉，没有引入物理引擎或第二个 WebGL Canvas。Three.js 继续负责桌面、本子外形与开合空间表现；文字、贴纸与可访问交互继续由 DOM 承载。自动验证已通过；项目指定浏览器工具未注入本次实现会话，但开发者已确认完成验收。

## 2. 用户需求

用户原始要求：

- 当前日记是单页，且不可翻页。
- MVP 需要实现翻页。
- 日记应呈现为一本打开的双页本子。
- 需要仿真翻页。
- 点击左边页即上一页，点击右边页即下一页。

用户在发现现行 MVP 与“仿真翻页”冲突后明确回复：“mvp冲突，修改mvp，需要仿真翻页，请继续。”因此本任务将更新已批准产品边界，而不是保留旧的“只做轻量反馈”表述。

Codex 对交互的解释：每张可见纸页对应一个有内容的日记日期，内容包括 `DailyEntry` 正文或该日期的日记贴纸；今天即使还没有内容也始终作为可写页面存在。页面序列按日期排序并跳过完全空白的历史日期，避免用户在无限空白日历页中翻找。

## 3. 当前源码事实

- `docs/product/mvp.md` 已用双页模型与受控仿真翻页取代旧的轻量反馈限制，并明确不引入真实物理引擎或第二个 WebGL Canvas。
- `src/app/App.tsx` 仍调用 `loadToday()` 与 `loadStickers()`；`selectedDate` 固定表示今天。历史浏览使用独立的 `journalCursor`，不改变贴纸工作台目标。
- `src/domain/daily-entry.ts` 的 `DailyEntryRepository` 新增 `listDates()`；`sortLocalDates()` 负责去重和稳定排序，`DailyEntry` 结构不变。
- `src/domain/sticker.ts` 的 `StickerRepository` 新增 `listJournalDates()`；生产实现只读 journal instance 日期，不为建页序加载所有历史 Blob。
- `src/state/app-store.ts` 组合正文日期、贴纸日期和今天，只缓存可见跨页；翻页依次经过 `idle -> loading -> turning -> idle`，动画结束后才提交 pending cursor。
- `src/features/journal/JournalPanel.tsx` 组合双页、今天草稿、状态提示与翻页 sheet；`JournalPage.tsx` 提供历史只读页和整页导航；`PageTurnSheet.tsx` 负责 CSS 动画结束 intent。
- `src/features/journal/JournalStickerLayer.tsx` 支持显式贴纸集合与 `interactive` 模式；今天可编辑，历史页关闭 pointer events 但正文仍保留屏幕阅读器可读性。
- `src/styles.css` 已实现双页比例、书脊、纸面、正反面、方向动画、移动端和 reduced-motion；`NotebookObject.tsx` 增加封面内侧纸面，仍不拥有正文或页序。
- 自动测试已覆盖日期并集、repository 日期查询、边界、重入锁、游标提交、左右点击与旧保存/贴纸行为。
- `docs/decisions/2026-08-06-002-local-first-data-and-scene-projection.md` 要求普通编辑器留在 DOM，Three.js 场景只投影可序列化状态。
- `docs/decisions/2026-08-08-001-local-image-cutout-and-dual-sticker-surfaces.md` 要求日记贴纸按日期独立于 `DailyEntry` 查询，并禁止为日记新增第二个 R3F Canvas。
- 当前工作区已有未提交改动，`JournalPanel.tsx`、`app-store.ts`、`app-store.test.ts`、`docs/product/mvp.md` 与新的日记贴纸文件都属于正在实施的 `DD-20260808-002`；本任务与这些文件重叠，实施时必须保留现有双 surface 贴纸行为。
- `docs/architecture/system-overview.html` 已使用 `$bun-html-docs` 按当前源码重写双页、贴纸、所有权、v3 数据、渲染、失败、示例与源码地图；`docs/index.html` 已同步入口状态。

## 4. 目标与非目标

### 4.1 目标

- 聚焦后的日记始终呈现为一本有左页、右页和中缝的双页本子。
- 默认右页显示今天并保留现有正文编辑、保存和当日日记贴纸能力；左页显示最近一条更早的有内容页面。
- 日记页序列由正文日期、日记贴纸日期与今天的并集组成，按日期升序排列；完全空白的历史日期不生成页面。
- 浏览过去时，点击左页翻到上一页，点击右页翻到下一页；一次操作沿页面序列移动一个日期，旧左页/右页成为新跨页的相邻页。
- 在首页和今天边界不越界，并提供可理解的禁用反馈。
- 翻页有明确方向、纸张弯折感、阴影和完成态；连续点击不会造成日期、正文或贴纸错位。
- 页面重新打开后仍从 IndexedDB 恢复正文和按日期关联的贴纸；阅读位置不新增持久化，重新打开本子仍回到“最近历史页 + 今天”。
- 桌面与移动端都保留双页语义，并为 `prefers-reduced-motion` 提供非旋转的简化过渡。

### 4.2 非目标

- 不引入真实纸张动力学、布料/软体物理引擎或逐顶点纸张模拟。
- 不新增第二个 WebGL Canvas；DOM 页面不改为 WebGL 纹理。
- 不允许浏览或创建未来日期页面。
- 不在本任务加入日历选择器、搜索、书签、页码目录或旧痕迹抽屉。
- 历史页面本任务只读；不在整页点击导航与历史正文/贴纸编辑之间引入模式切换。
- 不改变“贴纸工作台放到日记”默认落到今天的既有行为。
- 不持久化当前阅读位置，也不迁移或删除现有 IndexedDB 数据。

## 5. 方案说明

### 5.1 页面语义

新增独立的日记页面游标，避免复用 `selectedDate`：

```text
selectedDate = 今天（继续供正文保存与贴纸工作台目标使用）
journalPageDates = 有正文日期 ∪ 有日记贴纸日期 ∪ 今天
spreadCursor = 当前跨页右页在 journalPageDates 中的位置
leftPage = spreadCursor - 1
rightPage = spreadCursor
```

打开本子时 `spreadCursor` 指向今天。若存在历史内容，默认左页是最近历史页、右页是今天；若没有历史内容，左页显示不可导航的内封空白页。向前翻时旧左页成为新右页；向后翻时旧右页成为新左页，因此一次点击只移动一个日记页，方向与真实翻纸一致。

历史页只读并把整张纸作为导航命中区。今天的右页保留 textarea 与贴纸交互；由于今天已经是下一页边界，点击编辑内容不会与“下一页”发生冲突。未保存的今天草稿由双页面板父组件继续持有，浏览历史时不卸载，返回今天后仍可见；刷新或关闭本子时仍遵循当前未保存草稿不持久化的既有规则。

### 5.2 仿真翻页

翻页动画使用 DOM/CSS 实现：容器提供透视，活动纸张以中缝为 `transform-origin` 做 `rotateY`，正反面分别显示离开页和进入页；渐变、高光、书脊阴影与轻微页面曲线制造纸张翻动感。应用状态只保存方向、目标游标和阶段，不保存 DOM 或 Three.js 对象。

动画期间锁定新的翻页请求；内容加载失败时复位到原跨页并显示可重试错误。`prefers-reduced-motion` 下改为短暂交叉淡入，不执行大角度旋转。实现不新增运行依赖。

### 5.3 3D 与 DOM 分工

`NotebookObject` 只需要让打开后的空间轮廓明确呈现左右纸块和书脊；可读正文、贴纸、按钮语义与翻页纸面全部位于一个 DOM 双页层。这样保留当前相机/封面开合、单 Canvas 与 DOM 表单可访问性，同时让用户看到一本真正打开的双页本子。

## 6. 预计改动与影响评估

- `docs/product/mvp.md`：把“轻量、不模拟真实纸张物理”改为“受控的仿真纸张翻页视觉，不引入真实物理引擎”，并更新当前实现覆盖。
- `src/domain/daily-entry.ts`：增加稳定日期比较/排序辅助与 `DailyEntryRepository.listDates()`，不改变 `DailyEntry` 持久化结构。
- `src/domain/sticker.ts`、`src/persistence/sticker-repository.ts`：为日记页序列增加仅返回有日记贴纸日期的查询；不加载所有历史 Blob。
- `src/persistence/daily-entry-repository.ts`：按主键读取已有正文日期。
- `src/state/app-store.ts`：新增页面日期序列、双页内容、游标、加载状态和翻页状态机；`selectedDate` 继续表示今天，避免改变贴纸目标。
- `src/features/journal/JournalPanel.tsx`：改为双页容器和今天草稿所有者；按日期渲染历史只读页与今天编辑页。
- 建议新增 `src/features/journal/JournalPage.tsx` 与 `src/features/journal/PageTurnSheet.tsx`，隔离单页内容和翻页视觉，避免继续放大 `JournalPanel.tsx`。
- `src/features/journal/JournalStickerLayer.tsx`：接收页面日期/贴纸集合/交互性；今天保持现有放置与编辑，历史页只做视觉投影。
- `src/scene/NotebookObject.tsx`：只调整打开状态的左右纸面几何与书脊层次，不把页面内容或页序放入 R3F。
- `src/styles.css` 与现有日记相关样式：增加双页比例、中缝、纸张层、方向状态、移动端尺寸和 reduced-motion；保留贴纸工作台样式责任。
- 测试：扩展领域、repository、store、JournalPanel、JournalStickerLayer 和本子转场测试。
- `docs/architecture/system-overview.html`：实施后同步页面序列、store/repository 调用链、DOM/R3F 所有权、失败路径和源码地图；必须使用 `$bun-html-docs`。

### 6.1 核心数据结构变化

`DailyEntry`、`StickerInstance` 与 IndexedDB schema 不变；只扩展查询接口和运行态：

```ts
type PageTurnDirection = 'previous' | 'next'
type PageTurnPhase = 'idle' | 'turning'

interface JournalPageContent {
  date: LocalDate
  entry: DailyEntry | null
  stickers: PlacedSticker[]
  editable: boolean
}

interface JournalSpreadState {
  dates: LocalDate[]
  cursor: number
  left: JournalPageContent | null
  right: JournalPageContent
  turn: {
    phase: PageTurnPhase
    direction: PageTurnDirection | null
    targetCursor: number | null
  }
}
```

具体命名可按 TypeScript 约束局部调整，但必须保持：页面游标与 `selectedDate` 分离、历史 Blob 按可见页加载、翻页提交原子化、持久化 schema 不变。

### 6.2 上下游与跨模块影响

- `App` 仍按今天显示桌面摘要，贴纸工作台仍把 `journalDate` 设为今天；浏览过去不会悄悄改变随后贴纸的目标日期。
- repository 增加日期列表查询，但 UI 不直接访问 Dexie；store 组合正文日期与贴纸日期。
- 双页最多装载可见页与下一步必要缓存，避免一次读取全部历史贴纸 Blob。
- 今天正文仍由显式保存写入；翻阅不会自动保存或丢弃组件内草稿。
- 历史贴纸只读，避免贴纸拖动、文字选择与整页翻页命中冲突；今天贴纸的放置、移动、旋转、删除保持原行为。
- Three.js 只消费本子开合阶段，不消费 `DailyEntry`、Blob 或页序；DOM 翻页不会创建新 renderer。
- 当前 `DD-20260808-002` 仍处于实施中且修改相同文件。实施前后都要逐项核对其 Git 差异，确保图片贴纸、双 surface、v3 迁移和日记贴纸持久化不回退。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 整页导航与编辑抢事件 | 今天 textarea 或贴纸冒泡到翻页层 | 输入、选择贴纸时误翻页 | 历史页才启用整页导航；今天下一页边界禁用，交互对象继续阻止冒泡 |
| 异步加载与动画错位 | 连续点击或慢速 IndexedDB 查询 | 日期、正文和贴纸短暂不一致 | 单一翻页状态机、动画期锁定、目标内容就绪后原子提交，失败复位 |
| 页面列表漏掉贴纸-only 日期 | 只读取 `DailyEntry` 日期 | 用户无法翻到只有贴纸的页面 | 合并正文日期、日记贴纸日期和今天，并增加 repository 集成测试 |
| 读取全部历史 Blob | 为生成目录调用完整贴纸读取 | 内存和打开耗时随历史增长 | 日期查询只读 instance 日期字段；Blob 仅按可见页加载 |
| 移动端双页过窄 | 仍沿用桌面字号/间距 | 内容不可读或横向溢出 | 保持双页但压缩书边、字号和控件，正文内部滚动，真实移动视口验收 |
| 仿真效果造成眩晕 | 大角度旋转或频繁阴影变化 | reduced-motion 用户不适 | 媒体查询改为淡入，导航语义不变 |
| 覆盖未提交贴纸改动 | 直接按旧基线重写重叠文件 | 丢失用户当前实现 | 以工作树当前文件为基线做小补丁，实施前后对照 `DD-20260808-002` 和 Git diff |
| 架构文档无法同步 | `$bun-html-docs` 继续缺失 | 违反文档一致性门槛 | 在修改业务源码前要求恢复技能；不得以新增 Markdown 冒充已同步 HTML |

回退时可以移除页面游标、双页组件和翻页样式，恢复单页 DOM 展示；repository 新增只读查询接口可一并移除。数据库 schema 与用户正文/贴纸数据不变，不需要逆向迁移，也不得清库。

## 8. 验证与验收

- 自动测试：日期并集与排序、无历史页、贴纸-only 日期、上一页/下一页边界、一次移动一个页面、快速重复点击锁、加载失败复位、草稿翻阅后保留。
- 组件测试：默认左历史/右今天；点击左页向前、点击右页向后；历史页只读；今天正文保存与贴纸交互不误翻页；关闭本子仍遵循现有状态机。
- repository 测试：正文日期和日记贴纸日期查询不读取/破坏 Blob，旧 v1/v2/v3 数据继续可读。
- 构建与静态检查：运行 `npm run lint`、`npm run test`、`npm run build`、`node scripts/check-doc-references.mjs` 与 `git diff --check`。
- 浏览器验收：在可用浏览器工具中验证桌面 `1440 × 900` 与移动 `390 × 844` 的双页、中缝、左右点击、动画方向、边界、快速点击、草稿、贴纸和控制台错误。
- reduced-motion：模拟 `prefers-reduced-motion: reduce`，确认无大角度旋转但仍能完成页面切换。
- 持久化与恢复：构造正文页、贴纸-only 页与今天空白页；刷新后页面序列和内容一致，阅读位置回到“最近历史页 + 今天”。
- 成功标准：用户始终看到双页本子；左页点击只前往上一页，右页点击只前往下一页；动画具有清楚的真实纸张方向感；所有历史内容按日期正确对应；现有今天编辑、保存、贴纸与单 Canvas 能力无回归。

## 9. 待确认项与决策

用户已确认唯一会改变产品范围的决策：用仿真翻页取代现行 MVP 的轻量反馈约束，并继续实施。

以下实现解释按最小冲突方案锁定，如用户希望改变可另行补充：

1. 页面序列只包含有正文、日记贴纸或今天的日期，跳过完全空白的历史日期。
2. 默认左页为最近历史页，右页为今天；一次点击移动一个日记页。
3. 历史页只读，今天可编辑；浏览游标不改变贴纸工作台的“放到今天”目标。
4. “仿真”指可感知纸张厚度、方向、弯折感与光影的受控动画，不引入真实物理引擎。

当前不存在需要再次等待用户选择的产品项。工具前置条件见第 10 节。

## 10. 最终批准方案

用户于 2026-08-09 明确回复“mvp冲突，修改mvp，需要仿真翻页，请继续”，批准：

1. 修改 `docs/product/mvp.md`，以受控仿真翻页取代旧的轻量反馈规则。
2. 实现双页本子、左页上一页、右页下一页和边界处理。
3. 保持 DOM 编辑、local-first、日记贴纸按日期、单活跃 Canvas 与无真实物理引擎边界。
4. 按第 4、5、6、7、8、9 节建议方案直接实施，不再重复询问是否开始。

实施前置条件已满足：用户于 2026-08-09 恢复并显式提供 `$bun-html-docs`。Codex 已完整读取技能正文、`references/content-contract.md` 与 `references/shell-authoring.md`，业务实现和架构 HTML 同步可以继续。

## 11. 实施记录

2026-08-09：用户批准修改产品规则并继续。

- 已更新 `docs/product/mvp.md` 第 4.2、9、10 节：先记录双页本子与受控仿真翻页的批准范围，实施后再把覆盖状态更新为“已实现、视觉待验收”。
- 已完成任务记录与只读源码核对。
- 用户已恢复 `$bun-html-docs`；Codex 已读取完整技能与两份必读参考，开始修改业务源码。

实际实施：

- 领域与查询：`src/domain/daily-entry.ts`、`src/domain/sticker.ts`、两个 repository 增加正文日期和日记贴纸日期查询；没有数据库 schema 迁移。
- 状态：`src/state/app-store.ts` 新增日期序列、可见页缓存、游标、加载错误与翻页状态机；今天的 `selectedDate` 和双 surface 贴纸行为保持不变。
- DOM：重写 `JournalPanel.tsx`，新增 `JournalPage.tsx` 与 `PageTurnSheet.tsx`；历史页整页导航且只读，今天页保留 textarea、保存与贴纸交互。
- 贴纸：`JournalStickerLayer.tsx` 增加历史只读投影，不加载或修改其他日期的贴纸位置。
- 视觉：`src/styles.css` 实现双页、中缝、纸张正反面、方向阴影、720ms CSS 3D 动画和 reduced-motion 120ms 淡出；`NotebookObject.tsx` 增加封面内侧纸面。
- 测试：补充领域、repository、store 和 JournalPanel 测试；测试总数从 27 增至 30。
- 文档：使用 `$bun-html-docs` 实质更新 `docs/architecture/system-overview.html` 与 `docs/index.html`，并为共享 `docs-reader.js` 增加 `Ctrl/Command + K` 搜索入口；同步 MVP 当前实现状态。

方案偏差：最初类型草案把翻页阶段简写为 `idle | turning`；实际增加 `loading`，用于在动画前按需预读目标页并显示错误，不改变批准的用户行为。React 多组件质量检查发现历史正文被整体 `aria-hidden`，已修正为正文可读、只有历史贴纸对象不可交互。

## 12. 验证结果

- 已执行 Git 状态、源码、测试、产品、架构和决策检查。
- 已确认基线 commit 为 `0a842fc`，当前分支为 `main`，且存在与贴纸任务相关的未提交重叠改动。
- 本任务 Markdown/MVP 局部 `git diff --check`：通过。
- 任务记录一级章节检查：完整保留模板的 14 个编号章节。
- `node scripts/check-doc-references.mjs`：失败；既有未跟踪文件 `docs/changes/2026-08-08-001-require-bun-html-docs.md` 缺少“文档信息”“给阅读者的结论”“文档同步检查”“审阅记录”，本任务未擅自修改该独立记录。
- `npm run lint`：通过。
- `npm test`：通过，10 个测试文件、30 项测试全部成功。
- `npm run build`：通过；应用主包约 `1028.39 kB`、background-removal worker 约 `515.53 kB`、ONNX Runtime WASM 约 `23.57 MB`，仍有 Vite 大 chunk 告警。翻页未新增运行依赖。
- `git diff --check`：通过。
- `node scripts/check-doc-references.mjs`：失败；仍只报告既有未跟踪文件 `docs/changes/2026-08-08-001-require-bun-html-docs.md` 缺少四个模板章节。本任务没有权限把另一个独立记录改写成模板。
- `command -v ego-browser`：退出码 1。项目指定浏览器工具不可用，因此没有执行桌面 `1440 × 900`、移动 `390 × 844`、CSS 3D 观感、本地 HTML 搜索/目录/Wiki/复制的真实浏览器验收；这些不能写为通过。
- 2026-08-09 开发者（用户）确认当前工作区成果已验收。本记录据此关闭；该人工验收结论不改写上述未执行自动浏览器验证的工具事实。

## 13. 文档同步检查

- 产品文档：已更新 `docs/product/mvp.md` 的批准规则和当前实现覆盖，并同步开发者验收状态。
- 架构文档：已使用 `$bun-html-docs` 更新 `docs/architecture/system-overview.html`；保留共享本地阅读壳，补齐双页主链路、所有权、失败、完整示例和源码地图。
- 贴纸架构：已更新 `docs/architecture/sticker-system.md`，说明历史 `journalCursor` 与今天 `selectedDate` 分离，并让贴纸-only 日期进入页序。
- 决策文档：现有 local-first 与双 surface 决策保持有效；在双 surface ADR 中补充后续任务事实，没有改写原决策，不新增 ADR。
- 文档入口：已使用同一技能更新 `docs/index.html` 的项目状态、文档地图、MVP 与源码事实。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-09 18:25 CST | 用户 | 提出双页本子、仿真翻页、左页上一页、右页下一页。 |
| 2026-08-09 18:25 CST | Codex | 创建任务记录并开始只读核对。 |
| 2026-08-09 18:32 CST | Codex | 发现 MVP 明确禁止真实纸张模拟，与新要求冲突；同时确认现有单页调用链和未提交贴纸改动重叠。 |
| 2026-08-09 18:40 CST | 用户 | 明确要求修改 MVP、保留仿真翻页并继续。 |
| 2026-08-09 18:40 CST | Codex | 将任务设为已批准，锁定双页、页面游标、DOM/CSS 仿真与单 Canvas 方案。 |
| 2026-08-09 19:05 CST | 用户 | 恢复并显式提供 `$bun-html-docs`。 |
| 2026-08-09 19:05 CST | Codex | 完整读取技能与两份必读参考，解除 HTML 同步前置阻塞并开始实施。 |
| 2026-08-09 19:22 CST | Codex | 完成业务实现、30 项测试、lint、build、架构 HTML 和文档入口回写；记录文档检查既有阻塞与 ego-browser 缺失，任务保持实施中。 |
| 2026-08-09 19:30 CST | 开发者（用户） | 确认当前工作区成果已验收，同意将本任务标记为已完成并按任务提交。 |
