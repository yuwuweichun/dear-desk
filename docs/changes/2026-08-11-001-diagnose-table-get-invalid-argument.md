# DD-20260811-001：诊断 Table.get 参数错误

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待验收 |
| 类型 | 调研 |
| 创建时间 | 2026-08-11 18:15 CST |
| 最后更新 | 2026-08-19 16:48 CST |
| 当前阶段 | 已验收，提交受环境权限阻塞 |
| 源码基线 | Git commit `332135f`；工作区另有与本任务无关的未跟踪字体任务文件 |
| 实现提交 | 尚未创建（`.git/index` 写入被环境拒绝） |
| 关联任务 | 页面显示 `Invalid argument to Table.get()`，用户要求分析原因 |

> 本文记录故障诊断与已批准修复。修复不写入或删除用户现有持久化数据。

## 1. 给阅读者的结论

`Invalid argument to Table.get()` 不是 Three.js、React 或浏览器扩展错误，而是 Dexie 收到 `null` / `undefined` 主键时产生的精确异常。用户确认刚访问 5164、尚未交互时就出现错误；当时首屏并行调用 `loadToday()` 和 `loadStickers()`。当前日期由 `toLocalDate()` 同步生成，不会为空，因此错误来自启动时的贴纸加载：用户浏览器中存在一条残缺的贴纸记录，`stickerInstance.definitionId` 为空，或其定义的 `previewAssetId` 为空。

2026-08-19 复查确认：此前任务只完成了诊断，状态一直是“待确认”，没有修改业务源码或新增残缺数据测试，因此不存在已经落地但失效的修复。当前 repository 仍直接把这两个持久化字段传给 `Table.get()`，没有运行时完整性检查；store 又捕获异常并把原始 `error.message` 显示到页面。之后新增的铭牌设置启动读取也使用 `Table.get()`，但其键是编译期固定字符串 `primary`，不构成本次空参数来源。清空站点数据会让提示消失，但会删除本地记录且掩盖兼容缺口，不应作为修复。

## 2. 用户需求

用户报告页面错误 `Invalid argument to Table.get()`，要求分析。Codex 将复现故障、追踪真实调用链并说明根因、影响范围与建议修复，不在本轮修改业务源码或用户数据。

## 3. 当前源码事实

- Dexie 4.4.4 的 `Table.get()` 在 `keyOrCrit == null` 时直接拒绝并生成 `TypeError: Invalid argument to Table.get()`；临时 fake-indexeddb 诊断已复现完全相同的错误文本。
- 应用只有以下主键读取入口：
  - `src/persistence/daily-entry-repository.ts:16`：`dailyEntries.get(date)`；
  - `src/persistence/sticker-repository.ts:59`：`stickerDefinitions.get(instance.definitionId)`；
  - `src/persistence/sticker-repository.ts:61`：`stickerRenderAssets.get(definition.previewAssetId)`；
  - 贴纸移动、旋转和删除也按 `instanceId` 调用 `.get()`，但均有选中 ID guard，不符合“页面加载即报错”的典型触发条件。
- `src/main.tsx` 使用 `toLocalDate()` 创建 store；`loadToday()`、`loadStickers()` 和 `loadJournalPages()` 都从该字符串日期出发。日期索引还会在进入 `getByDate()` 前过滤为字符串，因此正文路径没有已知的空 key 来源。
- `DexieStickerRepository.listInstances()` 现在要求持久化 instance 的 `definitionId`、definition 的 `previewAssetId` 为非空字符串；缺失字段的记录在调用 `Table.get()` 前被跳过，引用是有效字符串但目标记录不存在时也会返回 `null` 并跳过。
- IndexedDB v3 升级只为旧 instance 补 `surface: 'desk'`，没有校验或修复 `definitionId`、`previewAssetId` 及引用完整性。当前自动测试只覆盖由 repository 正常事务创建的完整记录和标准 v2→v3 迁移，没有残缺旧记录用例。
- `src/state/app-store.ts:115` 的 `messageFromError()` 原样采用 `error.message`。`loadStickers()` 捕获后写入 `stickerErrorMessage`，由 `StickerControls` 或打开的 `JournalPanel` 显示，所以控制台没有应用异常堆栈并不矛盾。
- 用户确认错误在刚访问 5164、未执行打开本子或贴纸操作时出现。`ProductApp` 的首个 effect 同时调用 `loadToday()` 与 `loadStickers()`；结合非空 `selectedDate`，排除移动、旋转、删除、历史翻页及 3D 模型路径，并将故障确定到 `listDesk()` / `listJournal(today)` 共用的 `listInstances()`。
- 用户提供的控制台消息分类：React DevTools 是开发提示；`THREE.Clock` 是当前 R3F/Three.js 的弃用警告，但不影响 IndexedDB；`content_main.js` 的 dynamic-i18n mismatch 和 Built-In AI 提示来自“沉浸式翻译”扩展，均与 `Table.get()` 无关。
- 使用 `ego-browser` task space 18 在 `http://127.0.0.1:5164/` 重载桌面并打开本子，未复现错误。该隔离环境的 `dear-desk` 数据库为 Dexie v3（原生 IndexedDB version 30），贴纸四张表均为空，唯一正文记录完整；这证明问题依赖用户当前浏览器数据，而不是所有新会话都会触发。
- 2026-08-19 基于 commit `332135f` 再次核查全部 Dexie `.get()`：新增 `notebookCoverSettings.get('primary')` 使用固定非空键；其错误只在用户打开铭牌编辑对话框后显示，不会形成桌面首屏贴纸错误 toast。首屏可见的同名错误仍指向 `loadStickers()`。
- 贴纸 repository 自初始实现 `e97a596` 起就直接解引用 `instance.definitionId` 与 `definition.previewAssetId`；历史提交、当前实现和现有测试都没有为残缺记录增加 guard。原任务记录也没有后续实现提交。因此“之前试着解决过”实际是完成了原因分析，没有进入修复。
- 2026-08-19 使用 `ego-browser` task space 13 再次访问 `http://127.0.0.1:5164/`。隔离数据库已升级为 Dexie v4（原生 IndexedDB version 40），贴纸四张关联表和 `notebookCoverSettings` 仍为空，页面未复现错误；唯一日记记录结构完整。该结果再次证明故障依赖用户日常浏览器中的特定持久化记录，但隔离空间无法确认两个候选坏字段中的哪一个。

