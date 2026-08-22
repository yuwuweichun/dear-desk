# DD-20260823-001：全局内容字体设置与首页入口

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 / UI / 状态重构 |
| 创建时间 | 2026-08-23 00:53 CST |
| 最后更新 | 2026-08-23 01:56 CST |
| 当前阶段 | 实施、验证与用户验收均已完成 |
| 源码基线 | 当前工作树，未创建提交；存在已批准字体任务和其他文档状态回写 |
| 实现提交 | 本次提交（由 Git 记录） |
| 关联任务 | 用户要求把日记字体设置提升为全局设置，同时驱动日记和铭牌，且不改变 UI 字体；关联 `DD-20260819-004` |

> 本文只把“全局”定义为用户内容字体作用域，不代表替换应用 UI 字体。用户已批准右上角入口及以下最终执行清单。

## 1. 给阅读者的结论

字体偏好现已提升为全局内容设置：同一选择同时决定日记正文/输入和黄铜铭牌的动态字形，但按钮、菜单、标题、HUD、状态提示等 UI 继续使用现有 `animal-island-ui` 的 Nunito/Noto Sans SC。

字体入口已从日记页移到首页右上角现有场景工具栈，位于调色板与自由视角之间，使用 `Type` 图标，字体菜单向左展开。右上角继续统一承载场景外观和观察工具；没有新增右下角孤立入口。

## 2. 用户需求

- 把现有日记字体设置改为全局字体设置。
- 字体选择同时影响日记字体和铭牌字体。
- 字体设置按钮从日记页面移到首页。
- 在首页右上角与右下角之间选择合适位置。
- UI 字体不得改变。

## 3. 当前源码事实

- `src/domain/journal-font.ts` 定义 `paper | xuandong | suifeng | zhimang` 的全局内容字体类型、选项和字体栈，偏好保存在兼容 `localStorage` 键 `dear-desk:journal-font`。
- `src/app/App.tsx` 的 `ProductApp` 是当前页面唯一字体状态所有者；首页右上角 `ContentFontControl` 负责选择并写回偏好。
- `src/features/journal/JournalPanel.tsx` 只消费 `contentFont`，不再持有局部字体状态，也不渲染字体按钮或菜单。
- `.journal-panel[data-journal-font]` 只把字体栈赋给日记正文和 textarea；根节点 UI 字体来自 `animal-island-ui` 的 Nunito/Noto Sans SC。
- `src/scene/nameplate-text.ts` 按同一个 `ContentFontId` 生成动态铭刻字形、色调图、凹凸图和粗糙度图；`DeskScene -> NotebookObject` 负责下传和异步替换。
- `NotebookCoverSettings` 只保存 `label`，没有字体字段；铭牌字体无需进入 IndexedDB，可由全局偏好在场景重建时投影。
- 首页右上角 `.scene-tool-stack` 依次包含调色板、字体和自由视角三个图标按钮；字体菜单向左展开，移动端通过顶部偏移避让 HUD。
- 首页底部继续承载桌面主操作和贴纸流程状态；右下角没有新增独立设置入口。

## 4. 目标与非目标

### 4.1 目标

- 建立一个应用级、可持久恢复的内容字体状态，成为日记和铭牌的共同输入。
- 首页切换字体后立即重建铭牌字形及方案 A 的凹凸/粗糙度贴图；随后打开日记时正文和输入使用同一字体。
- 从日记右侧工具列删除字体入口，避免同一设置出现两个所有者。
- 保留四项字体、默认纸页宋体和既有用户偏好。
- 明确隔离 UI 字体，字体菜单仅在预览字样中展示候选字体。

### 4.2 非目标

- 不改变根节点、通用按钮、菜单标签、标题、HUD、日期、状态提示或贴纸工作台 UI 字体。
- 不让字体选择影响贴纸文字、第三方 Sticker Forge 或 Three.js 之外的其他内容。
- 不把字体写入每篇 `DailyEntry` 或 `NotebookCoverSettings`，不升级 IndexedDB。
- 不新增用户上传字体、远端字体或第二套字体偏好。

## 5. 方案说明

`ProductApp` 在应用启动时从现有 `localStorage` 读取稳定字体 ID，并持有当前内容字体。首页右上工具栈的字体菜单写回同一偏好并更新应用状态；`JournalPanel` 只接收当前字体用于 `data-journal-font`，`DeskScene -> NotebookObject -> createNameplateText` 接收同一字体 ID，用对应 CSS font stack 生成动态铭刻字形。

四项映射保持与当前日记一致：

| ID | 显示名 | 日记/铭牌字形栈 |
| --- | --- | --- |
| `paper` | 纸页宋体 | `Georgia, Songti SC, serif` |
| `xuandong` | 玄冬楷书 | `Xuandong Kaishu, Songti SC, serif` |
| `suifeng` | 随峰体 | `The Peak Font Plus, Songti SC, serif` |
| `zhimang` | 志莽行书 | `Zhi Mang Xing, Songti SC, serif` |

