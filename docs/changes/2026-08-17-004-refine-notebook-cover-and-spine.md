# DD-20260817-004：细化本子封面与书脊

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 修复 / 3D 视觉 |
| 创建时间 | 2026-08-17 10:22 CST |
| 最后更新 | 2026-08-17 12:26 CST |
| 当前阶段 | 用户已授权提交，预先验收条件满足，任务完成 |
| 源码基线 | `2f3edfe79c3c0dc1f565d1d1a12f972b0a5f20a2` (`feat(scene): refine notebook and desk mat models`)；检查时工作树干净，当前分支为 `main` |
| 实现提交 | 本次 `feat(scene): refine notebook binding and tabletop curves` 提交 |
| 关联任务 | 用户要求水平居中金属铭牌、增强书壳纹理、协调 D 型书脊与书壳连接，并删除红色书签 |

> 2026-08-17 10:31 CST：用户明确回复“批准”，同意按本文方案实施。

> 2026-08-17 11:06 CST：用户以近景截图指出书脊与上下书壳连接线仍明显，要求真正成为一块连续书壳；同时要求封面压线四角统一为对称斜切。该反馈属于已批准“一体化书脊”的验收修正，不扩大任务范围。

> 2026-08-17 11:31 CST：用户确认封面暗线四角视觉仍不一致。源码核对发现八段路径虽使用相同切角数值，但 `TubeGeometry` 会沿整条路径重新等距采样，折点不保证成为管线环，因此不能提供严格一致的四个硬切角。继续在原批准范围内改为固定八折点窄框几何。

> 2026-08-17 12:26 CST：用户明确要求分析当前工作区更改并创建提交，构成对最终结果的预先验收授权。Codex 重新运行完整工程检查并确认通过，实施未超出批准范围，因此提交前将状态更新为“已完成”。

## 1. 给阅读者的结论

当前四个问题均已定位到本子程序化模型内部：铭牌使用了偏右的局部坐标；封面虽已有布纹四通道，但纹理尺度、凹凸强度和场景响应不足；D 型书脊是独立胶囊网格，只靠位置重叠贴近封面，没有连续肩部；酒红书签则仍有完整几何、材质与运行时附件链路。

建议把本次工作限制为本子外观的纵向细化：铭牌改为相对封面几何中心水平居中；在不新增纹理资源的前提下提高布面可读性；把独立 D 型书脊改成具有圆背、双肩过渡和封面接合面的连续装帧组件；彻底删除红色书签。日记交互、开合状态机、持久化和单 Canvas 边界不变。

## 2. 用户需求

**用户原始要求：**

1. 金属铭牌应该水平居中。
2. 本子书壳似乎缺少纹理，需要判断并调整纹理或光照。
3. 书脊的 D 型结构与书壳连接不协调；当前是单独 object，需要一体化达到视觉协调。
4. 删除红色书签。

**Codex 解释：** “水平居中”以封面自身短边中心线为基准，不以页芯、书脊或画面中心为基准；根据 11:06 CST 验收反馈，“一体化”必须由同一个可见壳体网格同时承担前封面、圆背和后封面，不能再用三个相邻或重叠 Mesh 伪装连续；该网格允许在开合时按顶点权重弯折。“删除书签”包括所有可见几何和仅为书签存在的运行时、材质与测试事实。封面暗线四角统一使用等长斜切，书壳外轮廓仍保持圆角。

## 3. 当前源码事实

