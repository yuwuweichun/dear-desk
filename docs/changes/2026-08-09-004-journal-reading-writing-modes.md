# DD-20260809-004：统一日记阅读与书写模式

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待验收 |
| 类型 | 功能 / 日记交互 / 可编辑历史记录 |
| 创建时间 | 2026-08-09 23:25 CST |
| 最后更新 | 2026-08-10 10:48 CST |
| 当前阶段 | 已完成真正的竖排文字、上下滑块和右侧窄工具条修正，等待用户继续视觉验收 |
| 源码基线 | Git commit `8068a6690c73571ade08a0c2536c5e045dcc4f56`；分支 `main`；工作区存在 `DD-20260809-002` 视觉改造、概念图及用户已有 `package-lock.json` 差异，本文不覆盖这些修改 |
| 实现提交 | 尚未创建 |
| 关联任务 | 用户要求双页本子左页留白、右页统一显示当前日期内容，并通过阅读/编辑、书写/保存两级入口编辑今天或历史笔记；酒红书签视觉修正继续归属 `DD-20260809-002` |

> 用户已于 2026-08-09 明确要求“交互改造方案执行”，本文方案据此获批并进入实施；酒红书签仍属于已批准视觉任务的验收修正，不混入本任务的交互实施范围。

## 1. 给阅读者的结论

双页日记现已改成稳定的“左页留白、右页承载当前日期”结构。打开本子默认进入阅读模式，用户仍可翻到任意已有日期；本子右侧外部使用一个按“阅 / 读 / 编 / 辑”自上而下显示并上下滑动的模式按钮，切到编辑后，其下方出现按“图标 / 书 / 写”竖排的动作按钮，进入书写后变为“图标 / 收 / 笔”。历史记录与今天使用同一个入口和同一套保存流程。

这项改动没有数据库迁移。既有 repository 继续按任意日期保存；新增的 `saveJournalEntry(date, text)` 显式接收右页日期，并用 JournalBook 内的临时 UI 状态区分阅读、编辑准备和正在书写。

为避免丢稿，正在书写且内容发生变化时，翻页、关闭本子、切回阅读都会被阻止并提示“请先收笔”。本次没有增加自动保存、草稿持久化或复杂确认弹窗。

## 2. 用户需求

### 用户原始要求

1. 本子内页缺少明显的酒红色书签。
2. 左页应为空白内容，只有右页显示日期、正文和贴纸内容。
3. 过往笔记也应可以编辑，今天和历史日期使用统一编辑入口。
4. 本子区分阅读模式与编辑模式。
5. 阅读/编辑是一个选中态切换控件，悬浮在右页右侧、本子外部。
6. 编辑模式下，在该控件下方显示“书写”；点击后开始编辑，编辑结束点击“保存”或更书面化的动词。
7. 阅读/编辑与书写/保存是上下两级、各自会切换状态的按钮。

### 2026-08-10 验收补充

- 两级控件必须竖向排列，移动端也不得改成左右并排。
- “阅读 / 编辑”不是两个按钮，而是一个同时显示两个标签、选中块可滑动的切换按钮。
- 下层“书写 / 收笔”继续作为独立动作按钮，位于模式切换按钮下方。
- 用户进一步明确“竖着”指文字本身也要竖排：模式按钮按“阅 / 读 / 编 / 辑”自上而下显示并纵向滑动；动作按钮按“图标 / 书 / 写”自上而下显示，书写阶段对应“图标 / 收 / 笔”。

### Codex 对需求的解释

- 酒红书签继续在 `DD-20260809-002` 中修正，不把纯视觉验收项混入本任务的交互审批。
- “左页空白”解释为不显示历史正文、日期标题、贴纸或“第一页”文案；左页仍保留可访问的上一页命中区域和翻页动画职责。
- “只有右页显示内容”表示每个游标只对应一个日期，右页显示该日期的正文和贴纸；不再把前一天同时铺在左页。
- 打开本子默认是阅读模式。选择编辑模式并不立即出现 textarea；还需要点击“书写”进入当前右页的写作状态。
- 建议把“保存”显示文案写成 **“收笔”**，按钮的 `aria-label` 和 title 使用“保存本页”，兼顾纸本气质与清楚语义。
- 历史编辑只覆盖文字正文。历史贴纸继续只读；让历史贴纸也可移动/删除属于另一项交互扩展。

