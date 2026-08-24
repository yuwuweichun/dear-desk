# DD-20260824-005：增加本子打开时的多页翻动效果

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 |
| 创建时间 | 2026-08-24 18:12 CST |
| 最后更新 | 2026-08-24 19:04 CST |
| 当前阶段 | 用户验收通过，正在创建任务提交 |
| 源码基线 | Git `f7b6f0f`；工作区已有未跟踪的 `DD-20260824-001`，与本任务无关且不修改 |
| 实现提交 | 本次任务提交（以 Git 历史为准） |
| 关联任务 | 用户要求日记本展开过程中增加几页连续翻动的“哗啦啦”视觉效果，替代当前过于平稳的直接展开 |

> 用户已于 2026-08-24 18:18 CST 明确批准本文方案；实施不得扩大最终执行清单。

> 用户于 2026-08-24 19:04 CST 明确回复“验收通过，提交”；本任务实施、验证和文档回写符合批准范围，状态更新为已完成并纳入同一提交。

## 1. 给阅读者的结论

当前 3D 本子由一个连续的 `openProgress` 同时驱动封面和左右页堆：本子先沿书脊竖起，再让左右半册平稳、镜像地摊开。它能稳定交接到 DOM 日记，但展开过程没有独立纸页运动，所以缺少用户期望的“哗啦啦”层次。

建议保留现有开本结构与最终双页位置，在本子开始摊开后加入 5 张只在转场中可见的轻薄页片。页片沿中央装订轴依次错峰翻过书脊，角度、轻微高度差和透明度共同形成短促的扇动；最后一张落定前全部退出，仍由现有左右页堆和 DOM 日记承担稳定内容。这样能增加开本手感，同时不把视觉特效混入日记数据和日期翻页功能。

## 2. 用户需求

**用户原始要求：**

- 当前日记本展开过于平稳、直接。
- 展开过程中需要出现几页翻动的动画。
- 目标是形成“哗啦啦的页面展开”视觉效果。

**Codex 解释：**

- “几页”建议固定为 5 张视觉页片，足以形成连续节奏，同时控制 draw call 与几何量。
- 页片属于从桌面闭合本子进入打开日记的 3D 开本动画，不替代打开后的 DOM 日期翻页，也不承载真实正文或贴纸。
- 动画应保持现有书脊居中、终态双页位置和可逆关闭链路；关闭时页片按同一时间轴反向收回。
- 系统减少动态效果时不播放可辨识的大角度连续翻页，直接快速到达相同稳定端点。

## 3. 当前源码事实

- `src/app/App.tsx` 的“打开本子”按钮调用 store 的 `requestNotebookOpen()`；3D 本子点击入口也进入同一状态机。
- `src/scene/NotebookObject.tsx` 监听 `notebookPhase`，在 `opening` 阶段按 `getNotebookTransitionDuration()` 和 `easeInOutCubic()` 计算连续进度，再调用模型的 `setOpenProgress()`。当前标准开本总时长约 3 秒，其中靠近 1.4 秒、模型打开 1.6 秒；紧凑视口约 1.88 秒；reduced motion 总计约 0.12 秒。
- `src/scene/notebook-transition.ts` 的 `getNotebookPresentationState()` 把模型进度拆成竖起、摊开和落定三个连续阶段，没有独立页片节奏。
- `src/scene/models/create-notebook-model.ts` 的 `createNotebookModel()` 创建闭合页芯、左右打开页堆及各自顶页。`setOpenProgress()` 让左页堆和前封面使用相同 `spreadProgress` 转动，右页堆保持另一侧；当前没有转场页片池。
- `src/scene/models/model-factories.test.ts` 明确断言 `rapid-page-flip-pool` 不存在；`src/scene/notebook-transition.test.ts` 验证现有时长、端点、镜像摊开和 reduced-motion 时间上限。
- `docs/product/mvp.md` 当前事实明确写着旧的 5 张实例页片与快速翻页已删除。新需求与该项当前事实相反，因此实施后必须同步更新产品文档，不能只改源码。
- `docs/architecture/system-overview.html` 将 `NotebookObject -> createNotebookModel` 记录为中央展示锚点、封面铰链与左右页堆链路；若增加转场页片，需要同步该当前事实和源码地图说明。该 HTML 的修改必须按项目规则使用 `$bun-html-docs`。
- `DD-20260817-007` 曾否决“从第 1 页连续快速扫到中部”的旧动画，但允许从中间向两侧归位的少量翻页。本方案从中央装订轴错峰翻动，不恢复当时暴露模型结构和造成横向漂移的旧实现。