- `src/scene/models/model-specs.ts` 的 `NOTEBOOK_MODEL_SPEC.hardware.platePosition` 为 `[0.36, 0.082, -0.62]`。`createNameplate()` 直接把该坐标作为 `frontCover` 内的局部位置，因此铭牌相对宽 `3.2` 的封面中心线向右偏移 `0.36`。
- `src/scene/models/create-notebook-model.ts` 的 `createCover()` 已给封面外壳生成缩放 UV，并绑定 `materials.notebookCover`。封面并非完全没有纹理。
- `src/scene/models/material-library.ts` 的 `notebookCover` 已使用 cloth family 的独立 albedo、AO、height 与 roughness 四通道，`bumpScale` 为 `0.006`，roughness 为 `0.88`，另有低强度 sheen 与 anisotropy。合理推断是当前大面积 UV 密度、较深底色、弱凹凸和单主光组合降低了织纹可读性，而不是贴图缺失。
- `createSpine()` 当前单独创建 `CapsuleGeometry`，压缩成 D 型圆背后以 `rounded-spine-case` Mesh 加入根节点；`frontCover` 与 `backCover` 分别由 `createCover()` 创建。三者没有共享连续截面或连接肩面，仅通过相邻位置和同类材质形成视觉拼接。
- `createBookJoints()` 另以两条实例化胶囊表达书槽，但它们不能填补 D 型书脊与封面板之间的轮廓和曲率断层。
- `createBookmark()` 当前创建 32 段连续酒红带状几何，`setOpenProgress()` 会在闭合与打开端态重算顶点。根运行时还发布 `ribbonAnchor` socket、attachment binding 和 `binding` destruction group 成员。
- `ModelMaterialLibrary` 暴露 `ribbon` 材质；`createModelMaterialLibrary()` 始终创建该材质，即使其他模型不使用它。
- `src/scene/models/model-factories.test.ts` 当前断言铭牌/铆钉、连续书签、材质通道、运行时 socket、资源数量和开合端态。删除书签后这些断言必须同步修改，不能只把 Mesh 隐藏。
- `docs/product/mvp.md` 和 `docs/architecture/system-overview.html` 都把酒红书签写成当前事实；实施后若不回写会与源码冲突。
- `DD-ADR-20260806-002` 要求 Three.js 只是视觉投影。本次仅改变运行时模型几何与材质，不触及 Zustand、IndexedDB 或领域数据。

## 4. 目标与非目标

### 4.1 目标

- 将黄铜铭牌相对前封面短边几何中心水平居中，同时保留当前纵向位置、尺寸、倒角和两颗铆钉。
- 让墨绿色书壳在产品近景和对象审查近景中可辨认出细密布纹，同时避免变成夸张的绒面、塑料或规则棋盘纹。
- 用连续圆背、过渡肩和接合面组成新的装帧组件，消除独立 D 型书脊贴在封面旁的割裂感，并保持前封面正常开合。
- 删除红色书签的几何、规格、材质、socket、attachment、动画更新和相关文档事实。
- 保持当前模型尺寸、根位置、命中区、页芯、铭牌铆钉、开合进度契约和资源预算。

### 4.2 非目标

- 不改变本子整体 `5:3` 比例、封面主色、铭牌纵向位置或铭牌文案；铭牌继续无文字。
- 不重做页芯、快速翻页、DOM 日记、贴纸、相机路线、桌子或桌垫。
- 不引入外部贴图、第二套布纹 family、额外 WebGL Canvas 或新的灯光系统。
- 不把单一拓扑做成无法绕铰链转动的刚体；壳体以局部顶点权重兼顾拓扑连续和现有开合结构。
- 不创建提交、推送或 PR，除非用户后续明确要求。

## 5. 方案说明