## 3. 实施前源码事实（已被本任务替代）

> 本节保留方案审批时的源码基线，用于解释改造原因；当前实现事实以第 11 节、`docs/product/mvp.md` 和 `docs/architecture/system-overview.html` 为准。

### 双页布局与导航

- `src/features/journal/JournalPanel.tsx` 的 `JournalBook` 用 `journalCursor` 计算 `leftDate = cursor - 1` 与 `rightDate = cursor`。左页通过 `HistoricalJournalPage` 显示前一日期，右页若为今天则渲染 form，否则也渲染只读 `HistoricalJournalPage`。
- `HistoricalJournalPage` 在整页上覆盖 `.journal-page-navigation` 按钮；页面正文和只读 `JournalStickerLayer` 位于其下。左右页面分别发出 `previous` / `next`。
- `PageTurnSheet` 只需要 `fromDate`、`toDate` 和方向，视觉上不依赖左页必须承载前一日期正文，因此可以保留现有 CSS 3D 翻页机制。
- 截图 `C:/Users/18379/AppData/Local/Temp/codex-clipboard-4b6931c4-3d5d-4f85-aeb1-9eb35b8326ad.png` 已通过 WSL 映射路径读取。截图显示左页为 8 月 8 日历史内容，右页为 8 月 9 日今天编辑器，与用户期望不符。

### 日期、加载与保存链路

- `src/state/app-store.ts` 的 `selectedDate` 是应用启动时的今天日期；`entry` 与 `journalStickers` 也专指今天。
- `journalPageDates` 是正文日期、贴纸日期和今天日期的有序并集；`journalCursor` 是当前右页浏览游标，翻页不会改变 `selectedDate`。
- `loadJournalPages()` 与 `requestJournalTurn()` 已按日期把历史正文放入 `journalPageEntries[date]`，把贴纸放入 `journalPageStickers[date]`。右页所需历史数据已经存在，无需新增 repository 查询类型。
- `saveEntry(text)` 固定调用 `repository.save(get().selectedDate, text)`，随后只更新今天 `entry` 和 `journalPageEntries[selectedDate]`。这是历史页不能编辑的直接原因。
- `DailyEntryRepository.save(date, text)` 已接受任意 `LocalDate`，Dexie repository 会保留已有 `createdAt` 并更新 `updatedAt`；数据库 schema 不需要变化。

### 当前编辑器与测试

- 只有 `rightDate === selectedDate` 时右页才渲染 form/textarea；历史页始终为只读组件。
- `JournalBook` 本地只维护 `draft`，组件 key 包含今天日期和今天 entry 的 `updatedAt`；尚无阅读/编辑/书写会话状态。
- 现有 `JournalPanel.test.tsx` 覆盖今天加载保存、保存失败保留草稿、历史翻页、翻页重入锁和关闭时卸载；`app-store.test.ts` 覆盖日期并集和翻页游标，但没有按历史日期保存测试。
- 当前 `NotebookPhase` 的 `'editing'` 名称表示“本子已打开且 DOM 面板存在”，并不等于用户正在编辑文字。为避免扩大跨场景状态机，本任务不重命名它。

## 4. 目标与非目标

### 4.1 目标

- 双页稳定为左页留白、右页显示当前游标日期的正文和贴纸。
- 今天与历史日期共用同一只读页面、同一编辑器和显式按日期保存链路。
- 打开本子默认阅读；提供悬浮在右页外侧、按“阅 / 读 / 编 / 辑”竖排并上下滑动的单个模式按钮。
- 编辑模式下提供第二级“书写 / 收笔”动作；只有书写阶段出现 textarea。
- 保存成功后右页立即显示新正文，并同步今天专用状态或历史页缓存。
- 正在书写且草稿有改动时不允许静默翻页、切回阅读或关闭本子。
- 保持翻页动画、贴纸读取、IndexedDB 数据和本子开合行为可靠。

