# DD-20260816-003：在调色板下增加自由视角开关

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 |
| 创建时间 | 2026-08-16 21:58 CST |
| 最后更新 | 2026-08-16 22:42 CST |
| 当前阶段 | 用户已通过提交指令预先验收，正在创建本任务提交 |
| 源码基线 | `af4349ee075d990dceab71a58dd8482a36137f75`；基于包含其他任务未提交修改的工作区实施，并保留其差异 |
| 实现提交 | 本提交（提交哈希见包含本文的 Git 历史记录） |
| 关联任务 | 用户要求在调色板按钮下方增加摄像头按钮，用于切换是否可以自由转动视角，并询问是否使用原生 orbital 控制 |

> 用户已批准第 10 节最终方案；当前按批准范围实施，不扩展为自由走动、平移、缩放或持久化相机。

## 1. 给阅读者的结论

右上角调色板按钮的正下方现已增加“自由视角”图标按钮。关闭态显示带斜线的摄像头，开启态显示普通摄像头；按钮始终保持暖白背景，hover 只强调外边框和图标，开启态再用持续青绿边框与按下阴影区分。调色板与自由视角按钮均不显示原生 hover 文字提示，但保留屏幕阅读器名称。按钮开启后，用户可拖动桌面场景，围绕当前桌面观察目标旋转镜头；再次点击时退出自由视角并平滑回到当前固定机位。

旋转直接使用 Three.js 官方随包提供的 `OrbitControls`，从 `three/addons/controls/OrbitControls.js` 引入。它不是浏览器原生能力，也不是 `THREE` 核心类，但属于 Three.js 官方 addon，现有 `three@^0.185.1` 已包含它，因此没有新增 `@react-three/drei` 或其他运行依赖。本次只开放环绕旋转，不开放平移、自由走动或默认滚轮缩放。

## 2. 用户需求

### 2.1 用户原始要求

- 在调色板按钮的下方提供一个摄像头按钮。
- 点击按钮切换是否可以自由转动视角。
- 确认自由转动应该用什么实现，用户提出“原生 orbital”作为候选。
- 验收补充：禁止自由旋转时，按钮图标应在原有摄像头图标上增加一道斜线；允许自由旋转时显示普通摄像头图标。
- 验收补充：按钮 hover 不应填充整个按钮，只应让外边框和图标出现强调色；已开启状态也不要使用整块青绿填充，以免与 hover 混淆。
- 验收补充：去除右上角调色板按钮和自由视角按钮的原生 hover 文字提示，但保留可访问名称。

### 2.2 Codex 对需求的解释

- “自由转动”解释为以桌面为观察目标的轨道式旋转，不是第一人称自由走动。
- 功能默认关闭，避免改变产品启动时的稳定构图。
- 新按钮是自由视角的开关；当前左下角“远处 / 正面 / 近处”固定机位按钮保留，两者职责不同。
- 自由视角只存在当前页面会话，不写入 IndexedDB；刷新后恢复固定的“远处”机位。

## 3. 当前源码事实

