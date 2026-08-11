# DD-20260810-002：提升概念图对应的 Three.js 模型视觉

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待验收 |
| 类型 | 重构 |
| 创建时间 | 2026-08-10 18:03 CST |
| 最后更新 | 2026-08-11 18:39 CST |
| 当前阶段 | 已完成模型、测试、产品与 HTML 文档同步及双视口浏览器验证；等待用户验收 |
| 源码基线 | Git commit `c7a3660` |
| 实现提交 | `9833d6750ba448bda616b8fec4f1466e8b6b311d` |
| 关联任务 | 优化项目概念图在 Three.js 中的模型质量与视觉效果，使其更接近原概念设计 |

> 用户已于 2026-08-10 21:41 CST 明确批准本文全部推荐决策。Codex 将按最终执行清单直接实施；若发现会改变范围、主要交互、公共接口、数据结构或架构的新问题，再暂停相关改动并请求重新批准。

## 1. 给阅读者的结论

桌子、桌垫和交互本子的程序化重建已经完成。三个 plain Three.js `Group` 工厂使用共享 1024px 程序 PBR 材质，暴露可动作的运行节点、socket 和 collider，并在卸载时显式释放 geometry、material、texture 与 PMREM；现有状态机、贴纸坐标、IndexedDB 数据和单 Canvas 边界保持不变。

三个 `img2threejs` 严格规格均进入 `complete`，最终视觉评分为桌子 `0.86`、桌垫 `0.87`、本子 `0.85`，所有适用 critical feature 均不低于 `0.82`。41 个自动测试、lint、TypeScript/Vite production build、文档引用检查和 `git diff --check` 通过；产品与本地 HTML 文档均完成桌面和移动浏览器验证。

本轮没有修改持久化 schema、repository、领域数据或 MVP 功能范围，也没有新增依赖或第二个 WebGL Canvas。当前实现、产品说明、架构说明、旧任务状态和文档入口已经同步，任务进入待验收。

## 2. 用户需求

用户原始目标：项目中的概念图在 Three.js 中的表达还不够符合概念图效果，需要进一步优化模型质量和视觉效果，使结果往概念图靠拢。

用户允许使用 `img2threejs` 技能还原模型，并指出：概念图未必适合作为直接建模参考；必要时可以先根据概念图生成符合技能工作流的模型参考图，再进行 Three.js 建模。

用户成功标准：最终达到风格化、精细的模型视觉。

Codex 当前解释：优先保持项目已批准的产品范围和交互，不把任务扩展为写实资产管线或外部模型包导入；“接近概念图”需要拆解为可检查的关键特征，并用同视角截图逐阶段比较，不能仅以“更精细”的主观描述验收。

## 3. 当前源码事实

### 3.1 已验证事实

- 工作区基线为 Git commit `c7a3660`，创建本记录前工作树无未提交修改；当前新增差异只有本文档。
- 项目内四张已接受概念参考位于 `docs/assets/concepts/`，均为 `1672 x 941` RGB PNG，并已纳入 Git：
  - `warm-paper-atelier-desk.png`
  - `warm-paper-atelier-desk-mat.png`
  - `warm-paper-atelier-notebook.png`
  - `warm-paper-atelier-journal-pages.png`