### 4.2 非目标

- 不修改 IndexedDB schema、DailyEntry 领域结构或已有记录。
- 不实现自动保存、跨页面草稿持久化、版本历史、撤销栈或富文本。
- 不在本任务编辑历史贴纸、改变贴纸坐标或移动贴纸制作入口。
- 不改变 NotebookPhase、相机、本子 3D 开合或新增 WebGL Canvas。
- 不把左页改成目录、工具栏、月历或第二个编辑器。
- 不在未批准前修改业务源码、测试或持久化数据。

## 5. 方案说明

### 5.1 页面模型

每个 `journalCursor` 只代表一个当前日期：

```text
左页：空白纸面 + 上一页命中区（若存在）
右页：journalPageDates[journalCursor] 的日期、正文、贴纸
右页外侧：单个“阅 / 读 / 编 / 辑”竖排上下滑动按钮
            纵向下一级：编辑模式时显示“图标 / 书 / 写”或“图标 / 收 / 笔”
```

阅读或编辑准备阶段可以翻页；正在书写时锁定翻页，避免 textarea 与整页导航命中冲突。右页“下一页”命中区建议缩小为右侧页缘，而不是覆盖正文全文，从而允许阅读模式下选择文字，并为未来更稳定的内容交互留出空间。

### 5.2 两级交互状态

JournalBook 使用不持久化的本地 UI 状态：

```text
journalMode: 'reading' | 'editing'
writingPhase: 'idle' | 'writing' | 'saving'
draftDate: LocalDate | null
draft: string
```

- 打开本子：`reading + idle`。
- 选择“编辑”：`editing + idle`，右页仍以只读方式显示。
- 点击“书写”：以当前右页正文初始化 draft，进入 `editing + writing`，聚焦 textarea。
- 点击“收笔”：调用按日期保存；成功回到 `editing + idle`，失败留在 writing 并保留草稿。
- 切回“阅读”：只允许在没有未保存修改时执行；切换后隐藏第二级动作。
- 翻页：允许在 reading 或 `editing + idle`；翻页后仍保持当前顶层模式，但不自动进入 writing。

模式控件使用单个 DOM button、`aria-pressed`、可见焦点和状态文案；按钮内部以 CSS 竖排显示“阅读 / 编辑”，选中块随模式上下滑动。书写动作作为下一级按钮按“图标 / 书 / 写”或“图标 / 收 / 笔”竖排，不把操作画进 WebGL。桌面端悬浮在右页外约 16–20px；移动端为本子右侧预留窄安全区，继续使用同一条竖向工具条且不能横向溢出。

### 5.3 保存与缓存同步

建议新增 `saveJournalEntry(date, text)`，或把当前 `saveEntry` 改为显式接收日期。为控制兼容风险，推荐保留 `saveEntry(text)` 作为今天入口，并新增按日期 action：

```text
saveJournalEntry(date, text)
  -> DailyEntryRepository.save(date, text)
  -> journalPageEntries[date] = savedEntry
  -> if date === selectedDate:
       entry = savedEntry
  -> saveStatus = 'saved'
```

这样不改变 repository 公共接口，也不会把浏览游标错误地写入 `selectedDate`。组件保存时始终传入当前右页日期。

### 5.4 未保存内容保护

建议以 `draft !== currentEntryText` 判断 dirty。dirty writing 状态下：

- 翻页按钮禁用；
- 阅读/编辑顶层切换禁用或给出“请先收笔”的状态提示；
- 关闭本子被阻止并给出相同提示；
- 不自动保存，也不静默丢弃。

