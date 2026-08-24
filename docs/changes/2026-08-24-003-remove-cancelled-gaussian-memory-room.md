# DD-20260824-003：清理已取消的 Gaussian 记忆房间实验

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 重构 |
| 创建时间 | 2026-08-24 17:06 CST |
| 最后更新 | 2026-08-24 18:01 CST |
| 当前阶段 | 用户已验收历史记录与清理结果，任务完成 |
| 源码基线 | `c200eec`；工作区另有 DD-20260824-002 等未提交改动 |
| 实现提交 | 本次提交（由 Git 记录） |
| 关联任务 | 用户确认 Gaussian 记忆房间方案已经放弃，要求保留并取消历史记录、删除全部相关源码残留 |

> 用户于 2026-08-24 明确要求“清除残留的代码，方案记录更新为已取消后可以保留，但是相关的源码全部删除，进行清理”，构成本任务的直接执行授权。本文先登记范围，再按最终执行清单实施，不另行等待批准。

## 1. 给阅读者的结论

项目曾实现一套只在开发环境用参数开启的“记忆房间”视觉实验，但用户已经放弃这个方向。当前工作区仍保留运行时代码、第三方依赖、场景资产、生成脚本、测试和把它描述为待验收能力的文档，导致 Git 状态与真实产品决策不一致。

本次会完整删除该实验的可执行内容和当前事实引用；两份历史方案记录继续保留，但改为“已取消”，用于解释这段尝试为何不再属于项目现状。日记、贴纸、旧痕迹、桌面模型和持久化数据均不受影响。

## 2. 用户需求

- 用户原始要求：清除已经放弃的记忆房间 / Gaussian Splatting 残留代码。
- 明确保留：`DD-20260823-007`、`DD-20260823-008` 两份方案记录可以作为历史证据保留，但必须更新为“已取消”。
- 明确删除：与该实验有关的业务源码、场景组件、资源、生成脚本、测试、第三方依赖和工程接线。
- Codex 解释：同步删除架构文档、产品当前事实、第三方声明和文档首页中的现行能力描述；历史记录中的实施经过不抹除，只增加取消结论。

## 3. 当前源码事实

- `src/app/App.tsx` 调用 `resolveMemoryRoomProfile()` 读取开发 URL 参数，并把配置传入 `DeskScene`。
- `src/scene/DeskScene.tsx` 导入 `MemoryRoomBackdrop` 和相机边界函数，在配置启用时挂载背景并扩大自由视角范围。
- `src/scene/MemoryRoomBackdrop.tsx` 动态导入 `@sparkjsdev/spark`，在现有 R3F scene 中创建 `SparkRenderer` 与 `SplatMesh`；`MemoryRoomShell.tsx` 提供加载和失败回退几何。
- `src/scene/memory-room-profile.ts`、对应测试、`scripts/generate-memory-room.mjs` 与 `public/rooms/memory-room/` 分别拥有参数配置、边界断言、资产生成和 SPZ 文件。
- `package.json`、`package-lock.json`、`vite.config.ts` 与 `THIRD_PARTY_NOTICES.md` 包含 Spark 依赖、构建排除或许可说明。
- `docs/architecture/system-overview.html` 和 `docs/index.html` 仍把实验写成待验收的当前能力；`DD-20260824-002` 也把它记录为实施时需要保留的并行工作区事实。
- 两份历史记录状态仍为“待验收”，与用户已经放弃方案的决定冲突。

## 4. 目标与非目标

### 4.1 目标

- 让生产和开发源码都不再识别 `?memory-room=1`，不再加载 Spark 或 SPZ。
- 删除全部专属场景组件、配置、测试、资产和生成脚本。
- 从依赖、构建配置、第三方声明和当前事实文档中移除该实验。
- 将 007、008 历史记录更新为“已取消”，并记录本次清理承接关系。
- 保留工作区中其他任务的所有未提交修改。

### 4.2 非目标

- 不改变桌面、抽屉、旧痕迹、本子、贴纸、字体或颜色编辑行为。
- 不修改 IndexedDB schema、localStorage 字段或任何用户数据。
- 不回退与记忆房间无关的并行工作区差异。
- 不创建提交、推送或 PR。

## 5. 方案说明

先从真实引用链的入口向下拆除：删除 `App` 的参数解析和 `DeskScene` 的配置传递，再恢复自由视角使用既有相机边界，最后删除已经没有调用方的背景组件、配置、测试、SPZ 与生成器。随后用包管理器更新依赖锁文件，移除构建排除项与许可说明。

文档侧保留历史实施细节，但在记录顶部、结论和审阅记录中明确写入“已取消且源码已删除”。当前架构、产品与文档首页只描述清理后的运行事实，不再把历史实验列为可用能力。

## 6. 预计改动与影响评估