- `img2threejs/forge/stage1_intake/probe_image.py` 对四张图的技术探测均为 `pass` 且无警告。语义视觉检查结论：桌子与桌垫为 `pass`；关闭本子单图对关闭状态为 `pass`、对完整交互模型为 `conditional`；打开内页为本子打开态与材质的辅助证据。两张本子图联合后可支持风格化实时模型，但没有直接证明封底、铰接截面和页面运动路径。
- 真实渲染调用链为 `src/main.tsx -> App -> DeskScene -> DeskContents -> DeskBody / 桌垫 / StickerObject[] / NotebookObject`。`notebookPhase === editing` 时，`JournalPanel` 作为 DOM sibling 覆盖在聚焦后的 3D 本子上；Sticker Forge 制作阶段会卸载桌面 Canvas，因此仍只有一个活跃 WebGL Canvas。
- `src/scene/DeskScene.tsx` 的桌面相机与本子聚焦相机分别维护桌面/移动姿态。renderer 使用 `near=0.1`、`far=40`、DPR `[1, 1.5]`、抗锯齿和阴影；贴纸拖动平面固定在 `y=0.11`。
- 当前桌体由一块 `12 x 0.78 x 8` 的桌面、前沿、三只等宽抽屉、三个单层圆柱拉手和四条四边圆柱桌腿组成。概念图则是薄一些的圆角桌面、宽中抽加窄侧抽、独立桌面下抽屉梁、带底座的黄铜把手和向下收窄的桌腿。当前 `CylinderGeometry(0.29, 0.42, ...)` 使桌腿顶部更窄、底部更宽，锥向与参考相反。
- 当前桌垫可见模型是一个纯色圆角盒和四根连续亮色细盒；它没有使用已有的 `clothTexture`，也没有滚边、分段织线或独立命中面。包含可见几何的同一 `group` 直接承担 placement 事件。
- `NotebookObject` 保留稳定根位置 `[-0.65, 0.34, 0.25]`、透明点击盒、封面铰链 `[-1.5, 0.3, 0]`、`0.97pi` 开合、悬停抬升和阶段回调。当前可见模型只有底封、两层平纸芯、单条书脊、矩形书签、平面页线和一块随铰链翻开的封面；打开后没有独立左页堆、对称页缘、中缝谷和页面弧面。
- `RoundedBox` 直接使用 Three.js addon `RoundedBoxGeometry`。该几何把 radius 限制为最短边的一半：桌垫请求 `0.18` 实际约 `0.065`，上封面请求 `0.14` 实际约 `0.065`，`0.018` 厚内衬请求 `0.10` 实际约 `0.009`，名牌请求 `0.06` 实际约 `0.019`。薄片无法表达概念图的大平面圆角。
- `scene-visuals.ts` 只生成 `128 x 128` 的 albedo `CanvasTexture`：木纹为渐变加贝塞尔线，布纹为规则横竖网格；没有独立 roughness、normal/bump、AO、磨光边缘或局部覆盖。木纹只用于桌面，桌腿/抽屉仍是纯色；布纹只用于本子，桌垫仍是纯色。
- 当前灯光为强度 `1.15` 的环境光、一盏暖色投影方向光和一盏冷色方向光；雾范围是 `10..21`，而桌面相机到原点约 `14.3`，主体已经进入雾区间。没有显式环境反射、tone mapping、exposure、接触阴影目标或阴影软度配置。
- 按当前几何参数只读估算，固定场景约 `37` 个 mesh、`14,248` 个三角形，不含用户贴纸。一个 `segments=3` 的微小 `RoundedBox` 也约有 `588` 个三角形；当前重复抽屉拉手、压线和页线没有实例化或几何共享。
- 现有 33 个自动测试覆盖状态、持久化、DOM 交互和转场时序，但没有导入 `DeskScene`、`NotebookObject`、`RoundedBox` 或 `scene-visuals`，因此没有几何比例、动作锚点、材质通道、资源释放、渲染预算和视觉回归证据。
- `DD-20260809-002` 仍处于“实施中/等待截图验收”，其概念资产和源码范围与本任务重叠。为避免两个视觉任务同时拥有同一结果，本文建议在获批时把旧记录标记为“已替代”，由本任务接管后续模型质量与验收。

### 3.2 当前运行行为

- 2026-08-10 使用 `ego-browser` 在 `http://127.0.0.1:5164/` 检查了桌面 `1440 x 900` 和移动 `390 x 844`、DPR 2。两种视口均只有一个 Canvas，且 `scrollWidth === clientWidth`。
- 默认桌面中，桌面顶板和桌垫占据主要画幅，但桌面下抽屉结构与桌腿身份很弱；木纹表现为被拉伸的明暗条带。桌垫接近纯色平板和连续边线。本子仍呈盒体堆叠，名牌、布面圆角、纸芯和书签层次明显弱于概念图。
- 隐藏 DOM 面板后检查 3D 打开态，当前右侧只有一块平纸芯，左侧主要是翻开的封面内衬；没有概念图中的双页页堆、中缝曲面和连贯书签。桌面端 3D 透视与轴对齐 DOM 双页也没有稳定衔接。
- 上述浏览器检查只用于确定当前差距，没有把临时截图写入仓库，也没有操作或写入用户日记/贴纸数据。

### 3.3 合理推断

- 当前最主要的视觉瓶颈是几何选型和结构比例，其次才是材质与灯光；继续提高现有平盒的贴图分辨率无法单独达到目标。
- 桌子与桌垫的现有设计图已足够直接规格化。本子两张图能证明用户会看到的关闭与打开主视图，但统一的正/侧/背/打开状态参考板会降低铰接、页堆和书签路径的推断风险。

## 4. 目标与非目标

### 4.1 目标

- 将桌子、桌垫和交互本子分别建立为可审阅、可动作、可释放的程序化 Three.js 模型，造型、比例、结构层次、关键小件和材质响应接近四张已接受概念图。
- 让关闭本子与打开本子都成立：保留原点击、悬停、铰链和状态机，同时补足左右页堆、中缝、页缘、名牌铆钉和真实书签路径。
- 用适合薄板的平面圆角挤出、实例化重复件和独立 PBR 通道替代当前高成本但低辨识度的薄圆角盒堆叠。
- 校准桌面/聚焦相机、雾、环境反射、主辅光和接触阴影，使模型形体与材质在默认场景和中性审查视图中都能读清。
- 建立可重复的对象级审查入口、同视角对比和结构/预算测试，并通过自动检查、桌面端和移动端浏览器验收证明视觉提升没有破坏产品行为。
- 保持源码、测试、产品说明、架构说明、文档入口和本任务记录一致。

### 4.2 非目标

