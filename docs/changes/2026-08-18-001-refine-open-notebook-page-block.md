# DD-20260818-001：修正打开本子的中缝与页芯连续性

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 修复 / 3D 视觉重构 |
| 创建时间 | 2026-08-18 10:18 CST |
| 最后更新 | 2026-08-18 11:45 CST |
| 当前阶段 | 实施、验证与用户提交授权验收完成 |
| 源码基线 | Git `f26f262`；检查时工作区无未提交修改 |
| 实现提交 | 本记录所在提交（以 Git 历史为准） |
| 关联任务 | 用户根据全开近景截图指出中间暗带突兀，并质疑左右表面书页像两块独立结构 |

> 用户已批准最终执行清单，并通过明确提交指令预先验收当前结果。

> 用户于 2026-08-18 10:31 CST 明确要求“暂时隐藏顶层纸面，看看下面的结构”。该次请求作为本记录范围内的开发诊断实施授权；仅影响 development 运行时，不改变 production 行为。

## 1. 给阅读者的结论

用户的两个观察都能在当前源码中找到结构依据。中间并不是一张单独的阴影贴图，而是连续顶页网格用固定参数挖出的纵向凹谷；它沿整条书脊保持几乎相同的宽度和深度，近景受光后形成均匀竖带，缺少真实书页中缝应有的窄暗部、柔和肩部和书头/书尾变化。

最上层纸面在数据上已经是一个跨过中线的连续网格，但它下方仍放着左右两个彼此独立的圆角薄盒页堆。顶层曲面与页堆轮廓没有共享截面或装订根部，所以从侧面和斜视角看，会像“一张薄皮跨在两块板上”。建议让顶层跨页与左右页芯共用同一套装订截面：保留左右半册的真实厚度关系，同时把内侧页根、上表面承托和中缝光影做成连续结构。

## 2. 用户需求

**用户原始要求：**

- 中间疑似阴影的区域不自然、很突兀。
- 从两边看，左右两张表面的书页也不自然，像独立结构。
- 确认底层结构后，删除顶层纸面结构，不再保留。
- 恢复开发环境在本子动画结束后显示二维日记 UI，不再停留在 3D 调试终态。

**Codex 解释：**

- 本任务需要修正全开 3D 本子的近景几何与光影，不以单纯改颜色或降低阴影强度掩盖结构问题。
- “不是独立结构”按视觉和几何连续性理解：顶层跨页、内侧页根与下方页芯应遵循同一装订截面；左右半册仍可作为运动和厚度上的两个页量，不要求把整本书错误地做成一个实心块。
- 附图只作为视觉问题证据，不包含需要执行的文档内指令。

## 3. 当前源码事实

- `src/scene/models/create-notebook-model.ts` 的 `createOpenSpread()` 在全开进度达到 `0.985` 后显示单一 `continuous-open-page-spread`，并隐藏动画阶段的 `left-top-page` 与 `right-top-page`。
- `src/scene/models/geometry.ts` 的 `createContinuousOpenSpreadGeometry()` 用一个索引网格覆盖左右页面，`geometry.userData.continuousAcrossFold = true`；因此截图中的左右顶面不是两张完全分离的顶层网格。
- 同一几何使用 `0.032 * exp(-(distance / 0.12)^2)` 形成固定深度的中央凹谷，并叠加高度 `0.055` 的纸根肩部。凹谷只随横向离中线距离变化，除很弱的书头/书尾抬升外，沿纵向没有自然的装订收放变化。
- `createOpeningLeaf()` 仍分别创建 `left-opening-page-stack` 和 `right-opening-page-stack`。两者都是独立的 `createRoundedPlateGeometry()` 薄盒，内侧也保留普通圆角板轮廓；它们只在全开末段被摆到同一高度，没有与顶层跨页共享顶点、截面或页根曲率。
- `openSpread` 是位于两个页堆上方的第三个结构。它只创建书头和书尾端面，没有创建与左右页芯连续衔接的内侧页口/承托几何；这支持用户所见的“薄表面与两块独立页堆”观感。
- `src/scene/models/model-factories.test.ts` 当前只断言连续顶页存在、独立页缝节点不存在、凹谷深度为 `0.032`、纸根肩高为 `0.055`，以及左右页堆最终同高；没有验证顶页法线连续性、页芯内侧轮廓、斜视角遮挡或中缝宽度渐变。
- `docs/product/mvp.md` 与 `docs/architecture/system-overview.html` 把“单一连续跨页纸面覆盖左右页堆”写为当前事实。源码并未违反这句字面描述，但用户截图证明该实现尚未达到自然连续的视觉结果。
- 本任务不涉及 `DailyEntry`、贴纸、Zustand、IndexedDB 或 DOM 日记页；截图来自 development 中保留的 3D 全开调试终态。