- 修改 `src/app/App.tsx`、`src/scene/DeskScene.tsx`：移除 profile 解析、prop 传递、背景挂载和实验专属相机边界。
- 删除 `src/scene/MemoryRoomBackdrop.tsx`、`MemoryRoomShell.tsx`、`memory-room-profile.ts` 及其测试。
- 删除 `scripts/generate-memory-room.mjs` 与 `public/rooms/memory-room/`。
- 修改 `package.json`、`package-lock.json`、`vite.config.ts`、`THIRD_PARTY_NOTICES.md`：删除 Spark 依赖和配套声明。
- 修改 `docs/changes/2026-08-23-007-*.md`、`008-*.md`、`DD-20260824-002`、`docs/product/mvp.md`、`docs/architecture/system-overview.html` 和 `docs/index.html`：同步取消与当前事实。

### 6.1 核心数据结构变化

领域类型、repository、Zustand 持久化结构、IndexedDB schema 和用户数据均不变化。删除的 `MemoryRoomProfile` 只由页面启动时从 URL 计算，未写入 store 或数据库，因此无需迁移或清理持久化数据。

### 6.2 上下游与跨模块影响

- 上游 URL 参数不再影响场景；带旧参数访问时与普通页面相同。
- `DeskScene` 不再创建 Gaussian 背景及其失败回退 shell，自由视角恢复既有固定约束。
- Vite production build 不再产出 Spark 动态 chunk，默认页与开发实验页都不会请求 SPZ。
- 现有单活跃 WebGL Canvas 所有权、Sticker Forge 切换和桌面 R3F 生命周期不变。
- 删除专属测试后，由 `App`、`DeskScene`、模型与 store 的既有测试确认其他行为未回归。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 误删并行功能 | `App.tsx`、`DeskScene.tsx`、架构 HTML 同时含旧痕迹等未提交改动 | 丢失用户工作 | 逐块删除 Gaussian 专属引用，核对完整 diff，不按整文件回退 |
| 遗留引用导致构建失败 | 删除文件后仍有 import、类型或文档路径 | TypeScript、Vite 或引用检查失败 | 全仓 `rg` 残留扫描，运行完整检查与构建 |
| 锁文件残留 | 只改 `package.json` 未同步 lock | 安装结果仍携带 Spark | 使用 npm 的依赖删除流程并核对 lock 中零引用 |
| 历史记录被误解为当前功能 | 只改状态而不补取消说明 | 后续文档再次引用旧实施事实 | 在两份记录顶部和审阅表写明取消、清理任务编号及源码现状 |

回退方式：若本次未提交清理需要撤回，只恢复 DD-20260824-003 明确删除的专属文件和对应接线；不涉及数据迁移。由于当前工作树包含其他任务，禁止用整仓 reset 或 checkout 回退。

## 8. 验证与验收

- 自动测试：运行项目完整测试；至少确认 App、DeskScene 相关状态、模型和旧痕迹测试通过。
- 构建与静态检查：运行项目 `check`、production build、`git diff --check`、全仓残留扫描和文档引用检查。
- 浏览器验收：本次是删除开发态实验并恢复既有画面，不属于单组件样式调整；若项目完整检查不能覆盖运行入口，则使用 `ego-browser` 验证普通 URL 与旧参数 URL 行为一致、桌面和移动端无报错。
- 持久化与恢复：无持久化结构变化；确认已有日记/贴纸测试继续通过。
- 成功标准：除两份已取消历史记录和本清理记录外，可执行源码、依赖、资产、构建配置和当前事实文档中不存在 Gaussian 记忆房间引用。

## 9. 待确认项与决策

当前无阻塞待确认项。用户已明确要求删除相关源码并允许保留已取消历史记录。

## 10. 最终批准方案

用户于 2026-08-24 直接授权执行以下清单：

1. 删除记忆房间的运行时接线、组件、配置、测试、资产和生成脚本。
2. 删除 Spark 依赖、构建配置与第三方声明。
3. 保留 007、008 历史记录并标记为“已取消”。
4. 同步产品、架构、文档首页和受影响并行任务记录的当前事实。
5. 完成自动测试、构建、残留扫描和文档检查；不创建提交。

## 11. 实施记录

已按批准清单完成，未触碰日记、贴纸、旧痕迹、字体或持久化结构：