草稿未发生变化时允许直接退出 writing 或关闭。首版不增加第三个“放弃”按钮；如果用户需要显式放弃入口，应在批准前加入最终清单。

## 6. 预计改动与影响评估

| 预计模块 | 预计责任 |
| --- | --- |
| `src/state/app-store.ts` | 新增按日期保存 action，更新历史缓存和今天别名；不改变持久化模型 |
| `src/features/journal/JournalPanel.tsx` | 重组为左页空白 + 右页统一内容；维护阅读/编辑/书写会话；控制翻页、关闭和保存 |
| `src/features/journal/JournalPage.tsx` | 提取/调整空白左页、统一右页阅读内容和窄页缘导航；历史与今天不再使用两套主体 |
| `src/features/journal/PageTurnSheet.tsx` | 预计仅调整传入日期语义；如现有动画可复用则不改结构 |
| `src/styles.css`、`src/sticker-workbench.css` | 增加右页外悬浮模式控件、移动端布局、只读/书写状态和导航页缘样式 |
| `JournalPanel.test.tsx`、`app-store.test.ts` | 覆盖默认阅读、模式切换、历史写入、失败保稿、未保存保护、左页空白和翻页 |
| 产品、架构、本文与入口 | 实施后同步当前行为、状态所有权、验证和任务状态 |

### 6.1 核心数据结构变化

领域类型、Dexie schema 和 repository 不变。AppState 预计新增：

```ts
saveJournalEntry: (date: LocalDate, text: string) => Promise<boolean>
```

`journalMode`、`writingPhase`、`draftDate` 和 `draft` 只属于 `JournalBook` 挂载期间的界面状态，不进入 Zustand 或 IndexedDB。理由是它们不会被场景、贴纸工作台或其他页面消费，关闭本子后也不承诺恢复。

### 6.2 上下游与跨模块影响

- `DailyEntryRepository.save` 已支持任意日期，是新 store action 的直接下游。
- `entry` 仍是今天的快捷别名；历史保存不得覆盖它。
- `journalPageEntries` 是右页统一渲染的数据源；保存后必须原位更新，避免翻页后显示旧值。
- 今天的 `journalStickers` 与历史 `journalPageStickers` 继续按现有逻辑选择；本任务不改变贴纸编辑权限。
- 正在书写时必须避免 `.journal-page-navigation` 覆盖 textarea，也不能让翻页动画与保存同时运行。
- `JournalPanel` 关闭动作需要先经过 dirty 检查，不能直接调用 `requestNotebookClose`。
- 页面 key 不能再只依赖今天 `entry.updatedAt`，否则历史保存后可能不重建正确 draft；建议由显式会话状态管理，不依赖强制 remount。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 历史内容写到今天 | 保存继续隐式读取 `selectedDate` | 覆盖错误记录 | 保存 action 强制传入右页日期；补历史/今天分离测试 |
| 草稿静默丢失 | 书写中翻页、关闭或切回阅读 | 用户内容丢失 | dirty guard 锁定离开动作并提供 live status |
| 导航遮挡编辑器 | 整页透明按钮继续覆盖右页 | textarea 无法聚焦或选择文字 | 下一页命中缩到页缘；writing 时完全禁用导航 |
| 模式含义混乱 | NotebookPhase `'editing'` 与新 UI `editing` 同名 | 维护者误判状态 | 文档明确区分场景 phase 与 `journalMode`，后者保持组件局部 |
| 移动端外置按钮溢出 | 本子已占满横向空间 | 控件不可触达 | 移动端缩窄本子区域，为右侧竖向工具条预留安全区并保持可触达尺寸 |
| 贴纸遮挡正文编辑 | 现有贴纸覆盖 textarea | 输入或选择受影响 | 保持当前放置模式约束；本任务不扩大贴纸交互，浏览器验收覆盖遮挡 |
| 并行视觉任务冲突 | 同时修改 Journal CSS | 样式覆盖或回退 | 基于当前工作区小补丁，先合并书签修正，再实施交互样式 |

