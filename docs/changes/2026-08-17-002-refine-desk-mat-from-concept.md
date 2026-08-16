# DD-20260817-002：按概念图优化桌垫模型

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 重构 |
| 创建时间 | 2026-08-17 01:55 CST |
| 最后更新 | 2026-08-17 04:41 CST |
| 当前阶段 | 用户已授权提交当前更改并推送，按预先验收规则完成 |
| 源码基线 | Git commit `fa32605`；创建记录前工作区干净 |
| 实现提交 | 本次提交 `feat(scene): refine notebook and desk mat models` |
| 关联任务 | 用户要求使用 `img2threejs`，根据 `docs/concept` 下的桌垫概念图建模并优化现有桌垫 |

> 用户于 2026-08-17 明确回复“批准”，接受本文推荐边界。Codex 已开始按最终执行清单实施；若发现会改变范围、主要交互、公共接口、数据结构或架构的新问题，将先回写并暂停相关改动。

## 1. 给阅读者的结论

仓库中没有用户所述的 `docs/concept/`，但存在唯一且与描述对应的桌垫概念图 `docs/assets/concepts/warm-paper-atelier-desk-mat.png`。本文将该路径对应关系作为合理推断；概念图为 `1672 x 941` PNG，主体轮廓、表面、包边、缝线和两张低角度局部图均清晰，适合作为风格化实时 Three.js 桌垫的建模参考。

现有桌垫并非缺少基础部件，而是造型关系仍偏“软 bumper 包围内嵌托盘”：主体、管状包边、浅色内嵌工作场和分段织线都已存在，但概念图表现的是一块连续的薄软垫，上表面与包边之间只有压线和轻微坡面，不应出现明显的凹槽/托盘层级。建议保留当前世界尺寸、贴纸坐标、独立命中面和共享材质所有权，重做可见截面、包边贴合、缝线比例与布面局部响应，并按 `img2threejs` 的锁定阶段重新建立质量证据。

本次结果会是基于单张概念板的程序化风格化近似，不声称获得隐藏底面或制造级尺寸。默认用途沿用当前产品事实：实时浏览器场景中的静态可交互承载道具，而非可卷曲布料模拟或可破坏资产。

## 2. 用户需求

- 用户原始要求：使用 `img2threejs`，根据 `docs/concept` 目录下的桌垫概念图进行建模，优化现有桌垫。
- 路径解释：真实资产位于 `docs/assets/concepts/warm-paper-atelier-desk-mat.png`；仓库不存在 `docs/concept/`。除非用户指出另一张图，本文以该唯一桌垫概念图为上位视觉证据。
- 用途解释：用户未另行指定 hero render、动画或破坏需求，因此采用技能默认值并服从现有产品调用链，目标为实时浏览器 prop，继续承担贴纸放置区域的可见承载面。
- 验收意图：桌垫在正常产品机位中更接近概念图的薄软垫轮廓，在低角度审查中能读出连续布面、贴合包边、内缩压线/缝线、柔和圆角和可信接触阴影。

## 3. 当前源码事实

### 3.1 参考图与既有建模证据

- `img2threejs/forge/stage1_intake/probe_image.py` 对 `docs/assets/concepts/warm-paper-atelier-desk-mat.png` 的技术探测为 `pass`，无警告；图片尺寸为 `1672 x 941`、RGB PNG。
- 语义视觉检查结论为 `pass`：画面只有一个明确桌垫目标，主视角完整展示长宽比和圆角，两个低角度局部图补足前角截面、滚边、缝线和桌面接触关系。隐藏底面仍需保守推断。
- 概念图身份特征是：宽幅圆角矩形、整体偏薄且边缘微隆起、连续暗绿布面、与主体贴合的圆润包边、沿边均匀内缩的同色低对比缝线、细密非均匀织纹，以及压在木桌上的柔和接触阴影。
- `docs/assets/model-reviews/dd-20260810-002/` 已保存旧版 assessment、3x3 detail inventory、strict sculpt spec、逐阶段渲染和 comparison sheet。旧规格最终记录总分 `0.87`，但最终对比只使用孤立顶视图，未把概念图中的两个低角度边缘特写作为独立关键视角；因此该分数不能证明当前边缘截面与接触关系已经匹配。