## 4. 目标与非目标

### 4.1 目标

- 完整删除连续顶层纸面节点、几何生成函数、runtime 引用和相关测试断言。
- 让左右页堆及页口层直接作为 3D 全开终态，不再用额外纸面覆盖。
- 移除 development 专用的 3D 全开停留和 DOM 抑制，让开发与生产都在 `editing` 阶段隐藏 3D 本子并显示 `JournalPanel`。
- 保留打开动画的镜像同速、全开居中、闭合连续壳体与当前 3D/DOM 所有权。
- 用自动测试固定旧节点删除、资源预算和 3D/DOM 交接，并用 ego-browser 验证动画后二维 UI 正常出现。

### 4.2 非目标

- 不修改日记正文、贴纸、日期、持久化或 DOM 翻页。
- 不引入纸张动力学、布料/软体物理、外部模型资产或第二个 WebGL Canvas。
- 不重做封面、铭牌、桌子、桌垫、相机交互或整体配色。
- 不用单独的深色网格、贴图色带或屏幕空间假阴影模拟中缝。

## 5. 方案说明

最终方案不再重构或保留顶层跨页：

1. 从模型工厂删除 `continuous-open-page-spread` 的创建、定位、可见性切换、runtime 节点和 destruction group 引用。
2. 从几何模块删除只服务该节点的 `createContinuousOpenSpreadGeometry()`。
3. 保持动画阶段左右顶页现有行为；接近全开后它们退出，左右页堆与页口层直接成为 3D 终态。
4. 删除临时 `hideContinuousOpenSpread` 模型选项，因为节点本身不再存在。
5. 删除 `App.tsx` 的 development DOM 抑制和调试标记；`JournalPanel` 按 `notebookPhase === 'editing'` 挂载，`NotebookObject` 使用默认可见性契约隐藏 3D 本子。
6. 更新测试、产品说明和架构 HTML，明确开发与生产采用相同交接行为。

## 6. 预计改动与影响评估

- `src/scene/models/geometry.ts`：删除只服务顶层跨页的连续网格生成函数。
- `src/scene/models/create-notebook-model.ts`：删除顶层跨页节点、runtime 契约和资源所有权；保留左右页堆及原动画时间轴。
- `src/scene/models/model-types.ts`、`src/scene/NotebookObject.tsx`：删除临时诊断选项；恢复默认模型可见性判断。
- `src/app/App.tsx`：删除 development 调试标记，并在 `editing` 阶段统一挂载 `JournalPanel`。
- `src/app/App.test.tsx`、`src/scene/notebook-transition.test.ts`、`src/scene/models/model-factories.test.ts`：更新 DOM 交接、3D 可见性和旧顶层节点删除断言。
- `docs/product/mvp.md`、`docs/architecture/system-overview.html`：同步最终 3D 终态与 development/production 统一交接事实；HTML 按 `$bun-html-docs` 规范修改。

### 6.1 核心数据结构变化

不改变业务状态、持久化模型、事件或 IndexedDB。内部 `NotebookModelNodes` 删除 `openSpread`，`ModelFactoryOptions` 删除临时 `hideContinuousOpenSpread`；两者只由当前源码和测试使用，没有持久化兼容需求。

### 6.2 上下游与跨模块影响

