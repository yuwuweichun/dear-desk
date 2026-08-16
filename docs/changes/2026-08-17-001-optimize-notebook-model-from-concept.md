# DD-20260817-001：按概念图优化本子模型

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 重构 / 3D 视觉 |
| 创建时间 | 2026-08-17 01:52 CST |
| 最后更新 | 2026-08-17 04:41 CST |
| 当前阶段 | 用户已授权提交当前更改并推送，按预先验收规则完成 |
| 源码基线 | `fa326057c67f578bbc9443ab2c47e37131025d3d` (`Merge pull request #2 from yuwuweichun/main`)；检查时工作树干净 |
| 实现提交 | 本次提交 `feat(scene): refine notebook and desk mat models` |
| 关联任务 | 用户要求使用 `$img2threejs`，根据 concept 目录中的本子概念图建模并优化现有本子模型 |

> 2026-08-17 01:56 CST：用户明确回复“批准”，批准恢复概念图中的空白黄铜铭牌、两颗圆顶铆钉和酒红书签，并按本文执行。

## 1. 给阅读者的结论

本任务已经按 `$img2threejs` 八阶段质量门槛完成程序化重建。当前本子为 `5:3` 墨绿色布面软壳，具有包边缝线、圆背书脊、内缩页芯、12 层纸口、空白黄铜铭牌、两颗圆顶铆钉和连续酒红 V 口书签；打开末段形成独立左右页堆、弧形顶页与窄页沟。

日记状态机、DOM 编辑页、持久化、单 Canvas 边界和外部 `setOpenProgress()` 契约均未改变。最终 `$img2threejs` 评审分数为 `0.85` 至 `0.88`，固定场景资源为 45 个总 draw calls、42,174 个三角形与 12 个实际纹理引用，完整项目检查和桌面/移动产品流程均通过，当前等待用户验收。

## 2. 用户需求

**用户原始要求：** “根据concept目录下的本子的概念图，进行建模，优化现有的本子模型”，并显式指定 `$img2threejs`。

**路径解释：** 仓库中实际概念图目录为 `docs/assets/concepts/`。本任务以 `warm-paper-atelier-notebook.png` 为闭合态权威参考，以 `warm-paper-atelier-journal-pages.png` 为打开态纸页、页沟和书签结构的补充参考。

**Codex 解释：** 默认用途为实时浏览器主场景中的可交互道具；优化重点是与概念图的结构和材质相似度，同时保留当前本子打开、快速翻页、隐藏并切入 DOM 日记的产品调用链。

## 3. 当前源码事实

> 本节记录方案批准时用于判断差距的源码基线；实施后的当前事实见第 11 至 13 节与 `docs/product/mvp.md`。

- `src/scene/NotebookObject.tsx` 创建 `createNotebookModel(materials, { pass: 'optimization-pass' })`，用 `setOpenProgress(progress, animateRapidPages)` 驱动开合；点击命中、hover 抬升、移动端摆位和 `NotebookPhase` 均在该包装层。
- `src/scene/models/create-notebook-model.ts` 当前由 `backCover`、`frontCover`、`textBlock`、`spineCase`、两条 `bookJoints` 和 5 张快速翻页片组成。封面、页芯和书脊均以薄圆角板为主。
- `setOpenProgress()` 当前始终保留闭合 `textBlock`，普通开合时不显示 `leftPages` / `rightPages`；快速翻页结束后模型很快进入 `editing` 并由 `isNotebookModelVisible()` 隐藏。
- `src/scene/models/model-specs.ts` 把封面宽度固定为 `3.2`、深度固定为 `5:3` 竖向比例，并定义封面/页面铰链、打开角度和根位置。
- `root.userData.sculptRuntime` 已暴露 `cover-hinge`、`page-gutter`、命中 collider、destruction groups 和稳定节点；`model-factories.test.ts` 对节点父子关系、端态、快速翻页和资源预算有自动断言。
- `notebookPhase === 'editing'` 时，`JournalPanel` 作为 DOM 交互面接管正文、翻页和日记贴纸；Three.js 只负责进入编辑前的空间投影。该所有权边界受 `DD-ADR-20260806-002` 约束。
- `DD-20260812-003` 曾基于当时“本子与桌子风格对齐”的要求删除黄铜铭牌、圆钉和书签；本次“按概念图建模”的新要求与该视觉选择冲突。若本方案获批，将明确以本任务替代这些装饰的删除结论，但不恢复封面文字或持久化设置。
- 现有 `DD-20260810-002` 已保存 notebook assessment、20 项细节清单、sculpt spec、PBR 证据和历史渲染，可作为证据复用；由于源码后来多次重写，本任务必须创建独立的新流水线状态并重新完成所有截图门槛，不能继承旧通过结果。
- 两张参考图均为 `1672 × 941` PNG，技术探测通过。语义适配性结论为 **pass**：主体清楚、闭合与打开两种状态互补、主要材质可见、隐藏背面可按一致装帧合理推断；不能从单张闭合图获得制造级尺寸或真实背面细节。