- `src/app/App.tsx` 的 `ProductApp` 在桌面空闲态挂载右上角 `.scene-tool-stack`。调色板按钮在上，自由视角 toggle 在下；关闭态渲染 Lucide `CameraOff`，开启态渲染 `Camera`。工具栈通过 `src/styles.css` 在桌面端定位为 `top: 28px; right: 28px`，移动端为 `top: 18px; right: 16px`。
- `src/app/App.tsx` 仍在左下角 `.desk-actions` 中提供带 `Camera` 图标和当前名称的固定机位按钮。它调用 Zustand 的 `cycleDeskCameraPreset()`，按 `far -> front -> near -> far` 循环；自由模式开启时该按钮禁用。
- `src/state/app-store.ts` 当前拥有可序列化、非持久化的 `deskCameraPreset`、`deskCameraTransitioning` 与 `freeCameraEnabled`。按钮通过 `toggleFreeCamera()` / `disableFreeCamera()` 发出意图；本子、贴纸和固定机位动作负责互斥收敛。
- `src/scene/DeskScene.tsx` 的 `CameraRig` 在固定模式直接插值相机 `position`、`quaternion` 与 `fov`；自由模式开启时停止写相机。打开本子时镜头临时去 `near`，关闭时回到用户选择的固定机位；桌面端与移动端分别维护三组 `position / target / fov`。
- `src/scene/DeskScene.tsx` 已从 `three/addons/controls/OrbitControls.js` 导入官方 `OrbitControls`。`FreeOrbitCamera` 只在自由模式中创建它，禁用平移/缩放、限制极角，并在退出或 Canvas 卸载时释放；项目仍未依赖 `@react-three/drei`。
- `DeskScene` 自己管理一个 R3F root 和单一 WebGL Canvas。相机、控件、向量等运行对象按 `DD-ADR-20260806-002` 应继续由 R3F / Three.js 生命周期拥有，不得放入 Zustand 或 IndexedDB。
- `docs/product/mvp.md` 仍把稳定视角作为默认桌面特征，并把自由走动和完整房间列为非目标；当前已同步受限环绕是显式开启、会话内且不等同自由走动的产品事实。
- 工作区存在其他任务对 `docs/product/mvp.md`、`docs/architecture/system-overview.html`、模型、测试和依赖锁文件的未提交修改；本任务只在产品文档中追加自由视角事实，没有覆盖这些并行差异。

## 4. 目标与非目标

### 4.1 目标

- 在收起状态的调色板按钮正下方显示一个自由视角开关。
- 默认关闭；开启后允许鼠标拖动或单指拖动，使镜头围绕桌面目标点旋转。
- 通过按钮的激活样式、`aria-pressed`、可访问名称和 tooltip 清楚表达当前状态。
- 关闭态显示带斜线的摄像头图标，开启态显示普通摄像头图标，使图形语义与状态一致。
- 退出自由视角时平滑回到当前 `far / front / near` 固定机位。
- 本子开合、固定机位转场、贴纸交互与自由旋转不能同时争夺相机或 pointer 事件。
- 保持单 Canvas，保持现有桌面端和移动端构图回退路径。

### 4.2 非目标

- 不实现第一人称移动、键盘 WASD、自由走动、房间探索或家具装修。
- 不默认开放平移；不把镜头拖离桌面观察目标。
- 不默认开放滚轮或双指缩放；若需要缩放，应作为后续明确需求。
- 不保存自由视角开关或任意相机姿态；刷新仍回到默认固定机位。
- 不新增第二个 WebGL Canvas，不引入 `@react-three/drei`，不更换现有相机转场状态机。
- 不修改桌子、本子、桌垫、材质、灯光或配色方案。

## 5. 方案说明

### 5.1 控件布局

把右上角的单一绝对定位按钮改为一个纵向工具栈：调色板按钮在上，自由视角按钮在下，两个按钮保持相同尺寸和间距。调色板面板展开时可隐藏这组收起按钮，关闭面板后恢复；移动端仍避开安全区与底部桌面命令。

自由视角按钮使用摄像头图标，并采用 toggle button 语义：

```text
关闭：aria-pressed=false；“开启自由视角”
开启：aria-pressed=true；“关闭自由视角”并显示激活态
```

### 5.2 相机实现

直接使用官方 addon：

```ts
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
```

在 `DeskScene` 的 R3F 生命周期内创建和释放 `OrbitControls`，连接当前 `PerspectiveCamera` 与 Canvas。建议配置：

- `enableRotate = true`；
- `enablePan = false`；
- `enableZoom = false`；
- 开启适度 damping；
- 限制极角，避免翻到桌面下方或镜头倒置；
- 方位角可完整环绕，最终范围由桌面/移动端浏览器验收确认；
- `target` 使用当前固定机位的桌面观察目标，而不是把 Three.js `Vector3` 写进 store。