**合理推断：** 5 张页片在现有 1.6 秒打开阶段中占用摊开后半段，并以约 70-100ms 的间隔错峰启动，可以让用户感知连续纸声式节奏而不明显拖慢进入日记；最终节奏仍需桌面和移动端中间帧验证。

## 4. 目标与非目标

### 4.1 目标

- 在 3D 本子打开过程中显示 5 张连续、错峰翻过中央装订轴的纸页。
- 保持本子竖起、居中摊开、最终双页交接和关闭恢复的现有行为。
- 让页片只在转场需要的时间窗可见，稳定闭合态与稳定全开态均不残留临时几何。
- 保持单一 WebGL Canvas，并控制新增模型成本在现有预算内。
- 为页片数量、错峰区间、稳定端点、反向关闭与 reduced-motion 行为增加自动测试。
- 完成桌面和移动端真实浏览器视觉验收，检查中间帧、遮挡、闪烁和最终交接。

### 4.2 非目标

- 不修改打开日记后的 `page-flip@2.0.7` 日期翻页效果。
- 不让转场页片显示正文、日期或贴纸，也不引入真实纸张物理、骨骼、布料模拟或音效。
- 不改变本子封面、材质、镜头预设、DOM 日记布局、持久化结构或业务状态机。
- 不增加第二个 WebGL Canvas，不新增依赖。
- 不恢复旧版“从第 1 页快速扫到中间”的动画结构。

## 5. 方案说明

在 `createNotebookModel()` 中新增一个位于中央页铰链上的转场页片组，组内放置 5 张共享纸张材质、各自拥有独立 pivot 的薄页 Mesh。每张页片使用已有弯曲纸面几何或其轻量变体，不复制页芯厚度，也不承载交互。

`notebook-transition.ts` 新增纯函数，把全局 `openProgress` 映射为 5 张页片各自的局部进度。页片在本子已竖起、两侧开始摊开之后依次启动：每张从右侧页堆附近抬起，越过书脊后落向左侧，并通过很小的高度和相位差形成扇状层次。该函数只由进度决定，因此关闭时自然按相反顺序回收，不需要新增状态。

页片组在局部进度窗口外隐藏：闭合端点不穿出封面，全开端点不覆盖最终顶页，也不会在 Three.js 模型隐藏并切换到 DOM 日记时闪现。现有总时长先保持不变，以内部节奏重分配实现效果；只有浏览器验收证明 1.6 秒容纳不下清晰的 5 页节奏时，才把时长调整列为需要重新确认的方案偏差。

## 6. 预计改动与影响评估

- `src/scene/notebook-transition.ts`：增加转场页片数量/错峰窗口常量与纯进度映射，保持现有本子展示状态接口兼容。
- `src/scene/models/create-notebook-model.ts`：创建并注册 5 张临时翻动页片，在 `setOpenProgress()` 中应用角度、高度、可见性和层级；释放路径继续由模型工厂统一负责。
- `src/scene/notebook-transition.test.ts`：验证页片依次启动、端点隐藏、相位有序、反向进度可逆及 reduced-motion 仍快速收敛。
- `src/scene/models/model-factories.test.ts`：把“翻页池不存在”的旧断言更新为具体结构、数量、共用材质/几何策略、稳定端点与模型预算断言。
- `docs/product/mvp.md`：把“旧页片已删除”的当前事实更新为本次获批并实际实现的 5 页转场效果，明确它与 DOM 日期翻页的边界。
- `docs/architecture/system-overview.html`：按 `$bun-html-docs` 规则更新 R3F 渲染链路、reduced-motion 事实和源码地图；不改变页面信息架构。
- 本记录：回写最终批准清单、实际文件、偏差、命令、浏览器结果和验收状态。