字体按钮使用 Lucide `Type` 图标和可访问名称“更换内容字体，当前…”。菜单标签继续使用 UI 字体；只有每项左侧的“字”预览 swatch 使用候选字体。桌面端和移动端均向左展开，避免超出右侧视口。

### 5.1 位置比较

| 位置 | 优点 | 问题 | 建议 |
| --- | --- | --- | --- |
| 右上角现有工具栈 | 与调色板同属全局外观设置；首页可直接观察铭牌；已有响应式定位 | 工具栈从 2 项增加到 3 项 | **推荐：调色板、字体、自由视角** |
| 右下角独立按钮 | 与左上 HUD、左下主操作形成角落平衡 | 新增第二套工具区；移动端易与底部命令、状态条和安全区冲突；语义孤立 | 不推荐 |

## 6. 预计改动与影响评估

| 文件 | 责任 |
| --- | --- |
| `src/domain/journal-font.ts` 或等价重命名模块 | 将语义提升为内容字体，保留 ID、默认值、旧存储键及容错读取 |
| `src/app/App.tsx` | 持有全局内容字体；在首页右上工具栈渲染入口与菜单；向日记和场景下传字体 |
| `src/features/journal/JournalPanel.tsx` | 删除局部持久化所有权和日记页字体按钮，只消费全局字体 |
| `src/scene/DeskScene.tsx`、`src/scene/NotebookObject.tsx` | 把字体 ID 传入铭牌运行时；字体改变时释放旧贴图并重建 |
| `src/scene/nameplate-text.ts` | 按全局字体栈生成方案 A 灰度字形、凹凸图和粗糙度图 |
| `src/styles.css` | 增加首页字体菜单及响应式样式；删除日记工具列入口样式；保持 UI 根字体不变 |
| 相关测试 | 覆盖全局选择、偏好恢复、日记/铭牌联动、UI 字体隔离和贴图资源释放 |

### 6.1 核心数据结构变化

不改变持久化数据结构。运行时新增应用级 `contentFont`（名称以实现为准），值仍为现有四个稳定 ID。为兼容已有用户，`localStorage` 键继续使用 `dear-desk:journal-font`；只提升所有权和含义，不迁移或丢弃偏好。

### 6.2 上下游与跨模块影响

调用链由“`JournalBook` 局部状态 -> 日记 DOM”改为“`ProductApp` 全局内容字体 -> 日记 DOM + Three.js 铭牌投影”。字体变化只触发日记样式属性更新和铭牌运行时纹理替换，不写入正文、铭牌 label 或数据库。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| “全局”误伤 UI | 把内容字体应用到根节点或通用控件 | UI 排版、按钮尺寸和可读性变化 | 只向日记内容容器和 Canvas 字形传入字体；测试根 UI font-family 不变 |
| 同页切换不同步 | 日记与铭牌各自持有局部状态 | 两处显示不同字体 | 应用级单一状态同时下传，删除日记局部所有权 |
| 字体尚未加载就画 Canvas | 首次选择本地字体 | 铭牌暂时使用回退字形且不刷新 | 在生成贴图前等待 `document.fonts.load()`，完成后重建；卸载时取消过期结果 |
| 频繁切换泄漏 GPU 资源 | 连续选择多种字体 | CanvasTexture、material 或 geometry 累积 | 每次替换释放旧色图、凹凸图、粗糙度图、材质和 geometry，补充测试 |
| 右上工具栈过长 | 小高度移动设备 | 三个按钮占用过多高度 | 保持 48px/10px 规则并检查 320px 宽和低高度视口；必要时只调整间距，不移到右下 |
| 旧偏好失效 | 直接更换存储键 | 用户选择恢复默认 | 保留原键和值，语义升级不做迁移 |

## 8. 验证与验收

- 自动测试：四项选择、默认/无效偏好回退、首页菜单、日记入口移除、日记与铭牌使用同一 ID、UI 根字体不变、字体加载竞态和 GPU 资源释放。
- 构建与静态检查：`npm run lint`、`npm test`、`npm run build`、文档引用检查、`git diff --check`。
- 浏览器验收：使用 ego-browser 在桌面与移动端从首页依次切换四种字体，确认铭牌立即变化；打开日记后正文/输入匹配；按钮、菜单标签、HUD 和其他 UI 字体不变。
- 持久化与恢复：选择非默认字体后刷新页面，首页铭牌与日记均恢复同一字体；IndexedDB schema 和记录不变。
- 成功标准：字体设置只有一个首页入口和一个运行时事实来源，同时控制日记内容与铭牌字形，不影响任何 UI 字体。

## 9. 待确认项与决策

用户已确认全局作用域、两个消费者、UI 字体隔离及首页入口位置：采用右上角现有工具栈，顺序为调色板、字体、自由视角，菜单向左展开；不创建右下角独立入口。

## 10. 最终批准方案

已批准（2026-08-23 00:56 CST）。最终执行清单：