### 5.3 与现有镜头状态机的关系

预计新增可序列化、非持久化的 `freeCameraEnabled: boolean`。Zustand 只保存这个布尔意图；实际 `OrbitControls`、camera、target 向量和 damping 运行值继续留在 `DeskScene`。

两种相机拥有者必须互斥：

```text
固定模式：CameraRig 拥有 camera -> 预设切换 / 本子转场
自由模式：OrbitControls 拥有 camera -> 用户环绕旋转
退出自由模式：OrbitControls 禁用 -> CameraRig 从当前姿态回到当前预设
进入本子或贴纸流程：先退出自由模式 -> 再执行原有流程
```

自由模式开启时，建议禁用左下角固定机位按钮；用户先关闭自由模式，再切换 `far / front / near`。这样不会让 `CameraRig` 与 `OrbitControls` 在同一帧写相机。若用户希望点击固定机位按钮即可自动关闭自由模式并切换，也可以在批准时选为替代交互。

## 6. 预计改动与影响评估

- `src/app/App.tsx`：渲染右上角纵向工具栈和自由视角 toggle；连接自由视角状态；为固定机位按钮增加互斥禁用或自动退出行为。
- `src/scene/SceneColorEditor.tsx`：让调色板入口能被工具栈组合，或新增同级的自由视角按钮组件；保持颜色面板本身职责不变。
- `src/scene/DeskScene.tsx`：新增由 R3F 生命周期拥有的 `OrbitControls` 包装；在自由模式、预设转场和本子阶段之间切换唯一相机写入者；卸载时调用 `dispose()`。
- `src/state/app-store.ts`：新增会话内自由视角布尔状态和带现有流程 guard 的切换/退出动作；不加入数据库或领域模型。
- `src/state/app-store.test.ts`：覆盖默认关闭、切换、转场互斥、进入本子/贴纸流程时退出，以及刷新时不恢复自由姿态的状态边界。
- `src/app/App.test.tsx`：覆盖按钮位置对应的结构、`aria-pressed`、可访问名称、激活状态和非桌面阶段隐藏。
- `src/styles.css`：新增右上角纵向工具栈和桌面/移动端间距；避免覆盖其他任务正在修改的视觉样式。
- `docs/product/mvp.md`：实施后把受限自由环绕模式写入当前产品事实，并继续明确它不是自由走动。
- `docs/architecture/system-overview.html`：若实施形成新的相机运行链和状态所有权，应同步相机拥有者互斥、OrbitControls 生命周期与源码地图。该 HTML 修改必须使用项目要求的 `$bun-html-docs`；当前会话未提供此技能，因此实施阶段在修改该 HTML 前需要先恢复技能可用性。

### 6.1 核心数据结构变化

预计在应用会话状态中新增类似字段：

```ts
interface AppState {
  freeCameraEnabled: boolean
  toggleFreeCamera(): void
  disableFreeCamera(): void
}
```

默认值为 `false`。字段不持久化，不修改 Dexie schema、领域实体、repository 公共接口或 IndexedDB 数据。具体命名可按当前 store 风格微调。

`OrbitControls` 实例及其 `target: THREE.Vector3` 不属于上述数据结构，只在 Canvas 挂载期间存在并在卸载时释放。

### 6.2 上下游与跨模块影响