## 4. 目标与非目标

### 4.1 目标

- 保持当前占地、根位置、点击范围和 `5:3` 竖向比例，重建接近参考图的闭合书体轮廓。
- 建立封面软包边、连续圆润书脊、双肩压槽、封面内缩页芯和三侧页口层次。
- 恢复概念图明确显示的空白黄铜铭牌、两颗圆顶铆钉和酒红色 V 口书签；不添加任何文字。
- 改进打开转场末段的左右页堆、页冠弧面、中心页沟和书签路径，使从 WebGL 到 DOM 日记的切换不再经过“封面打开但页芯仍闭合”的结构矛盾。
- 使用独立的布、纸面、纸口、黄铜和书签 PBR 通道，保持纹理和程序噪声可复现。
- 保留 action-ready hierarchy、稳定 pivots/sockets/collider/destruction groups，并继续满足固定资源预算。

### 4.2 非目标

- 不做逐页物理、布料模拟、书脊有限元或制造级复原。
- 不改变 `NotebookPhase`、日记 DOM 布局、正文/贴纸数据、IndexedDB schema、相机预设或桌子/桌垫模型。
- 不把 DOM 日记内容绘制到 WebGL，不增加第二个 Canvas。
- 不恢复可编辑封面标题、logo 或旧 `notebookCoverSettings` 产品入口。
- 不承诺参考图未显示的背面与内部装订工艺完全准确；背面只作同材质、无铭牌的一致性推断。

## 5. 方案说明

按 `$img2threejs` 采用锁定分阶段流程，不直接一次性堆细节：

1. **重新建档与质量契约**：从两张权威参考重新生成 pre-spec assessment、detail inventory 与 notebook sculpt spec；复杂度定为 `complex`，要求至少 3 个 macro、10 个 meso、8 个 micro feature groups、4 个重复系统和 5 类材质层。
2. **Blockout**：锁定闭合书体长宽厚、圆角、封面 overhang、页芯 inset、圆背书脊和近处相机下的占屏比例。
3. **Structure**：建立 `root -> cover/page pivots -> visual meshes`；封面、书脊、页芯、铭牌、铆钉和书签均有稳定 ID。书签锚定 `ribbon-anchor` socket，页片锚定 `page-gutter`，不可出现悬空或穿插。
4. **Form refinement**：加入真实几何封边、书脊肩槽、页口弧度、12 至 18 组实例化页边层、黄铜倒角、圆顶铆钉、书签 V 口和打开页冠曲率。
5. **Material/surface**：复用或重新提取布、纸、黄铜证据；albedo、roughness、normal/AO 独立，不复用同一贴图通道。封面布纹需有方向性，纸面与纸口使用不同暖度和粗糙度，黄铜边缘比面部更低 roughness。
6. **Interaction**：沿用现有 `setOpenProgress()` 外部契约，内部将开盖、快速翻页、打开页芯收束成连续阶段；reduced-motion 直接进入稳定端态。
7. **Optimization**：重复页边与铆钉使用 `InstancedMesh`，共享几何/材质，按固定视角保留可见细节并通过资源预算。
8. **逐阶段视觉门槛**：每一 pass 都用 ego-browser 的既有本地任务空间捕获固定视角，以 skill 脚本生成参考/渲染对照图，再由视觉检查记录 `continue | refine-spec | refine-code | request-input | stop`。全局分数和每个 critical feature 均达阈值后才能解锁下一阶段。

质量契约的 critical systems 预计为：闭合轮廓与书脊、封面/页芯装配、页口层系统、黄铜五金、打开页芯与书签连续路径。最终需要闭合前 3/4、闭合材质近景、打开俯视、产品桌面与移动端五类证据。

## 6. 预计改动与影响评估