1. **铭牌定位：** 把铭牌的横向规格改为 `x = 0`，并增加基于封面宽度与铭牌包围盒的居中断言。纵向高度和 `z` 位置不变，避免同时改变视觉层级。
2. **书壳纹理：** 先在现有 cloth family 内调整封面专属 UV 密度、bump/roughness/AO 响应和必要的材质参数，不新增纹理。优先让织纹通过微表面明暗可见，而不是通过大幅颜色噪声伪造。对象审查近景与真实产品灯光都需验证，避免只在 review 场景有效。
3. **装帧一体化：** 根据验收修正，用一个闭合 BufferGeometry 同时生成前封面、圆背和后封面，不再保留三个可见外壳 Mesh。网格保存闭合顶点；前封面为权重 1，圆背活动肩从 0 到 1 平滑过渡，固定后壳为 0。`setOpenProgress()` 按原 `coverPivot` 变换加权更新顶点，铭牌和暗线继续由 pivot 刚性带动。闭合态无重叠接缝，打开态不以拉长条面遮挡页沟。
4. **暗线四角：** 本子专用窄框由外、内两组各八个固定顶点组成，四角使用相同切角长度并逐段连接；不再通过 `TubeGeometry` 重采样折线路径，也不修改桌垫等模型共用的圆角曲线助手。
5. **删除书签：** 删除 `createBookmark()`、`NOTEBOOK_MODEL_SPEC.ribbon`、`ribbon`/`ribbonAnchor` 节点、运行时 attachment/socket、动画更新和材质库中的 ribbon 材质。同步清理产品与架构文档中的当前事实，保留日记 DOM 所有权不变。

## 6. 预计改动与影响评估

| 路径 | 预计责任 |
| --- | --- |
| `src/scene/models/model-specs.ts` | 铭牌横向归中；增加装帧肩部/桥接尺寸；删除书签规格 |
| `src/scene/models/create-notebook-model.ts` | 重建圆背与封面连接结构；调整封面 UV；删除书签节点和动画链路 |
| `src/scene/models/geometry.ts` | 如现有几何助手无法表达连续截面，增加一个可复用的装帧截面/桥接几何助手 |
| `src/scene/models/material-library.ts` | 调整书壳专属微表面响应；删除未再使用的书签材质 |
| `src/scene/models/model-types.ts` | 预计不变；只有运行时类型显式要求 attachment 键时才做兼容清理 |
| `src/scene/models/model-factories.test.ts` | 覆盖铭牌居中、装帧连续性、开合净空、无书签资源、材质通道与预算 |
| `docs/product/mvp.md` | 删除酒红书签当前事实，回写新的连续装帧和布面表现 |
| `docs/architecture/system-overview.html` | 仅做现有段落的事实同步：删除书签链路，更新本子装帧组件说明；不改页面结构、样式或交互 |
| 本记录 | 写回真实差异、验证结果、文档同步与方案偏差 |

### 6.1 核心数据结构变化

- `NOTEBOOK_MODEL_SPEC.hardware.platePosition[0]` 从 `0.36` 改为 `0`；其余铭牌与铆钉规格不变。
- `NOTEBOOK_MODEL_SPEC.spine` 预计增加 shoulder width、bridge inset、joint gap 或等价的确定性几何常量；这些值仅属于源码版本，不进入持久化。
- 删除 `NOTEBOOK_MODEL_SPEC.ribbon`。
- `NotebookModelNodes` 删除 `ribbon` 与 `ribbonAnchor`；`spineCase` 可保留稳定节点名或改为指向新的装帧主 Mesh/Group，以减少测试与审查工具的无意义破坏。
- `ModelMaterialLibrary` 删除 `ribbon`。共享 16 张 wood/cloth/kraft/paper 程序纹理不变，材质对象总数减少一个。
- `root.userData.setOpenProgress(value, animateRapidPages)`、`getOpenProgress()`、`openAngle`、collider、cover/page pivots 和业务状态完全不变。

### 6.2 上下游与跨模块影响