- DOM 按钮发出可序列化意图；Zustand 协调模式；`DeskScene` 执行相机控制，符合现有状态与视觉投影边界。
- `CameraRig` 与 `OrbitControls` 都可能写同一个 camera，互斥开关是本任务的核心正确性条件。
- OrbitControls 监听 Canvas pointer/wheel 事件；即使禁用 pan/zoom，也必须验证不会拦截桌面贴纸点击、拖动、本子命中和触控滚动。
- 本子打开流程仍从自由姿态插值到 `near`，关闭后返回用户最后选择的固定预设，不恢复任意自由姿态。
- 颜色编辑仍是组件级临时状态，不与自由相机状态合并，也不新增持久化主题或相机配置。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 两套控制同时写相机 | CameraRig 转场期间仍启用 OrbitControls | 镜头抖动、跳帧或落点错误 | 用单一模式状态保证互斥；针对切换顺序增加测试 |
| 与贴纸 pointer 事件冲突 | OrbitControls 抢占点击或拖动 | 无法选择、移动贴纸或误旋转镜头 | 进入贴纸交互前退出自由模式；浏览器验证 pointer capture |
| 镜头转到桌下或倒置 | 极角未限制 | 暴露未建模区域并破坏构图 | 限制 `minPolarAngle / maxPolarAngle`，必要时限制方位角 |
| 移动端手势误触 | 单指旋转与页面/对象操作冲突 | 操作不可预测 | 只在显式开启后接管手势；验证单指、双指与安全区 |
| 两个相机图标职责混淆 | 右上自由开关与左下预设按钮同时存在 | 用户不知道哪个切机位、哪个旋转 | 推荐保留文字清楚的左下预设按钮，并为右上 toggle 使用激活态、tooltip 和明确可访问名称；是否合并在批准前确认 |
| 退出自由模式突跳 | 直接写入固定姿态 | 视觉不连续 | 复用 CameraRig 从当前姿态到预设的平滑插值；reduced-motion 快速收敛 |
| HTML 架构文档无法按规则更新 | `$bun-html-docs` 仍不可用 | 无法满足文档一致性门槛 | 实施前恢复技能；否则暂停 HTML 修改并不得宣称交付完成 |

回退方式：删除自由视角按钮、会话状态和 OrbitControls 包装，恢复由 `CameraRig` 独占相机。由于不修改持久化 schema，不需要数据迁移或数据回滚。

## 8. 验证与验收

- 自动测试：验证默认关闭、toggle 状态、固定机位互斥、进入本子/贴纸流程自动退出、reduced-motion 收敛和 store 不持有 Three.js 对象。
- 构建与静态检查：运行针对性 Vitest、全量 `npm test`、`npm run lint`、`npm run build`、`node scripts/check-doc-references.mjs` 和 `git diff --check`。
- 浏览器验收：`ego-browser` 可用时，在桌面端与 `390 × 844` 移动端验证按钮位于调色板下方、开关状态清楚、拖动可环绕、不能翻到桌下、退出平滑回位；验证自由模式与三预设、本子开合、贴纸选择/拖动、颜色面板、窗口缩放的组合路径。若 `ego-browser` 不可用，记录桌面端和移动端未覆盖范围并交由用户手动验收。
- 持久化与恢复：刷新页面确认自由模式关闭、镜头回到 `far`，原日记和贴纸数据不受影响。
- 成功标准：用户能显式开启和关闭受限自由环绕；任何时刻只有一个相机控制者；现有本子、固定机位、贴纸和调色功能无回归。

## 9. 待确认项与决策

用户批准推荐选项后，当前没有未决的范围问题：

1. **保留两个相机入口。** 左下角继续负责 `远处 / 正面 / 近处` 固定机位，右上角图标按钮负责自由视角 toggle；自由模式开启时固定机位按钮禁用。
2. **自由视角只做环绕旋转。** 平移和缩放保持禁用，并限制极角以避开桌下未建模区域。
3. **退出时回到固定预设。** 主动关闭、打开本子、进入贴纸流程或选择桌面贴纸都会退出自由模式；任意自由姿态不持久化。
4. **状态图标。** 用户在待验收阶段明确要求关闭态使用“摄像头＋斜线”，开启态使用普通摄像头；采用现有 `lucide-react` 的 `CameraOff` / `Camera`，不新增依赖。
5. **状态样式。** 源码检查确认依赖库的默认 hover 只改变文字/图标、边框、阴影和轻微位移；整块青绿来自本任务 `.free-camera-button[aria-pressed="true"]` 的开启态规则。按用户反馈移除该填充：关闭 hover 与开启状态均保持暖白背景，hover 只强调外边框和图标；开启态另用持续青绿边框、图标色及按下阴影表达。
6. **移除 hover 文字。** 调色板和自由视角按钮不再渲染原生 `title`，避免指针停留时显示浏览器文字提示；`aria-label` 继续分别提供“打开场景颜色编辑器”和动态自由视角状态名称，不牺牲屏幕阅读器语义。其他 `IconButton` 默认行为不变。

