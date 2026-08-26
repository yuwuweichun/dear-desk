# DD-20260825-003：保存并切换场景颜色预设

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 |
| 创建时间 | 2026-08-25 17:36 CST |
| 最后更新 | 2026-08-26 CST |
| 当前阶段 | 用户验收通过，已完成 |
| 源码基线 | `80a19cb`；工作树另有 `DD-20260825-001`、`DD-20260825-002` 已实施待验收修改，本任务不得覆盖 |
| 实现提交 | 本次提交 |
| 关联任务 | 用户要求场景颜色面板增加预设 Tab，可命名保存当前颜色，并通过预设卡片切换场景颜色 |

> 用户已批准首轮方案及本轮修订；双列小卡片、无色卡、新建 640 × 360 预览、旧 320 × 180 Blob 兼容及 V11 启动语义均已实施并验证，当前等待用户验收。

## 1. 给阅读者的结论

当前颜色面板已经提供“颜色 / 预设”两个页签：用户调好颜色后，可在预设页输入名称并保存；点击预设卡片会把九项颜色一次性应用到当前场景。预设现在以每行两张的紧凑图片卡片展示，不再渲染场景图下方的九色缩略条；图片失败时使用中性占位。

预设作为用户创建的持久数据保存到当前浏览器 IndexedDB。保存时同时从当前 WebGL 场景截取一帧，缩小后编码为 WebP `Blob`，作为卡片主预览图；截图只包含 3D 场景，不包含颜色面板等 DOM 界面。后续新截图和默认 V11 随包图均为 `640 × 360`；首轮已有的 `320 × 180` Blob 保持兼容并继续显示，不修改或重写用户记录。

刷新后预设列表与预览图仍在，但页面仍按运行默认色启动，不自动恢复上次选中的自定义预设；用户进入预设页点击后才切换。卡片提供删除命令以避免无法清理的永久堆积，本次不提供重命名、覆盖保存、排序、导入导出或云同步。

## 2. 用户需求

- 用户原始要求：场景颜色面板增加一个 Tab；可以把当前修改后的颜色参数命名并保存为预设；每个预设是卡片；点击卡片切换预设并改变场景颜色。
- 用户补充要求：保存预设时截取一张场景图，可使用 Blob；默认预设也应提供预览图。
- 用户验收反馈：卡片图片下方不需要九色色卡；卡片应更小并改成每行两张；同时询问 `320 × 180` 预览是否过于模糊，以及“IndexedDB v5 持久化但启动仍使用 V11”的含义。
- Codex 解释：现有九项 `SceneColorConfig` 必须整体快照保存；卡片点击后不重建 Canvas，而是沿现有 `setSceneColors -> DeskScene -> applySceneColors()` 链路原位更新场景。
- Codex 解释：自定义预设的预览是保存当下的纯 3D 场景快照，记录当时相机视角和可见桌面内容，保存后不随贴纸、机位或场景内容继续变化；默认 V11 使用固定随包预览图。
- 验收意图：用户能区分调色与预设管理，命名保存后立即看到带真实场景预览的卡片；多个卡片可重复切换且场景同步变化；刷新后预设和 Blob 预览仍存在。
- 修订验收意图：预设页在现有面板宽度内稳定显示两列紧凑图片卡片，不再用色卡占用视觉空间；新预览在高像素密度屏幕上仍有充足采样精度。

## 3. 当前源码事实