- 不新增 MVP 范围外的产品功能或交互流程。
- 不以摄影测量、下载模型包或不可追溯的外部成品资产替代项目内的程序化 Three.js 实现。
- 不追求单张概念图无法证明的隐藏面绝对还原；必要时采用与可见风格一致的合理补全，并在记录中标注推断。
- 未经重新批准，不引入第二个 WebGL 画布，不改持久化模型或公共接口。
- 不重做贴纸工作台、日记阅读/书写流程或贴纸视觉；DOM 日记只做保证与 3D 本子衔接所必需的局部 surface/遮罩调整。
- 不引入真实纸张物理、布料模拟、抽屉交互、自由相机、HDR 网络资产、Blender/glTF 管线或新运行依赖。
- 不把四张 `1.6-2.4 MB` 的文档概念 PNG 作为运行时纹理。

## 5. 方案说明

### 5.1 参考输入与对象分类

建立三个独立重建对象：

| 对象 | 主参考 | 辅助参考 | 复杂度 | 运行用途 |
| --- | --- | --- | --- | --- |
| 桌子 | `warm-paper-atelier-desk.png` | 默认桌面构图 | complex | 静态场景主体与桌垫父级 |
| 桌垫 | `warm-paper-atelier-desk-mat.png` | 默认桌面构图 | moderate | 静态可见模型 + 独立贴纸命中面 |
| 本子 | `warm-paper-atelier-notebook.png` | `warm-paper-atelier-journal-pages.png` | complex | 可点击、可悬停、铰接开合的主物件 |

批准后先为本子生成一张中性状态参考板，统一展示关闭正面/侧面/背面、打开约 `180deg`、书脊截面和书签路径。它只补足两张已接受图之间的结构信息，不改颜色、材质或造型母题；若生成图与现有概念图冲突，则拒绝该版本并 `refine-spec`，不让生成图覆盖原始证据。桌子和桌垫不生成额外参考。

随后对三个对象分别执行图像探测、复杂度评分、`component-zones` 或 `grid-3x3` 细节清单、pre-spec assessment、quality contract 和 sculpt spec。桌子、本子至少各映射 10 项微细节，桌垫至少 6 项；每项必须落到真实 `component.localFeatures` 或 `material.localOverrides`，不保留无法进入代码的散文描述。三个规格必须通过普通校验和 `--strict-quality` 后才允许生成代码。

### 5.2 程序化模型边界

使用技能生成的 plain Three.js `Group` 工厂作为每个锁定阶段的起点，再按项目的 React Three Fiber 包装方式手工精修。重建规格是可序列化数据，模型工厂创建 Three.js 运行对象，Zustand 和 IndexedDB 不保存任何 Mesh、Material、Texture 或 Vector。

建议运行时层级：

```text
DeskScene / R3F root
  -> shared material library
  -> createDeskModel(spec)
  -> createDeskMatModel(spec)
  -> independent placement hit surface
  -> createNotebookModel(spec)
       -> root
       -> hitTarget
       -> backCover / rightPageStack / spine
       -> coverHinge
            -> frontCover / leftPageStack
       -> bookmarkRoot
       -> named sockets and collider metadata
```

每个根 `Group` 设置稳定 ID，并在 `root.userData.sculptRuntime` 暴露 nodes、meshes、sockets 和 collider intent。本子封面、左页堆和书签保留独立 pivot；桌腿、抽屉、滚边等子件记录 parent socket、接触类型和允许间隙。现有 `NotebookPhase` 只驱动这些运行节点，不改变状态协议。

### 5.3 几何策略

- 新增可释放的圆角平板几何：以 rounded `Shape + ExtrudeGeometry` 表达桌面、桌垫、封面、纸芯和名牌，使平面圆角独立于薄板厚度；现有 `RoundedBox` 只继续用于适合各向圆角的厚实体。
- 桌子拆成薄圆角桌面、桌面下围板、宽中抽/窄侧抽、内凹抽屉面、正确向下收窄的腿和黄铜拉手。三组拉手共享实例几何与材质；桌腿与围板保持可见接触，不出现悬空。
- 桌垫使用圆角平板主体、沿 rounded rectangle curve 的 `TubeGeometry` 滚边和沿内圈分布的低对比分段织线。可见模型与 placement 命中面分离，命中范围、顶面高度、世界坐标和贴纸拖动平面保持不变。
- 本子使用布壳/板芯两层封面、弧形书脊、右页主堆、随封面铰链展开的左页堆、少量实例化页缘层和轻微预变形页面曲面。打开态补足中缝谷和外缘扇开，不引入纸张动力学。
- 名牌为薄圆角黄铜板加两颗实例化铆钉，移除无参考依据的深色内嵌块。书签使用带 V 形缺口的薄挤出/平面形状，在书脊内有真实重叠，并在关闭和打开状态保持连贯接触。

### 5.4 材质与纹理

用确定性程序生成的独立纹理通道替换单一 `128 x 128` albedo。主要近景材质的质量目标为 `1024px`：