## 10. 最终批准方案

用户于 2026-08-16 22:01 CST 回复“认可，按推荐方案执行”，批准第 5 至 8 节方案，并采用第 9 节的三个推荐选项：保留固定机位按钮、自由视角只做旋转、退出时回到当前固定预设。

用户于 2026-08-16 22:19 CST 在待验收阶段补充关闭态图标要求；该修正不改变功能范围、交互流程或架构，按用户明确指令继续在本任务实施。

用户于 2026-08-16 22:32 CST 反馈按钮出现整块填充并要求 hover 只显示边框强调；源码定位为开启态规则而非默认 hover，按用户视觉意图同时收敛 hover 与开启态样式。

用户于 2026-08-16 22:36 CST 要求去除调色板和自由视角两个按钮的 hover 文字提示；该修正只改变两个按钮的 `title` 输出，不改变可访问名称或功能。

最终执行清单：

1. 新增右上角纵向工具栈和可访问的自由视角 toggle。
2. 用官方 `OrbitControls` 实现受限环绕，不新增依赖。
3. 用会话布尔状态保证 OrbitControls、CameraRig、本子和贴纸流程互斥。
4. 完成自动测试、构建、文档引用和桌面/移动浏览器验收。
5. 回写产品、架构和本任务记录；实际完成后状态更新为待验收。

## 11. 实施记录

已按批准范围实施：

- `src/state/app-store.ts`：新增默认关闭、仅会话存在的 `freeCameraEnabled`，以及 `toggleFreeCamera()`、`disableFreeCamera()`。自由模式开启时固定机位循环被 guard；关闭自由模式会触发现有预设回位转场。
- `src/state/app-store.ts`：从任意自由姿态打开本子时统一进入 `approaching`，即使当前固定预设是 `near` 也先平滑回到近处再开盖。打开本子、进入贴纸制作、准备贴纸落位、3D fallback 和选择桌面贴纸都会清除自由模式；选择已有贴纸时同时触发预设回位。
- `src/app/App.tsx`：右上角新增 `.scene-tool-stack`，调色板按钮在上、自由视角按钮在下。自由按钮使用 `aria-pressed`、动态可访问名称和激活态；关闭态使用现有 `CameraOff`（摄像头加斜线），开启态使用普通 `Camera`。自由视角按钮显式关闭原生 `title`。自由模式期间左下固定机位按钮禁用。打开颜色面板前会先退出自由模式，避免工具栈隐藏后失去关闭入口。
- `src/ui/IconButton.tsx`：新增默认开启的 `showTitle` 选项；设为 `false` 时不输出原生 `title`，但始终保留 `aria-label`。其他图标按钮仍默认使用 label 作为 title。
- `src/scene/SceneColorEditor.tsx`：调色板入口设置 `showTitle={false}`；保留当前其他任务对“抽屉面”措辞的修改。
- `src/scene/DeskScene.tsx`：直接从 `three/addons/controls/OrbitControls.js` 引入官方 addon，没有新增依赖。`FreeOrbitCamera` 仅在桌面自由模式中创建控件，目标点取当前响应式固定机位的 `target`，开启 damping，禁用 pan/zoom，旋转速度为 `0.65`，极角限制在 `0.22` 到 `π/2 - 0.08`；退出或卸载时调用 `dispose()`。
- `src/scene/DeskScene.tsx`：`CameraRig` 在自由模式中停止写相机；自由模式退出后从当前任意姿态沿原有插值回到当前固定预设，保持任何时刻只有一个相机拥有者。
- `src/styles.css`：把原调色板按钮定位改为右上纵向工具栈，并补充自由视角状态与移动端位置。关闭 hover 和开启状态均显式保持暖白背景，只改变青绿色边框/图标；开启态继续使用下压位置和较短阴影表达已启用。未改变颜色面板本体。
- `src/state/app-store.test.ts`：覆盖默认关闭、toggle、固定机位互斥、选择贴纸退出、近处自由姿态仍先 approaching，以及贴纸工作台退出自由模式。
- `src/app/App.test.tsx`：覆盖调色板/自由按钮同属工具栈、`aria-pressed` 切换、关闭态 `CameraOff`、开启态 `Camera`、自由视角按钮无 `title` 和自由模式禁用固定机位按钮。
- `src/scene/SceneColorEditor.test.tsx`：覆盖调色板按钮保留可访问名称但不输出 `title`。
- `docs/product/mvp.md`：同步受限自由视角的当前行为、非自由走动边界和实现覆盖状态。

