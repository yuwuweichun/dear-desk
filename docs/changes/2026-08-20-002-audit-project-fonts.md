# DD-20260820-002：盘点当前项目字体

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已替代 |
| 类型 | 调研 |
| 创建时间 | 2026-08-20 17:06 CST |
| 最后更新 | 2026-08-21 23:29 CST |
| 当前阶段 | 历史盘点已过期，由当前 OFL 字体报告替代 |
| 源码基线 | Git commit `1a66431`；工作区已有未跟踪记录 `docs/changes/2026-08-20-001-replace-journal-fonts.md` |
| 实现提交 | 不适用；本次不修改业务源码 |
| 关联任务 | 用户要求“查询当前项目的字体种类” |

> 本文记录只读盘点结果。本次不会修改业务源码、依赖、工程配置、字体资源或持久化数据。

> 过期说明（2026-08-21）：本文是 2026-08-20 的历史快照；随峰体已在之后加入生产日记字体，当前事实以 `DD-20260821-003` 和源码为准。

## 1. 给阅读者的结论

按字体家族计，当前生产构建会携带 `Nunito`、`Noto Sans SC` 和玄冬楷书 3 个字体家族；本地开发环境再增加云峰晶晶体，共 4 个随项目资源提供的字体家族。`Nunito` 和 `Noto Sans SC` 来自 `animal-island-ui`，玄冬楷书由项目 `public/fonts/` 提供，云峰晶晶体只由开发服务器从 `dev-assets/fonts/` 暴露。

日记字体菜单采用另一种产品口径：生产环境有纸页宋体、玄冬楷书 2 项；开发环境额外有云峰晶晶体，共 3 项。其中“纸页宋体”不是独立字体文件，而是 `Georgia -> Songti SC -> serif` 回退栈。贴纸文字和 HEX 输入等专用界面还使用系统字体栈，不会额外打包对应字体文件。

## 2. 用户需求

### 用户原始要求

查询当前项目的字体种类。

### Codex 对需求的解释

- 盘点当前源码与资源中已经存在并被引用的字体。
- 区分生产字体、开发专用字体、第三方依赖字体和系统回退栈。
- 不执行字体替换、下载、删除或样式调整。

## 3. 当前源码事实

### 3.1 随项目提供的字体家族

| 字体家族 | 字重 / 文件 | 环境 | 当前用途 | 事实来源 |
| --- | --- | --- | --- | --- |
| `Nunito` | 500、700、900；3 个 Latin WOFF2 | 生产与开发 | 全局 Latin UI 和 `animal-island-ui` 控件 | `animal-island-ui/style` 的 `@font-face`；`src/styles.css` 根字体栈 |
| `Noto Sans SC` | 400、500、700；每个字重各含 Latin 与简中 WOFF2，共 6 个文件 | 生产与开发 | 全局中文 UI、`animal-island-ui` 控件及铭牌回退 | `animal-island-ui/style` 的 `@font-face`；`src/styles.css` 和 `src/scene/nameplate-text.ts` |
| 玄冬楷书 | `public/fonts/Xuandong-Kaishu.ttf`；同一文件声明 400、700 | 生产与开发 | 日记可选正文/输入字体；3D 本子铭牌的首选 Canvas 字体 | `src/styles.css`、`src/domain/journal-font.ts`、`src/scene/nameplate-text.ts` |
| 云峰晶晶体 | `dev-assets/fonts/YunFengJingJingTi-Regular.ttf`；Regular | 仅开发 | 日记字体菜单中的视觉评估项 | `JournalPanel.tsx` 仅在 `import.meta.env.DEV` 注入；`vite.config.ts` 仅在 `serve` 暴露资源 |

现有生产输出 `dist/` 可见 9 个 `animal-island-ui` WOFF2 和 1 个玄冬楷书 TTF，不包含云峰晶晶体；该结果与源码构建边界一致。字体文件元数据检查确认玄冬楷书内部 family 为 `XuandongKaishu, 玄冬楷书`，开发字体内部 family 为 `云峰晶晶体`。

### 3.2 日记菜单中的字体种类

| 菜单项 | 实际 CSS 字体栈 | 生产 | 开发 |
| --- | --- | --- | --- |
| 纸页宋体 | `Georgia, "Songti SC", serif` | 是，默认 | 是，默认 |
| 玄冬楷书 | `"Xuandong Kaishu", "Songti SC", serif` | 是 | 是 |
| 云峰晶晶体 | `"Dear Desk JingJing", "Songti SC", serif` | 否 | 是 |

`src/domain/journal-font.ts` 定义稳定 ID `paper | jingjing | xuandong`；`JournalPanel.tsx` 在生产环境过滤 `jingjing`。字体偏好只保存在 `localStorage`，不会改变日记纯文本。

### 3.3 其他系统字体栈

- 全局 UI 回退：`-apple-system`、`BlinkMacSystemFont`、`Segoe UI`、`PingFang SC`、`Hiragino Sans GB`、`Microsoft YaHei`、`sans-serif`。这些是系统回退，不是项目字体资源。
- 贴纸文字：`Arial Rounded MT Bold, Arial Black, sans-serif`，由 Sticker Studio 传给 Sticker Forge；项目不携带 Arial 字体文件。
- HEX 等宽输入：`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`，均为平台回退。
- 日记日期等局部排版还直接使用 `Georgia` / `Songti SC` / `serif`；同样不携带对应字体文件。