### 6.1 核心数据结构变化

- 不改变 Zustand store、`NotebookPhase`、IndexedDB schema、日记记录、贴纸或公共业务事件。
- 模型运行时节点预计增加一个转场页片组及 5 个页片 pivot/Mesh 引用，仅存在于当前 Three.js 模型生命周期中。
- `setOpenProgress(number)` 和 `getOpenProgress()` 公共调用方式保持不变；页片状态从同一个规范化进度派生，不单独持久化。

### 6.2 上下游与跨模块影响

- 上游 `App -> store -> DeskScene -> NotebookObject` 的打开意图与阶段推进不变。
- 下游 `JournalPanel` 仍只在 `editing` 阶段接管，日期翻页快照和正文表单不读取 3D 页片状态。
- 材质库沿用现有 `paper` 材质，不新增纹理；模型 dispose 需要覆盖新增几何但不释放共享材质。
- 预计增加少量 draw call 和三角形；必须继续通过模型预算测试和 production build。
- 动画为用户可见状态变化，需要自动测试以及 ego-browser 的桌面、移动端中间帧与最终态验收。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 页片穿过封面或页堆 | pivot、起止角或高度与现有页堆坐标不一致 | 中间帧出现明显穿模 | 沿现有 `pageHinge` 建模，用固定关键进度的世界包围盒测试与浏览器中间帧检查；必要时缩小页片并收窄可见窗口 |
| 视觉过快或过乱 | 5 页错峰窗口过窄、振幅过大 | “哗啦啦”变成闪烁 | 保持单向有序相位、小高度差和固定页数；只在验收后微调节奏常量 |
| DOM 交接时闪页 | 全开端点临时页仍可见 | 进入日记瞬间跳变 | 在全开前完成所有页片并显式隐藏，自动测试稳定端点 |
| 关闭动画不自然 | 纯进度反放造成纸页回收次序突兀 | 关闭本子观感下降 | 浏览器同时验收打开与关闭；若反放不合适，回退为关闭阶段隐藏临时页片，不改变状态机 |
| 性能或模型预算回退 | 每页创建高细分独立几何/材质 | 移动端掉帧或预算测试失败 | 共享材质、复用/克隆轻量 geometry，限定 5 页；失败时减少细分而不改变页数与交互 |
| reduced-motion 仍出现大幅运动 | 60ms 内仍渲染中间帧 | 不符合用户动态偏好 | 保持现有快速端点时长，并让临时页在 reduced-motion 路径无可辨识连续播放 |

回退方式：删除转场页片组和纯进度映射，恢复现有 `setOpenProgress()` 对封面、页堆和页芯的驱动；业务状态、持久化与 DOM 日记无需迁移或回滚。

## 8. 验证与验收

- 自动测试：运行 `src/scene/notebook-transition.test.ts`、`src/scene/models/model-factories.test.ts`，再运行全量 `npm test`。
- 构建与静态检查：运行 `npm run lint`、`npm run build`，确认类型、资源释放和模型预算无回退。
- 浏览器验收：按项目固定地址 `http://127.0.0.1:5164` 使用 ego-browser；至少覆盖 1440x900 与 390x844，检查打开早/中/晚帧、5 页错峰方向、书脊居中、无穿模、无闪页、关闭恢复以及 reduced-motion。任务结束默认关闭 task space。
- 持久化与恢复：本次无持久化改动；刷新后仍应以闭合本子和原有日记数据启动。通过浏览器刷新做回归检查，不新增迁移测试。
- 文档检查：运行 `node scripts/check-doc-references.mjs`；HTML 更新按 `$bun-html-docs` 要求完成结构、链接、响应式和可访问性验证。
- 成功标准：普通动态偏好下，用户能在展开过程中清楚看到 5 张有序连续翻动的纸页；最终双页、DOM 日记和关闭恢复无跳位；reduced-motion 快速到达相同端点；全量测试、lint、build、文档引用检查通过。