1. 把字体偏好提升为应用级单一内容字体状态，保留四项 ID、默认纸页宋体和现有 `localStorage` 键。
2. 将字体入口从日记页移到首页右上工具栈，置于调色板和自由视角之间，菜单向左展开。
3. 日记正文/输入和铭牌 Canvas 字形共同消费该状态；切换后立即重建方案 A 的铭牌凹凸/粗糙度贴图。
4. 不修改根 UI 字体；菜单标签、按钮、标题、HUD、日期和状态提示继续使用 Nunito/Noto Sans SC，只有内容和字体预览使用候选字体。
5. 补齐状态同步、偏好恢复、字体加载、纹理释放、桌面/移动视觉及文档一致性验证。

## 11. 实施记录

已按批准清单实施，未改变 IndexedDB schema、正文/铭牌纯文本结构或根 UI 字体：

- `src/domain/journal-font.ts` 将公开语义提升为 `ContentFontId`、`CONTENT_FONT_OPTIONS` 和 `CONTENT_FONT_FAMILIES`，保留兼容存储键 `dear-desk:journal-font`；无效值和旧 `jingjing` 值回退纸页宋体。
- `src/app/App.tsx` 的 `ProductApp` 成为当前页面唯一字体状态所有者，负责读取/写入偏好，并把同一字体 ID 下传给 `DeskScene` 和 `JournalPanel`。
- 新增 `src/features/settings/ContentFontControl.tsx`，把 `Type` 入口放在首页右上工具栈的调色板与自由视角之间；菜单向左展开，候选字体只用于“字”预览，标签继续继承 UI 字体。
- `src/features/journal/JournalPanel.tsx` 删除日记局部字体状态、持久化副作用、按钮和菜单，只通过 `contentFont` 设置正文/输入的内容字体。
- `src/scene/DeskScene.tsx`、`src/scene/NotebookObject.tsx` 把全局字体传入铭牌；字体变化时先等待 `document.fonts.load()`，再原子替换铭牌 Mesh，并取消过期异步结果。
- `src/scene/nameplate-text.ts` 按当前字体生成 `2048×512` 的色调、凹凸和粗糙度三张 CanvasTexture；`src/scene/models/material-library.ts` 提取共享黄铜参数，铭牌表面使用 `bumpScale = 0.005`。替换和卸载时统一释放三张纹理、材质和 geometry。
- `src/styles.css` 增加首页字体菜单及响应式避让，删除日记字体菜单样式；UI 根字体规则未改。
- 同步更新产品说明、系统架构 HTML、文档首页和相关测试。实施未超出已批准范围。

## 12. 验证结果

- `npm test -- --run`：20 个测试文件、88 项测试全部通过。覆盖字体偏好读写/回退、首页工具顺序、日记入口移除、日记/场景共享字体、字体加载竞态、三张铭牌贴图及 GPU 资源释放。
- `npm run lint`：通过。
- `npm run build`：TypeScript 与 Vite production build 通过；构建仍有既有大 chunk 提示，不是本次回归失败。
- `node scripts/check-doc-references.mjs`：通过。
- `git diff --check`：通过。
- ego-browser 桌面 `1440×900`：右上工具顺序、菜单边界、四种字体切换、志莽行书加载、铭牌动态字形和偏好恢复均通过；正面与斜角未见矩形贴片边界，页面无横向溢出。
- ego-browser 移动 `390×844`：四种字体切换、菜单/HUD 避让、日记正文联动、日记入口移除和 UI 字体隔离均通过，无横向或纵向页面溢出。
- 本地架构 HTML 与文档首页完成 `1440×900` / `390×844` 检查；搜索、键盘跳转、移动目录、术语弹层、复制反馈和零横向溢出均通过。
- 截图：[桌面铭牌与字体菜单](./assets/2026-08-23-001-global-content-font/desktop-nameplate-menu.png)、[移动端日记字体](./assets/2026-08-23-001-global-content-font/mobile-journal.png)。

## 13. 文档同步检查

- 产品文档：`docs/product/mvp.md` 已改为首页全局内容字体入口，并明确日记/铭牌消费者、UI 排除项和字体许可证边界。
- 架构文档：`docs/architecture/system-overview.html` 已更新状态所有权、`localStorage` 语义、Canvas 三贴图生成与失败/释放路径；按 `$bun-html-docs` 要求保留现有阅读壳并完成浏览器验证。
- 决策文档：暂不新增 ADR；未改变 local-first 或场景投影边界。
- 文档入口：`docs/index.html` 已同步“已完成”状态、当前结论和记录入口。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-23 00:53 CST | 用户 / Codex | 用户要求把字体提升为全局设置，同时影响日记和铭牌、不得改变 UI 字体，并询问首页右上或右下位置；Codex 推荐复用右上工具栈，创建待确认方案，未修改业务源码。 |
| 2026-08-23 00:56 CST | 用户 | 明确回复“批准执行”，批准右上工具栈位置和最终执行清单。 |
| 2026-08-23 01:29 CST | Codex | 完成全局字体状态提升、首页入口、日记/铭牌联动、方案 A 三贴图铭刻、资源释放、文档回写及桌面/移动验收；88 项测试、lint、build、文档引用和差异格式检查通过，状态更新为待验收。 |
| 2026-08-23 01:56 CST | 用户 / Codex | 用户明确回复“验收通过”；任务状态更新为已完成，并同步产品、架构和文档入口状态。 |
