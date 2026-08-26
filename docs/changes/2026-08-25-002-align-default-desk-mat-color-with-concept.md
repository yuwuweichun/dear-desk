# DD-20260825-002：对齐桌垫默认颜色与概念图

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 修复 |
| 创建时间 | 2026-08-25 17:07 CST |
| 最后更新 | 2026-08-26 CST |
| 当前阶段 | 用户验收通过，已完成 |
| 源码基线 | `80a19cb`；工作树另有 `DD-20260825-001` 已实施待验收修改，本任务不得覆盖 |
| 实现提交 | 本次提交 |
| 关联任务 | 用户指出桌垫默认颜色不符合概念图，要求确认当前颜色并改为概念图方向 |

> 用户已批准本文方案；最终执行清单已经实施并验证，当前等待用户验收。

## 1. 给阅读者的结论

当前桌垫默认色确实不是概念图颜色：工作面为蓝灰 `#73858A`，垫体与包边为深蓝灰 `#4C5E63`。概念图 `docs/assets/concepts/warm-paper-atelier-desk-mat.png` 展示的是低明度苔绿/橄榄绿桌垫；仓库已有材质提取报告也把主样本集中在 `#3E3B29`、深部集中在 `#2D2C1E`。

现已新增默认调色版本 V11，仅把桌垫工作面和包边改为概念图方向，并把场景材质版本标记为 `V2.1`。背景、胡桃木桌、本子、几何和交互保持不变；提取起始值在真实场景灯光下直接通过，无需额外校准。

## 2. 用户需求

- 用户原始要求：确认桌垫的默认颜色；当前颜色不符合概念图，需要更改桌垫默认颜色。
- Codex 解释：以仓库唯一桌垫概念图 `docs/assets/concepts/warm-paper-atelier-desk-mat.png` 为视觉依据，把默认工作面和包边从蓝灰改为低明度苔绿/橄榄绿。
- 验收意图：默认加载和颜色面板“重置”后都应显示概念图方向的桌垫；桌垫仍与木桌、墨绿本子清楚分层。

## 3. 当前源码事实

- `src/scene/models/material-library.ts` 的 `DEFAULT_SCENE_PALETTE_VERSION` 当前为 `v2`，`SCENE_MATERIAL_VERSION` 为 `V2.0`。
- `SCENE_PALETTE_PRESETS.v2` 以 `mint: '#73858a'` 和 `mintDark: '#4c5e63'` 保存桌垫工作面与包边角色色；`getSceneColorConfig()` 分别映射到 `matField` 和 `matBinding`。
- `ProductApp` 初次渲染根据 `resolveScenePaletteVersion()` 创建页面级 `sceneColors`；production、无参数和无效参数都回到当前默认版本。颜色面板“恢复运行回退颜色”调用无参数 `getSceneColorConfig()`，因此也回到同一默认色。
- `DeskScene` 把 `SceneColorConfig` 传入材质库，`applySceneColors()` 分别更新 `materials.cloth` 与 `materials.clothDark`；桌垫模型的工作面使用前者，垫体与包边使用后者。
- 颜色状态只存在当前页面，不进入 store、IndexedDB 或 `localStorage`；刷新会恢复源码默认值。
- `src/scene/models/model-factories.test.ts` 当前明确断言 V2 蓝灰角色色、默认版本、production 回退和材质实际颜色。
- `docs/product/mvp.md` 与 `docs/architecture/system-overview.html` 当前把默认场景描述为 V2.0 蓝灰桌垫，与源码一致。
- `docs/changes/2026-08-17-002-refine-desk-mat-from-concept.md` 曾明确限制当时的模型任务不改变默认蓝灰色；本次用户请求是新的独立配色修复，不应改写该历史记录。
- `docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth-report.json` 从概念图裁剪中提取的代表色为 `#3E3B29`、`#373524`、`#46422E`、`#2D2C1E`、`#504B34`，置信度 `0.761`。报告同时警告单图像素包含光照，不能视为精确反演材质。
- `docs/changes/2026-08-09-002-unified-desk-visual-direction.md` 把概念方向定义为深苔绿，并曾给出角色色 `#314B43`；这是较早的视觉建议，不是当前运行默认值。
- Git 工作树已有 `DD-20260825-001` 的 App、设置面板、样式和文档修改。本任务预计与其共享 `docs/product/mvp.md`、`docs/architecture/system-overview.html` 和 `docs/index.html`，实施时必须在现有内容上增量回写，不得覆盖。

## 4. 目标与非目标

### 4.1 目标