- 胡桃木：独立 albedo、roughness、normal/height 与 AO；桌面、抽屉和腿按局部轴向设置木纹方向，包含宏观色带、木纹中频和细孔微频，并对边缘做克制磨光。
- 苔绿布/皮面：独立色差、织纹 normal、粗糙度和缝边局部覆盖；桌垫与本子可共享母材质证据，但使用不同重复尺度。
- 象牙纸：轻纤维色差、独立 roughness/normal、较暗页缘和中缝 AO；微细节不能妨碍 DOM 文字可读性。
- 旧黄铜：`metalness=1`、中等粗糙度、冠部较亮、边缘磨光和少量氧化局部覆盖；使用环境反射让金属在没有强直射光时仍可辨识。
- 酒红织带：高粗糙度、细纤维 normal、侧边暗部和 V 形尾部，不使用纯色矩形盒。

对木、布、纸和黄铜的关键裁剪运行 reference PBR evidence 提取。置信度低于 `0.7` 时不把结果写入规格：优先细化裁剪或中性辅助参考；仍不足时把材质明确标记为风格化等效响应，不声称从单张概念图精确反演 PBR。

### 5.5 灯光、相机与 DOM 衔接

- 降低会压平形体的环境光和近距离雾；把雾移到主体之后或移除，避免默认相机中的桌面已经被雾混色。
- 保持一盏投影主光，增加非投影 fill/rim 或程序化环境反射，显式设置 ACES tone mapping、exposure、PCF soft shadow 和可控的 shadow camera；不增加第二盏投影灯。
- 桌面相机在桌面端略降低、拉宽，使桌面、抽屉梁与腿的身份可读，同时保留本子和贴纸区域；移动端继续以本子和可用桌垫为优先，不强行展示完整桌腿。
- 聚焦时把本子根姿态和相机校准到更接近顶部视图，使 3D 开页轮廓与轴对齐 DOM 双页衔接。DOM 只允许调整纸面不透明度、裁切和边缘留白，消除 3D 子网格穿透/重影；不改日期、正文、贴纸、翻页和模式控件。

### 5.6 锁定阶段与质量契约

三个对象按 `blockout -> structural-pass -> form-refinement -> material-pass -> lighting-pass -> interaction-pass -> optimization-pass` 执行。每个阶段只修改已解锁层；完成后用固定 review route 捕获命名视角，制作参考/渲染对比图，由视觉检查给出 layer score 和 feature score，并写回 spec `reviewHistory`。

对象级关键特征：

| 对象 | 不得被整体平均掩盖的关键特征 |
| --- | --- |
| 桌子 | 桌面轮廓/厚度；宽中抽+窄侧抽系统；腿的锥向与接触；胡桃木三频响应；黄铜拉手与柔和接触阴影 |
| 桌垫 | 大圆角轮廓/厚度；滚边；分段织线；布/皮触感；稳定放置面与本子接触 |
| 本子 | 关闭轮廓/比例；书脊与开合层级；双页页堆/中缝；名牌铆钉与书签路径；布/纸/黄铜材质关系 |

中间阶段只有整体视觉分数至少 `0.80` 且所有 critical feature 至少 `0.78` 才能 `continue`。最终对象级 reference-match 目标为整体至少 `0.85`、每项 critical feature 至少 `0.82`；这代表强实时程序化匹配，不承诺概念静帧的摄影级 `0.95+`。任一关键特征失败时必须选择 `refine-spec` 或 `refine-code`，不能用高平均分跳过。

## 6. 预计改动与影响评估

| 预计模块 | 预计责任 |
| --- | --- |
| `docs/assets/model-reviews/dd-20260810-002/` | 本子辅助参考板、三对象 assessment/spec、必要裁剪、逐阶段 comparison sheet、最终桌面/移动截图；只保留有审阅价值的证据 |
| `src/scene/models/model-specs.ts` | 运行时需要的可序列化尺寸、层级、组件 ID、socket、材质角色和预算；不包含 Three.js 实例 |
| `src/scene/models/model-types.ts` | `SculptRuntime`、模型 options、material library 和资源释放契约 |
| `src/scene/models/geometry.ts` | 圆角平板、页曲面、V 形书签和复用/实例化几何；集中 dispose 责任 |
| `src/scene/models/material-library.ts` | 确定性独立 PBR 纹理、材质、环境反射和销毁；替代当前单一 albedo 工厂 |
| `src/scene/models/create-desk-model.ts` | 桌体 plain Three.js `Group` 工厂与运行时元数据 |
| `src/scene/models/create-desk-mat-model.ts` | 可见桌垫工厂；不拥有 placement 事件 |
| `src/scene/models/create-notebook-model.ts` | 关闭/打开可见模型、铰链、页堆、书签与 runtime nodes |
| `src/scene/DeskScene.tsx` | 组合三个工厂、独立命中面、环境/灯光、相机、单 Canvas 与 renderer 配置 |
| `src/scene/NotebookObject.tsx` | 保留现有状态/事件包装，改为驱动 notebook factory 暴露的 pivot 与节点 |
| `src/scene/ModelReviewScene.tsx`、`src/app/App.tsx` | 仅开发环境的对象审查入口，支持固定视角/中性/掠射/参考布光；生产正常入口不变 |
| `src/styles.css` | 仅做 3D 开页与 DOM 纸面的必要遮罩、边缘和响应式衔接修正 |
| `src/scene/*.test.ts` | 规格、几何轮廓、attachment、材质通道确定性、runtime anchors、预算和转场契约 |
| `docs/product/mvp.md`、`docs/architecture/system-overview.html`、`docs/index.html`、旧任务记录与本文 | 同步当前视觉事实、源码地图、任务承接、验证结果和状态 |