### 3.4 文档与源码一致性

`docs/product/mvp.md` 与 `docs/architecture/system-overview.html` 对日记字体的描述均与源码一致：生产为纸页宋体/玄冬楷书，开发额外提供云峰晶晶体。工作区已有的 `DD-20260820-001` 是尚未批准的替换方案，不是当前实现事实，因此未计入当前字体清单。

## 4. 目标与非目标

### 4.1 目标

- 给出当前项目字体种类、用途和来源位置的可核验清单。
- 标记只在开发环境出现或仅作为回退值的字体。

### 4.2 非目标

- 不评价或替换字体视觉效果。
- 不修改字体授权、打包、加载或持久化逻辑。
- 不执行浏览器视觉验收。

## 5. 方案说明

通过字体资源文件、`@font-face`、`font-family`、领域字体配置、Vite 开发资源映射和依赖包资源交叉核对，避免只按文件名或单一 CSS 声明计数。

## 6. 预计改动与影响评估

只更新本调研记录，不修改业务行为。

### 6.1 核心数据结构变化

不适用；本次不修改类型、接口、持久化模型、事件或状态。

### 6.2 上下游与跨模块影响

不适用；只读盘点不会影响调用方、渲染、存储、测试或构建配置。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 字体名称重复或别名 | 文件名、CSS family 和字体内部 family 不一致 | 清单重复计数或漏计 | 同时核对资源、声明和字体元数据 |
| 依赖包隐式携带字体 | 只扫描 `src/` 与 `public/` | 漏掉构建中实际使用的第三方字体 | 检查依赖入口、构建配置与依赖资源 |
| 系统回退被误认为内置资源 | CSS 字体栈含平台字体 | 错误描述分发范围 | 将本地字体和系统回退字体分别列出 |

## 8. 验证与验收

- 自动测试：不适用；本次无业务改动。
- 构建与静态检查：执行字体引用搜索、资源元数据检查、`git diff --check` 和文档引用检查。
- 浏览器验收：不适用；这是只读清单，不涉及单组件样式或用户可见状态变化。
- 持久化与恢复：不适用。
- 成功标准：清单中的每项均能由源码声明、资源文件或依赖事实支持，并明确运行环境与用途。

## 9. 待确认项与决策

无。查询范围可由当前仓库事实直接确定。

## 10. 最终批准方案

本次是用户直接请求的只读查询；不涉及需批准的业务源码、依赖、配置或持久化数据改动。

## 11. 实施记录

已完成以下只读检查，未修改业务源码、依赖、工程配置、字体资源或持久化数据：

- 扫描 `src/`、`public/`、`dev-assets/` 的字体文件、`@font-face`、`font-family`、Canvas 字体和 Sticker Forge 参数。
- 核对 `animal-island-ui` 1.5.1 的 CSS 声明及随包 WOFF2。
- 核对玄冬楷书、云峰晶晶体的文件类型、内部 family、SHA-256 和运行环境边界。
- 对照产品文档、架构文档和未批准的字体替换记录。

## 12. 验证结果

- `rg` 字体引用扫描：通过；覆盖 CSS、TypeScript/TSX、Vite 配置、产品和架构文档。
- 字体资源扫描：生产项目资源 1 个 TTF；开发专用资源 1 个 TTF；`animal-island-ui` 依赖资源 9 个 WOFF2。
- `fc-scan`：玄冬楷书与云峰晶晶体文件可识别，内部 family 与源码用途一致。
- `file` / `shasum -a 256`：两个本地字体均为 TrueType；哈希分别为玄冬楷书 `cd3ae5d3a7bad43470db8400e1afbe5fcd0489580a37dcc9a1c5a8bfff894f93`、云峰晶晶体 `f29a1a406d542b4911a57a913dc1ddfc27e3f39e81560ed8ba88db00672c7d8a`。
- `node scripts/check-doc-references.mjs`：通过（`Documentation checks passed.`）。
- `git diff --check`：通过。
- 浏览器验收：未执行；本次只读盘点没有修改用户可见行为，且项目规则不要求为此类查询执行视觉验证。

## 13. 文档同步检查

- 产品文档：已核对 `docs/product/mvp.md`，当前字体事实一致，无需修改。
- 架构文档：已核对 `docs/architecture/system-overview.html`，当前字体事实一致，无需修改。
- 决策文档：无长期决策变化。
- 文档入口：本次调研记录不改变入口结构。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-20 17:06 CST | Codex | 创建字体现状调研记录，开始只读盘点。 |
| 2026-08-20 17:09 CST | Codex | 完成字体资源、声明、运行环境和依赖构建边界核对；任务进入待验收。 |
| 2026-08-21 23:29 CST | 用户 / Codex | 用户明确将该项目字体盘点视为过期/作废；状态更新为已替代，当前字体事实转由 `DD-20260821-003` 记录。 |