| 路径 | 预计责任 |
| --- | --- |
| `docs/assets/model-reviews/dd-20260817-001/` | 新 assessment、detail inventory、sculpt spec、PBR 证据、分阶段截图与对照图 |
| `src/scene/models/create-notebook-model.ts` | 重建可见几何层级、装订结构、铭牌/铆钉/书签、打开页芯与运行时 attachment |
| `src/scene/models/model-specs.ts` | 增加书脊肩、包边、铭牌、书签、页口层等确定性规格 |
| `src/scene/models/geometry.ts` | 按需增加可复用的圆背、页口弧面或带 V 口薄片几何助手 |
| `src/scene/models/material-library.ts` | 增加或调整黄铜、书签、纸口与布面独立材质通道；维护统一释放 |
| `src/scene/models/model-types.ts` | 仅在现有 attachment metadata 无法表达书签时做向后兼容扩展；不改变调用方接口 |
| `src/scene/models/model-factories.test.ts` | 覆盖新节点、附件、各开合阶段、无穿模约束、材质独立性、销毁与预算 |
| `docs/product/mvp.md` | 把当前实现描述回写为与最终可运行模型一致的视觉事实 |
| 本记录 | 写回实际差异、pass review、验证结果与方案偏差 |

### 6.1 核心数据结构变化

- `NotebookModelNodes` 预计新增 `nameplate`、`rivetPair`、`ribbonBookmark`、`ribbonAnchor`、`gutter` 或等价稳定节点；现有 `root`、`coverPivot`、`pagePivot`、`frontCover`、`backCover`、`textBlock` 保持可用。
- `NOTEBOOK_MODEL_SPEC` 只新增可序列化的建模常量，不进入 Zustand 或 IndexedDB。
- `root.userData.setOpenProgress(value, animateRapidPages)`、`getOpenProgress()`、`openAngle` 保持调用签名不变。
- 可能补充 `attachmentBindings` 描述书签从书脊到闭合/打开端态的局部路径；该数据仅存在 Three.js runtime，不成为业务状态事实。
- 持久化模型、事件、默认用户数据和迁移全部不变，因此无需持久化兼容处理。

### 6.2 上下游与跨模块影响

- 上游 `NotebookObject` 应继续只传材质与进度；若视觉端态需要调整 timing，只能在不改变 `NotebookPhase` 合法流转的前提下修改局部采样。
- 下游 `JournalPanel`、正文与日记贴纸仍在 `editing` 阶段拥有页面交互，不读取新 Three.js 节点。
- `ModelReviewScene` 继续作为 pass/view 参数入口；实现时确认现有 query 审查模式可覆盖 closed/open/material 视角。
- 共享材质库增加通道会影响统一 `dispose()` 与总 texture count，必须连同桌子和桌垫一起测资源预算。
- 产品行为只增加进入日记前可见的模型细节，不改变用户操作命令、存储或可访问 DOM 退路。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 参考图与产品镜头不同 | 概念图为棚拍近景，主场景本子更小且受桌面灯光影响 | 微细节在产品视角不可读 | 先以产品近景锁 macro/meso，再用材质近景验证 micro；不为不可见细节突破预算 |
| 打开层级穿模 | 封面、页芯、书签使用不同 pivot 和弧线路径 | 快速翻页或端态出现交叉 | 每个关键进度采样包围盒与最小间隙；失败时回退到较少页层而不改变外部状态机 |
| 材质通道超预算 | 独立 PBR 证据新增纹理 | 纹理数超过 16 或加载变慢 | 优先程序纹理与共享通道打包，但不把 albedo 直接别名为 roughness/normal；超限则降低分辨率或合并同语义 atlas |
| 恢复装饰违背旧视觉选择 | `DD-20260812-003` 曾删除铭牌、圆钉、书签 | 文档结论冲突 | 本记录明确以最新概念图要求替代旧视觉选择；未批准前不改源码 |
| DOM 切换露出不一致 | WebGL 打开页与 DOM 双页比例/颜色不同 | 切换瞬间跳变 | 用打开俯视对照同步页色、gutter 与 cover lip；不复制 DOM 内容到纹理 |
| 单视角隐藏面不确定 | 参考未展示背封、真实装订截面 | 无法声称精确复原 | 背面采用无铭牌一致性推断，并在 spec 中保留置信度；不加入无证据装饰 |

回退时可整体恢复旧 notebook factory/spec/material 节点，不涉及数据库或用户数据。新评审资产和任务记录保留，说明回退原因，不把失败 pass 标成通过。

## 8. 验证与验收

