# DD-20260806-003：建立本子聚焦、开合与二维编辑衔接

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 / 3D 交互 / 动效 |
| 创建时间 | 2026-08-06 15:38 CST |
| 最后更新 | 2026-08-06 17:52 CST |
| 当前阶段 | 用户已验收，任务完成 |
| 源码基线 | `130b62f feat(core): 建立技术基础与首个纵向切片` |
| 实现提交 | 本次提交：`feat(notebook): add focus transition` |
| 关联任务 | 用户提出点击本子后模拟坐到桌前，再打开本子并衔接二维 UI |

> 用户已于 2026-08-06 17:52 CST 明确回复“验收结束”，本任务实现、验证与文档回写均已接受。

## 1. 给阅读者的结论

本子聚焦转场已经实现。点击 3D 本子或 DOM 等价入口后，镜头平滑走近并转到本子正面，封面沿书脊打开，随后 DOM 编辑器在纸页位置淡入；关闭时先卸载编辑器，再合盖并返回桌面全景。

该转场使用现有 React Three Fiber 与 Three.js 帧循环实现，没有新增动效依赖。Zustand 只记录六阶段交互状态，真实 camera、Quaternion 和 Group 仍由 Three.js 拥有，保持编号 002 已批准的数据边界；桌面、移动端与 reduced-motion 均已验证。

## 2. 用户需求

用户原始要求：

> 点击本子，camera 视角动画，流畅地走进并转到正面，模拟坐在桌子前的感觉；然后本子打开，衔接二维 UI。

Codex 将其解释为一个可逆、可中断且响应式的空间到 DOM 转场。二维 UI 仍使用 DOM，不创建第二个 WebGL 画布，也不把表单绘制到纹理中。

## 3. 当前源码事实

本节保存批准方案时对基线提交 `130b62f` 的源码事实，用于解释改动起点；实施后的当前事实见第 11 节和 `docs/architecture/system-overview.html`。

- `src/state/app-store.ts` 只有 `notebookOpen: boolean`；`openNotebook()` 立即写为 `true`，没有过渡阶段。
- `src/app/App.tsx` 根据 `notebookOpen` 直接挂载 `JournalPanel`，因此点击后面板立即出现。
- `src/scene/DeskScene.tsx` 的 `ResponsiveCamera` 只在视口宽度变化时设置固定位置并调用 `lookAt(0, 0, 0)`，没有运行时相机动画。
- `src/scene/NotebookObject.tsx` 只对整个本子做轻微高度与 z 轴旋转阻尼，没有独立封面、书脊铰链或开合动作。
- 当前场景只有一个 React Three Fiber `Canvas`；日记编辑、保存和错误状态均为 DOM。
- 编号 002 已完成浏览器验收、架构 HTML 和最终文档回写，当前状态为“待验收”。003 仍需用户批准后才能修改交互源码。

## 4. 目标与非目标

### 4.1 目标

- 点击 3D 本子或 DOM 等价入口后，镜头平滑走近并转到本子正面。
- 镜头到位后，本子封面沿书脊打开；打开完成后才显示二维编辑器。
- 关闭编辑器时先隐藏 DOM，再合上本子并返回桌面全景。
- 桌面与移动端分别使用稳定取景，转场不裁切本子或 UI。
- 支持重复点击防抖、转场期间交互锁定与 `prefers-reduced-motion`。
- 保持单 Canvas、DOM 表单、可序列化状态和 IndexedDB 边界不变。

### 4.2 非目标

- 不实现过去日期翻页或纸张物理。
- 不实现自由相机、OrbitControls、第一人称行走或碰撞。
- 不接入贴纸、抽屉、台灯或新的持久化表。
- 不把 DOM 表单渲染成 CanvasTexture，也不增加第二个 WebGL 画布。
- 不引入通用时间轴编辑器或新的动画库。

## 5. 方案说明

### 5.1 交互状态机

用单一阶段替代 `notebookOpen` 布尔值：

```text
desk
  -> approaching
  -> opening
  -> editing
  -> closing
  -> retreating
  -> desk
```

- `desk`：桌面全景，本子与 DOM 入口可点击。
- `approaching`：锁定重复打开操作，相机从当前桌面取景插值到本子正面。
- `opening`：相机保持聚焦，封面绕书脊打开。
- `editing`：本子保持打开，DOM 编辑器挂载并获取焦点。
- `closing`：先卸载 DOM，再合上封面。
- `retreating`：相机回到响应式桌面取景，完成后恢复点击。

任何阶段只允许一个合法后继状态。关闭动作在 `editing` 阶段触发；转场中重复点击不创建并行动画。

### 5.2 时间与镜头