### 3.2 真实调用链与运行结构

```text
src/main.tsx
  -> App / ProductApp
  -> DeskScene
  -> DeskMat
  -> createModelMaterialLibrary()
  -> createDeskMatModel(materials, { pass })
       -> visible root Group
       -> body / binding / field / stitches
       -> non-visible interactionSurface runtime socket

DeskScene sibling hit mesh
  -> placement intent
  -> sticker bounds / drag plane
  -> persisted StickerInstance coordinates
```

- `src/scene/models/model-specs.ts` 的 `DESK_MAT_MODEL_SPEC` 当前固定宽 `8.7`、深 `6.25`、平面圆角 `0.7`、位置 `[0, 0.055, 0.2]`、顶面世界高度 `0.11` 和 `274` 个缝线实例。
- `src/scene/models/create-desk-mat-model.ts` 用 `createRoundedPlateGeometry()` 创建厚软 `body`，再以 `TubeGeometry` 创建管状 `binding`；较小的 `field` 被放在局部 `y=0.075`，形成明显浅色内嵌工作场；`CapsuleGeometry` 缝线沿 rounded-rect curve 实例化。
- 桌垫 `root.userData.sculptRuntime` 已暴露 nodes、socket、collider 和 destruction groups；可见几何不拥有 pointer event，贴纸事件由外部命中面负责。
- `src/scene/models/material-library.ts` 为 `cloth` family 确定性生成独立 albedo、AO、height 和 roughness 纹理；`cloth` 与 `clothDark` 共用纹理证据但使用不同角色色和粗糙度。当前默认角色色是蓝灰 `matField #73858a` 与深蓝灰 `matBinding #4c5e63`，不是概念图的墨绿；颜色由现有场景调色器临时可改，本任务不把概念图绿色强制写成新的默认主题。
- `src/scene/models/model-factories.test.ts` 已覆盖 runtime anchors、圆角半径、UV1、结构标签、织线实例数、命中面世界高度、collider、贴纸 bounds、构建阶段和资源预算。
- 当前产品文档把桌垫描述为“较深软 bumper、较浅内嵌工作场与暖白分段织线”；若本任务获批实施，该产品事实需要同步为连续软垫表面及低对比内缩缝线。

### 3.3 文档、源码与旧证据的冲突

- 旧 `img2threejs` 规格把 broad silhouette、rolled binding 和 segmented stitches 判为通过，但对比图没有以参考图低角度局部验证包边贴合、截面厚度与桌面接触；这是验证覆盖不足，不是源码损坏。
- 当前源码和产品文档一致地表达 `bumper-well / recessed-work-field`，而概念图更接近连续上表面和边缘包边。本文以可运行源码作为当前事实，以概念图作为预计改动目标，不把目标形态写成已经存在。
- 旧规格中的墨绿材质与当前运行回退 V2 蓝灰角色色不一致。当前产品允许临时调色，且十套候选色均已被用户否决；本任务只优化模型和材质响应，不擅自决定新的默认场景配色。

## 4. 目标与非目标

### 4.1 目标

- 用程序化 Three.js 几何把桌垫从“内嵌托盘”重构为概念图所示的连续薄软垫。
- 让主体截面、贴合包边、内缩缝线和圆角在顶视与低角度视图中均可辨识。
- 调整布面 PBR 的宏观起伏、中频织纹、微频纤维/粗糙度关系，使其在正常产品尺度下不呈现均匀塑料或规则棋盘感。
- 保持 `DESK_MAT_MODEL_SPEC` 的外部世界尺寸、中心、顶面高度、贴纸 bounds、collider、独立命中面和单 Canvas 边界。
- 复用并更新 `img2threejs` 规格，按锁定阶段完成截图、comparison sheet、逐层/逐特征评分和自我修正。
- 增加与视觉变化相称的自动测试，并同步产品当前事实与任务记录。

### 4.2 非目标