方案偏差：没有范围、交互或架构偏差。初版无需修改 `src/scene/SceneColorEditor.tsx`，因为 `ProductApp` 可直接组合现有 `SceneColorEditorButton` 与新按钮；后续根据用户“移除两个右上按钮 hover 文字提示”的验收修正，在该文件的 `SceneColorEditorButton` 上增加了 `showTitle={false}`。该文件当前的“抽屉面”改动属于其他任务，本任务通过精确暂存排除。没有修改依赖、持久化 schema、领域模型或公共 repository 接口。

## 12. 验证结果

- 类型检查：`npx tsc -b --pretty false` 通过。
- 针对性测试：首次运行因宿主 `TEMP/TMP` 指向不存在的 Windows 临时目录而在加载测试前失败；使用 `env -u TEMP -u TMP npm test -- --run src/state/app-store.test.ts src/app/App.test.tsx` 后通过，2 个文件、13 项测试全部成功。该失败不是源码或断言失败。
- lint：`npm run lint` 通过。
- 全量测试：`env -u TEMP -u TMP npm test` 通过，14 个文件、58 项测试全部成功。
- 生产构建：`npm run build` 通过；Vite 只报告既有的大 chunk 提示，没有构建错误。
- 文档与差异：`node scripts/check-doc-references.mjs` 与 `git diff --check` 均通过。
- React 复核：按 React 最佳实践检查 hooks 依赖、运行对象生命周期、可访问 toggle、渲染边界和第三方控件释放，没有发现需要扩大修改的质量问题。
- 浏览器验收：当前环境没有 `ego-browser`（`command not found`）。按项目规则未改用其他浏览器工具，桌面端和移动端的按钮视觉、鼠标/触摸拖动、极角边界、退出回位、本子开合和贴纸 pointer 组合路径均未宣称验证通过，等待用户手动验收。
- 持久化：未修改 Dexie schema 或 repository。store 单元测试证明默认 `freeCameraEnabled = false`；实际页面刷新恢复仍包含在待手动验收范围。
- 关闭态图标修正后复验：再次运行 `env -u TEMP -u TMP npm test`、`npm run lint`、`npm run build`、文档引用和差异检查，结果仍为 14 个测试文件、58 项测试全部成功，lint/构建/文档检查通过；新增断言确认关闭态为 `CameraOff`、开启态为 `Camera`。
- hover/开启态填充修正后复验：`env -u TEMP -u TMP npm test -- --run src/app/App.test.tsx` 通过，1 个文件、2 项测试成功；`npm run lint`、`npm run build`、文档引用检查和 `git diff --check` 均通过。由于附件临时路径已失效且 `ego-browser` 不可用，实际 hover 像素效果仍等待用户手动复验。
- 移除 hover 文字提示后复验：`env -u TEMP -u TMP npm test` 通过，14 个测试文件、59 项测试全部成功；`npm run lint`、`npm run build`、文档引用检查和 `git diff --check` 均通过。新增断言确认调色板与自由视角按钮没有 `title` 且 `aria-label` 可查询。
- 提交前验收：用户于 2026-08-16 22:42 CST 明确要求 `git commit`，按项目规则构成对当前已批准范围的预先验收授权。实现未超出批准范围，必要自动验证均通过；`ego-browser` 不可用的视觉未覆盖范围已在上文披露，用户在多轮界面复验后发出提交指令。