## 9. 待确认项与决策

建议直接确认以下体验参数：

- 页片数量为 5 张。
- 翻动发生在本子竖起后、左右半册摊开的中后段，从中央装订轴依次翻向左侧。
- 保持现有 1.6 秒模型打开时长，先通过错峰节奏制造“哗啦啦”，不额外延长进入日记的等待。
- 关闭沿同一进度反向回收；若浏览器验收显示反放不自然，则关闭时隐藏临时页片作为不改变打开体验的局部回退。
- 本次只做视觉，不添加纸张声音。

除此之外没有会实质改变范围、数据或架构的待确认项。

## 10. 最终批准方案

用户于 2026-08-24 18:18 CST 回复“批准”，确认第 9 节建议参数：5 张页片、开本摊开中后段从中央装订轴依次翻向左侧、保持现有打开时长、关闭按进度反向回收、本次不增加音效。

最终执行清单：

1. 在 `notebook-transition.ts` 增加 5 页错峰翻动的纯进度映射，不改变 store 状态机与总时长。
2. 在 `create-notebook-model.ts` 增加只在转场中可见的临时页片组，沿现有装订轴驱动角度、高度和可见性。
3. 更新转场与模型工厂测试，覆盖数量、错峰、端点、反向可逆、资源/预算和 reduced-motion。
4. 同步 `docs/product/mvp.md`、`docs/architecture/system-overview.html` 与本记录；HTML 严格使用 `$bun-html-docs`。
5. 运行针对性测试、全量测试、lint、build、文档引用检查，并使用 ego-browser 覆盖桌面、移动、关闭和 reduced-motion。
6. 实施完成后把本记录更新为“待验收”，不创建提交、push 或 PR。

## 11. 实施记录

已按批准清单实施，未扩大业务范围：

- `src/scene/notebook-transition.ts` 新增 `NOTEBOOK_PAGE_FLUTTER_COUNT = 5` 与 `getNotebookPageFlutterState()`。5 张页片从全局进度 `0.44` 起以 `0.06` 间隔错峰，每张占用 `0.29` 进度窗口；局部进度经过现有 cubic easing，抬升使用半正弦曲线。函数只依赖规范化进度，因此关闭反向经过同一位置。
- `src/scene/models/create-notebook-model.ts` 新增单个 `opening-page-flutter` `InstancedMesh`。5 张页片共享弯曲纸面 geometry 和既有 paper material，每张实例拥有独立矩阵；模型闭包复用一个 `Object3D` 计算矩阵，避免逐帧创建 Three.js 辅助对象。
- `setOpenProgress(value, animatePageFlutter = true)` 在保持现有单参数调用兼容的同时更新页片角度、高度、前后错层、活动数量与可见性。闭合和全开端点缩放隐藏所有实例，稳定打开页仍由原左右页堆负责。
- `src/scene/NotebookObject.tsx` 把 `!reducedMotion` 作为页片播放开关传给模型；系统减少动态效果时不创建可辨识的页片中间态。
- `src/scene/notebook-transition.test.ts` 新增 5 页数量、错峰顺序、抬升、端点、正反向轨迹一致与范围钳制测试。
- `src/scene/models/model-factories.test.ts` 用 `opening-page-flutter` 的结构、实例数、活动数量、有序局部进度、reduced-motion 隐藏和稳定端点断言替代旧“快速翻页池不存在”的单一断言。
- `docs/product/mvp.md` 更新当前产品事实，区分已删除的旧版 9 次循环扫页与本次 5 张各翻一次的转场页片。
- `docs/architecture/system-overview.html` 按 `$bun-html-docs` 的当前事实与源码证据规则更新开场结论、模型链路、渲染边界、reduced-motion、源码地图和验证证据。