- 走近与转正建议约 `1.2s`，采用慢入慢出的三次缓动。
- 封面打开建议约 `0.7s`，在相机到位后开始。
- DOM 编辑器在封面完成前约 `0.15s` 开始轻量淡入，总打开时间不超过约 `2s`。
- 关闭流程略快：DOM 淡出、合盖与返回合计约 `1.3s`。
- 相机同时插值 position、Quaternion 和必要的 FOV，不依赖每帧固定增量；低帧率下仍按实际 delta 完成。
- 桌面和移动端分别定义全景与聚焦 pose，但共享同一状态机。

`CameraRig` 在 `useFrame` 中拥有真实相机运行对象。store 只保存阶段，不保存 Vector3、Quaternion、Camera 或时间戳。

### 5.3 本子与二维衔接

`NotebookObject` 拆分为底封、纸页和可绕左侧书脊旋转的上封面。聚焦取景中打开后的右侧纸页成为视觉锚点，`JournalPanel` 改为位于该纸页视野范围内的 DOM 层，而不是立即出现的独立右侧面板。

DOM 仍负责 textarea、按钮、焦点和无障碍。场景负责空间、遮挡、光照与开合动作。二者通过阶段衔接，不共享 Three.js 对象。

### 5.4 减弱动态与失败降级

- `prefers-reduced-motion: reduce` 时跳过走近轨迹，以不超过 `150ms` 的切换进入正面取景并打开本子。
- WebGL 不可用时直接使用现有 DOM 本子入口与编辑器，不等待不存在的场景回调。
- 页面隐藏或失焦不会让状态卡在中间；恢复时推进到当前方向的稳定终态。

## 6. 预计改动与影响评估

| 预计模块 | 预计责任 |
| --- | --- |
| `src/state/app-store.ts` | 用 `NotebookPhase` 替换 `notebookOpen`，提供请求打开、阶段推进和请求关闭动作 |
| `src/scene/DeskScene.tsx` | 新增 `CameraRig`，根据阶段和响应式 pose 驱动 camera；转场中维持单 Canvas |
| `src/scene/NotebookObject.tsx` | 拆分封面与纸页，通过铰链 group 驱动开合并报告动作完成 |
| `src/features/journal/JournalPanel.tsx` | 仅在 `editing` 挂载；关闭按钮触发反向流程，不再立即回桌面 |
| `src/app/App.tsx`、`src/styles.css` | 根据阶段管理入口、DOM 衔接、交互锁定和移动端布局 |
| 相关测试 | 覆盖状态机合法流转、重复点击、关闭逆序与 reduced-motion |

### 6.1 核心数据结构变化

```ts
type NotebookPhase =
  | 'desk'
  | 'approaching'
  | 'opening'
  | 'editing'
  | 'closing'
  | 'retreating'
```

`notebookOpen: boolean` 被 `notebookPhase` 替代。该状态只存在内存，不写入 IndexedDB；刷新页面始终从 `desk` 开始，避免恢复到半开或相机中途位置。`DailyEntry` 与数据库 v1 不变。

### 6.2 上下游与跨模块影响

- 3D 本子和 DOM 入口调用同一个 `requestNotebookOpen()`，避免两条路径产生不同阶段。
- `CameraRig` 和 `NotebookObject` 只能通过完成事件推进状态，不直接挂载 DOM。
- `JournalPanel` 不感知 camera，只读取 `notebookPhase === 'editing'`。
- 保存链路、Dexie repository 和日记草稿所有权不变。
- WebGL fallback 必须能直接进入 `editing`，否则无场景设备会永久停在 `approaching`。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 相机与本子动作失序 | 两个组件各自修改布尔值 | UI 提前出现或动画卡住 | 单一状态机与显式完成事件 |
| 低帧率导致跳动 | 使用每帧固定步长 | 移动端速度不一致 | 基于 delta 的归一化进度和缓动 |
| 聚焦后本子被裁切 | 桌面 pose 直接用于移动端 | 无法看到纸页或操作 | 桌面/移动端分别验收 focus pose |
| 重复点击产生并行动画 | 转场阶段仍接收入口点击 | 相机抖动、状态反转 | 非稳定阶段锁定打开入口 |
| DOM 与纸页错位 | 面板尺寸独立于聚焦构图 | 衔接突兀 | 固定聚焦构图，DOM 使用对应响应式约束 |
| 用户不适应镜头运动 | 位移或旋转过快 | 眩晕或操作疲劳 | reduced-motion 和约 2s 上限 |

回退时恢复 `notebookOpen` 的直接开关和现有静态相机，不涉及数据库或用户数据回退。

## 8. 验证与验收