- `src/app/App.tsx` 的 `ProductApp` 以组件级 `sceneColors` 持有九项颜色。它同时传给 `SceneColorEditor` 和 `DeskScene`，因此 `setSceneColors()` 是当前场景颜色的唯一 React 所有者。
- `src/scene/SceneColorEditor.tsx` 当前只有一页颜色字段：环境 1 项、桌子 4 项、桌垫 2 项、本子 2 项；支持恢复运行默认色和复制 JSON，没有页签、命名表单、预设列表或持久化入口。
- `src/scene/models/material-library.ts` 的 `SceneColorConfig` 是九个 HEX 字符串；`applySceneColors()` 原位更新木材、桌垫和本子材质，背景/fog 由 `DeskScene` 的 React Three Fiber props 同步。切换颜色不会新建 Canvas 或纹理。
- `src/scene/DeskScene.tsx` 当前拥有唯一 React Three Fiber Canvas 和 renderer，但没有向 DOM 层暴露场景截图命令。要可靠取得缩略图，需要在 renderer 刚绘制当前 scene/camera 后同步复制 WebGL canvas 像素到小型离屏 2D canvas，再由离屏 canvas 编码 Blob；不应长期打开第二个 WebGL Canvas。
- `src/scene/scene-color.ts` 当前只提供完整六位 HEX 校验和复制序列化，没有持久化模型校验。
- `src/persistence/database.ts` 当前数据库版本为 v4，已有日记、贴纸资源/实例和本子铭牌设置表；没有场景颜色预设表。
- 已接受 ADR `docs/decisions/2026-08-06-002-local-first-data-and-scene-projection.md` 要求用户业务数据写入 IndexedDB、领域模型与 Three.js 对象分离、UI 通过 repository 访问持久化数据。命名颜色预设属于用户创建的结构化数据，不应只保存 Three.js 材质或组件运行对象。
- `localStorage` 当前只保存音频和内容字体等小型单值偏好；命名预设是可增删的记录集合，因此本方案遵循 ADR 使用 IndexedDB。
- `docs/product/mvp.md` 和 `docs/architecture/system-overview.html` 当前明确写明实时颜色仅为页面临时状态、不包含持久化主题管理；实施后必须同步改为真实行为。
- 当前 Git 工作树已有颜色面板左展/设置面板互斥、V11 默认桌垫色以及相关 App、样式、测试和 HTML 文档修改。本任务与这些文件重叠，实施必须在现有工作树上增量修改，不得回退或覆盖。
- 首轮实现后，`SceneColorEditor` 的预设列表是单列网格，卡片由 16:9 图片、名称/类型、九色色条和删除按钮组成；图片失败回退也使用九色色条。`capture-scene-preview.ts` 固定生成 `320 × 180`，随包默认图同为 `320 × 180`。这些是本轮修订开始前的真实源码事实。

## 4. 目标与非目标

### 4.1 目标

- 在场景颜色面板内增加“颜色 / 预设”两个可访问页签，默认打开“颜色”。
- 允许用户为当前九项颜色输入名称并保存为新预设。
- 每个预设以紧凑图片卡片展示名称；列表采用两列网格，一行容纳两张卡片，点击卡片立即把整套颜色应用到当前场景。
- 保存自定义预设时截取当前纯 3D 场景画面，新生成 `640 × 360` WebP Blob；卡片不展示九色缩略条，图片失败时使用中性占位而不是色卡。
- 在预设列表中提供不可删除的“默认配色”V11 卡片，展示仓库内固定机位预览图，点击后恢复完整 V11 九项颜色。
- 明确展示当前匹配的预设；用户继续修改任意颜色后，如果不再完整匹配该快照，则取消选中态。
- 支持删除预设；删除当前匹配的卡片只移除持久记录，不回退当前场景颜色。
- 预设跨页面刷新保留，并覆盖加载、保存、应用、删除、错误和响应式交互。

### 4.2 非目标

- 不自动恢复上次点击的预设，不改变 V11 运行默认色和开发查询参数行为。
- 不提供预设重命名、覆盖更新、拖动排序、内置预设列表、导入导出或分享。
- 不同步账号、服务端或其他设备；清除站点数据后预设会丢失。
- 不改变九项颜色字段、材质所有权、程序纹理、光照、相机、场景几何或 Canvas 数量。
- 不为截图增加第二个 WebGL Canvas，不把颜色面板、HUD 或其他 DOM 界面合成到预览图。
- 不让预览图随相机、贴纸或其他场景内容变化自动重拍；本次也不提供手动“更新预览”。
- 不把预设写入 Three.js 对象、Zustand 持久状态或 `localStorage`。

## 5. 方案说明

颜色面板标题和现有重置、复制、关闭命令保持不变，标题下增加两项 Tab。颜色页继续承载现有九项字段；预设页顶部是单行名称输入和“保存当前颜色”按钮，下方是可滚动卡片列表。名称保存前会去除首尾空白、合并连续空白，不能为空，最长 24 个字符；同名预设拒绝创建并给出就地错误，避免卡片难以区分。

保存时先创建不可变颜色快照，再通过 `DeskScene` 注册的截图命令让当前 renderer 显式绘制 scene/camera，并立即把 WebGL canvas 复制到固定 `640 x 360` 离屏 2D canvas；离屏画面编码为质量受控的 `image/webp` Blob。这样不需要 `preserveDrawingBuffer: true` 的持续性能成本，也不增加第二个 WebGL Canvas。若浏览器拒绝 WebP，则回退为 PNG Blob；若截图最终失败，预设颜色仍可保存，卡片使用中性图片占位并显示非阻断提示。