- 将默认桌垫工作面和包边从蓝灰调整为概念图所示的低明度苔绿/橄榄绿。
- 保留 V1-V10 历史候选值，新增 V11 作为新的默认调色版本；场景材质版本从 `V2.0` 升为 `V2.1`。
- 默认进入、production 回退、无效调色参数回退和颜色面板重置均解析到新默认桌垫色。
- 用自动测试锁定版本、映射和材质实际色，并用桌面与移动端真实场景检查桌垫、本子和木桌分层。
- 同步产品、架构、文档入口和本任务记录中的当前事实。

### 4.2 非目标

- 不改变背景、桌面、桌框、桌腿、抽屉、本子或纸张的默认颜色。
- 不改变桌垫几何、纹理生成、粗糙度、光照、相机、贴纸命中面或坐标。
- 不新增持久化主题、颜色预设 UI、数据迁移或第二个 WebGL Canvas。
- 不重写或删除 V1-V10 历史候选，也不修改旧任务的审批和实施事实。
- 不处理当前工作树中 `DD-20260825-001` 的面板布局与互斥逻辑。

## 5. 方案说明

在 `SCENE_PALETTE_PRESETS` 新增 `v11`。它复制当前 V2 的背景和木材角色色，只把桌垫字段替换为概念图苔绿/橄榄绿。建议初始值为工作面 `#3E3B29`、包边 `#2D2C1E`：前者来自概念材质提取的主样本，后者来自同一报告的深部样本，可维持包边比工作面更深的结构层次。

实现时将 `DEFAULT_SCENE_PALETTE_VERSION` 改为 `v11`，并把 `SCENE_MATERIAL_VERSION` 升为 `V2.1`。这避免篡改 V2 的历史含义，也让 production、默认加载、无效参数回退和颜色重置通过现有调用链自动获得新颜色。开发环境继续支持 `?palette=v1..v11`，便于前后对照。

由于概念图像素包含暖光、阴影和程序纹理，十六进制提取值只作为 WebGL 基色起点。浏览器验收允许在不改变色彩方向和范围的前提下微调 V11 的两个值；若必须离开深苔绿/橄榄绿或同时修改其他场景角色色，则属于方案偏差，需先回写记录并重新确认。

## 6. 预计改动与影响评估

| 预计模块 | 预计责任 |
| --- | --- |
| `src/scene/models/material-library.ts` | 新增 V11，切换默认版本到 `v11`，升级场景材质版本到 `V2.1`；保持 V1-V10 原值不变 |
| `src/scene/models/model-factories.test.ts` | 锁定 V11 值、默认/production/无效参数回退、材质实际颜色及 V1-V10 历史值不变 |
| `src/app/App.test.tsx` 或现有颜色编辑器测试 | 只在当前覆盖不足时补充“重置回新默认色”集成断言；不修改面板布局行为 |
| `docs/product/mvp.md` | 把当前默认场景和刷新回退事实从 V2.0 蓝灰桌垫更新为 V2.1 苔绿/橄榄绿桌垫 |
| `docs/architecture/system-overview.html` | 更新默认 palette、开发参数范围和材质版本事实；实施前按规则加载 `$bun-html-docs` |
| `docs/index.html` | 增加本任务状态与入口；实施前按规则加载 `$bun-html-docs` |
| 本任务记录 | 回写批准、最终色值、真实差异、验证结果和待验收状态 |

### 6.1 核心数据结构变化

- `ScenePaletteVersion` 由 `SCENE_PALETTE_PRESETS` 键自动推导，预计从 `v1..v10` 扩展到 `v1..v11`。
- `SCENE_PALETTE_PRESETS.v11` 预计为 `{ background: '#d5dad8', mint: '#3e3b29', mintDark: '#2d2c1e', wood: '#73411f', woodDark: '#593219', woodPanel: '#70401f' }`，其中两个桌垫值允许依据批准范围内的真实场景验证做小幅校准。
- `DEFAULT_SCENE_PALETTE_VERSION` 从 `v2` 改为 `v11`；`SCENE_MATERIAL_VERSION` 从 `V2.0` 改为 `V2.1`。
- `SceneColorConfig` 的字段、序列化格式和页面生命周期不变；无数据库、store 或本地存储变化。

### 6.2 上下游与跨模块影响