- 上游 `NotebookObject` 继续只驱动开合进度，不感知铭牌、布纹、书脊或书签删除。
- 下游 `JournalPanel` 不使用 3D 书签，不受删除影响。
- `ModelReviewScene` 继续提供 notebook closed/material/open 视角；预计不需要新入口。
- 材质库仍由 `DeskScene` 创建一次并由桌子、桌垫、本子共享；删除 ribbon 不会改变四组程序纹理及其释放职责。
- 新装帧组件必须计入现有 draw call、triangle 与 texture 限额；若桥接面增加网格，应通过共享材质和合并固定部件抵消不必要 draw call。
- 产品行为没有持久化变化，因此无需数据库迁移或恢复策略。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 布纹被过度放大 | 只提高 bump 或 UV repeat，没有在产品镜头检查 | 封面像编织桌垫或粗麻袋 | 同时检查对象材质近景与产品近景；以微表面可读、轮廓不抖动为上限，回退单项参数 |
| 纹理仍被光照吃掉 | 只改贴图，不验证主场景入射角 | review 中可见、产品中仍平 | 在现有单主光和环境反射下调材质响应；若仍不足，只在批准范围内微调封面材质，不改全局灯光 |
| 一体化结构妨碍开盖 | 固定肩部侵入前封面旋转扫掠区 | 打开时穿模或出现裂缝 | 采样多个开合进度测包围盒/可视净空；活动侧保留窄装订沟，不把运动部件焊死 |
| 连续几何增加资源 | 截面分段过多或拆成多 Mesh | 超出 draw call/triangle 预算 | 固定装帧部件尽量使用一个共享材质 Mesh；降低不可见截面分段，保留当前预算门槛 |
| 删除书签留下悬空契约 | 仅移除可见 Mesh | runtime、测试或文档仍宣称有 attachment | 从 spec、nodes、socket、attachment、destruction group、材质、测试和文档逐项搜索清理 |
| 铭牌视觉中心与数学中心不一致 | 书脊使封面可见面积看起来偏移 | 数学居中后仍有主观偏差 | 本次以封面几何中心为唯一基准；若用户后续要求光学居中，作为同记录补充决策再调整 |

回退不涉及业务数据：可单独恢复铭牌横坐标、旧 `createSpine()`、封面材质参数或书签链路。若一体化结构无法在现有开合扫掠区内达到稳定端态，将保留记录与失败证据，不以遮挡物掩盖结构问题。

## 8. 验证与验收

- 自动测试：运行 `src/scene/models/model-factories.test.ts` 与 `src/scene/notebook-transition.test.ts`；新增铭牌中心误差、装帧组件父子关系/包围盒接合、关键开合进度净空、书签节点与 attachment 不存在、材质通道和资源预算断言。
- 构建与静态检查：运行 `npm run lint`、`npm run test`、`npm run build`、`node scripts/check-doc-references.mjs` 与 `git diff --check`。
- 浏览器验收：按项目规则使用 `ego-browser` 并复用本任务的 localhost task space；验证桌面 `1440 x 900`、移动 `390 x 844`，以及 notebook 对象审查的 closed/material/open 视角。检查铭牌居中、布纹可读、圆背肩部连续、开合无穿模、书签完全消失。
- 持久化与恢复：本任务不改变持久化；做页面重开 smoke test，确认日记入口和既有内容恢复不受模型资源清理影响。
- 成功标准：铭牌数学中心与封面中心重合；正常产品近景能读到细密布纹但无夸张噪声；圆背到封面有连续肩部、无悬浮拼贴感；所有闭合/打开画面都没有红色书签；必要检查与桌面/移动验收通过。

## 9. 待确认项与决策

没有需要额外选择的待确认项。建议按第 5 节方案执行：铭牌采用封面几何中心；书壳优先调整现有 cloth UV 与材质响应，不动全局灯光；书脊采用连续装帧肩部并保留活动封面装订沟；书签彻底删除而非隐藏。

## 10. 最终批准方案

用户于 2026-08-17 10:31 CST 明确回复“批准”。最终执行清单为：

1. 将黄铜铭牌以封面自身短边几何中心为基准水平居中，保留尺寸、纵向位置、倒角和两颗铆钉。
2. 复用现有 cloth 四通道程序纹理，仅调整本子封面的 UV 密度与专属微表面响应，不新增纹理或改全局灯光。
3. 以带圆背、固定肩部和活动侧装订沟的连续装帧组件替代孤立 D 型书脊，保持 `coverPivot` 与外部开合契约不变。
4. 彻底删除书签的规格、几何、材质、动画更新、节点、socket、attachment、测试和文档事实。
5. 完成定向测试、全量检查、文档引用检查、桌面/移动与对象审查视觉验收，并将实际结果回写本记录。