## 13. 文档同步检查

- 产品文档：已更新 `docs/product/mvp.md`，记录受限环绕、互斥、回位、非持久化和非自由走动边界。
- 架构文档：未修改。现有 `docs/architecture/system-overview.html` 已把会话意图归 Zustand、相机运行对象归 R3F / Three.js，并把 `DeskScene` 标为相机与单 Canvas 所有者；本实现没有改变这些架构边界。该 HTML 还包含其他任务的未提交修改，本任务未覆盖。
- 决策文档：无需修改；实现继续遵守 `DD-ADR-20260806-002`，store 只保存布尔意图，OrbitControls、Camera 和 Vector 均留在 R3F 生命周期。
- 文档入口：未修改；本任务使用同一 Markdown 记录，未新增需要独立入口的长篇文档。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-16 21:58 CST | 用户 / Codex | 用户提出在调色板按钮下增加自由视角摄像头开关，并询问 orbital 实现；Codex完成源码核对和待确认方案记录。 |
| 2026-08-16 22:00 CST | Codex | 文档引用检查和差异空白检查通过；任务保持待确认，未修改业务源码。 |
| 2026-08-16 22:01 CST | 用户 / Codex | 用户明确认可推荐方案并要求执行；任务进入实施中。 |
| 2026-08-16 22:11 CST | Codex | 完成右上自由视角开关、官方 OrbitControls、相机互斥、自动测试、构建和文档回写；因 ego-browser 不可用，桌面/移动视觉与真实拖动留待用户手动验收，状态更新为待验收。 |
| 2026-08-16 22:19 CST | 用户 / Codex | 用户要求禁止自由旋转状态使用带斜线的摄像头图标；作为同一任务的验收修正继续实施。 |
| 2026-08-16 22:21 CST | Codex | 使用现有 Lucide CameraOff / Camera 完成关闭态与开启态图标切换，补充断言并重跑全量测试、lint、构建和文档检查；任务返回待验收。 |
| 2026-08-16 22:32 CST | 用户 / Codex | 用户反馈按钮整块填充易被误认为 hover bug，并明确 hover 只应强调外边框；源码确认填充来自开启态规则，任务继续实施样式修正。 |
| 2026-08-16 22:34 CST | Codex | 移除开启态整块青绿填充，并显式约束关闭 hover/开启 hover 只强调边框与图标；针对性测试、lint、构建和文档检查通过，任务返回待验收。 |
| 2026-08-16 22:36 CST | 用户 / Codex | 用户要求去除调色板和自由视角两个按钮的 hover 文字提示，同时保留功能与可访问语义；任务继续实施。 |
| 2026-08-16 22:39 CST | Codex | 为 IconButton 增加可选 title 输出并只对两个右上按钮关闭，补充无 title/保留 aria-label 测试；59 项全量测试、lint、构建和文档检查通过，任务返回待验收。 |
| 2026-08-16 22:42 CST | 用户 / Codex | 用户明确要求创建 Git 提交，构成对当前范围的预先验收；任务标记为已完成并进入提交。 |