合理推断：用户浏览器可能保留过开发过程中的旧或部分写入数据。Git 历史中的已提交 v2/v3 schema 都要求这两个字段，因此仅凭仓库历史不能证明是哪一版产生坏记录；需要只读查看用户实际记录才能区分两个字段。

## 4. 目标与非目标

### 4.1 目标

- 确认报错的具体页面状态、调用栈、Dexie 表和无效参数来源。
- 区分源码回归、旧数据兼容问题与浏览器临时状态。
- 给出有证据支持的修复建议和验证范围。

### 4.2 非目标

- 本轮不修改业务源码、依赖、配置或 IndexedDB 数据。
- 不以清空站点数据代替根因分析。

## 5. 方案说明

已按计划核对所有 `Table.get()`、store 捕获链、schema、迁移和自动测试，并在隔离浏览器完成桌面/本子复现与 IndexedDB 只读审计。建议的修复方向是先在 repository 加持久化记录完整性校验，让单条残缺贴纸不会阻断全部贴纸加载；再根据用户实际坏字段决定是否需要可逆的数据修复或只跳过不可恢复记录。

## 6. 预计改动与影响评估

本轮仅诊断，不修改业务文件。若用户要求修复，预计至少涉及 `sticker-repository.ts` 的边界校验、残缺记录测试和面向用户的错误信息；是否升级 schema 或修复历史数据必须在读取实际坏记录后决定，不能预先假定可删除。

### 6.1 核心数据结构变化

本轮不改变数据结构。潜在修复优先保持 v3 schema 与公共领域类型不变；只有实际数据证明需要迁移时，才评估 v4 完整性修复。

### 6.2 上下游与跨模块影响

影响链为：历史 IndexedDB 贴纸记录 → `listDesk()` / `listJournal()` → `listInstances()` → `.get(undefined)` → `loadStickers()` 捕获 → `stickerErrorMessage` → 页面 toast 或日记错误。`Promise.all` 会使一条坏记录阻断桌面与当日日记两组贴纸的整体加载；正文与 Three.js 模型本身不受该错误直接影响。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 诊断时误改用户数据 | 对 IndexedDB 执行写入或清理 | 丢失本地记录或掩盖根因 | 浏览器检查只读，不执行 put/delete/clear |
| 无法复现 | 错误依赖特定旧数据或页面状态 | 只能得到不完整推断 | 保留控制台与实际记录结构证据，明确未确认项 |
| 直接跳过坏记录导致静默丢失 | 引用字段可通过其他记录恢复 | 用户看不到原贴纸 | 修复前只读审计关联表；记录跳过数量并保留原始数据 |

## 8. 验证与验收

- 自动测试：新增残缺 `definitionId` 与残缺 `previewAssetId` 两类 repository 场景；两类测试均确认坏记录被跳过且不会阻断完整记录。
- 构建与静态检查：运行针对性 Vitest、文档引用检查与差异格式检查。
- 浏览器验收：隔离数据下桌面重载与打开本子均正常；用户控制台没有应用异常堆栈，符合 store 捕获行为。
- 持久化与恢复：已只读检查 task space 18 的 schema、keyPath 和全部记录，没有写数据；用户实际坏记录尚未被该隔离空间覆盖。
- 成功标准：残缺贴纸关联不再触发 `Table.get()` 参数异常，完整贴纸继续加载；不改写用户数据。

## 9. 待确认项与决策