**方案偏差：** 无实质偏差。实现使用一个实例化页片网格而非 5 个独立 Mesh/pivot，以一个 draw call 达到相同的 5 页独立变换目标；该选择符合已批准的性能边界，未改变用户体验、公共业务接口或数据结构。

## 12. 验证结果

- 针对性测试：`npm test -- src/scene/notebook-transition.test.ts src/scene/models/model-factories.test.ts`，2 个文件、22 项测试全部通过。
- 完整门槛：`npm run check` 通过，包括 ESLint、22 个测试文件共 98 项测试、TypeScript/Vite production build 和 `node scripts/check-doc-references.mjs`。
- 构建结果：成功生成 production bundle；仅报告项目既有的 chunk 超过 500kB 警告，本任务未新增依赖、纹理或独立 bundle。
- 桌面浏览器：ego-browser 在 `http://127.0.0.1:5164`、1440 × 900 捕捉 6 张与 `opening` 状态对齐的连续帧；页片从中央装订轴依次向左翻动，多个相位同时可见，最终 3D 页片在 DOM 日记接管前退出。最终保持 1 个 Canvas，页面横向溢出为 `0`。
- 移动浏览器：同一 task space 在 390 × 844、DPR 2 捕捉 6 张 `opening` 中间帧与最终日记帧；关键翻动轮廓在移动构图中可辨识，最终控件无重叠，保持 1 个 Canvas，页面横向溢出为 `0`。
- 关闭与恢复：桌面、移动均先关闭到 `desk` 后重新打开；关闭沿相同进度反向恢复，重新打开仍能看到当前浏览器已有日记内容。
- reduced-motion：通过 CDP 模拟 `prefers-reduced-motion: reduce` 并重新载入页面；媒体查询返回 `true`，点击打开后首次 20ms 轮询已为 `editing`，没有可观察的 `opening` 页片阶段，最终仍为同一 DOM 日记。
- HTML 文档：按 `$bun-html-docs` 直接打开 `file:///Users/song/Desktop/dear-desk/docs/architecture/system-overview.html`，1440 × 900 与 390 × 844 均无页面横向溢出。搜索成功/空态、ArrowDown/ArrowUp/Enter/Escape、`/` 聚焦、锚点偏移、活动目录、键盘触发复制、术语 hover/focus/click、移动目录和唯一 `docs-home-navigation` 到 `docs/index.html` 均通过；宽表格和代码块在自身容器内滚动。
- 文档页面为现有 pre-shell 结构，未声明 `data-doc-shell="1"`；本次遵守技能约束保留既有 `docs-reader.js` 行为，没有为小范围事实更新强制迁移外壳。

## 13. 文档同步检查

- 产品文档：已更新 `docs/product/mvp.md` 中本子开合的当前行为和旧/新翻页边界。
- 架构文档：已按 `$bun-html-docs` 更新 `docs/architecture/system-overview.html` 的开场结论、R3F 模型链路、reduced-motion、源码地图和验证证据。
- 决策文档：无需新增 ADR；本次没有改变长期架构、数据所有权、公共接口、依赖或单 Canvas 决策。
- 文档入口：现有 `docs/index.html` 已覆盖变更记录目录与系统概览；唯一文档首页组件跳转验证通过，无需新增入口。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-24 18:12 CST | Codex | 创建待确认方案；记录现有单一进度开本链路、产品文档冲突和 5 页错峰转场建议。 |
| 2026-08-24 18:18 CST | 用户 | 明确回复“批准”，同意按建议体验参数执行。 |
| 2026-08-24 18:18 CST | Codex | 状态更新为实施中，并锁定最终执行清单。 |
| 2026-08-24 18:38 CST | Codex | 完成源码、测试、产品/架构文档、桌面/移动/reduced-motion 与本地 HTML 验证；无实质方案偏差，状态更新为待验收。 |
| 2026-08-24 19:04 CST | 用户 | 明确回复“验收通过，提交”，验收当前结果并授权创建任务提交。 |
| 2026-08-24 19:04 CST | Codex | 核对批准范围与验证结果后，将状态更新为已完成并准备创建同一任务提交。 |