- 自动测试：运行 `src/scene/models/model-factories.test.ts` 与 `src/scene/notebook-transition.test.ts`；覆盖节点身份、父子/pivot/socket、书签 attachment、进度端态、关键帧净空、reduced-motion、资源释放和预算。
- 构建与静态检查：运行项目 typecheck、lint、相关测试、production build、`git diff --check` 与文档引用检查。
- 浏览器验收：按项目规则使用 ego-browser，复用同一 localhost task space；桌面与移动端分别验证桌面态、近处态、打开转场、DOM 接管和关闭返回。对象审查入口捕获闭合前 3/4、材质近景和打开俯视。
- 视觉证据：每个 `$img2threejs` pass 生成参考/渲染 comparison sheet；全局 AI vision score 至少 `0.85`，每个 critical feature 至少 `0.82`，任何 identity-defining feature 失败都不得 `continue`。
- 持久化与恢复：本任务不改变持久化；仍需页面重开 smoke test，确认正文/贴纸恢复链路未受模型改动影响，不把未运行写为通过。
- 成功标准：本子在主场景第一眼具备参考图的软壳、圆背、页口、黄铜与书签身份；开合无明显穿模或浮空；DOM 切换连贯；桌面/移动无布局遮挡；所有必要检查和视觉门槛通过。

## 9. 待确认项与决策

本方案只有一项会改变视觉范围的决策：

- **建议批准：** 以最新“按概念图建模”要求替代 `DD-20260812-003` 的去装饰选择，恢复概念图中的**空白黄铜铭牌、两颗圆顶铆钉和酒红书签**；仍不恢复封面文字或设置入口。

若不接受该替代，本任务只能优化书体、页口和材质，无法达到指定概念图的完整物件身份。

## 10. 最终批准方案

用户于 2026-08-17 01:56 CST 明确回复“批准”。最终执行清单为：

1. 以 `warm-paper-atelier-notebook.png` 为闭合态权威参考，以 `warm-paper-atelier-journal-pages.png` 为打开态补充参考。
2. 重新生成本任务独立的 assessment、detail inventory 与 sculpt spec，并通过 strict-quality；历史 `DD-20260810-002` 资产只作证据，不继承 pass 状态。
3. 重建软包封面、圆润书脊肩、页芯与页口层，恢复空白黄铜铭牌、两颗圆顶铆钉和酒红 V 口书签，不恢复封面文字或设置入口。
4. 保持 `NotebookPhase`、DOM 日记、持久化、外部 `setOpenProgress()` 调用契约、命中体、关键 pivot/socket 和单 Canvas 边界。
5. 按 blockout、structure、form、material/surface、interaction、optimization 锁定 pass 实施；每阶段用参考/渲染对照图和 AI vision score 审核。
6. 完成定向测试、静态检查、构建、桌面/移动 ego-browser 验收、页面重开 smoke test和文档回写后，将状态更新为“待验收”。

## 11. 实施记录

已按批准范围完成程序化本子重建：

- `create-notebook-model.ts` 改为布包软壳分组、圆背书脊、实例化书槽与 12 层三侧纸口；打开端态使用独立左右页堆、弧形顶页和下凹页沟，外部 `setOpenProgress()` 调用签名不变。
- 恢复空白倒角黄铜铭牌与恰好两颗实例化圆顶铆钉；新增酒红书签材质和 32 段连续带状网格，尾部使用真实三角面构成 V 口。书签保留 `ribbon-anchor` socket attachment，并在打开态沿页沟铺设后越过书口下落。
- 快速翻页由 5 个独立 draw call 合并为一个动态 `InstancedMesh`；封面内部板层合并进布包 shell，避免新增可见细节突破固定场景 draw-call 上限。
- 封面从旧 `kraft` 通道切换到现有独立 `cloth` albedo、AO、height 和 roughness 通道，并加入受控 bump、各向异性与 sheen；纹理总数保持 16 个材质库资源、固定场景实际引用 12 个。
- `ModelReviewScene` 调整闭合、材质近景与打开俯视相机，使 `5:3` 本子和展开双页完整入镜。
- `model-factories.test.ts` 新增软壳、页层、五金、书签 attachment、打开页堆、书签纸面净空、独立材质通道和资源预算断言。

实现中发生两项不改变批准范围的局部修正：初版书签顶面没有纵向分段，打开后会斜穿页芯，现已改为 32 段带状网格；封面起初错误沿用纸浆 `kraft` 纹理，表面评审发现后已改为布纹四通道。3D 页面横线未恢复，因为当前产品明确由 DOM 日记拥有内容与横线语义，同时固定场景 draw-call 预算已用满。