回退只恢复 JournalPanel/JournalPage/store action 与相应 CSS/测试，不迁移或删除任何 DailyEntry。新 action 未改变数据库内容格式，已有历史编辑结果仍是合法记录。

## 8. 验证与验收

- 自动测试：默认阅读；左页无正文/贴纸；阅读/编辑选中态；书写进入 textarea；今天和历史保存；失败保留草稿；dirty 状态阻止翻页/关闭/切换；保存后恢复只读；翻页重入锁不回归。
- 构建与静态检查：`npm run lint`、`TMPDIR=/tmp TMP=/tmp TEMP=/tmp npm run test`、`npm run build`、`git diff --check`、`node scripts/check-doc-references.mjs`。
- 浏览器验收：`ego-browser` 可用时检查桌面 `1440 × 900` 和移动 `390 × 844` 的模式控件、本子外布局、键盘焦点、历史编辑、翻页和关闭；不可用时记录未覆盖并请用户手验。
- 持久化与恢复：编辑历史日期后关闭并重新打开页面，翻回该日期应显示新内容；今天内容和其他日期不被覆盖。
- 成功标准：用户无论翻到今天还是历史日期，都只在右页阅读内容；通过同一组“编辑 → 书写 → 收笔”操作修改并保存，且任何离开动作都不会静默丢稿。

## 9. 待确认项与决策

用户批准第 10 节执行清单时一并接受以下三项建议；当前没有剩余待确认项。

### 决策 1：保存动作显示文案

**建议：使用“收笔”。** 控件视觉显示“书写 / 收笔”，`aria-label` 和 title 明确写“开始书写本页 / 保存本页”。若更看重通用软件直觉，可直接显示“保存”。

### 决策 2：未保存草稿是否需要显式放弃入口

**建议首版不增加。** dirty 状态阻止离开并要求先“收笔”，保持你要求的两级控件最简结构。代价是用户若想放弃大段修改，只能手动恢复内容；若需要“搁笔/放弃修改”，应在批准前加入第三个次要动作。

### 决策 3：顶层编辑模式是否跨翻页保持

**建议保持。** 在 `editing + idle` 下翻页后仍处于编辑模式，但必须再次点击“书写”才进入该页 textarea；这样适合连续整理多天记录，也不会翻页后自动误编辑。

## 10. 最终批准方案

已批准。最终执行清单为：

1. 左页改为空白导航纸面，右页统一显示当前游标日期内容。
2. 打开本子默认阅读，在右页外增加一个按“阅 / 读 / 编 / 辑”竖排并上下滑动的模式按钮。
3. 编辑模式下增加“书写 / 收笔”动作，只有书写阶段显示 textarea。
4. 新增显式按日期保存 action，使今天与历史页共用保存链路。
5. dirty 书写状态阻止翻页、切回阅读和关闭，并显示明确提示。
6. 历史贴纸继续只读；不修改数据库 schema、NotebookPhase 或翻页动画边界。
7. 补齐自动测试、桌面/移动验收和重开恢复验证。
8. 回写产品、架构、本文和文档入口，完成后状态更新为待验收。

## 11. 实施记录

实施于 2026-08-09 23:55 CST 完成，实际改动如下：