若技能生成器的 starter factory 与现有 R3F 生命周期不完全匹配，只把它作为当前 pass 的结构基线，再在上述工厂中手工精修；不把未来 pass 内容提前混入，也不让生成器重写 App/store/persistence。

### 6.1 核心数据结构变化

不改变 `DailyEntry`、`StickerDefinition`、`StickerInstance`、Zustand action、repository 接口、IndexedDB schema 或 `NotebookPhase` union。新增内容都是内部场景数据和运行时对象：

```text
serializable ModelSpec
  -> create*Model(spec, materialLibrary)
  -> THREE.Group
     -> userData.sculptRuntime { nodes, meshes, sockets, colliders }

NotebookPhase
  -> NotebookObject wrapper
  -> manipulates runtime cover/page/bookmark pivots
  -> does not persist runtime objects
```

默认值、尺寸、组件 ID 和预算写入只读 spec；材质库和几何只在 Canvas 生命周期中存在并显式释放。开发审查 query 只在 `import.meta.env.DEV` 下生效，不成为产品 API。

### 6.2 上下游与跨模块影响

- `App` 仍在 Sticker Forge 制作阶段卸载 `DeskScene`，审查入口不能绕过单 Canvas 所有权。
- `DeskContents` 改为消费模型工厂，但贴纸仍由 `StickerObject[]` 投影；已有 desk instance 的世界坐标、clamp 和旋转不迁移。
- 桌垫 visible group 与 hit surface 分离后，hit surface 仍发出同一 placement intent；StickerObject 的 `y=0.11` 拖动平面保持不变。
- `NotebookObject` 仍由 `NotebookPhase` 和 `CameraRig` 驱动；调整可见 envelope、相机或根姿态时必须同时核对 `JournalPanel` 对齐。
- PBR 纹理增加 GPU 内存和初始化成本，但不增加网络请求、构建静态大图或依赖；纹理按共享材质库创建一次并在 Canvas 卸载时释放。
- 灯光、tone mapping 与曝光会影响桌面贴纸 PNG 的视觉；贴纸材质保持 `toneMapped={false}`，验收其颜色没有漂移。
- 新开发审查入口只用于截图/统计，不能读取或写入 IndexedDB，也不出现在正常导航和生产 UI。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 本子辅助图生成不一致 | 新参考板改变原图比例、配色、装订或细节 | 错误证据进入模型 | 原四图始终是上位证据；逐视图核对，冲突即 `refine-spec`/重生成，不接受“多数视图看起来合理” |
| 隐藏面仍无法证明 | 封底、铰接截面或桌体背面缺少证据 | 无法保证全角度严格还原 | 只为实际相机与动作需要做一致补全，给组件标注置信度；若关键主视图仍依赖猜测则暂停请求输入 |
| 薄板几何重写影响锚点 | 工厂替换改变本子 envelope、铰链或桌垫顶面 | 点击、动画、DOM 对齐或贴纸坐标回归 | hit surface 与可见模型分离；锁定根、pivot、顶面和坐标契约；结构测试 + 双视口实测 |
| 高分辨率 PBR 增加内存 | 每对象重复创建 1024px 多通道纹理 | 移动端初始化慢、内存或 WebGL context 风险 | 材质库共享、次要材质降级、显式 dispose；记录 textures/memory proxy，出现 context loss 先降低非关键通道分辨率 |
| 细节增加 draw call/三角形 | 每根缝线、页缘、铆钉都成为独立 mesh | 帧率下降、开合卡顿 | InstancedMesh、共享几何/材质、移除无辨识度细条；optimization pass 达预算后才继续 |
| 新灯光改变贴纸颜色 | tone mapping/环境光影响用户 PNG | 已有贴纸与 Forge 输出不一致 | StickerObject 保持 `toneMapped=false`；浏览器检查现有 PNG，不改贴纸资产或持久化 |
| 桌面相机更低影响操作 | 为展示抽屉/桌腿牺牲桌垫面积 | 放置区难用或本子入口被裁切 | 桌面和移动分别校准；命中仍基于世界坐标；主交互可用性优先于完整展示桌腿 |
| DOM 与 3D 打开态重影 | 相机、本子姿态或纸面透明度不一致 | 打开本子出现穿插和双影 | 聚焦视角与根姿态成对调整；DOM 仅做不透明度/clip/边缘局部修正；每个响应式视口检查 |
| 旧任务与新任务双重所有 | `DD-20260809-002` 保持实施中 | 文档状态互相矛盾 | 本任务获批时把旧记录标为已替代并链接本文；入口只显示本任务为当前视觉质量工作 |
| 主观验收标准过宽 | 只以“更精细”判断 | 反复修改且无法收敛 | 锁定 critical feature、分层分数、命名视角和 `refine-spec/refine-code` 决策，不允许平均分掩盖关键失败 |