- 上游 `ProductApp` 无需新增状态或分支；现有默认解析与重置调用会自动读取 V11。
- 下游 `DeskScene`、材质库和 `createDeskMatModel()` 的接口不变，只接收不同的两个默认颜色值。
- 桌垫 `cloth` 与 `clothDark` 使用同一程序纹理族，但本子使用独立角色色；只改 `matField` / `matBinding` 不会改本子颜色。
- 开发调色查询参数新增 `v11`；production 仍忽略查询参数并回到默认版本。
- 贴纸放置、拖动、持久化、Canvas 数量、纹理数量和资源预算不受影响。
- 文档需同时保留“V1-V10 历史候选均未采用”的事实，并明确 V11 是本次概念图对齐后的新默认。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 提取色在 WebGL 中过黑或偏棕 | 直接把受暖光与阴影影响的像素当作无光照基色 | 桌垫细节丢失，颜色看起来不像苔绿 | 以提取值为起点，在固定产品灯光下检查并仅在深苔绿/橄榄绿范围内微调 |
| 桌垫与墨绿本子色块合并 | 两者明度和色相过近 | 本子轮廓与视觉焦点减弱 | 在远、正、近机位检查边界；优先让桌垫更偏橄榄、包边更深，不改本子 |
| 改写历史 V2 | 直接修改 `SCENE_PALETTE_PRESETS.v2` | 旧截图、任务记录和 `?palette=v2` 不再可复现 | 新增 V11 并保留 V1-V10 原值 |
| 重置路径仍回到旧色 | 只改初始 state，不改默认 palette 常量 | 颜色面板重置与刷新行为不一致 | 统一通过 `DEFAULT_SCENE_PALETTE_VERSION`；自动测试覆盖默认、production、无效参数和重置 |
| 与现有未提交文档改动冲突 | 覆盖 `DD-20260825-001` 已写内容 | 丢失用户现有工作 | 在当前文件内容上做最小增量修改，实施前后逐项审查 Git 差异 |

回退方式：本任务无数据迁移。把默认版本恢复为 `v2`、材质版本恢复为 `V2.0`，并移除 V11 及其测试/文档增量即可恢复当前蓝灰默认；V1-V10 始终保留。

## 8. 验证与验收

- 自动测试：运行 `src/scene/models/model-factories.test.ts`，覆盖 V11 catalog、默认版本、production/无效参数回退、`getSceneColorConfig()` 映射和实际 cloth 材质颜色；按覆盖缺口补充颜色重置集成测试。
- 构建与静态检查：运行 `npm run check`、`git diff --check` 和项目文档引用检查。
- 浏览器验收：按项目规则使用 `ego-browser` 访问固定地址 `http://127.0.0.1:5164`；复用本目标的同一 task space，在桌面 `1440 x 900` 和移动 `390 x 844` 检查默认远/正/近机位、颜色面板值、重置结果、Canvas 数量与页面溢出，完成后以 `keep: false` 关闭。
- 持久化与恢复：本任务不新增持久化；通过刷新验证临时试色被清除并恢复 V11 默认桌垫色。
- 成功标准：默认工作面与包边肉眼呈现概念图同类的低明度苔绿/橄榄绿，且包边更深；木桌、本子和桌垫轮廓清楚；背景、木材、本子和交互行为不变；所有检查通过。

## 9. 待确认项与决策

无剩余待确认项。用户已批准新增 V11 并切换默认、升级场景材质版本到 `V2.1`，以及以工作面 `#3E3B29`、包边 `#2D2C1E` 为起始值进行概念图方向的真实场景校准。本次不联动修改墨绿本子或其他场景颜色。

## 10. 最终批准方案

用户于 2026-08-25 17:13 CST 明确回复“批准执行”。最终执行清单：

1. 在 `SCENE_PALETTE_PRESETS` 新增 V11，复用 V2 的背景与木材角色色，只把桌垫工作面和包边改为概念图苔绿/橄榄绿；保留 V1-V10 原值。
2. 把默认调色版本切换为 `v11`，把场景材质版本升为 `V2.1`；默认加载、production、无效参数和颜色重置统一解析到 V11。
3. 以工作面 `#3E3B29`、包边 `#2D2C1E` 为实现起点，只允许在相同深苔绿/橄榄绿范围内依据真实场景做小幅校准，不改其他角色色。
4. 更新自动测试，按 `$bun-html-docs` 约束增量回写产品、架构、文档入口和本记录，不覆盖 `DD-20260825-001` 现有修改。
5. 运行全量检查与文档引用检查，使用 `ego-browser` 在固定地址完成桌面和移动端默认色、重置、刷新、视觉分层与单 Canvas 验收。

## 11. 实施记录