## 11. 实施记录

已按批准范围完成：

- `model-specs.ts` 将铭牌局部 `x` 从 `0.36` 改为 `0`，删除 `ribbon` 规格，保留单壳体所需的 `innerInset`、`shoulderOffset` 与加宽圆背规格；验收修正后删除仅供三网格重叠方案使用的 `bridgeOverlap`、`frontLipOverlap`。
- `create-notebook-model.ts` 新增按封面宽深归一化的平面 UV 投影，使 `1.15 x 1.9` 表示真实纹理重复而不是乘在 ExtrudeGeometry 的世界尺寸 UV 上；封面继续复用 cloth albedo/AO/height/roughness 四通道。
- 首次实现虽把独立 `CapsuleGeometry` 改成 C 型书脊截面，但前后封面仍是独立圆角板，实际保持三个重叠网格，用户截图确认连接线明显。验收修正后以 `continuous-case-shell` 单一网格替换三者：闭合横截面同时包含前封面、连续圆背和后封面，沿深度 96 段采样以保留书壳圆角；活动封面和圆背上半肩使用 `0..1` 连续弯折权重，固定后壳与圆背下半区保持不动。
- 首次单网格开合只移动封面端点，打开俯视会把最后一段肩部拉成绿色竖条。最终实现改用连续权重平滑弯折，浏览器复核确认页沟不再被绿色条遮挡，仅保留圆背包布在书口上下端的短收边。
- 封面暗线最终改用外、内两组各八个固定顶点组成的窄框面，16 个顶点和 48 个索引逐段构成四条直边与四条斜边；不再使用 `TubeGeometry` 沿路径重采样。四条外侧斜边长度由自动测试逐一比较到 6 位精度；共享 `createRoundedRectCurve()` 未修改，避免影响桌垫。
- `material-library.ts` 保持共享纹理数量不变，只提高本子专属 cloth AO、bump、anisotropy 与 sheen 响应。浏览器像素检查确认纹理缺失感来自 UV 与材质响应，不需要修改全局灯光。
- 删除 `createBookmark()`、`createRibbonGeometry()`、ribbon 材质、模型节点、socket、attachment binding、逐帧顶点更新和 destruction group 成员；闭合、打开与产品场景均不再渲染红色书签。
- `model-factories.test.ts` 同步断言铭牌居中、归一化 UV、唯一 `continuous-case-shell`、`spineCase` 别名、固定/活动顶点开合与复位、四角对称斜切、无书签节点/附件、材质参数、开合端态、释放和资源预算。
- 实施期间另一个任务并发新增 `DD-20260817-005`、`DESK_MODEL_SPEC.tabletop.curveSegments`、`create-desk-model.ts` 调用参数及对应测试断言。这些不是本任务改动，已保留且未纳入上述实施事实。

最终实现相对 10:31 的初版批准方案有一项由用户验收反馈明确要求的实现收紧：从“连续装帧组件贴合独立封面”提升为“一个可形变网格同时承担前封面、圆背和后封面”。该修正没有改变产品范围、持久化、公共业务接口或单 Canvas 边界；`spineCase` 继续作为兼容别名指向唯一壳体节点。其余局部修正包括追查并修复 ExtrudeGeometry 世界尺寸 UV 的真实根因，以及用圆背肩部连续权重消除打开时的拉伸条面。

## 12. 验证结果