回退策略：三个对象工厂、共享材质、灯光/相机和 DOM 衔接保持独立文件边界；失败时按当前锁定 pass 回退对应工厂或配置，不迁移/删除用户数据，不清理 IndexedDB。若新工厂无法稳定替代，可恢复旧 JSX visible mesh，同时保留规格、审查证据和测试供下一轮修正。未经用户明确要求不创建提交、推送或 PR。

## 8. 验证与验收

- 自动测试：为三个 serializable spec、圆角平板轮廓/厚度、桌腿/抽屉 attachment、本子 runtime nodes/pivot、桌垫 hit envelope、确定性纹理通道、资源释放和固定场景预算新增测试；保留现有 33 个行为测试全量回归，不用像素快照替代结构契约。
- 分阶段视觉门槛：开发审查入口分别捕获桌子 `front-three-quarter`/`top-integration`，桌垫 `top`/`grazing`，本子 `closed-three-quarter`/`open-top`/`material-close-up`；material pass 还需 `neutral`、`grazing`、`reference-match`。每张 render 与目标参考制作 comparison sheet，并按第 5.6 节门槛记录审查。
- 构建与静态检查：先运行新增场景测试；最终运行 `npm run check`（lint、全部 Vitest、TypeScript + Vite build、文档引用）和 `git diff --check`。如本机临时目录异常，使用 `TMPDIR=/tmp TMP=/tmp TEMP=/tmp npm run check`，并记录真实命令。
- 浏览器桌面验收：使用 `ego-browser` 在 `1440 x 900` 检查默认桌面、本子 hover、approaching/opening/editing、隐藏 DOM 的纯 3D 打开态、DOM 双页衔接、关闭/退回、桌面贴纸点击/拖动、单 Canvas、无横向溢出、控制台无 error/context loss。
- 浏览器移动验收：使用 `390 x 844`、DPR 2 检查主体裁切、桌垫可用范围、本子开合、DOM 对齐、触控入口、UI 不重叠、单 Canvas 和 reduced-motion；按项目规则保留当前 localhost task space 供复核。
- 持久化与恢复：本任务不新增持久化字段，但必须用现有记录/贴纸验证刷新后内容和位置不丢失、不漂移，正常场景能由同一领域状态重建。
- 性能与资源：保持 DPR cap `[1, 1.5]`、一盏投影主光和单 Canvas；固定场景（不含用户贴纸）目标不超过 `45` draw calls、`80,000` triangles、`16` textures，且无 WebGL context loss。若 reference fidelity 与预算冲突，先实例化/共享/删除无辨识度细节，不静默提高预算。
- 文档验收：逐项对照批准清单与真实 Git diff；运行引用检查；使用 `$bun-html-docs` 要求直接打开 `docs/index.html` 和 `docs/architecture/system-overview.html`，在 `1440 x 900` 与 `390 x 844` 验证搜索、导航、Wiki、复制、焦点和无横向溢出，不启动文档预览服务器。
- 成功标准：三个模型具有清晰风格化轮廓、精细结构层次和可读的木/布/纸/黄铜材质；最终对象级总体分数至少 `0.85` 且所有 critical feature 至少 `0.82`；默认桌面和打开本子第一眼属于同一“暖木纸本工坊”，现有交互、贴纸、持久化、响应式和单 Canvas 均无回归。

## 9. 待确认项与决策

本文给出以下推荐决策，用户可一次批准；没有需要先回答的额外问题：

1. **范围**：本轮覆盖桌子、桌垫、3D 本子、共享材质/灯光/相机，以及 3D/DOM 打开态的必要衔接；不重做贴纸工作台和日记功能。建议采用。
2. **参考输入**：桌子和桌垫直接使用现有参考；本子批准后先生成一张统一状态参考板，但原本子/内页概念图始终为上位证据。建议采用。
3. **实现形态**：将 JSX mesh 堆叠迁移为三个 plain Three.js `Group` 工厂，并由现有 R3F 生命周期包装；保留现有状态、命中和持久化边界。建议采用。
4. **质量门槛**：最终总体 `>=0.85`、critical `>=0.82`，同时受 `45` draw calls、`80k` triangles、`16` textures、单投影主光和 DPR cap 约束。建议采用。
5. **任务承接**：批准本文时把 `DD-20260809-002` 标记为“已替代”，其已完成实现与反馈继续作为历史证据，由本文接管未通过的模型视觉验收。建议采用。

