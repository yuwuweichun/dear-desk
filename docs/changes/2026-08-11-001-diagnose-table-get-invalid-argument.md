# DD-20260811-001：诊断 Table.get 参数错误

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待确认 |
| 类型 | 调研 |
| 创建时间 | 2026-08-11 18:15 CST |
| 最后更新 | 2026-08-11 18:24 CST |
| 当前阶段 | 启动加载链已确认；等待确认实际坏字段与是否进入修复 |
| 源码基线 | Git commit `c7a3660`；工作区包含已批准任务 DD-20260810-002 的未提交改动 |
| 实现提交 | 尚未创建 |
| 关联任务 | 页面显示 `Invalid argument to Table.get()`，用户要求分析原因 |

> 本文是故障诊断记录。用户本轮只要求分析；除本文档外，不修改业务源码、工程配置或持久化数据。

## 1. 给阅读者的结论

`Invalid argument to Table.get()` 不是 Three.js、React 或浏览器扩展错误，而是 Dexie 收到 `null` / `undefined` 主键时产生的精确异常。用户确认刚访问 5164、尚未交互时就出现错误；首屏只会并行调用 `loadToday()` 和 `loadStickers()`。当前日期由 `toLocalDate()` 同步生成，不会为空，因此可以确认错误来自启动时的贴纸加载：用户浏览器中存在一条残缺的贴纸记录，`stickerInstance.definitionId` 为空，或其定义的 `previewAssetId` 为空。

当前 repository 在读取贴纸时直接把这两个持久化字段传给 `Table.get()`，没有运行时完整性检查；store 又捕获异常并把原始 `error.message` 显示到页面，因此控制台不会出现未捕获的 `Table.get()` 堆栈。清空站点数据会让提示消失，但会删除本地记录且掩盖兼容缺口，不应作为修复。

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
- `DexieStickerRepository.listInstances()` 假定所有持久化 instance 都有 `definitionId`、所有 definition 都有 `previewAssetId`。若引用是有效字符串但目标记录不存在，代码会返回 `null` 并跳过；只有引用字段本身为 `null` / `undefined` 才会抛出本次错误。
- IndexedDB v3 升级只为旧 instance 补 `surface: 'desk'`，没有校验或修复 `definitionId`、`previewAssetId` 及引用完整性。当前自动测试只覆盖由 repository 正常事务创建的完整记录和标准 v2→v3 迁移，没有残缺旧记录用例。
- `src/state/app-store.ts:115` 的 `messageFromError()` 原样采用 `error.message`。`loadStickers()` 捕获后写入 `stickerErrorMessage`，由 `StickerControls` 或打开的 `JournalPanel` 显示，所以控制台没有应用异常堆栈并不矛盾。
- 用户确认错误在刚访问 5164、未执行打开本子或贴纸操作时出现。`ProductApp` 的首个 effect 同时调用 `loadToday()` 与 `loadStickers()`；结合非空 `selectedDate`，排除移动、旋转、删除、历史翻页及 3D 模型路径，并将故障确定到 `listDesk()` / `listJournal(today)` 共用的 `listInstances()`。
- 用户提供的控制台消息分类：React DevTools 是开发提示；`THREE.Clock` 是当前 R3F/Three.js 的弃用警告，但不影响 IndexedDB；`content_main.js` 的 dynamic-i18n mismatch 和 Built-In AI 提示来自“沉浸式翻译”扩展，均与 `Table.get()` 无关。
- 使用 `ego-browser` task space 18 在 `http://127.0.0.1:5164/` 重载桌面并打开本子，未复现错误。该隔离环境的 `dear-desk` 数据库为 Dexie v3（原生 IndexedDB version 30），贴纸四张表均为空，唯一正文记录完整；这证明问题依赖用户当前浏览器数据，而不是所有新会话都会触发。

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

- 自动测试：现有测试没有残缺 instance / definition 场景；临时 fake-indexeddb 诊断确认 `.get(undefined)` 产生同名错误，本轮不新增仓库测试。
- 构建与静态检查：诊断记录完成后运行文档引用与差异格式检查。
- 浏览器验收：隔离数据下桌面重载与打开本子均正常；用户控制台没有应用异常堆栈，符合 store 捕获行为。
- 持久化与恢复：已只读检查 task space 18 的 schema、keyPath 和全部记录，没有写数据；用户实际坏记录尚未被该隔离空间覆盖。
- 成功标准：已将根因定位到贴纸 foreign-key 字段为空；具体字段需用户页面位置或实际数据确认。

## 9. 待确认项与决策

1. 待确认具体坏字段：`instance.definitionId` 或 `definition.previewAssetId`。需要只读检查用户当前浏览器的贴纸三张关联表，不能从隔离 task space 推断。
2. 待用户决定是否继续修复。建议先做不写库的完整性审计，再批准 repository 容错与针对性迁移；不建议清空站点数据。

## 10. 最终批准方案

本轮未请求修复批准。若用户要求实施，将在本文记录批准范围。

## 11. 实施记录

不适用：用户本轮只要求分析。

## 12. 验证结果

- 源码与 Dexie 实现核查完成；错误只在 `Table.get(null | undefined)` 产生。
- 临时 fake-indexeddb 命令复现：`TypeError: Invalid argument to Table.get()`。
- `ego-browser` 桌面初始化和打开本子通过；隔离数据库没有贴纸记录，未复现用户数据特有错误。
- 用户控制台仅包含 React 开发提示、Three.js 弃用警告与浏览器扩展消息，没有 Dear Desk 未捕获异常。

## 13. 文档同步检查

- 产品文档：诊断阶段不修改。
- 架构文档：诊断阶段不修改。
- 决策文档：诊断阶段不修改。
- 文档入口：诊断阶段不修改。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-11 18:15 CST | Codex | 创建只读故障诊断记录；尚未修改业务源码或持久化数据。 |
| 2026-08-11 18:15-18:20 CST | Codex | 核对产品、架构、ADR、Dexie 实现、全部 `.get()` 调用、store 错误展示、schema 迁移和测试；使用 `ego-browser` 只读复现桌面与本子并审计隔离 IndexedDB。根因范围定位为贴纸引用字段为空，未修改业务源码或用户数据。 |
| 2026-08-11 18:17 CST | 用户 | 提供控制台消息；其中没有 `Table.get()` 堆栈，只有 React/Three.js 提示和沉浸式翻译扩展消息。 |
| 2026-08-11 18:24 CST | 用户 | 确认刚访问 5164、尚未交互时就出现错误，将故障确定到首屏 `loadStickers()` 的贴纸关联读取。 |