## 12. 验证结果

输入适配性：

- `probe_image.py docs/assets/concepts/warm-paper-atelier-notebook.png`：`1672 × 941`，PNG，technical suitability `pass`。
- `probe_image.py docs/assets/concepts/warm-paper-atelier-journal-pages.png`：`1672 × 941`，PNG，technical suitability `pass`。
- 人工视觉适配性：`pass`，闭合/打开两张图足以支持实时浏览器道具的近似程序化重建；背面和真实装订工艺仍是合理推断。

`$img2threejs` 流水线：

- strict-quality：`PASS`；17 个组件、6 类材质、5 个 repetition systems、21 项细节。spec 仍提示部分组件缺少 spec 级 `actionProfile`，但运行时 hinge/socket/collider/destruction metadata 已实现并由测试覆盖。
- 八阶段均以 `action=continue` 完成：blockout `0.85`、structural `0.85`、form `0.86`、material `0.87`、surface `0.85`、lighting `0.86`、interaction `0.88`、optimization `0.88`；所有 critical feature 均不低于 `0.82`。
- 每个视觉阶段均保存浏览器 render 与参考/render comparison sheet，路径位于 `docs/assets/model-reviews/dd-20260817-001/{renders,comparisons}/passes/notebook/`。

工程检查：

- `npm run check`：通过；ESLint 通过，14 个测试文件共 59 项测试通过，TypeScript 与 production build 通过，文档引用检查通过。
- `npx tsc -b --pretty false` 与定向 `model-factories` / `notebook-transition`：通过，2 个文件共 18 项测试通过。
- `git diff --check`：通过。
- 构建仅保留既有大 chunk 提示，不影响产物生成。
- 固定场景实测：43 个模型 draw calls，加 2 个固定场景调用后为上限内的 45；39 个 mesh、29 个 shadow casters、42,174 个三角形、12 个实际纹理引用。铆钉、书槽/页口和快速页池均使用 instancing。

ego-browser 产品验收：

- 复用 task space `69`，桌面 `1470 × 923`：远处场景、近处打开、3D 双页过渡、DOM 日记接管、关闭返回均通过；Canvas 非空且本子无裁切、重影或控件遮挡。
- 移动端 `390 × 844`：空闲本子、底部命令、打开后的 DOM 双页和模式控件均在视口内，无文本/控件重叠。
- 页面关闭本子后重新导航到产品根页，桌面和移动端均恢复可交互空闲态；本任务未写入新的持久化数据，既有正文/贴纸 schema 与读取链路未改动。
- 主要证据：`product-desktop-idle.png`、`product-desktop-opening.png`、`product-desktop-journal.png`、`product-desktop-closed-return.png`、`product-mobile-idle.png` 与 `product-mobile-journal.png`。

## 13. 文档同步检查

- 产品文档：已更新 `docs/product/mvp.md` 的 3D 本子当前事实和功能状态表，删除硬壳平背、无五金/书签的旧描述。
- 架构文档：已核对 `docs/architecture/system-overview.html`；其状态所有权、`setOpenProgress()`、页堆/中缝/书签、DOM 接管和单 Canvas 描述与当前源码一致，无需实质修改 HTML。
- 决策文档：未新增长期架构约束，无需新 ADR；本记录明确以最新批准结果替代 `DD-20260812-003` 的去装饰视觉选择。
- 文档入口：任务未改变文档导航或当前状态聚合方式，`docs/index.html` 无需修改；文档引用检查已通过。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-17 01:52 CST | Codex | 使用 `$img2threejs` 完成参考适配性、现有调用链、历史资产和质量门槛分析，创建待确认方案。 |
| 2026-08-17 01:56 CST | 用户 / Codex | 用户明确回复“批准”；方案进入实施，批准恢复概念图五金与书签，并保持业务与持久化边界不变。 |
| 2026-08-17 02:55 CST | Codex | 完成八阶段评审；针对视觉反馈修正书签穿页/断裂和封面错误 `kraft` 通道，optimization pass 解锁为 complete。 |
| 2026-08-17 03:04 CST | Codex | 完成完整工程检查、桌面/移动产品验收、页面重开 smoke test 与文档回写；任务状态更新为“待验收”。 |
| 2026-08-17 04:41 CST | 用户 / Codex | 用户明确要求提交当前更改并 push，构成预先验收授权；批准范围、必要验证和文档回写均满足要求，任务更新为“已完成”并纳入本次提交。 |