预设列表改为两列网格，卡片主体是选择命令，包含 16:9 场景图、预设名、类型和选中状态，不再渲染图下九色色条；右上角使用垃圾桶图标删除，并阻止删除点击触发卡片应用。点击卡片只调用现有 `onChange(preset.colors)`，因此背景、fog 和材质通过已有链路同步，不重建场景资源。自定义 Blob 通过 `URL.createObjectURL()` 显示，并在记录删除、列表替换或组件卸载时 `URL.revokeObjectURL()`，避免内存泄漏。

列表首项是内置“默认配色”V11 卡片。其预览在实施验收阶段以固定默认场景、固定远处机位生成一次并作为仓库 WebP 资源随包发布；它不写入 IndexedDB、不创建 object URL、不可删除。这样首次使用、隐私模式或 IndexedDB 暂不可用时仍有稳定预览，也不会为同一默认图在每个浏览器重复保存 Blob。

持久层新增 IndexedDB v5 `sceneColorPresets` 表和独立 repository。`ProductApp` 在挂载时异步加载列表；加载失败时仍可继续手动调色，并在预设页显示错误。保存/删除只在 repository 成功后更新列表，失败时保留当前 UI 数据与场景颜色并提供可重试反馈。刷新只恢复列表，不自动套用某张卡片，以免新功能静默改变当前 V11 启动语义。

## 6. 预计改动与影响评估

| 预计模块 | 预计责任 |
| --- | --- |
| `src/domain/scene-color-preset.ts` | 定义预设记录（含可选预览 Blob）、repository 接口、名称归一化/校验和颜色快照校验 |
| `src/domain/scene-color-preset.test.ts` | 覆盖空名、长度、空白归一化、九项 HEX 完整性和不可变快照 |
| `src/persistence/database.ts` | 数据库升至 v5，新增 `sceneColorPresets` 表，不改既有 v1-v4 数据 |
| `src/persistence/scene-color-preset-repository.ts` | 实现列表、颜色与预览 Blob 创建、删除和同名冲突处理 |
| `src/persistence/scene-color-preset-repository.test.ts` | 覆盖 CRUD、排序、冲突、v4 升级保留旧数据和空表初始化 |
| `src/main.tsx` / `src/app/App.tsx` | 注入 repository；加载预设、协调场景截图，处理保存/删除状态，并把当前颜色与预设交互传给面板 |
| `src/scene/DeskScene.tsx` / 截图辅助模块 | 从唯一 renderer 捕获当前 scene/camera；修订后将新截图由 320 × 180 提升到 640 × 360 并继续编码 WebP/PNG Blob，不持有预设业务数据 |
| `src/scene/SceneColorEditor.tsx` | 保留 Tab、命名保存、默认/自定义预设和 Blob object URL 生命周期；移除卡片色条与色条失败回退，改用中性占位 |
| `src/scene/SceneColorEditor.test.tsx` / `src/app/App.test.tsx` | 覆盖页签语义、命名保存、截图结果、预览回退、卡片应用、场景颜色联动、删除、刷新恢复所需的集成边界及现有面板互斥回归 |
| `public/assets/scene-color-presets/default-v11.webp` | 把现有 320 × 180 固定 V11 预览重新生成为 640 × 360，并纳入尺寸和画面检查 |
| `src/styles.css` | 把预设列表改为两列紧凑网格，缩小卡片和内部文字/按钮占位，移除九色色条样式；保持 330px 面板及移动端可用高度内滚动 |
| `docs/product/mvp.md` | 把临时颜色能力更新为可命名持久预设及明确非目标 |
| `docs/architecture/system-overview.html` | 更新状态所有权、IndexedDB v5、repository、数据流和源码地图；实施前按规则加载 `$bun-html-docs` |
| `docs/index.html` | 增加本任务状态与入口；实施前按规则加载 `$bun-html-docs` |
| 本任务记录 | 回写批准、真实实现差异、验证和待验收状态 |

### 6.1 核心数据结构变化

预计新增：

```ts
interface SceneColorPreset {
  id: string
  name: string
  colors: SceneColorConfig
  previewBlob?: Blob
  previewMimeType?: 'image/webp' | 'image/png'
  createdAt: string
  updatedAt: string
}

interface SceneColorPresetRepository {
  list(): Promise<SceneColorPreset[]>
  create(
    name: string,
    colors: SceneColorConfig,
    preview?: { blob: Blob; mimeType: 'image/webp' | 'image/png' },
  ): Promise<SceneColorPreset>
  delete(id: string): Promise<void>
}
```