## 10. 最终批准方案

用户于 2026-08-10 21:41 CST 回复“批准”，第 9 节五项推荐决策全部通过。最终执行清单为：

1. 将 `DD-20260809-002` 标记为“已替代”，保留其历史实施与反馈，由本文接管模型视觉质量和最终验收。
2. 以现有桌子/桌垫概念图直接建模；先根据关闭本子与打开内页概念图生成一张统一的中性状态参考板，原四图始终为上位证据。
3. 为桌子、桌垫和本子分别建立 assessment、细节清单、quality contract 和 sculpt spec，并通过普通与 strict-quality 校验。
4. 使用 `img2threejs` 锁定阶段生成/精修三个 plain Three.js `Group` 工厂，保持数据、状态、命中、坐标和单 Canvas 边界。
5. 按 blockout、结构、造型、材质、灯光、交互、优化顺序执行；每个阶段捕获命名视角、制作 comparison sheet、评分并记录唯一自校正动作。
6. 最终对象级总体分数达到 `>=0.85`、所有 critical feature 达到 `>=0.82`，并满足 `45` draw calls、`80k` triangles、`16` textures、单投影主光和现有 DPR cap。
7. 完成结构/材质/资源/预算自动测试、`npm run check`、`git diff --check`、桌面/移动/reduced-motion/持久化浏览器验收。
8. 对照真实 Git 差异回写产品、架构、任务记录、旧任务和文档入口；HTML 使用 `$bun-html-docs` 并直接本地打开验证，任务最终只更新到“待验收”。

## 11. 实施记录

实施中。已完成以下实际改动：

- 在 `docs/assets/model-reviews/dd-20260810-002/` 建立本子状态参考板、三对象 assessment/detail inventory/sculpt spec、五类 PBR 证据、各锁定阶段 render/comparison 和最终产品双视口截图。三个 spec 均通过普通与 strict-quality 校验，编排器状态均为 `complete`。
- 新增 `src/scene/models/` 内的可序列化尺寸规格、圆角平板/曲面页/书签几何、共享材质库、场景环境、资源度量与销毁契约，以及桌子、桌垫、本子三个 plain Three.js `Group` 工厂。重复织线、页缘、页线与铆钉使用 `InstancedMesh`；运行根暴露 `sculptRuntime`、socket、collider 和销毁入口。
- `DeskScene` 改为组合三个工厂和独立桌垫命中面，保留贴纸世界坐标与单 Canvas；场景启用 ACES、显式曝光、PCF 阴影、程序化环境反射和主体之外的雾范围，并重新校准桌面/聚焦相机。
- `NotebookObject` 保留原状态协议、hover、开合时序和透明命中盒，改为驱动工厂的封面 pivot、双页页堆与连续书签。浏览器检查发现 DOM 日记打开后有 3D 页块穿出，实际修正为只在 `editing` 阶段隐藏 3D 本子；关闭和所有动画阶段仍显示并恢复模型。
- 新增仅开发环境可用的 `?review=desk|mat|notebook` 对象审查入口及固定视角/灯光/阶段参数；正常生产入口和导航不变，也不读取或写入 IndexedDB。
- 新增工厂结构、薄板圆角、锚点、开合、独立 PBR 通道、资源释放和预算测试；补充 DOM/3D 所有权阶段测试。旧任务 `DD-20260809-002` 已按批准结果标记为“已替代”。

实际方案偏差：桌子和桌垫 spec 在材质与灯光之间增加了技能当前版本支持的 `surface-pass`，用于单独审查粗糙度、凹凸和局部表面响应；没有改变产品范围。`src/styles.css` 最终无需修改，DOM/3D 重影通过场景对象可见性边界解决。运行时仍使用 1024px 程序纹理，PBR 提取证据图为工具默认 256px，仅作为参考推断，不作为运行资产。

## 12. 验证结果

- `python3 .../validate_sculpt_spec.py <spec> --strict-quality`：桌子、桌垫、本子全部 `PASS`；桌垫保留输入风险提示，本子保留未来复杂动画所需 `actionProfile` 提示，均不影响当前开合/交互范围。
- `python3 .../orchestrate_passes.py status <spec>`：三个对象均为 `currentPass: complete`。AI 视觉最终评分为桌子 `0.86`、桌垫 `0.87`、本子 `0.85`；所有适用 critical feature 均 `>= 0.82`。本子打开页冠/页缘扇开为最接近门槛的残余差距，已写入 review history，没有被平均分掩盖。
- PBR 证据置信度：walnut `0.774`、moss cloth `0.761`、book cloth `0.807`、ivory paper `0.829`、aged brass `0.823`，全部高于 `0.7`；报告明确保留单图无法证明真实物理参数的限制。
- `TMPDIR=/tmp TMP=/tmp TEMP=/tmp npm run check`：通过 ESLint、11 个 Vitest 文件共 41 个测试、TypeScript/Vite production build 和文档引用检查。Vite 仅保留已有大 chunk 提示，没有构建错误。
- `git diff --check`：通过。
- `ego-browser` 桌面 `1440 x 900`：验证默认桌面、本子打开、DOM 双页和关闭恢复；单 Canvas，`scrollWidth === clientWidth`。发现并修复 3D 页块穿出 DOM 面板后重新截图通过。
- `ego-browser` 移动 `390 x 844`、DPR 2、`prefers-reduced-motion: reduce`：验证默认桌面、打开日记和关闭恢复；单 Canvas、无横向溢出、控件无重叠，3D 本子在 `editing` 隐藏且关闭后恢复。
- 本任务未改持久化 schema、repository 或领域数据；全量既有持久化测试通过。浏览器验收未创建、移动或删除用户贴纸/日记数据。