- 自动测试：状态机完整正反向流转、非法/重复事件无效、WebGL fallback、reduced-motion。
- 构建与静态检查：运行 `npm run lint`、`npm run test`、`npm run build`。
- 浏览器验收：使用 ego-browser 录取桌面和移动端打开/关闭全过程的阶段截图与时间点。
- Canvas 检查：确认每个关键阶段 Canvas 非空，camera pose 与本子封面角度按阶段变化。
- 交互：转场中重复点击不抖动，进入编辑后 textarea 自动聚焦，关闭后返回原桌面取景。
- 无障碍：键盘入口与点击 3D 本子触发同一流程，reduced-motion 下核心操作不依赖动画。
- 成功标准：用户感知为连续的“走近桌前 -> 转正 -> 打开本子 -> 在纸页上书写”，没有 UI 突现或第二画布。

## 9. 待确认项与决策

### 决策 1：转场节奏

**建议：打开约 `2s`，关闭约 `1.3s`。** 足以形成坐下与开本子的感受，同时不让高频记录变得拖沓。

### 决策 2：二维 UI 的视觉位置

**建议：聚焦后让 DOM 编辑器覆盖并对齐打开的右侧纸页。** 保留真实表单能力，同时让 3D 到 2D 的切换看起来发生在同一本子上；不继续使用独立右侧浮层作为主视觉。

### 决策 3：减弱动态

**建议：系统要求 reduced-motion 时跳过走近轨迹，只做不超过 `150ms` 的取景与开本切换。** 核心功能与普通模式一致。

### 决策 4：与编号 002 的顺序

**建议：先完成 002 的浏览器验收、架构文档和待验收回写，再实施 003。** 这样能保留可追溯基线，不把未验收基础与新交互混为一项。

## 10. 最终批准方案

用户于 2026-08-06 17:09 CST 明确回复“批准并实施”，接受第 9 节全部建议决策：

1. 普通模式打开约 `2s`、关闭约 `1.3s`，使用顺序明确且可逆的阶段状态机。
2. 聚焦后 DOM 编辑器覆盖并对齐打开的右侧纸页，不增加第二个 WebGL 画布。
3. `prefers-reduced-motion: reduce` 下跳过长距离镜头轨迹，以不超过 `150ms` 的切换进入稳定编辑取景。
4. 编号 002 已完成待验收回写，003 在其当前源码基线上继续实施。

最终执行清单：

- 用 `NotebookPhase` 替代 `notebookOpen`，实现正反向合法流转、重复操作防抖和 WebGL 失败直达编辑的降级动作。
- 在唯一 R3F Canvas 内加入响应式 `CameraRig`，按阶段推进 camera pose；Three.js 运行对象不进入 store。
- 将本子拆成底封、纸页与书脊铰链上封面，阶段完成后显式推进状态。
- 只在 `editing` 挂载 `JournalPanel`，关闭时先卸载 DOM，再合盖并退回桌面。
- 同步自动测试、产品当前实现、架构 HTML、文档入口和本记录，完成桌面与移动端浏览器验收。

## 11. 实施记录

实际实施文件与行为：

- `src/state/app-store.ts`：用六阶段 `NotebookPhase` 替代 `notebookOpen`，新增打开请求、期望阶段推进、关闭请求、WebGL 降级直达编辑与页面隐藏收敛动作。刷新仍从 `desk` 开始，不写 IndexedDB。
- `src/scene/notebook-transition.ts`：集中普通桌面、窄视口和 reduced-motion 时长及三次缓动；桌面计划打开 `1.83s`、关闭 `1.3s`，窄视口计划打开 `1.08s`、关闭 `0.78s`，reduced-motion 每个方向不超过 `0.12s`。
- `src/scene/DeskScene.tsx`：以 `CameraRig` 插值 camera position、Quaternion 与 FOV；普通 React 层提供同阶段计时保护，RAF 或 R3F 子根被节流时仍可推进。桌面与移动端分别使用稳定 desk/focus pose。
- `src/scene/NotebookObject.tsx`：本子拆成底封、纸页、书脊与独立上封面铰链；打开和关闭按墙钟时间转动，上层命中区只在 `desk` 可交互。
- `src/app/App.tsx`、`src/features/journal/JournalPanel.tsx`、`src/styles.css`：DOM 入口在离开 `desk` 后卸载，编辑器只在 `editing` 挂载并自动聚焦；关闭先卸载 DOM 再执行 3D 反向流程，编辑器覆盖打开纸页并适配移动端。
- `src/state/app-store.test.ts`、`src/features/journal/JournalPanel.test.tsx`、`src/scene/notebook-transition.test.ts`：覆盖完整正反向流转、重复和越序事件、页面隐藏收敛、WebGL 降级、DOM 关闭顺序、普通与减弱动态时长。
- `docs/product/mvp.md`、`docs/architecture/system-overview.html`、`docs/index.html` 与本文：同步当前产品行为、状态所有权、真实调用链、失败路径、源码地图与待验收状态。