- `id` 使用 `crypto.randomUUID()`；`createdAt` / `updatedAt` 使用 ISO 时间。
- `colors` 保存九项完整、规范化为小写的六位 HEX，不保存 Three.js 材质、纹理或场景实例。
- `previewBlob` 对新记录保存 640 × 360 的 WebP 或 PNG 场景快照；已有 320 × 180 Blob 继续兼容。Blob 只在 IndexedDB 和临时 object URL 之间流动，不进入 Zustand、Three.js 场景对象或 JSON 复制配置。
- v5 表索引建议为 `id, name, createdAt`；列表按 `createdAt` 新到旧显示。名称在 repository 创建事务中检查唯一，当前范围不提供覆盖更新。
- 数据库升级只新增空表，无既有记录迁移或默认预设注入；v1-v4 数据保持原样。
- 内置 V11 卡片不是 `SceneColorPreset` 数据库记录；它由运行默认 `SceneColorConfig` 和静态 WebP 组成，避免与用户记录生命周期混淆。

### 6.2 上下游与跨模块影响

- 上游 `ProductApp` 继续拥有当前 `sceneColors`，只额外持有预设列表和异步状态；不把当前配色迁入全局 store。
- `SceneColorEditor` 仍是 DOM 表单和列表，不进入 WebGL；卡片应用复用 `onChange`。
- 下游 `DeskScene`、`applySceneColors()` 和材质库公共接口不变；预设只是 `SceneColorConfig` 的持久快照。
- `DeskScene` 只新增“捕获当前帧”的运行命令，仍不读写 IndexedDB；截图完成后把 Blob 返回给上游，符合场景投影 ADR。
- 数据库 schema 从 v4 升到 v5，需验证已有日记、贴纸和铭牌数据不受影响。
- 现有复制 JSON 和恢复默认色保持可用；恢复后若九项刚好匹配某预设，该卡片可显示为当前匹配。
- 面板与音频、字体仍由 `openSettingsPanel` 保持全局互斥；内部 Tab 不创建新的外层设置面板状态。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 数据库升级影响既有数据 | v5 schema 遗漏旧表或索引 | 日记、贴纸或铭牌数据不可读 | v5 完整声明所有旧表；用 v4 fixture 验证升级与旧数据保留 |
| 卡片点击与删除冲突 | 删除按钮事件冒泡到卡片 | 删除时场景意外切色 | 删除使用独立可访问图标按钮并阻止卡片选择事件 |
| 颜色对象被后续编辑污染 | 保存时复用可变对象引用 | 旧预设跟随当前颜色变化 | domain/repository 创建九字段副本，返回值也不依赖 UI 原引用 |
| 异步失败造成假保存 | 先乐观显示卡片但持久化失败 | 刷新后预设消失 | repository 成功后才更新列表；失败显示状态且保留输入 |
| WebGL 截图为空或透明 | 在默认 framebuffer 被清空后异步读取 | 卡片出现空白图 | 截图命令显式绘制后立即同步复制到 2D canvas，再异步编码；测试非空像素和尺寸 |
| 预览 Blob 占用过多存储 | 640 × 360 比首轮像素数增加四倍，PNG 回退尤其明显 | 大量预设增加 IndexedDB 用量 | 仍只保存受控 640 × 360，优先质量受控 WebP，记录 MIME；不保存原始全分辨率截图 |
| object URL 泄漏 | 卡片重载或删除后不释放 URL | 长会话内存持续增长 | 集中管理并在列表替换、删除和卸载时 revoke |
| 快照包含当时桌面私人内容 | 截图记录可见贴纸或铭牌 | 预览不只是纯色样本 | 明确它是本地场景快照，只存当前浏览器；不上传、不导出 |
| 移动面板内容过高 | 表单和卡片挤入现有 330px 面板 | 操作被裁切或页面溢出 | Tab 内容复用面板正文滚动；双视口检查按钮、长名称与多卡片 |
| 与待验收颜色任务互相覆盖 | 直接按 HEAD 旧文件实现 | 丢失面板左展、互斥或 V11 修改 | 以当前工作树为基线做最小增量，并逐项审查差异 |

回退方式：删除预设 UI、domain/repository 接入和 v5 表声明即可停止新功能；已有 v5 数据库中的预设表即使保留也不会影响 v1-v4 业务表。若需物理移除表，必须另建带数据清理审批的数据库升级任务，本任务不执行破坏性降级。

## 8. 验证与验收