- 运行入口：`src/app/App.tsx` 删除 `resolveMemoryRoomProfile()`、启动时 URL profile 和 `DeskScene` profile prop；`src/scene/DeskScene.tsx` 删除背景 import/挂载、实验专属自由视角边界和跨层 profile 传递。旧痕迹中央抽屉的状态、命中、动画与 DOM 入口保持不变。
- 专属文件：删除 `src/scene/MemoryRoomBackdrop.tsx`、`MemoryRoomShell.tsx`、`memory-room-profile.ts` 和 `memory-room-profile.test.ts`。
- 资源与工具：删除 `scripts/generate-memory-room.mjs`、`public/rooms/memory-room/memory-room.spz`、相邻 `SOURCE.md` 及清空后的目录。
- 依赖与工程：从 `package.json`、`package-lock.json`、`vite.config.ts` 和 `THIRD_PARTY_NOTICES.md` 移除 Spark 依赖、预构建排除和许可/资产说明；`npm uninstall @sparkjsdev/spark --ignore-scripts` 同步删除本地安装包。这四个仓库文件因此恢复为相对 `c200eec` 无差异。
- 历史记录：`DD-20260823-007` 与 `008` 保留原试验方案、实施和验证证据，但状态改为“已取消”，顶部和审阅表明确指向本清理任务。
- 当前事实：`docs/architecture/system-overview.html` 删除运行树、场景说明、失败路径、源码地图、状态表和构建成本中的实验内容；`docs/index.html` 增加已取消状态与本任务入口；`DD-20260824-002` 删除把该实验当作现行并行成果的保护性表述。

方案偏差：无。产品规格无需修改；`docs/product/mvp.md` 没有把该开发实验写成产品能力，并继续把完整房间列为非目标。决策文档无需修改，local-first、场景投影和单活跃 Canvas 长期边界不变。

## 12. 验证结果

- `npm run check`：通过。ESLint 通过；Vitest 22 个文件、96 项测试全部通过；TypeScript 与 Vite production build 通过；文档引用检查通过。
- production build：主 JS 为 `1,207.80 kB / 342.37 kB gzip`；不再生成约 5.05 MB 的 Spark 动态 chunk。Vite 仅保留既有大 chunk 警告。
- `npm ls @sparkjsdev/spark --depth=0`：输出 `(empty)`，确认本地依赖树不含 Spark；命令因查询包不存在返回 npm 的预期非零状态。
- 残留扫描：在 `src`、`public`、`scripts`、`package.json`、`package-lock.json`、`vite.config.ts` 和 `THIRD_PARTY_NOTICES.md` 中搜索 `MemoryRoom`、`memory-room`、Spark 与 Splat 运行符号，结果为零。Sticker Forge 上游 bundle 自带的 `SphericalGaussianBlur` 是无关材质算法，按固定上游产物保留。
- `git diff --check`：通过，无空白错误。
- `ego-browser` 应用：固定地址 `http://127.0.0.1:5164/` 与旧参数 `?memory-room=1` 都只有一个 Canvas、零页面横向溢出、零 Spark/SPZ 资源请求，并保留“打开本子”“旧痕迹”“编辑铭牌”“贴纸工作台”；桌面 `1440 x 900` 和移动 `390 x 844` 截图画面非空、构图正常、控件无重叠。
- `ego-browser` 架构 HTML：直接 `file://` 打开，在 `1440 x 900` 与 `390 x 844` 确认零页面横向溢出、表格与代码内部滚动、搜索成功/空态、ArrowUp/ArrowDown/Enter/Escape、目录锚点与 active 状态、移动目录开合、术语卡 hover/focus/click、复制“已复制”和唯一文档首页入口。深页锚点截图在 ego-browser 捕获层返回纯黑，但同一时刻 DOM 显示验证正文、锚点顶部 176px、页面尺寸与样式正常；顶部与移动目录截图正常，因此不把纯黑捕获结果作为页面失败证据。
- `ego-browser` 文档首页：桌面与移动均零页面横向溢出，表格在自身容器内滚动；“Gaussian 记忆房间实验”显示“已取消”，本清理记录链接存在且可解析。

## 13. 文档同步检查

- 产品文档：已检查，无需修改；当前规格未把开发实验列为产品能力，并继续把完整房间列为非目标。
- 架构文档：已删除运行链、失败路径、源码地图、状态和构建成本描述，并同步清理后的 96 项测试事实。
- 决策文档：无需修改；既有本地数据与单 Canvas 长期决策未变化。
- 文档入口：已增加历史实验“已取消”状态、本清理任务“已完成”状态和三份记录链接。
- 引用检查：`npm run check` 中的文档引用检查通过；架构页与首页已完成本地直接打开验证。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-24 17:06 CST | 用户 | 明确确认方案已放弃，要求保留取消后的方案记录并删除全部相关源码。 |
| 2026-08-24 17:06 CST | Codex | 创建清理记录并按直接执行授权进入实施。 |
| 2026-08-24 17:22 CST | Codex | 完成源码、依赖、资产、测试和当前事实文档清理；完整工程检查、残留扫描及桌面/移动浏览器验证通过，状态更新为待验收。 |
| 2026-08-24 17:58 CST | 用户 / Codex | 用户确认高斯泼溅记录与放弃后的清理已验收，并明确要求提交；批准范围、验证和文档回写均无偏差，任务更新为已完成并纳入本次提交。 |
| 2026-08-24 18:01 CST | Codex | 提交前联合复核通过：22 个测试文件、96 项测试、lint、TypeScript/Vite production build、文档引用和差异空白检查均通过；最终主包为 1,211.92 kB / 343.59 kB gzip，仅保留既有大 chunk 警告。 |