- `src/state/app-store.ts`：新增 `saveJournalEntry(date, text)`；按显式日期调用既有 repository，更新 `journalPageEntries[date]`，仅在保存日期等于 `selectedDate` 时同步今天的 `entry` 别名。`saveEntry(text)` 保留并委托给新 action，没有改变 repository 接口或 IndexedDB schema。
- `src/features/journal/JournalPage.tsx`：用 `BlankJournalPage` 和 `JournalReadingPage` 取代历史左右页/内封双主体；左页不再渲染日期、正文、贴纸或“第一页”，右页统一显示当前游标日期；下一页命中缩到右侧页缘。
- `src/features/journal/JournalPanel.tsx`：新增局部 `journalMode`、`writingPhase`、`draftDate`、`draft` 和 live status；打开默认阅读；外置模式控件是一个“阅读 / 编辑”竖排上下滑动 button，下层“书写 / 收笔”采用图标在上、文字竖排在下；保存失败保留草稿；dirty 草稿阻止翻页、切回阅读和关闭。
- `src/styles.css`：增加桌面右页外侧控件、移动端右侧窄安全区、单按钮上下滑动选中块、汉字竖排、图标/文字竖向动作、焦点/禁用态与窄页缘导航；沿用已存在的纸面、书脊、书签和贴纸层视觉。
- `src/features/journal/JournalPanel.test.tsx`、`src/state/app-store.test.ts`：新增默认阅读、单按钮双标签/滑动状态语义、左页留白、模式跨页、今天保存、历史保存、今天别名隔离、失败保稿和 dirty 离开保护测试。
- `docs/product/mvp.md`、`docs/architecture/system-overview.html`、`docs/index.html` 与本文：同步已实现产品行为、状态所有权、保存/失败链路、源码地图、验证边界和待验收状态。
- `PageTurnSheet` 结构、DailyEntry 领域类型、repository、数据库 schema、NotebookPhase、历史贴纸权限与 WebGL Canvas 所有权均未改变。

方案偏差：没有修改 `PageTurnSheet.tsx` 或 `src/sticker-workbench.css`，因为现有动画组件和纸页贴纸层样式可以直接复用；仅把翻页动画的 `fromDate` 调用语义改为当前右页日期。该偏差减少修改面，不改变已批准交互、公共接口或数据结构。

2026-08-10 验收修正：

- `JournalPanel.tsx` 将两个独立的“阅读”“编辑”按钮合并为一个 `journal-mode-toggle` button；按钮始终同时显示两个标签，以 `aria-pressed=false/true` 表达阅读/编辑，并通过当前模式生成明确的“切换到……”可访问名称。
- `styles.css` 使用同一按钮的 `::before` 选中块在上下两段标签之间滑动，以 `writing-mode: vertical-rl` 让“阅读 / 编辑”和“书写 / 收笔”逐字竖排；外层 `journal-mode-controls` 在桌面和移动端都保持右侧单列窄工具条。
- `JournalPanel.test.tsx` 改为验证只有一个模式按钮、按钮内双标签、默认阅读语义、编辑语义和 dirty 状态下通过同一按钮尝试切回阅读。
- 产品、架构、入口和本文均已同步“竖排单按钮上下滑动 + 图标/文字竖排动作”的当前事实。

## 12. 验证结果

- 定向测试：`TMPDIR=/tmp TMP=/tmp TEMP=/tmp npm run test -- --run src/features/journal/JournalPanel.test.tsx src/state/app-store.test.ts` 通过，2 个文件、14 个用例全部通过。
- 全量测试：`TMPDIR=/tmp TMP=/tmp TEMP=/tmp npm run test` 通过，10 个文件、33 个用例全部通过。
- 静态检查：`npm run lint` 通过。
- 生产构建：`npm run build` 通过；保留既有主 bundle、worker 和 ONNX Runtime WASM 体积提示，没有新增运行依赖。
- 差异与文档：`git diff --check` 通过；`node scripts/check-doc-references.mjs` 通过。
- 持久化证据：store 测试证明历史日期被显式传给 repository、历史缓存更新且不覆盖今天别名；既有 Dexie repository 测试继续覆盖按日期创建、更新与读取。真实页面关闭/重新打开后的历史恢复尚未执行浏览器验收。
- 浏览器与 HTML 视觉验证：当前执行环境没有 `ego-browser` 命令或工具能力，按项目规则跳过；桌面 `1440 × 900`、移动 `390 × 844`、键盘焦点、历史编辑、dirty 提示、翻页、关闭、重开恢复，以及 `docs/index.html` / 架构 HTML 的搜索、目录、术语和响应式布局均未生成自动浏览器证据，必须由用户手动验收。
- 首次未设置临时目录的 Vitest 尝试因映射到不存在的 Windows Temp 路径而在加载用例前失败；改用 `/tmp` 后全部通过，该环境失败不属于产品回归。
- 2026-08-10 定向回归：`JournalPanel.test.tsx` 的 6 个用例全部通过，覆盖单按钮双标签与切换语义。
- 2026-08-10 完整门槛：`TMPDIR=/tmp TMP=/tmp TEMP=/tmp npm run check` 通过；10 个测试文件、33 个用例、lint、生产构建与文档引用检查全部通过，仍只有既有构建体积提示。
- 2026-08-10 竖排修正后再次运行完整 `npm run check`：33 个测试、lint、build 与文档引用全部通过；CSS 已改为上下滑块、`writing-mode: vertical-rl` 和移动端右侧预留区，但因没有 `ego-browser`，实际字形方向、间距和窄屏占位仍待用户目视验收。