- 自动测试：domain 校验、repository Blob CRUD/冲突/迁移、640 × 360 截图尺寸/MIME/非空像素与回退、组件双列结构/无色条/中性占位/object URL/删除/错误、App 场景联动与既有颜色面板互斥回归。
- 构建与静态检查：运行针对性测试、`npm run check`、`git diff --check` 和项目文档引用检查。
- 浏览器验收：按项目规则使用 `ego-browser` 访问固定地址 `http://127.0.0.1:5164`；复用本目标同一 task space，在 `1440 x 900` 与 `390 x 844` 检查两列小卡片、无图下色卡、默认图、命名保存、640 × 360 新截图与 320 × 180 旧 Blob 兼容、多卡片切换、当前匹配、删除、长名称、滚动、中性图片回退、无横向溢出和单 WebGL Canvas，完成后默认 `keep: false`。
- 持久化与恢复：保存至少两份有明显颜色和机位差异的预设，刷新页面后确认列表与 Blob 预览恢复、场景先使用 V11 默认，再点击卡片恢复对应九项颜色；删除后再次刷新确认记录和 Blob 不再出现。
- 数据迁移：从 v4 fixture 打开 v5，确认已有日记、贴纸和铭牌数据保留，预设表为空且可写。
- 成功标准：用户可以命名保存当前完整颜色和对应场景快照、在默认及自定义图片卡片之间稳定切换场景、清理不需要的预设；刷新保留颜色与 Blob 预览但不静默改默认启动色；截图不增加第二个 WebGL Canvas且不存在空白图；自动测试、构建、文档检查和双视口验收全部通过。

## 9. 待确认项与决策

用户已批准以下决策：

1. 预设持久化到 IndexedDB v5，跨刷新保留；刷新后不自动应用上次预设，仍从 V11 运行默认色开始。
2. 预设名称归一化后不能为空、最长 24 字符，并拒绝同名；本次只新增和删除，不提供重命名或覆盖。
3. 每张卡片点击应用完整九项颜色，并提供独立删除图标；删除当前卡片不改变已经应用到场景的颜色。
4. 自定义预设保存时截取当前纯 3D 场景和当前机位，缩为 320 x 180，优先保存 WebP Blob、PNG 回退；截图失败不阻断颜色保存，卡片回退到九色缩略条。
5. 列表提供不可删除的 V11“默认配色”卡片，使用仓库内固定远处机位 WebP，不在每个浏览器重复保存 Blob。

用户于 2026-08-25 18:44 CST 批准以下修订：

1. 移除每张卡片图片下方的九色色卡，并把图片失败状态改为不表达颜色参数的中性占位。
2. 预设列表改为两列，卡片在现有 330px 桌面面板和 298px 移动面板内缩小，继续保持 16:9 图片比例、名称、类型、选中态和删除命令。
3. 后续自定义截图与随包 V11 图改为 `640 × 360`。已有 `320 × 180` Blob 不迁移、不重编码，仍可直接显示；数据库结构继续为 v5，无需升版。
4. “IndexedDB v5”表示本地数据库 schema 版本，“V11”表示运行默认配色版本，两者互不相关。修订方案继续保持刷新时恢复预设卡片和图片，但场景先使用 V11，不自动应用上次选择；若要记住上次选择，需要另行批准新增持久化选择状态。

## 10. 最终批准方案

用户于 2026-08-25 17:47 CST 明确回复“批准执行”。最终执行清单：

1. 新增 IndexedDB v5 `sceneColorPresets` 表、领域模型与 repository，持久化名称、完整九项颜色、可选 320 x 180 WebP/PNG Blob 预览和时间字段；验证 v4 数据原样升级。
2. 在唯一 `DeskScene` renderer 上提供当前 scene/camera 截图命令，显式绘制后同步复制到离屏 2D canvas，再编码 Blob；不启用持续 `preserveDrawingBuffer`，不新增 WebGL Canvas。
3. 场景颜色面板增加“颜色 / 预设”Tab、24 字符唯一命名保存、内置 V11 卡片、Blob 自定义卡片、九色回退、当前匹配状态和独立删除命令。
4. 自定义预设保存时捕获当前纯 3D 场景与当前机位；截图失败不阻断颜色保存。V11 使用仓库内固定远处机位 WebP，不写入用户数据库。
5. 保持刷新从 V11 默认色启动、现有重置/复制、面板互斥、材质映射、相机和单 Canvas 行为；补齐 domain、repository、截图、组件与 App 测试。
6. 按 `$bun-html-docs` 增量同步产品、架构、文档入口和本记录，运行全量检查、引用检查，并用 `ego-browser` 在固定地址完成桌面和移动验收。

### 10.1 已批准修订执行清单

1. 调整 `SceneColorEditor` 与样式：移除九色色卡，把列表改为两列紧凑 16:9 图片卡片，保留名称、类型、选中态和删除命令；图片错误时显示中性占位。
2. 把新场景预览输出改为 `640 × 360`，重新生成同尺寸 V11 随包 WebP；保留现有 320 × 180 用户 Blob 的读取兼容，不修改 IndexedDB v5 schema 或既有记录。
3. 保持刷新从 V11 启动，不新增“上次选择”持久化；更新截图和组件测试，运行 `npm run check`、`git diff --check`、文档引用检查，并用 `ego-browser` 重新验证桌面和移动布局及持久化。
4. 按真实差异同步产品、架构、文档入口和本记录，实施完成后重新进入 `待验收`。