1. 用户日常浏览器中的具体坏字段仍未被读取确认；本次修复同时覆盖两个候选字段，因此不阻塞交付。
2. 自动改写或删除历史坏记录保持为非目标；当前行为是只读跳过，避免进一步损失本地数据。

## 10. 最终批准方案

2026-08-19 用户明确批准执行修复。最终执行清单：

1. 在贴纸关联读取前校验 `definitionId` 与 `previewAssetId` 为非空字符串。
2. 对残缺关联记录跳过处理，不删除、不改写用户数据，不阻断其他完整贴纸加载。
3. 增加两类残缺字段的 repository 测试，并同步架构失败路径说明。

## 11. 实施记录

已完成：

- `src/persistence/sticker-repository.ts`：在两次 `Table.get()` 前增加非空字符串 guard；残缺记录返回 `null` 并被现有过滤逻辑跳过。
- `src/persistence/sticker-repository.test.ts`：增加缺失 instance `definitionId`、缺失 definition `previewAssetId` 两类坏数据测试，并验证完整记录不受影响。
- `docs/architecture/sticker-system.md`：记录残缺贴纸关联的只读隔离行为。

方案偏差：无。未升级 IndexedDB schema，未执行用户数据写入、删除或迁移。

## 12. 验证结果

- 源码与 Dexie 实现核查完成；错误只在 `Table.get(null | undefined)` 产生。
- 临时 fake-indexeddb 命令复现：`TypeError: Invalid argument to Table.get()`。
- `ego-browser` 桌面初始化和打开本子通过；隔离数据库没有贴纸记录，未复现用户数据特有错误。
- 用户控制台仅包含 React 开发提示、Three.js 弃用警告与浏览器扩展消息，没有 Dear Desk 未捕获异常。
- 2026-08-19 修复前复查：`git log --follow -- src/persistence/sticker-repository.ts` 仅有功能提交，无该错误的修复提交；当时 `listInstances()` 在未校验字段的情况下调用两次 `Table.get()`。
- 2026-08-19 浏览器复查：task space 13、Dexie v4 / IndexedDB version 40、贴纸关联表为空，桌面首屏无错误；未覆盖用户日常浏览器中的故障数据。
- 2026-08-19 修复验证：`npm run check` 通过（18 个测试文件、75 个测试、构建和文档引用检查）；新增两类残缺外键测试通过，repository 现在会隔离坏记录并继续返回完整贴纸。
- 2026-08-19 浏览器验收：`ego-browser` task space 15 访问 `http://127.0.0.1:5164/`，首屏未出现 `Invalid argument to Table.get()`；空间已关闭。

## 13. 文档同步检查

- 产品文档：无产品范围变化，不修改。
- 架构文档：已更新 `docs/architecture/sticker-system.md` 的失败路径。
- 决策文档：诊断阶段不修改。
- 文档入口：诊断阶段不修改。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-11 18:15 CST | Codex | 创建只读故障诊断记录；尚未修改业务源码或持久化数据。 |
| 2026-08-11 18:15-18:20 CST | Codex | 核对产品、架构、ADR、Dexie 实现、全部 `.get()` 调用、store 错误展示、schema 迁移和测试；使用 `ego-browser` 只读复现桌面与本子并审计隔离 IndexedDB。根因范围定位为贴纸引用字段为空，未修改业务源码或用户数据。 |
| 2026-08-11 18:17 CST | 用户 | 提供控制台消息；其中没有 `Table.get()` 堆栈，只有 React/Three.js 提示和沉浸式翻译扩展消息。 |
| 2026-08-11 18:24 CST | 用户 | 确认刚访问 5164、尚未交互时就出现错误，将故障确定到首屏 `loadStickers()` 的贴纸关联读取。 |
| 2026-08-19 16:21 CST | 用户 | 反馈错误此前尝试处理但似乎未解决，要求继续摸查。 |
| 2026-08-19 16:24 CST | Codex | 基于当前 HEAD 复查所有 Dexie 主键读取、相关历史提交与测试；确认此前只有诊断记录、没有实施修复。使用 `ego-browser` task space 13 只读检查本地 5164 页面与 Dexie v4 隔离数据，未复现依赖用户日常浏览器坏记录的错误，未修改业务源码或持久化数据。 |
| 2026-08-19 16:30 CST | 用户 | 明确批准执行修复。 |
| 2026-08-19 16:38 CST | Codex | 实施贴纸关联读取 guard、两类坏数据测试和架构失败路径回写；未修改用户持久化数据，状态更新为“待验收”。 |
| 2026-08-19 16:45 CST | 用户 | 验收通过，要求提交本任务涉及的更改。 |
| 2026-08-19 16:45 CST | Codex | 准备按用户验收授权提交本任务涉及的四个文件，但环境拒绝写入 `.git/index`。 |
| 2026-08-19 16:48 CST | Codex | 未绕过安全限制；恢复“待验收/尚未创建提交”状态。源码、测试和文档改动仍保留在工作区。 |