- 上游 `NotebookObject` 继续只传 `0..1` 展示进度，不需要知道页芯拓扑。
- 中游 `createNotebookModel()` 仍拥有左右 pivot、页堆与资源释放；节点删除不能改变打开/关闭时间轴。
- 下游 renderer、灯光和纸材质继续按现有方式工作；删除一个网格只降低资源量，不改变桌面其他模型。
- development 与 production 统一恢复既有 3D/DOM 交接。
- 资源预算仍受 `45` draw calls、`80,000` triangles 和现有纹理上限约束；优先复用现有材质和网格数量。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 删除顶层纸面后 3D 终态更平 | 左右页堆直接暴露 | 立体感减少 | 这是用户确认后的目标结果；不在本任务擅自新增替代结构 |
| 动画末端出现短暂空档 | 动画顶页隐藏与 DOM 接管之间存在时序差 | 交接闪烁 | 保持原 `0.985` 顶页退出点，ego-browser 实播验证最终 DOM 接管 |
| development 恢复 DOM 后测试仍依赖旧调试标记 | 旧断言未同步 | 自动测试失败或文档冲突 | 删除旧标记、第二参数和断言，全量检索残留引用 |
| HTML 回写破坏既有 shell | 手工改动共享交互 | 搜索或移动目录失效 | 按 `$bun-html-docs` 只改内容，直接打开桌面/移动视口验证 |

回退时恢复连续跨页函数、节点、runtime 引用和对应测试/文档，并恢复 development 调试例外；本任务没有数据迁移或持久化回滚。

## 8. 验证与验收

- 自动测试：旧顶层节点不存在；打开 `0/0.985/1` 与关闭端点；`editing` 隐藏 3D 并挂载 DOM；资源预算和 dispose 回归。
- 构建与静态检查：运行定向 Vitest、全量测试、lint、production build、文档引用检查和 `git diff --check`。
- 浏览器验收：按项目要求使用 `ego-browser`；实际 Dear Desk 服务位于 `http://localhost:5176/studio`（`5175` 被其他应用占用）。桌面和移动端检查完整打开动画后进入 `editing`、显示二维日记且无横向溢出。完成后以 `keep: false` 关闭 task space。
- 持久化与恢复：数据模型不变；回归页面重新打开后既有正文/贴纸仍可进入，重点确认视觉修复没有阻断打开流程。
- 成功标准：源码和 runtime 不再存在连续顶层纸面；开发环境动画结束后与生产一致显示二维日记；桌面和移动端均能进入 `editing`，无调试标记和横向溢出。

## 9. 待确认项与决策

无待确认项。用户已明确选择删除顶层纸面，而不是继续重构或调参；同时要求恢复开发环境二维 UI。`$bun-html-docs` 已从本地技能路径读取，HTML 同步阻塞解除。

## 10. 最终批准方案

用户于 2026-08-18 明确回复“确认了，删掉顶层纸面结构，不需要了，然后之前设置的开发阶段本子动画之后不显示二维 ui，把这个设置改为显示”，批准并调整最终执行清单：

1. 删除连续顶层纸面结构及其专用几何、runtime 节点、资源引用和测试断言。
2. 保留左右页堆、页口层和既有打开/关闭动画；不在本任务内重构底层页芯造型。
3. 删除临时 development 隐藏选项。
4. development 与 production 均在 `editing` 隐藏 3D 本子并挂载 `JournalPanel`。
5. 更新相关测试、产品文档、架构 HTML 和本记录；执行全量 test、lint、build、引用检查、diff 检查与 ego-browser 桌面/移动交接验证。

## 11. 实施记录

已实施临时开发诊断开关：

- `src/scene/models/model-types.ts` 的 `ModelFactoryOptions` 新增可选 `hideContinuousOpenSpread`。
- `src/scene/NotebookObject.tsx` 仅在 `import.meta.env.DEV` 创建本子模型时传入该选项。
- `src/scene/models/create-notebook-model.ts` 保留 `continuous-open-page-spread` 节点和默认生产显示逻辑，但在诊断选项开启时不显示它；左右页堆、页口层、动画和 DOM 交接不变。
- 首次截图发现全开时两张动画阶段 `left-top-page` / `right-top-page` 仍会回显；已将诊断选项扩展为同时隐藏这两张顶页，只保留页堆和页口层，避免把“顶层纸面”误看成已移除。

该开关是临时观察手段，不代表最终产品方案；完成观察后应删除或关闭，并根据截图决定是否实施第 5 节的页芯重构。

用户确认后的最终实施：