## 11. 实施记录

1. `src/domain/scene-color-preset.ts` 新增九项 `SceneColorConfig` 的领域定义、固定字段顺序、24 字符命名归一化、完整六位 HEX 校验、颜色比较、预设/预览/repository 接口及明确的校验和同名错误。`material-library.ts` 改为从领域层导入并继续 re-export 类型，既有调用方无需迁移导入路径。
2. `src/persistence/database.ts` 新增 v5 `sceneColorPresets: 'id, &name, createdAt'`，完整保留 v1-v4 表；`scene-color-preset-repository.ts` 实现新到旧列表、UUID 创建、规范化九色、可选 WebP/PNG Blob、唯一命名冲突和删除。没有注入默认记录或修改既有日记、贴纸、铭牌数据。
3. `src/scene/capture-scene-preview.ts` 将当前 WebGL canvas 居中裁成 16:9、同步复制到 320 × 180 离屏 2D canvas，优先以质量 0.82 编码 WebP并回退 PNG。`DeskScene` 在既有唯一 renderer 创建后向上游注册截图命令；保存时先显式渲染当前 scene/camera，再调用该辅助函数，未启用持续 `preserveDrawingBuffer` 或第二个 WebGL Canvas。
4. `src/app/App.tsx` 通过可注入 `SceneColorPresetRepository` 异步载入列表，持有预设/错误/截图函数状态，并协调保存和删除；`src/main.tsx` 注入真实 Dexie repository。截图失败时仍创建颜色记录并返回非阻断状态，repository 成功后才更新 UI 列表。
5. `src/scene/SceneColorEditor.tsx` 增加可访问的“颜色 / 预设”Tab、命名保存表单、固定 V11 默认卡片、自定义 Blob 图片卡片、九色缩略条、完整九色匹配选中态和独立删除图标。Blob 卡片建立 object URL，并在列表替换、删除或卸载时 revoke；继续手调任一颜色会在不再完整匹配时退出卡片选中态。
6. `public/assets/scene-color-presets/default-v11.webp` 是用真实应用固定远处机位生成、清理 DOM UI 并裁切到 320 × 180 的随包场景图；默认卡片不写入每个用户数据库且不可删除。
7. `src/styles.css` 增加紧凑 Tab、40px 命名表单、16:9 卡片、稳定九色条、当前/删除状态和移动滚动布局；现有 330px 桌面面板、298px 移动面板、按钮左展和设置面板互斥布局保持不变。
8. 新增 domain、repository 和截图单元测试；扩展 `SceneColorEditor.test.tsx` 与 `App.test.tsx`，覆盖 Tab、命名、Blob URL 生命周期、卡片应用、删除不误触、截图接线、刷新所需 repository 边界及既有面板互斥回归。
9. 用户批准修订后，`SceneColorEditor.tsx` 删除 `PresetColorStrip`、卡片 `colors` 展示参数和图下九色色条，预览失败改用 Lucide `ImageOff` 中性占位；`src/styles.css` 把列表改为两列稳定网格，桌面卡片宽约 147px、移动卡片宽约 131px，并缩小元信息与删除按钮占位。空状态跨两列，卡片名称仍可省略显示且不会推动布局变形。
10. `capture-scene-preview.ts` 将新截图常量提升到 640 × 360，编码类型、质量、中央裁切和 PNG 回退路径不变。`default-v11.webp` 通过真实应用的保存预设截图链路在固定远处机位重新生成，输出为 640 × 360 WebP；生成用临时 IndexedDB 记录已经删除。repository 和 IndexedDB v5 schema 未改变，已有 320 × 180 Blob 可直接通过原 object URL 路径显示。
11. `capture-scene-preview.test.ts` 新增对 640 × 360 常量的明确断言；`SceneColorEditor.test.tsx` 增加无色条与中性占位覆盖。产品文档、系统架构和文档入口同步双列布局、新旧预览尺寸兼容及继续从 V11 启动的真实行为。

方案偏差：无实质偏差。为保持领域层不依赖 Three.js，`SceneColorConfig` 从材质库移到新领域文件并由旧路径 re-export；截图裁切/编码单独放入可测试辅助模块。这两项属于批准范围内的模块所有权细化，公共调用行为和九字段结构不变。首轮生成默认图时通过视觉复检发现初始浏览器截图含 UI 边缘，最终资源改用仅保留 Canvas 的场景捕获并做轻量边缘裁切；本轮 640 × 360 资源直接复用真实保存截图链路。固定机位、纯 3D 内容、双列无色条布局、旧 Blob 兼容和 V11 启动语义均符合批准修订。