## 13. 文档同步检查

- 产品文档：已更新 `docs/product/mvp.md` 的当前视觉和 3D 场景实现事实；未改变产品行为、MVP 或数据概念。
- 架构文档：已使用用户提供路径的 `$bun-html-docs` 更新 `docs/architecture/system-overview.html`，补齐模型工厂、可序列化 spec、`sculptRuntime`、共享 PBR 材质、资源释放、审查入口、renderer 配置、性能预算、源码地图和验证事实。
- 决策文档：当前不新增跨任务长期约束；单 Canvas、scene projection 和 DOM/R3F 所有权继续遵守既有 ADR。若实施中需要改变公共边界，先暂停并重新批准。
- 文档入口：已使用 `$bun-html-docs` 更新 `docs/index.html`，把 `DD-20260809-002` 标记为已替代，将本文列为待验收，并同步当前模型、测试、浏览器验证和源码基线事实。
- HTML 直接文件验收：使用 `ego-browser` 复用 task space `18`，直接打开 `file:///Users/song/Desktop/dear-desk/docs/index.html` 与 `file:///Users/song/Desktop/dear-desk/docs/architecture/system-overview.html`，未启动文档服务。`1440 x 900` 和 `390 x 844` 均无页面级横向溢出；移动表格与长代码在内部滚动。搜索成功/空状态、ArrowUp/ArrowDown/Enter/Escape、锚点偏移与活动目录、移动目录、复制反馈、术语 hover/focus/click 和真实 Tab 焦点轮廓均通过。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-10 18:03 CST | Codex | 创建待确认方案；尚未修改业务源码。 |
| 2026-08-10 18:03-19:23 CST | Codex | 读取 MVP、架构、决策、旧视觉任务和真实源码；探测并视觉检查四张概念图；使用 `ego-browser` 核查桌面/移动默认态与打开态；确认单 Canvas、几何/材质/相机差距和测试缺口。 |
| 2026-08-10 19:23 CST | Codex | 补齐三对象质量契约、plain Three.js 工厂方案、锁定 build passes、性能预算、验证、回退和旧任务承接；状态保持待确认，业务源码未修改。 |
| 2026-08-10 21:41 CST | 用户 | 明确回复“批准”，通过第 9 节全部推荐决策。 |
| 2026-08-10 21:41 CST | Codex | 记录最终执行清单，任务进入实施中；开始执行本子辅助参考、严格规格与分阶段模型重建。 |
| 2026-08-11 17:15-17:37 CST | Codex | 从中断会话恢复；确认已有三对象规格、PBR 证据、模型工厂和阶段截图。严格规格、40 个既有/新增测试与 TypeScript 先行通过；逐张检查 23 份 comparison sheet并补齐 AI 视觉 review history，三个编排器状态更新为 complete。 |
| 2026-08-11 17:20-17:33 CST | Codex | 使用既有 ego-browser task space 验证产品桌面/移动视图；发现 DOM 双页打开后 3D 页块穿出，修正 `editing` 阶段模型可见性并加测试；补充页线双面/深度契约。 |
| 2026-08-11 17:43-17:45 CST | Codex | 全量 `npm run check` 通过，共 41 个测试；保存桌面/移动默认态和日记态最终截图，回写产品与任务 Markdown。因当前技能列表缺少项目强制的 `$bun-html-docs`，暂停 HTML 架构和入口修改，任务保持实施中。 |
| 2026-08-11 17:46 CST | 用户 | 指明 `$bun-html-docs` 可从 `/Users/song/.codex/skills/bun-html-docs/SKILL.md` 读取，解除 HTML 文档同步阻塞。 |
| 2026-08-11 17:46-18:11 CST | Codex | 按 `$bun-html-docs` 内容契约保留共享文档壳，更新系统架构与文档入口；使用 `ego-browser` 直接打开两份 HTML，完成桌面/移动布局、搜索键盘流、目录、锚点、复制、术语与焦点验收。最终再次运行全量 `npm run check` 和 `git diff --check`，均通过；任务进入待验收。 |
| 2026-08-11 18:39 CST | Codex | 按用户提交授权创建实现提交 `9833d67`；任务状态保持待验收。 |