- 不改桌子、本子、贴纸外观、相机产品预设、灯光系统或场景默认配色。
- 不新增布料物理、卷曲、折叠、破坏、动画或用户可操作的桌垫变形。
- 不改变贴纸领域模型、Zustand、IndexedDB schema、世界坐标、拖动平面或持久化数据。
- 不引入外部模型、图片纹理包、第二个 WebGL Canvas、新依赖或网络资源。
- 不承诺从单张概念板恢复隐藏底面、真实缝纫工艺或制造级尺寸。

## 5. 方案说明

### 5.1 适用性、对象分类与质量契约

- Suitability：`pass`。一个明确目标、轮廓完整、主要材料和边缘细节可见、可用程序化几何近似。
- Object class：`object`；fabric-like layered shell；static prop；cloth/rubber-like binding；浅层运行时 hierarchy。
- Complexity：`moderate`。宏观轮廓简单，但匹配质量依赖多层截面、沿曲线重复缝线、局部材料频段和三种审查视角。
- Definition of done：主视角长宽比和圆角稳定；低角度下主体厚度、轻微软垫冠部、包边贴合与内缩线迹清晰；没有明显托盘凹槽、悬浮管线、穿插或棋盘织纹；正常产品视图不喧宾夺主；交互与资源契约不变。
- 最小特征：1 个宏观连续垫体；至少 3 个 meso 系统（上表面/底层截面、包边、缝线）；至少 4 个 micro/local feature（布面中频织纹、微频粗糙度、边缘压缩/高光变化、线迹轻微尺度/方向变化）。
- 重复系统：沿同一 rounded-rectangle 基准曲线分布缝线，间距稳定、转角切向连续，实例不得悬空或穿出包边。
- 关键视角：概念图主顶视、左前角低角度、右前边低角度、产品桌面端常用机位、移动端常用机位。
- 阻断条件：任何关键视角出现托盘式凹槽、包边漂浮/断裂、角部切向突变、线迹穿插、顶面高度/贴纸 bounds 改变、总体分低于 `0.85` 或任一 critical feature 低于 `0.82`。

### 5.2 几何策略

1. 以一套共享的 rounded-rectangle 尺寸和基准曲线驱动主体、包边与缝线，消除当前多个硬编码 inset/radius 互相漂移的问题。
2. 把可见主体改成连续的分层软垫截面：底层提供轻微下缘圆弧和桌面接触，顶层只保留很小的 crown/压缩差，不再把较小 `field` 抬高成独立凹槽岛。
3. 包边仍采用曲线扫掠，但截面与主体侧缘有受控重叠，视觉上表现为缝合包边而非悬浮圆管；必要时使用非圆截面 sweep 或顶/侧两层几何，而不是单纯加粗 `TubeGeometry`。
4. 缝线沿包边内侧稳定内缩，缩小暖白对比并降低高度；保留 instancing，在角部使用真实 curve tangent 对齐。线迹可加入确定性的微小长度/旋转变化，但不制造手工瑕疵噪声。
5. 保持隐藏 interaction surface 的世界位置、大小、socket、collider 和 sticker bounds 完全不变；可见 envelope 只能在该交互契约内调整。

### 5.3 材质策略

- 继续使用独立 albedo/AO/height/roughness 通道，不把同一纹理别名到多个 PBR channel。
- 调整 `cloth` 采样的频段和幅度：宏观只做克制的低频明暗，中频建立细密交错织纹，微频通过 height/roughness 提供纤维响应；避免规则网格在远景形成摩尔纹。
- `cloth` 与 `clothDark` 保持角色色可编辑，但允许使用不同 UV scale、bump scale、roughness 和局部边缘响应，使包边比中心布面更压实、更低起伏。
- 缝线材质从高亮暖白收敛为受现有角色色影响的低对比线色，保留足够亮度让线迹在概念图式掠射光下可读；默认配色决策不纳入本任务。
- 若局部 PBR evidence 工具对概念图裁剪的置信度低于 `0.7`，将材质明确记录为风格化等效响应，不把推断写成精确反演事实。

### 5.4 锁定阶段与自我修正