- `npm test -- --run src/scene/models/model-factories.test.ts src/scene/notebook-transition.test.ts`：通过，2 个测试文件共 18 项测试。
- `npm run check`：通过；ESLint、14 个测试文件共 59 项测试、TypeScript/Vite production build 和文档引用检查全部成功。构建仅保留既有大 chunk 警告，无新增错误。
- `git diff --check`：通过。
- 书签残留搜索：业务源码中只保留“应不存在”的负向测试；产品与架构当前事实不再宣称存在书签，旧变更记录作为历史证据保留。
- ego-browser 对象审查：`1440 x 900` 下在最终 96 段深度采样几何上重新验证 closed three-quarter、material close-up 与 open top。闭合视图不再出现独立封面板与书脊的重叠连接线；四角暗线均为相同斜切，书壳外轮廓仍为圆角；铭牌水平居中，细密织纹可读，无红色书签。打开视图中连续权重肩部没有形成绿色竖条，页沟保持完整可见。
- 11:31 CST 暗线复核：用固定 16 顶点窄框替代 TubeGeometry 后，再次在 `1440 x 900` closed three-quarter 与 material close-up 检查；四个硬折角均清晰，未再出现短弧、钝角或折点错位，平面窄框没有反面剔除或闪烁。
- ego-browser 产品验收：`1440 x 900` 桌面与 `390 x 844` 移动端均非空、无横向溢出，铭牌、装帧和书签删除结果可见；Canvas 尺寸分别为 `1440 x 900` 与 `390 x 844`。
- 交互与恢复 smoke test：桌面点击“打开本子”后完成空间转场并挂载“关闭本子”的 DOM 双页日记；点击关闭后回到桌面且打开入口恢复。随后以 `390 x 844` 重新打开产品页，确认页面重开仍为桌面、打开入口存在、Canvas 铺满视口且无横向溢出。任务不写持久化数据，既有空白今日页正常读取。
- 本地开发 task space 为 ego-browser `71`，按本项目规则保留供用户继续验收；仅保留当前本地应用页。

## 13. 文档同步检查

- 产品文档：已同步 `docs/product/mvp.md`，记录细密布纹、连续装帧、居中铭牌和无书签当前事实。
- 架构文档：已对 `docs/architecture/system-overview.html` 做有限事实同步，明确单一 `continuous-case-shell` 的顶点权重、开合法线/包围体更新和兼容 pivot 所有权，并删除书签调用链；未改变 HTML 结构、样式或交互。
- 决策文档：不变；未改变持久化、DOM/R3F 所有权或单 Canvas 长期边界。
- 文档入口：不变；没有新增入口类别或需要置顶的长期文档。
- 引用检查：`node scripts/check-doc-references.mjs` 已随 `npm run check` 通过。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-17 10:22 CST | Codex | 创建待确认方案；完成源码、产品文档、架构事实、ADR、测试和 Git 基线只读核对。 |
| 2026-08-17 10:31 CST | 用户 / Codex | 用户明确批准；记录最终执行清单并进入实施。 |
| 2026-08-17 10:55 CST | Codex | 完成源码、测试、产品/架构事实回写、全量检查及桌面/移动浏览器验收；状态更新为待验收。 |
| 2026-08-17 11:06 CST | 用户 / Codex | 用户验收截图确认三网格连接仍可见，结果未满足“一块连续书壳”；继续实施单网格外壳与四角对称斜切压线。 |
| 2026-08-17 11:23 CST | Codex | 完成单网格可形变壳体、圆背肩部连续权重、四角统一斜切、自动检查及最终桌面/移动和开合浏览器复核；状态恢复为待验收。 |
| 2026-08-17 11:31 CST | 用户 / Codex | 用户确认暗线四角仍不一致；定位为 TubeGeometry 路径重采样未严格保留折点，继续改为固定八折点窄框面。 |
| 2026-08-17 11:36 CST | Codex | 完成固定 16 顶点窄框、四条斜边等长断言、全量检查与闭合/材质近景复核；状态恢复为待验收。 |
| 2026-08-17 12:26 CST | 用户 / Codex | 用户明确要求提交；Codex 复核当前差异并重新运行 `npm run check`，全部通过。预先验收条件满足，状态更新为已完成并纳入同一提交。 |