方案偏差与原因：

- 原方案建议 DOM 在封面完成前约 `0.15s` 开始淡入；实际严格等到 `editing` 才挂载，以保证 textarea 不会在 3D 动画仍未完成时抢焦点。进入后仍有 `180ms` 淡入。
- 移动端高 DPR 验收发现 WebGL 主线程会延后 R3F 子根提交，因此新增窄视口短计划时长和普通 React 层计时保护。页面内实测总打开约 `2.25s`，仍符合“约 2s”的批准节奏并避免卡住。
- reduced-motion 不等待动画计时器，而是在 effect 中立即收敛稳定阶段；页面内实测 `3ms`，满足不超过 `150ms`。

## 12. 验证结果

- `npm run lint`：通过。
- `npm run test`：通过，5 个测试文件、16 项测试全部成功。
- `npm run build`：通过；产物 JavaScript 约 `978.66 kB`、gzip 约 `276.20 kB`，保留编号 002 已知的大包提示，不影响构建。
- `node scripts/check-doc-references.mjs`：通过，任务记录章节和本地引用有效。
- `git diff --check`：通过，无空白错误。
- ego-browser task space `47`，桌面 `1440 × 900`：DOM 入口与原生 Canvas PointerEvent 都能触发；重复 Canvas 命中只产生一次 `desk → approaching → opening → editing`；textarea 自动聚焦；关闭后按 `closing → retreating → desk` 返回；无横向溢出。
- ego-browser task space `47`，移动端 `390 × 844`、DPR 2：编辑器边界为左右各 `14px`、底部 `18px`，没有横向或纵向页面溢出；打开纸页作为背景锚点，表单、关闭与保存控件均完整可见。
- reduced-motion：通过 CDP 模拟 `prefers-reduced-motion: reduce`，页面内阶段观测从 `desk` 到 `editing` 为 `3ms`，焦点落在 `daily-entry`。
- Canvas 非空检查：查看桌面、打开、移动端与返回阶段截图；对桌面画布主体 `1100 × 650` 裁剪转换后，编辑与桌面样本分别包含 `242` 和 `201` 种字节值且 SHA-256 不同，排除空白或同帧画布。
- HTML 文档：直接打开 `docs/index.html` 与 `docs/architecture/system-overview.html`；桌面正文、`288px` 侧栏、搜索键盘跳转、空结果、复制按钮和术语卡正常；移动端 `scrollWidth === clientWidth === 390`，目录入口、标题与表格无页面级溢出。

未执行破坏性 WebGL 初始化失败注入；降级动作由 store 自动测试覆盖，实际浏览器 `root.configure()` 失败路径仍是剩余风险。持久化 schema 与保存链路未改变，编号 002 的重开恢复证据继续有效。

## 13. 文档同步检查

- 产品文档：已更新 `docs/product/mvp.md` 的当前实现覆盖；MVP 范围与非目标不变。
- 架构文档：已更新 `docs/architecture/system-overview.html` 的 `NotebookPhase`、CameraRig、封面铰链、低帧率保护、失败路径和源码地图。
- 决策文档：未新增；本任务没有改变本地数据事实、DOM/Three.js 边界或单 Canvas 长期决策。
- 文档入口：已将编号 003 更新为待验收，并同步当前完整调用链；桌面与移动端均已使用 ego-browser 验证。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-06 15:34 CST | 用户 | 提出镜头走近转正、本子打开后衔接二维 UI 的体验要求。 |
| 2026-08-06 15:38 CST | Codex | 根据当前源码建立待确认方案，未修改业务实现。 |
| 2026-08-06 16:30 CST | Codex | 编号 002 已收尾为待验收；本文仍保持待确认，未修改相机、本子或编辑器源码。 |
| 2026-08-06 17:09 CST | 用户 | 明确回复“批准并实施”，接受第 9 节四项建议决策并授权开始执行。 |
| 2026-08-06 17:09 CST | Codex | 将状态更新为已批准，锁定第 10 节最终执行清单；业务源码尚未修改。 |
| 2026-08-06 17:09 CST | Codex | 按批准清单进入实施中，开始修改状态机、相机、本子与编辑面板。 |
| 2026-08-06 17:34 CST | Codex | 完成实现、自动检查、桌面/移动端与 reduced-motion 浏览器验收，回写产品、架构和入口文档，状态更新为待验收。 |
| 2026-08-06 17:52 CST | 用户 | 明确回复“验收结束”，接受编号 003 的实现与验证结果。 |
| 2026-08-06 17:52 CST | Codex | 将任务状态更新为已完成，并准备创建实现提交。 |