按 `blockout -> structural-pass -> form-refinement -> material-pass -> lighting-pass -> interaction-pass -> optimization-pass` 执行；如当前技能规格包含独立 `surface-pass`，继续保留在 material 与 lighting 之间。每阶段只修改已解锁内容，生成固定视角截图与 comparison sheet，并只选择一个结论：`continue | refine-spec | refine-code | request-input | stop`。

旧规格和 detail inventory 可作为历史证据，但会复制/更新到本任务专属目录，补上当前源码事实、连续软垫目标、三张 reference crop、低角度 critical feature 和当前 `img2threejs` schema；不得直接覆写 `DD-20260810-002` 的历史记录。

## 6. 预计改动与影响评估

| 预计模块 | 预计责任 |
| --- | --- |
| `docs/assets/model-reviews/dd-20260817-002/` | 新 assessment、detail inventory/crops、严格规格、各阶段 render/comparison 与评分证据；保留旧任务资产不动 |
| `src/scene/models/model-specs.ts` | 把主体、包边、线迹的截面/inset/radius 参数变为一个可核对的桌垫规格；外部 width/depth/position/topY 不变 |
| `src/scene/models/geometry.ts` | 若现有 rounded plate/curve 无法表达贴合截面，新增通用的圆角软垫层或非圆截面 sweep helper；不为桌垫复制一次性顶点字符串 |
| `src/scene/models/create-desk-mat-model.ts` | 重构可见层级、截面、包边 attachment、缝线分布和 runtime 元数据；保持 factory 签名与 interaction surface 契约 |
| `src/scene/models/material-library.ts` | 精修 cloth family 的独立 PBR 频段及包边/缝线响应；保持 16 张共享纹理预算和调色接口 |
| `src/scene/models/model-factories.test.ts` | 锁定共享曲线关系、attachment/重叠、无 recessed tray、实例分布、交互边界与资源预算 |
| `docs/product/mvp.md` | 实施后把当前桌垫视觉事实更新为连续薄软垫、贴合包边和低对比内缩缝线 |
| 本任务记录 | 回写批准、实际差异、阶段评分、自动检查、桌面/移动浏览器结果与验收状态 |

不预计修改 `docs/architecture/system-overview.html`：模型工厂所有权、运行时层级、可见/命中面分离、共享材质库与单 Canvas 边界均不改变。若实施中发现必须改变这些架构事实，将先写入本文并暂停，等待重新批准；由于当前可用技能列表不包含项目要求的 `$bun-html-docs`，不得静默修改该 HTML。

### 6.1 核心数据结构变化

- `DESK_MAT_MODEL_SPEC` 预计新增或重命名内部几何参数，例如 surface inset/crown、edge overlap、binding profile 和 stitch distribution；这些是源码内只读建模数据，不进入 store 或持久化。
- `DeskMatModelNodes` 继续暴露 `root/body/binding/field/stitches/interactionSurface`。若连续表面使 `field` 名称失真，优先在兼容字段下映射新的 surface node，避免不必要地扩大内部接口变化；确需更名时同步所有源码消费者和测试。
- `root.userData.sculptRuntime` 继续暴露相同 socket、collider 和外部 interaction surface；destruction groups 只反映可见层级，不新增用户破坏能力。
- `StickerInstance`、Zustand action、repository、IndexedDB schema、场景颜色配置格式和默认值全部不变。

### 6.2 上下游与跨模块影响