## 12. 验证结果

- `npm test -- --run src/domain/scene-color-preset.test.ts src/persistence/scene-color-preset-repository.test.ts`：通过，2 个文件、4 项测试。
- 新增 UI/截图与 App 针对性测试多轮通过；最终 `npm run check`：ESLint、29 个测试文件/120 项测试、TypeScript、Vite production build 和文档引用检查全部成功。构建只保留项目既有的大 chunk 警告。
- `git diff --check`：通过。`sips -g pixelWidth -g pixelHeight -g format public/assets/scene-color-presets/default-v11.webp`：确认 `320 × 180`、WebP；本地图片检查确认最终画面只有固定远处机位的 3D 桌面、本子和桌垫，没有颜色面板、HUD 或命令按钮。
- 固定地址 `http://127.0.0.1:5164` 由既有 PID 82987 监听，未更换端口或启动第二个服务。
- `ego-browser` task space 34，桌面 `1440 × 900`：面板 `left 1024 / right 1354 / width 330`，默认卡片图成功加载；自定义“验收薄荷灰”保存为 `blob:` 图片且天然尺寸 `320 × 180`，保存状态和当前匹配正确，Canvas 始终为 1，页面横向溢出为 0。
- 桌面双向切色：点击 V11 默认卡片后背景 HEX 为 `#D5DAD8`，点击自定义卡片后为 `#B8C7C2`；刷新后列表与新的 object URL 恢复，自定义图片仍为 320 × 180，但默认卡片处于选中态，证明没有自动恢复上次选择。
- 移动 `390 × 844`：面板 `left 18 / right 316 / width 298`，按钮列 `left 326 / right 374`，两张卡片无页面溢出且 Canvas 为 1。创建默认 + 3 张自定义卡片后正文 `scrollHeight 1038 > clientHeight 646`，只在面板内部滚动；四张图均为 320 × 180。删除后状态正确，刷新只剩默认卡片；所有临时验收预设均已清理。
- 本地 `docs/index.html`：桌面搜索“场景颜色命名预设”成功、空结果正确，ArrowDown/Enter 定位 `#current`，Escape 清空并关闭结果；真实指针点击复制显示“已复制”，术语点击与键盘焦点都显示解释；桌面和移动页面横向溢出均为 0。
- 本地 `docs/architecture/system-overview.html`：搜索 `SceneColorPresetRepository` 命中场景模型和状态所有权两节，ArrowDown/ArrowUp/Enter/Escape、空结果、v5 schema 复制、术语焦点均通过；桌面恰有一个可见 `docs-home-navigation`。移动目录打开后选择持久化章节，hash 为 `#persistence`、目录自动关闭、章节顶边为 175.93px；3 个宽表/代码块在自身容器滚动，页面无横向溢出。唯一首页入口实际到达 `docs/index.html`。
- `$bun-html-docs` 首屏检查：入口页和架构页标题、lead、当前结论与首节继续先解释用户看见的问题、普通原因、主要责任和边界，没有由本任务引入源码符号堆叠或营销式首屏。
- `ego-browser` task space 34 已按默认规则以 `keep: false` 完成并关闭。

本轮修订复验：