- `src/scene/models/geometry.ts` 删除 `createContinuousOpenSpreadGeometry()`。
- `src/scene/models/create-notebook-model.ts` 删除 `createOpenSpread()`、`openSpread` runtime 节点、场景挂载、可见性切换和 destruction group 引用；动画阶段顶页仍在 `spreadProgress >= 0.985` 后退出。
- 临时 `hideContinuousOpenSpread` 选项及传参已删除，最终差异不再包含该诊断开关。
- `src/app/App.tsx` 删除 `data-hold-notebook-open-for-debug`，并在 `notebookPhase === 'editing'` 时挂载 `JournalPanel`。
- `src/scene/NotebookObject.tsx` 恢复默认 `isNotebookModelVisible(notebookPhase)`；`src/scene/notebook-transition.ts` 删除强制保留 3D 的第二参数。
- 三份相关测试同步为旧节点不存在、`editing` 隐藏 3D、开发环境挂载二维日记。
- `docs/product/mvp.md` 与 `docs/architecture/system-overview.html` 已回写最终当前事实；后者按 `$bun-html-docs` 内容契约保留既有 shell 并完成直接打开验证。

方案偏差：用户确认后明确选择“删除顶层纸面”，取代第 5 节最初的共享截面重构建议；本次不修改左右页芯造型。

## 12. 验证结果

已完成 development 结构观察：

- 第一次截图确认仅隐藏连续跨页仍会看到 `left-top-page` / `right-top-page`；因此诊断开关扩展为同时隐藏两类顶层纸面。
- 第二次截图确认底层仍是左右两块浅色圆角页芯板，各自包着绿色页口层；中线只有两块板的圆角边相接，没有连续装订曲面。
- 该结果支持后续按第 5 节重构页芯截面，而不是只调中缝颜色或阴影。

已执行验证：

- `npm test -- --run src/scene/models/model-factories.test.ts`：12 项通过。
- `npm run lint`：通过。
- `npm run build`：通过（局部可见性修正后定向测试与 lint 通过；production 默认仍显示顶层纸面）。
- `node scripts/check-doc-references.mjs`：通过。
- `git diff --check`：通过。
- ego-browser：在 Dear Desk `5176/studio` development 页面完成全开截图；隐藏两类顶层纸面后确认左右独立页芯结构。

最终实现验证：

- `npm run test`：14 个测试文件、62 项测试全部通过。
- `npm run lint`：通过。
- `npm run build`：通过；仅保留既有大 chunk 警告。
- `node scripts/check-doc-references.mjs`：通过。
- `git diff --check`：通过。
- ego-browser 桌面端：动画后进入 `editing`，出现 1 个“双页日记本” dialog 和 1 个 `.journal-book`，旧调试标记不存在。
- ego-browser 移动端 `390 × 844`：动画后进入 `editing`，二维日记出现，`clientWidth === scrollWidth === 390`，无横向溢出。
- 架构 HTML：直接以 `file://` 打开；“顶层纸面”搜索命中更新后的场景模型与验证章节，ArrowDown/Enter 跳转到 `#scene-models`；移动端 `390 × 844` 的 `clientWidth === scrollWidth === 390`，搜索框、移动目录和唯一文档首页入口可见。

## 13. 文档同步检查

- 产品文档：已同步删除顶层纸面和左右页堆直接作为 3D 终态的事实。
- 架构文档：已按 `$bun-html-docs` 同步模型所有权、3D/DOM 交接、源码地图与验证事实。
- 决策文档：预计不变；本任务不新增长期跨任务约束。
- 文档入口：Markdown 任务记录不需要新增入口；架构 HTML 维持现有入口。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-18 10:18 CST | Codex | 根据用户全开近景截图创建待确认方案；只读检查确认中央竖带来自固定折谷截面，顶层虽连续但下方左右页芯仍是独立圆角薄盒。 |
| 2026-08-18 10:31 CST | 用户 / Codex | 用户要求暂时隐藏顶层纸面以观察下方结构；增加仅 development 生效的模型选项，未改变 production 默认显示。 |
| 2026-08-18 11:32 CST | 用户 / Codex | 用户确认删除顶层纸面，并要求恢复开发环境在动画结束后显示二维 UI；最终执行清单获批并开始实施。 |
| 2026-08-18 11:41 CST | Codex | 顶层纸面和 development 调试例外已删除；全量工程检查、桌面/移动 3D→DOM 交接及架构 HTML 双视口验证通过，状态更新为待验收。 |
| 2026-08-18 11:45 CST | 用户 / Codex | 用户明确要求“就当前更改提交”，构成对未超出批准范围且验证通过结果的预先验收；状态更新为已完成并纳入同一提交。 |