- 上游 `DeskScene` 与 `ModelReviewScene` 继续以相同签名调用模型工厂；正常产品入口不增加新 UI。
- 下游贴纸 placement、drag、clamp 和重开恢复继续消费现有世界坐标与 bounds；可见桌垫不接管 pointer event。
- cloth texture family 同时被桌垫可见层使用，需确认没有影响本子专属材质；当前 `notebookCover` 是独立 kraft family，不应随 cloth 改动。
- 材质纹理在 Canvas 生命周期内共享并释放；预计不增加纹理总数，不改变 PMREM、灯光或 renderer。
- 模型阶段审查入口可复用现有 `?review=mat`；如需额外低角度固定视角，只修改开发审查配置，不进入 production 产品交互。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 概念图绿色与当前默认蓝灰混为一个任务 | 同时改模型和默认配色 | 无法判断改善来自形体还是颜色，并违反既有负向配色证据 | 固定同一当前 palette 比较前后模型；新默认色另建任务审批 |
| 顶面 envelope 改变贴纸交互 | 可见几何高度被直接复用为命中面或拖动平面 | 贴纸漂浮、下陷或旧坐标失配 | 锁定 `topY=0.11`、collider、bounds 和独立 hit surface；自动测试加回归断言 |
| 包边 sweep 在圆角处扭转 | frame/tangent 不连续或截面过大 | 角部翻转、穿插、粗细突变 | 共享闭合曲线与稳定 frame；低角度四角抽查，不通过则 `refine-code` |
| 布纹产生摩尔纹或塑料高光 | 频率、bump 或 roughness 幅度不合适 | 远景闪烁、近景规则棋盘、抢夺本子焦点 | 固定产品 DPR/机位检查；降低对比和微频幅度，保留独立通道 |
| 线迹实例过密或对比过高 | 沿用旧 `274` 数量但新 inset/尺寸改变 | 连成实线或显得装饰化 | 以目标世界间距推导数量并测试间距；颜色收敛为低对比 |
| 仅孤立审查通过、产品合成失败 | review route 与真实桌面灯光/相机差异过大 | 在产品里仍显厚重或不协调 | 同时验收孤立三视角和产品桌面/移动视图，任何关键视角失败即修正 |
| 程序化近似无法恢复隐藏结构 | 单张概念板没有底面证据 | 背面/底面只能推断 | 使用最简单连续底层，不声明精确；若用户要求制造级还原则请求更多视图 |

回退方式：本任务不迁移数据；可通过恢复本任务对模型 spec、geometry helper、factory、material sampling 和测试的局部差异回到当前 `fa32605` 行为。历史 assessment/spec 和新审查资产保留为可追溯证据，不需要清理用户数据。

## 8. 验证与验收

- 自动测试：运行 `src/scene/models/model-factories.test.ts`；验证连续表面/无托盘结构、包边 attachment、线迹实例分布、UV/PBR 通道、runtime nodes、interaction surface、collider、贴纸 bounds 和资源预算。
- 构建与静态检查：运行项目现有完整 `npm run check`，并单独记录 lint、Vitest、TypeScript/Vite build、文档引用检查和 `git diff --check` 结果。
- `img2threejs` 规格：运行普通与 `--strict-quality` validation；每个解锁阶段生成 render、comparison sheet、layer scores、critical feature reviews 和唯一 decision，最终状态必须完成且无跳过阶段。
- 浏览器验收：按项目规则使用 `ego-browser`，复用同一 local-development task space；在桌面和移动视口检查正常产品页，并在 `?review=mat` 检查主顶视、左前低角度、右前低角度。保留本地验证 task space 与必要页面。
- 视觉阈值：最终全局 AI-vision score 至少 `0.85`；大圆角薄软轮廓、连续上表面、贴合包边、内缩缝线、布面响应、桌面接触六项 critical feature 均至少 `0.82`。
- 持久化与恢复：本任务不改持久化；仍需用已有自动测试证明贴纸数据契约未变。无需为了模型改动写入或清理 IndexedDB。
- 成功标准：概念图主视与两个低角度特征均通过；产品桌面/移动端无重叠、漂浮、穿插或交互回归；纹理/三角形/draw call 在既有预算内；文档与实际差异一致。

## 9. 待确认项与决策

需要用户确认以下推荐边界：

1. 参考图采用 `docs/assets/concepts/warm-paper-atelier-desk-mat.png`，视为用户所述 `docs/concept` 桌垫图。
2. 本任务只优化桌垫模型、材质响应和审查证据；保持当前默认蓝灰角色色，不把概念图墨绿设为新默认配色。
3. 保持贴纸交互坐标与顶面高度完全兼容，不引入布料动画或可变形交互。

除此之外没有会实质改变范围、公共接口、持久化或架构的待确认项。

## 10. 最终批准方案

用户于 2026-08-17 明确回复“批准”，确认以下决策：参考图使用 `docs/assets/concepts/warm-paper-atelier-desk-mat.png`；本任务只优化桌垫模型、材质响应和审查证据，不改变当前默认角色色；贴纸交互坐标、顶面高度和持久化契约保持兼容，不引入布料动画或可变形交互。