- `npm test -- --run src/scene/capture-scene-preview.test.ts src/scene/SceneColorEditor.test.tsx src/app/App.test.tsx`：3 个文件、19 项测试通过。随后 `npm run check` 再次通过 ESLint、29 个测试文件/120 项测试、TypeScript、Vite production build 和文档引用检查；只保留项目既有的大 chunk 警告。
- `sips -g pixelWidth -g pixelHeight -g format public/assets/scene-color-presets/default-v11.webp`：确认默认图为 640 × 360 WebP；本地原尺寸图片检查确认画面只有固定远处机位的桌面、桌垫和本子，没有 DOM UI。
- `ego-browser` task space 35，桌面 1440 × 900：两张卡片同排，网格列宽均为 147px，默认图与新建“验收薄荷灰”Blob 天然尺寸均为 640 × 360，图下色条均不存在；面板宽 330px、页面横向溢出为 0、Canvas 为 1。
- 刷新后“验收薄荷灰”与 Blob 仍在，但背景 HEX 先回到 V11 的 `#D5DAD8`；点击自定义卡片后恢复为 `#B8C7C2`。临时构造并写入的 320 × 180 旧版 Blob 同样正常加载和应用，证明现有 v5 记录无需迁移。
- 移动 390 × 844、DPR 2：卡片两列宽均为 131px，默认图与旧版卡片同排，第三张自动换行；名称、类型和删除图标无重叠，图下无色条，面板宽 298px、页面横向溢出为 0、Canvas 为 1。两条临时自定义记录均通过 UI 删除，刷新后只剩默认卡片和空状态。
- 本地 `docs/index.html`：搜索“场景颜色命名预设”命中当前状态，ArrowDown/Enter 到达 `#current`，空结果、Escape、任务状态复制、术语 hover/click、390 × 844 移动目录打开/选择/关闭和 1440 × 900 / 390 × 844 页面无横向溢出均通过。
- 本地 `docs/architecture/system-overview.html`：搜索 `SceneColorPresetRepository` 的 ArrowDown/ArrowUp/Enter 到达 `#ownership`，复制与术语 hover/click 通过；移动目录定位后章节顶边为 176px，11 个宽表/代码块在自身容器滚动且页面无横向溢出。恰有一个 `docs-home-navigation`，点击实际到达 `docs/index.html`。
- `$bun-html-docs` 首屏复核：两页的标题、lead、当前结论和首节仍先解释普通读者可见的问题、协作原因、责任边界和当前状态；本轮只更新事实内容，没有修改既有搜索、导航、Wiki、复制或响应式壳层。

## 13. 文档同步检查

- 产品文档：`docs/product/mvp.md` 已同步颜色/预设 Tab、命名九色、双列无色条卡片、新建 640 × 360 / 兼容旧 320 × 180 Blob、V11 默认图、刷新启动语义、IndexedDB v5 和明确非目标。
- 架构文档：`docs/architecture/system-overview.html` 已按 `$bun-html-docs` 同步 v5 schema、repository、当前/持久状态所有权、640 × 360 截图数据流、旧 Blob 兼容、中性失败回退、双列卡片、object URL 生命周期、源码地图和验证证据。
- 决策文档：实现遵循既有“本地数据事实与场景投影边界”ADR；预设只保存领域值和 Blob，Three.js 只返回当前帧且不读写数据库，无需新增或替代 ADR。
- 文档入口：`docs/index.html` 已同步本任务已完成状态与记录入口，并把顶部结论、repository 数量、数据库版本、源码摘要和更新时间更新为当前事实。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-25 17:36 CST | 用户 / Codex | 用户要求场景颜色面板增加预设 Tab，可命名保存当前颜色，并通过预设卡片切换场景颜色。Codex 完成只读核对并创建待确认方案。 |
| 2026-08-25 17:42 CST | 用户 / Codex | 用户补充预设卡片应带场景截图，提出自定义预设可保存 Blob、默认预设也应提供图片。Codex 将方案修订为自定义场景 WebP/PNG Blob、内置 V11 随包 WebP 与九色失败回退，任务仍待确认。 |
| 2026-08-25 17:47 CST | 用户 / Codex | 用户明确回复“批准执行”；IndexedDB v5、命名与删除边界、场景 Blob 截图、V11 固定预览、测试和文档清单获得批准，任务进入实施。 |
| 2026-08-25 18:24 CST | Codex | 完成 IndexedDB v5、颜色/预设 Tab、自定义场景 Blob、固定 V11 图、卡片切色/删除、测试和当前事实文档回写；120 项测试、构建、引用检查、默认图检查、应用与本地 HTML 双视口验收通过，任务进入待验收。 |
| 2026-08-25 18:38 CST | 用户 / Codex | 用户验收反馈要求移除图下色卡、缩小卡片并改为每行两张，同时询问刷新启动语义和 320 × 180 清晰度。Codex 解释 IndexedDB v5 与配色 V11 是不同版本概念，并提出新截图/默认图升至 640 × 360、旧 Blob 兼容且不迁移、继续从 V11 启动的修订方案；任务退回待确认，尚未修改业务源码。 |
| 2026-08-25 18:44 CST | 用户 / Codex | 用户明确回复“批准执行”；双列小卡片、移除色卡、640 × 360 新预览、旧 Blob 兼容以及继续从 V11 启动的修订清单获批，任务重新进入实施。 |
| 2026-08-25 19:20 CST | Codex | 完成双列小卡片、移除图下色卡、中性失败占位、640 × 360 新截图与 V11 默认图、旧 320 × 180 Blob 兼容及文档同步；120 项测试、构建、引用检查、资源尺寸检查、应用与本地 HTML 双视口验收通过，临时预设均已清理，任务重新进入待验收。 |
| 2026-08-26 CST | 用户 | 验收通过，确认本任务结果可提交。 |
