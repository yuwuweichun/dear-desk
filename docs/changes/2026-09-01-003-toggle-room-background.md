# DD-20260901-003：切换房间背景显示

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 |
| 创建时间 | 2026-09-01 15:32 CST |
| 最后更新 | 2026-09-01 15:45 CST |
| 当前阶段 | 已验收，已提交 |
| 源码基线 | `2af466a` `fix(scene): 窗户位置` |
| 实现提交 | 本次提交（见 Git 历史） |
| 关联任务 | 在右上角添加按钮，切换房间背景显示；行为类似“自由视角”按钮 |

> 本文是待审阅方案。批准前只允许只读检查和修改本文档。

## 1. 给阅读者的结论

建议在右上角现有场景工具栈中增加一个“房间背景”切换按钮，与“自由视角”使用相同的图标按钮和 on/off 视觉反馈。开启时显示程序化书房墙体、地板和窗户，关闭时隐藏该房间壳体，只保留桌面及 renderer 清屏背景。

该开关只在当前页面会话内生效，不新增持久化数据，也不改变自由视角、桌面相机、本子和贴纸工作流。

## 2. 用户需求

### 用户原始要求

- 在右上角添加一个按钮。
- off 状态不显示房间背景，on 状态显示房间背景。
- 切换方式类似“自由视角”按钮。

### Codex 解释

“房间背景”指当前 `StudyRoomShell` 程序化房间壳体；桌子、桌垫、本子和贴纸不属于该背景，不因开关被隐藏。默认保持当前行为，即开启显示。

## 3. 当前源码事实

- `src/app/App.tsx` 的 `ProductApp` 在 `.scene-tool-stack` 中渲染调色板、内容字体和自由视角入口；自由视角通过 `aria-pressed`、动态无障碍名称和 `Camera`/`CameraOff` 图标表达状态。
- `src/scene/DeskScene.tsx` 的 `DeskContents` 当前无条件渲染 `<StudyRoomShell />`。
- `StudyRoomShell` 在同文件中通过 `createStudyRoomShellModel({ pass: 'optimization-pass' })` 创建并释放房间模型。
- `DeskScene` 使用长期挂载、复用的 R3F root，并通过 `latestSceneProps` 将外部 props 更新到场景；因此开关应作为 `DeskScene` prop 进入 `DeskContents`，而不是重建 Canvas。
- 当前 `freeCameraEnabled` 属于 Zustand 会话状态；本需求不要求房间背景状态跨刷新恢复，因此使用 `ProductApp` 本地状态即可。
- 产品与架构文档已将房间壳体定义为非交互视觉背景，且明确 renderer 背景只是清屏色；本开关只控制实体房间壳体。

## 4. 目标与非目标

### 4.1 目标

- 在右上角工具栈增加“房间背景” on/off 按钮。
- 默认 on，点击后在 off/on 间切换。
- off 时不渲染 `StudyRoomShell`，on 时恢复显示。
- 使用 `aria-pressed`、明确的中文无障碍名称和与自由视角一致的按钮视觉。
- 保持单 Canvas、桌面对象、相机控制和现有持久化行为不变。

### 4.2 非目标

- 不提供房间编辑、透明度调节、单独墙体/地板选择或自由走动。
- 不保存房间背景开关到 `localStorage`、IndexedDB 或服务端。
- 不隐藏 renderer 清屏背景、桌面模型、灯光或场景颜色配置。
- 不引入新的按钮组件、状态管理抽象或第三方依赖。

## 5. 方案说明

在 `ProductApp` 增加 `showRoomBackground`，初始值为 `true`，并把它传给 `DeskScene`。`DeskScene` 将该值写入现有 `DeskContentsProps` 和 `latestSceneProps`；`DeskContents` 仅在值为 true 时渲染 `StudyRoomShell`。右上角工具栈新增 `IconButton`，使用 `aria-pressed`、`显示/隐藏房间背景` 动态标签和 `Eye`/`EyeOff` 图标，直接复用现有 `.scene-tool-stack .dd-icon-button` 与自由视角状态样式。

## 6. 预计改动与影响评估

- `src/app/App.tsx`：新增会话状态，向 `DeskScene` 传递状态，在右上角工具栈增加切换按钮。
- `src/scene/DeskScene.tsx`：扩展 `DeskSceneProps`/`DeskContentsProps`，更新现有 `latestSceneProps`，条件渲染 `StudyRoomShell`。
- `src/app/App.test.tsx`：补充按钮默认状态、点击切换和工具栈位置断言；更新 mock 接收的新 prop（如需要）。
- `docs/product/mvp.md`：实施后补充房间背景可见性开关的当前产品行为。
- `docs/architecture/study-room-shell.md`：实施后补充 `ProductApp -> DeskScene -> DeskContents` 的显示控制事实。