## 13. 文档同步检查

- 产品文档：已更新 `docs/product/mvp.md` 的本子行为、核心验收场景、已确认范围和当前实现覆盖；明确 DD-20260809-004 已实现但待验收。
- 架构文档：按 `$bun-html-docs` 规范实质更新 `docs/architecture/system-overview.html`，同步空白左页、统一右页、局部会话、按日期保存、失败路径、示例、源码地图和证据边界。
- 决策文档：未新增；实现继续遵守 local-first、DOM 表单、数据/场景分离和单活跃 Canvas 决策，没有产生新的长期架构约束。
- 文档入口：已将 `docs/index.html` 的任务状态更新为待验收，并同步当前产品链路与源码职责。
- 文档引用：`node scripts/check-doc-references.mjs` 通过；未发现失效相对路径或未解释占位内容。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-09 23:25 CST | 用户 | 提供当前本子截图，要求左页留白、右页统一显示内容、历史可编辑，并在本子右外侧设置阅读/编辑和书写/保存两级切换控件。 |
| 2026-08-09 23:25 CST | Codex | 完成截图与真实调用链核对，创建按日期保存和局部编辑会话的待确认方案；未修改交互源码。 |
| 2026-08-09 23:30 CST | Codex | 完成关联视觉任务的酒红书签修正和现有行为回归检查；本文交互方案继续等待用户批准。 |
| 2026-08-09 23:52 CST | 用户 | 明确要求“交互改造方案执行”，批准第 10 节最终执行清单。 |
| 2026-08-09 23:52 CST | Codex | 将任务状态更新为实施中，开始按已批准范围核对源码并执行。 |
| 2026-08-09 23:55 CST | Codex | 完成源码、测试和文档回写；33 个自动测试、lint、build、差异和文档引用检查通过。因当前环境无 `ego-browser`，桌面、移动、重开恢复和 HTML 交互保留为用户手动验收项，任务进入待验收。 |
| 2026-08-10 10:15 CST | 用户 | 验收反馈要求两级控件竖向排列，并将“阅读 / 编辑”从两个按钮改成一个同时显示双标签的滑动切换按钮。 |
| 2026-08-10 10:15 CST | Codex | 将同一任务恢复为实施中，按验收反馈修正控件结构、响应式布局、测试和当前事实文档。 |
| 2026-08-10 10:19 CST | Codex | 完成单按钮滑动切换、桌面/移动纵向布局、测试与文档同步；完整 `npm run check` 通过，任务重新进入待验收。 |
| 2026-08-10 10:43 CST | 用户 | 进一步明确控件文字也必须竖排，目标形态为“阅 / 读 / 编 / 辑”，下方为“图标 / 书 / 写”。 |
| 2026-08-10 10:43 CST | Codex | 将任务恢复为实施中，修正滑块方向、文字书写方向和移动端右侧窄工具条布局。 |
| 2026-08-10 10:48 CST | Codex | 完成“阅 / 读 / 编 / 辑”竖排上下滑块与“图标 / 书 / 写”竖排动作按钮；完整检查通过，任务重新进入待验收。 |