1. `src/scene/models/material-library.ts` 新增 `SCENE_PALETTE_PRESETS.v11`：背景、桌面、桌框和抽屉面复用 V2 值，桌垫工作面使用 `#3e3b29`，垫体与包边使用 `#2d2c1e`。`DEFAULT_SCENE_PALETTE_VERSION` 从 `v2` 切换为 `v11`，`SCENE_MATERIAL_VERSION` 从 `V2.0` 升为 `V2.1`；V1-V10 原值均未修改。
2. `src/scene/models/model-factories.test.ts` 把 catalog、版本解析、production/无效参数回退、默认 `SceneColorConfig` 和实际 cloth 材质断言扩展到 V11，同时继续精确锁定 V2 历史值。
3. `docs/product/mvp.md` 把当前默认场景、配色历史、颜色面板重置/刷新和 3D 桌面能力表更新为 V2.1/V11 橄榄苔绿桌垫事实。
4. `docs/architecture/system-overview.html` 按 `$bun-html-docs` 的现有阅读器约束增量更新 palette catalog、默认解析、开发参数范围和非持久化边界；未改搜索、目录、Wiki、复制或响应式壳。
5. `docs/index.html` 增加本任务入口和待验收状态，并把当前结论更新为真实色值、保留边界和验证结果；`DD-20260825-001` 的待验收内容原样保留。
6. `ProductApp`、`DeskScene`、`SceneColorEditor`、桌垫模型、纹理生成、灯光、相机、贴纸和持久化源码均无需修改；现有默认解析链自动消费 V11。

方案偏差：无。批准的起始值在桌面和移动真实场景中呈现为可辨识的橄榄苔绿，包边更深，墨绿本子仍有清楚的冷暖与明度分层，因此没有使用获准的小幅校准余量。

## 12. 验证结果

- `npm test -- --run src/scene/models/model-factories.test.ts`：通过，1 个文件、12 项测试。
- `npm run check`：通过；ESLint、26 个测试文件/112 项测试、TypeScript/Vite production build 和文档引用检查均成功。保留项目既有的大 chunk 警告，没有新增构建错误。
- `git diff --check`：通过；`node scripts/check-doc-references.mjs`：通过。
- 固定地址 `http://127.0.0.1:5164` 已由现有 PID 82987 监听，未更换端口或启动第二个服务。
- `ego-browser` task space 32，桌面 `1440 x 900`：默认桌垫呈低明度橄榄苔绿，深色包边、工作面、暖胡桃木与冷墨绿本子边界清楚；颜色面板工作面/包边分别显示 `#3E3B29` / `#2D2C1E`。把工作面临时改为 `#123456` 后点击重置，两个字段恢复 V11；页面无横向溢出，Canvas 始终为 1。
- 移动 `390 x 844`：远处、正面、近处再回远处的三机位序列全部完成；颜色面板为 `left 18 / right 316 / width 298`，调色板按钮为 `left 326 / right 374`，无面板或页面横向溢出。刷新后两个字段恢复 `#3E3B29` / `#2D2C1E`，Canvas 仍为 1。
- 本地 HTML 文档：`docs/index.html` 在 `1440 x 900` 和 `390 x 844` 均无页面横向溢出；搜索“桌垫默认色”可命中当前状态，空结果文案正确，ArrowDown/ArrowUp/Enter/Escape、复制、Wiki 点击、移动目录和锚点收起通过。
- `docs/architecture/system-overview.html` 在 `1440 x 900` 和 `390 x 844` 均无页面横向溢出；搜索 `V11` 可定位程序化场景模型章节，代码/表格保留内部滚动边界，移动目录和 Wiki 点击通过。页面恰有一个可见 `docs-home-navigation`，其链接到 `docs/index.html` 并已实际到达文档首页。
- `$bun-html-docs` 首屏检查：入口页和架构页的标题、lead 与第一节继续先解释可见问题、普通原因和边界，没有因本次增量引入未解释的源码术语或营销式首屏。
- 浏览器 task space 在最终文档回写复核后按默认规则以 `keep: false` 关闭。

## 13. 文档同步检查

- 产品文档：`docs/product/mvp.md` 已同步 V2.1、V11、两项默认色、刷新/重置和配色历史事实。
- 架构文档：`docs/architecture/system-overview.html` 已同步 catalog、默认解析、版本、开发参数和非持久化边界。
- 决策文档：未改变数据、Canvas、状态所有权或长期架构约束，无需新增 ADR。
- 文档入口：`docs/index.html` 已增加本任务入口、当前结论和已完成状态。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-25 17:07 CST | 用户 / Codex | 用户指出桌垫默认颜色与概念图不符，要求确认当前颜色并修改默认色。Codex完成只读核对并创建待确认方案。 |
| 2026-08-25 17:13 CST | 用户 / Codex | 用户明确回复“批准执行”；V11、V2.1、概念提取起始值、有限校准范围以及测试和文档清单获得批准，任务进入实施。 |
| 2026-08-25 17:29 CST | Codex | 完成 V11 默认色、V2.1 版本、自动测试与产品/架构/入口回写；112 项全量测试、构建、文档检查以及应用和 HTML 双视口验收通过，任务进入待验收。 |
| 2026-08-26 CST | 用户 | 验收通过，确认本任务结果可提交。 |