最终执行清单：

1. 在本任务专属资产目录建立更新后的 assessment、detail inventory、strict sculpt spec 和三视角 reference crops。
2. 先重做连续薄软垫 blockout，再逐阶段实现贴合包边、内缩缝线、布面 PBR 和最终优化；每阶段完成截图、自评和门禁。
3. 保持 interaction surface、collider、sticker bounds、world topY、factory 调用签名、单 Canvas 和持久化契约不变。
4. 更新/新增模型工厂自动测试，运行完整工程检查。
5. 使用 `ego-browser` 完成桌面端、移动端和三种桌垫审查视角验证。
6. 同步 `docs/product/mvp.md` 和本文实施事实；仅在架构事实实际变化时暂停并请求允许处理 HTML 文档技能缺口。
7. 完成差异核对后将任务状态更新为“待验收”，不自动提交、推送或创建 PR。

## 11. 实施记录

### 11.1 实际源码改动

- `src/scene/models/model-specs.ts`：把桌垫内部参数整理为 `bodyThickness`、`binding`、`surface`、`stitch` 四组；外部 `8.7 × 6.25` footprint、`position` 与世界 `topY=0.11` 不变。线迹数量由 `274` 收敛为 `244`，表面新增 `bodyTopInset=0.006` 与桌垫专用 UV scale。
- `src/scene/models/create-desk-mat-model.ts`：把 `bumper-well` 重构为 `continuous-pad-with-attached-binding`。底层与连续工作面实体重叠但不再共面，压缩椭圆包边与侧壁受控重叠，线迹沿共享 rounded-rectangle 曲线实例化；隐藏 interaction surface、socket、collider 与 sticker bounds 保持原契约。
- `src/scene/models/geometry.ts`：为 rounded panel/plate helper 增加默认保持 `10` 的可选 `curveSegments` 参数；只有桌垫主体和工作面使用 `48`，消除低角度圆角折面，其他模型默认行为不变。
- `src/scene/models/material-library.ts`：桌垫 cloth 通道改为更密、低对比的程序化织纹，降低 sheen，区分中心布面与压实包边；桌垫专用 bump 分别为 `0.0032` 与 `0.002`，线迹改为低对比蓝灰 `#aab5b4`。仍复用 16 张共享独立 PBR 纹理，不新增纹理或材质所有权。
- `src/scene/ModelReviewScene.tsx`：桌垫新增左右低角度固定审查机位，并抬高顶视相机以完整容纳方形证据截图。该文件中的并行笔记本机位改动属于 `DD-20260817-001`，本任务未回退。
- `src/scene/models/model-factories.test.ts`：新增连续表面、无 tray gap、包边 attachment、底层与工作面高度分离、48 段圆角、线迹数量和既有交互契约断言；共享文件中的笔记本断言属于并行任务。

### 11.2 `img2threejs` 产物与自我修正

- `docs/assets/model-reviews/dd-20260817-002/` 保存 moderate object assessment、3×3 detail inventory、严格 sculpt spec、PBR evidence、逐阶段 render/comparison 和最终三视图；PBR 推断置信度为 `0.761`，高于 `0.7` 门槛。
- 管线已完成 `blockout -> structural-pass -> form-refinement -> material-pass -> surface-pass -> lighting-pass -> interaction-pass -> optimization-pass`，最终状态为 `complete`，最终视觉评分 `0.86`。
- structural-pass 初次低角度截图发现圆角折面，记录 `refine-code` 后将桌垫专用曲线细分从默认 `10` 提升至 `48`，复核为 `0.86 continue`。
- material-pass 初次掠射光发现主体顶面与工作面共面造成阶梯条带，记录 `refine-code` 后加入 `bodyTopInset=0.006`；外部 `topY` 不变，三光照复核为 `0.85 continue`。
- surface-pass 初次评分 `0.80`，低于 critical `0.82` 门槛；降低桌垫 UV 重复密度并提高仅桌垫消费的 bump 响应后，以 `0.83 continue` 通过且未出现摩尔纹。