### 6.1 核心数据结构变化

不改变领域类型、Zustand `AppState`、IndexedDB 或任何持久化结构。新增值是 `ProductApp` 生命周期内的 `boolean`，默认 `true`，刷新后恢复默认开启。

### 6.2 上下游与跨模块影响

房间模型仍由 `StudyRoomShell` 自己负责创建和释放；条件渲染会在关闭时卸载模型、开启时重新创建模型，但不新增 Canvas。桌面交互对象、相机和场景背景色不受影响。按钮仅在桌面操作区可见，打开本子、贴纸工作台或其他非桌面视图时随现有 `showDeskActions` 隐藏。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 房间模型重建带来短暂空白 | 从 off 切回 on 时异步创建模型 | 房间短暂不可见 | 复用现有 `StudyRoomShell` 生命周期；若验收发现问题，可改为保持模型并切换 `visible` |
| 新按钮挤压窄屏工具栈 | 右上角按钮数量增加 | 小屏布局可用性下降 | 复用现有 48px 工具按钮和工具栈布局，执行桌面/移动端检查 |
| “背景”误解为清屏色 | 关闭按钮后用户期待纯透明/黑色 | 视觉结果与预期不符 | 标签和文档明确只控制房间壳体；保留 renderer 背景色是既有架构事实 |

## 8. 验证与验收

- 自动测试：运行 `npm test -- --run src/app/App.test.tsx`，验证默认 on、点击后 off、再次点击恢复 on 及 `aria-pressed`/图标标签。
- 构建与静态检查：运行 `npm run lint` 和 `npm run build`。
- 浏览器验收：若 `ego-browser` 可用，验证桌面端右上角按钮、on/off 房间壳体可见性和移动端位置；否则记录未覆盖并请求手动验收。
- 持久化与恢复：确认刷新后开关恢复默认 on；不应产生存储记录。
- 成功标准：按钮位于右上角工具栈，切换状态清晰；off 隐藏房间实体背景而保留桌面；on 恢复房间；既有自由视角和主要流程无回归。

## 9. 待确认项与决策

- 建议默认状态为 on，以保持当前页面默认视觉；若需要默认 off 会改变首次进入体验，请在批准时明确。
- 建议只做会话内切换，不做持久化；若需要记住用户选择，需扩大到存储和刷新恢复验收。

## 10. 最终批准方案

用户于 2026-09-01 批准按本记录执行。最终执行清单：

- 在 `ProductApp` 增加默认开启、会话内的 `showRoomBackground`。
- 在右上角工具栈增加带 `aria-pressed` 和 `Eye`/`EyeOff` 图标的房间背景按钮。
- 通过 `DeskScene`/`DeskContents` 条件挂载 `StudyRoomShell`。
- 补充 App 测试，更新产品和架构事实文档。

## 11. 实施记录

已实施并完成用户验收：

- `ProductApp` 增加默认开启的会话状态 `showRoomBackground`。
- 右上角工具栈增加房间背景 `IconButton`，on/off 使用 `Eye`/`EyeOff` 和 `aria-pressed` 表示。
- `DeskScene`/`DeskContents` 根据该状态条件挂载 `StudyRoomShell`。
- 更新 App 测试、房间架构文档和 MVP 当前行为描述。
- 新增按钮复用了现有工具栈与自由视角的 active/hover 样式规则；未新增抽象或依赖。

用户已明确要求提交本次任务相关文件，该指令构成本次结果的预先验收授权。

## 12. 验证结果

已执行：

- `npm test -- --run src/app/App.test.tsx`：通过，12 tests passed。
- `npm run lint`：通过。
- `npm run build`：通过；Vite production build 完成。
- `node scripts/check-doc-references.mjs`：通过。
- `npm test`：124 tests 中 121 通过、3 失败；失败均为既有 `src/scene/models/model-factories.test.ts` 对 V12 默认颜色/大小写的旧断言，与本次改动无调用关系。
- 浏览器视觉验收：当前环境没有可用 `ego-browser`，桌面端和移动端交互未覆盖，需用户手动验收。

方案偏差：无。已知基线测试冲突不在批准范围内，未修改相关颜色源码或测试。

## 13. 文档同步检查

- 产品文档：实施后更新房间背景开关的当前行为。
- 架构文档：实施后更新房间壳体显示控制链路。
- 决策文档：不新增长期决策。
- 文档入口：无需新增入口；实施后运行文档引用检查。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-09-01 15:32 CST | Codex | 创建待确认方案，完成现有自由视角与房间壳体调用链检查。 |
| 2026-09-01 | 用户 | 批准按记录方案实施。 |