### 11.3 方案偏差与边界

- 没有采用自定义非圆截面 sweep；压缩 `TubeGeometry` 已能在三视角形成贴合包边，减少了额外 helper 与 draw call。
- PBR evidence 用于判断频段、粗糙度和 bump 参数，不作为运行时图片纹理加载。运行时继续遵守项目的确定性程序化独立通道与固定 16 纹理预算；因此结果是参考驱动的等效材质，不是从单图精确反演的 PBR。
- 没有修改默认蓝灰角色色、持久化、公共调用签名、单 Canvas 边界或架构所有权；无需修改架构 HTML 或 ADR。

## 12. 验证结果

- `npm run check`：通过。ESLint 通过；Vitest `14` 个测试文件、`59` 项测试全部通过；`tsc -b` 与 Vite production build 通过；文档引用检查通过。Vite 仍报告既有的大 chunk 提示，不是本任务新增失败。
- `npx vitest run src/scene/models/model-factories.test.ts`：最终目标测试 `12/12` 通过。
- `python3 .../validate_sculpt_spec.py ... --strict-quality`：`PASS`。
- `python3 .../orchestrate_passes.py status ...`：`currentPass: complete`，八个阶段全部完成。
- `node scripts/check-doc-references.mjs`：`Documentation checks passed.`；`git diff --check`：通过。
- `ego-browser` 任务空间 `70`：桌面产品视口 `1440×900` 与移动产品视口 `390×844` 均通过；移动端 `scrollWidth=clientWidth=390`、`scrollHeight=clientHeight=844`，无水平溢出。桌垫与桌面、本子、UI 无漂浮、穿插或遮挡。
- 最终孤立证据：`renders/final/final-top.png`、`final-left-grazing.png`、`final-right-grazing.png`；产品证据：`product-desktop.png`、`product-mobile.png`。对应 comparison 位于 `comparisons/final/`。
- 一次非验收工具尝试 `npx vite-node -e ...` 因本地未安装且受限网络无法访问 npm registry 而失败；未引入依赖。资源预算仍由实际工程测试中的 `measureModelResources()` 精确断言覆盖。

## 13. 文档同步检查

- 产品文档：已更新 `docs/product/mvp.md`，把旧 `bumper + 内嵌工作场 + 暖白线迹` 当前事实改为连续低薄表面、贴合压缩包边与低对比内缩线迹，并补入 `DD-20260817-002`。
- 架构文档：无需修改；模型工厂所有权、场景数据流、可见/命中面分离和单 Canvas 公共边界均未改变。
- 决策文档：无需修改；未新增长期约束。
- 文档入口：无需修改；本任务优化既有 3D 资产，不新增产品入口或能力。
- 预计改动与实际差异已逐项核对；实际新增的 `curveSegments` 与 `bodyTopInset` 均是为通过已批准视觉门槛所需的局部实现修正，没有扩大范围。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-17 01:55 CST | Codex | 使用 `img2threejs` 完成参考图技术/语义适用性检查、概念图与旧最终对比视觉复核、当前模型/材质/测试/产品/架构/ADR/Git 基线核对，并创建待确认方案。 |
| 2026-08-17 02:04 CST | 用户 | 明确回复“批准”，接受推荐边界和最终执行清单。 |
| 2026-08-17 02:04 CST | Codex | 将任务更新为实施中，开始按 `img2threejs` 锁定阶段建立本任务规格并实施。 |
| 2026-08-17 03:29 CST | Codex | 完成连续薄垫、贴合包边、内缩线迹和程序化布面优化；结构、材质与表面阶段分别按截图证据完成自我修正，八阶段管线最终为 `complete`、评分 `0.86`。 |
| 2026-08-17 03:29 CST | Codex | 完成 59 项全量测试、lint、build、严格规格、文档引用、桌面/移动产品视图与最终三视图验证；产品文档已同步，任务进入待验收。 |
| 2026-08-17 04:41 CST | 用户 / Codex | 用户明确要求提交当前更改并 push，构成预先验收授权；批准范围、必要验证和文档回写均满足要求，任务更新为“已完成”并纳入本次提交。 |
