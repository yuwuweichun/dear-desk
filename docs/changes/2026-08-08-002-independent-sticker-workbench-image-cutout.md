# DD-20260808-002：建立独立贴纸工作台并支持图片抠图与双目标放置

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 / 贴纸系统 / 图片处理 / 本地持久化 |
| 创建时间 | 2026-08-08 22:01 CST |
| 最后更新 | 2026-08-09 19:40 CST |
| 当前阶段 | HTML 当前事实已补齐，开发者（用户）已验收，任务完成 |
| 源码基线 | `e97a596cb944d7eeb7d81002c3f8083bd8dd0654` |
| 实现提交 | `fe2fc89`：`feat(stickers): add independent sticker workbench` |
| 关联任务 | 用户要求贴纸系统脱离日记成为独立工作台，新增图片贴纸与抠图，并支持放到桌面或日记 |

> 用户已于 2026-08-08 22:24 CST 明确回复“按此执行”。本文所列八项建议均获批准，现进入实施阶段。

## 1. 给阅读者的结论

贴纸应从“日记草稿的附属动作”提升为与本子并列的独立工具。建议在桌面稳定状态提供独立“贴纸工作台”入口，移除日记编辑器里的“制作贴纸”主入口；用户进入工作台后选择文字或图片，图片可保留矩形、自动抠图或手动修整，再使用真实 Sticker Forge 预览并选择“放到桌面”或“放到日记”。

“放到桌面”复用现有 R3F 桌垫放置链路；“放到日记”建议打开当前日期的本子，在 DOM 纸页贴纸层中点击落位，并支持移动、`15°` 旋转、删除和重开恢复。日记可以只有贴纸而没有正文，不强制创建空的 `DailyEntry`。

本需求与已批准 MVP 的旧边界存在显式冲突：MVP 原先把“图片透明轮廓提取”列为非目标。本任务若获批准，将以“图片贴纸支持本地抠图”替代该旧边界；批准前不会修改产品事实文档或业务源码。

## 2. 用户需求

用户原始要求：

- 贴纸需要增加图片贴纸与抠图。
- 从功能入口角度，贴纸系统应独立于日记。
- 进入贴纸系统后是类似 Sticker Forge 的贴纸工作台。
- 制作完成后可选择“放到桌面”或“放到日记”。

Codex 将其解释为：

- 贴纸创建不再要求先打开本子或从日记草稿发起；文字与图片共享同一个独立工作台。
- 工作台最终提供两个明确动作：“放到桌面”和“放到日记”，而不是先保存到一个与目标无关的图库。
- 图片上传、校验、自动抠图、手动修整和临时预览全部在当前浏览器本地完成，不上传服务器。
- Dear Desk 继续使用固定版本 Sticker Forge 的公开图片 source API 生成贴纸视觉；目标选择、桌面/日记位置、图片资产、持久化与恢复由 Dear Desk 负责。
- “放到日记”当前指向 store 的 `selectedDate`；由于日期切换尚未实现，当前实际就是当天页面。本任务不顺带实现历史日期选择。

## 3. 当前源码事实

- 当前分支为 `main`，基线提交是 `e97a596c`。工作区在本文创建前已有用户修改：`package-lock.json` 删除若干可选原生包的 `libc` 元数据，`docs/changes/2026-08-08-001-establish-main-default-branch.md` 未跟踪；本任务不得覆盖或回退它们。本文是本轮新增的第三个未提交项。
- 唯一贴纸入口位于 `src/features/journal/JournalPanel.tsx`。按钮读取未保存的日记 `draft`，要求本子处于 `editing`，并限制文字不超过 `60` 个字符；因此贴纸当前在入口和草稿生命周期上依赖日记。
- `src/state/app-store.ts` 的 `StickerWorkflow` 只有 `idle | composing | placing`。`startStickerComposer(text)` 会把本子从 `editing` 直接切回 `desk`；取消制作返回 `editing` 并恢复日记草稿。该状态机不能表达独立入口、图片源、目标选择或日记贴纸放置。
- `src/features/stickers/StickerStudio.tsx` 只呈现文字输入、五种颜色和四种材质，最终按钮固定为“放到桌面”。它不包含 source 类型切换、文件选择、拖放、抠图、目标选择或日记放置。
- `src/integrations/sticker-forge.ts` 把上游 source 类型收窄为文字，但固定提交 `068caa49` 的公开类型声明实际支持 `text`、`image` 和 `svg`。图片 source 接受浏览器可解码 URL；透明 alpha 会驱动 Sticker Forge 的轮廓。适配器可以在不访问上游私有 renderer 的前提下扩展为图片 source。
- 固定 ES bundle 只包含可复用贴纸引擎，不包含上游完整 React 工作台的自动/手动抠图 UI。上游自动抠图由 `workers/background-removal.worker.ts`、`@huggingface/transformers`、WASM 和同源 U-2-Netp 模型组成；模型文件 `onnx/model.onnx` 为 `4,574,861` 字节、Apache-2.0，worker 明确禁止远端模型并从 `/models/` 本地读取。上游手动抠图属于 React 应用源码，使用 Canvas 2D 的框选、画笔、添加/移除和缩放，不是公开 embed API。
- 当前 `package.json` 没有 `@huggingface/transformers`，仓库也没有抠图 worker、本地模型或图片资源来源清单。接入自动抠图将修改依赖与锁文件，因此必须在实施时保留并核对现有 `package-lock.json` 用户差异。
- `src/domain/sticker.ts` 的 `StickerDefinition.kind` 固定为 `text`，`sourceEntryDate` 必填；`StickerInstance.position` 只有桌面世界坐标 `{ x, z }`。`src/persistence/database.ts` 当前是 IndexedDB v2，只有日记表及 definition、render asset、instance 三张贴纸表，没有 `Asset` 表、目标 surface 或日记日期索引。
- `src/persistence/sticker-repository.ts` 假设一个 definition 对应一个桌面 instance，并在一个事务中创建/删除 definition、PNG render asset 与 instance。现有 007 数据必须在新 schema 中继续被识别为 `desk` 贴纸。
- `DailyEntry` 只有 `date`、`text` 和时间戳；`JournalPanel` 只有 textarea，没有贴纸层。图片或贴纸不能直接塞进 `DailyEntry.text`，否则会混淆正文和资产生命周期。
- `App` 在 `composing` 阶段卸载 R3F 桌面，退出前销毁 Sticker Forge，再恢复桌面，满足单活跃 WebGL Canvas 决策。抠图可以使用 DOM、Canvas 2D 和 worker，但不能再创建第二个 WebGL renderer。
- 当前自动验证记录为 7 个测试文件、23 项用例，覆盖文字贴纸领域、v1→v2、三表事务、store 工作流和日记 UI；没有图片解码、抠图、v2→新版本、目标分流或日记贴纸测试。
- `docs/product/mvp.md` 已批准基础矩形图片贴纸，但同时把“图片透明轮廓提取”列为非目标；用户本轮明确要求抠图，二者冲突，不能静默选择旧边界。

## 4. 目标与非目标

### 4.1 目标

- 在桌面 `desk + idle` 稳定状态提供与“打开本子”并列的“贴纸工作台”入口，不要求先存在日记文字。
- 移除 `JournalPanel` 当前“制作贴纸”入口，使日记与贴纸的功能入口、草稿和取消行为彼此独立。
- 工作台提供“文字 / 图片”source 切换，并保留现有文字颜色、四种材质与 peel 预览。
- 图片首切片支持 PNG、JPEG 与 WebP，限制单文件不超过 `15 MB`；浏览器解码后最长边规范化到不超过 `4096px`，再以 PNG 进入后续处理。
- 图片提供三条可见路径：保留矩形、一次本地自动抠图、自动结果或原图上的手动修整。手动修整至少支持框选/画笔、添加/移除、画笔大小与缩放。
- 自动抠图在 worker 中本地运行固定 U-2-Netp 模型；首轮模型加载、推理进度、失败、取消和手动回退都有明确反馈，图像不上传远端。
- 把处理后的图片通过固定 Sticker Forge 公开 `image` source API 真实渲染；不自研替代其轮廓、材质和 peel 视觉。
- 工作台末尾提供“放到桌面”和“放到日记”两个主动作；捕获同一份 flat 透明 PNG 后进入对应放置状态。
- 桌面目标保留当前点击落位、拖动、`15°` 旋转、删除和重开恢复。
- 日记目标打开当前 `selectedDate` 页面，在 DOM 纸页贴纸层点击落位；放置后支持拖动、`15°` 旋转、删除和重开恢复，并允许只有贴纸、没有正文的页面。
- 图片 source 资产、Forge render asset 和 placement 数据保持可序列化，以 IndexedDB 新版本持久化；现有文字桌面贴纸与 v1 日记必须无损迁移。
- 桌面和移动端都提供可访问、无溢出的工作台、抠图和两种放置体验；任意时刻仍只有一个活跃 WebGL Canvas。

### 4.2 非目标

- 不在本任务实现历史日期选择、翻页或旧痕迹入口；“放到日记”只使用当前 `selectedDate`。
- 不支持 HEIC、AVIF、动画 GIF、视频或 SVG 上传；动画图片即使浏览器可解码也不在本切片承诺范围内。
- 不把原始上传图片永久保存；建议只保存经过方向规范化和用户确认的最终 source PNG，避免原图、抠图结果和 Forge 快照三份长期占用空间。
- 不实现已放置贴纸的重新进入工作台编辑、重新抠图、复制、缩放、多选或层级排序。
- 不实现 Sticker Forge 完整 Gallery、文件夹、导入导出、PNG/GIF/APNG/MOV 导出或嵌入代码。
- 不实现服务端上传、云端抠图、模型训练、账号同步或跨设备迁移。
- 不把日记正文渲染到 WebGL，不把日记贴纸塞进 `DailyEntry.text`，也不为日记贴纸创建独立 WebGL Canvas。
- 不持久化 peel 瞬时状态，不让桌面或日记上的每张贴纸运行独立 Sticker Forge renderer。
- 不在本任务开放上游全部光照、阴影、背胶、字体或高级材质参数。

## 5. 方案说明

### 5.1 独立入口与工作流

建议工作流如下：

```text
桌面稳定态
  -> 点击“贴纸工作台”
  -> App 卸载 DeskScene，Sticker Forge 成为唯一 WebGL Canvas 所有者
  -> 选择“文字”或“图片”
  -> 图片：保留矩形 / 自动抠图 / 手动修整
  -> Sticker Forge 材质与 peel 预览
  -> 选择“放到桌面”或“放到日记”
  -> reset + flat wait + 透明 PNG 裁切 + destroy Forge
  -> 桌面放置，或打开当前日记并在纸页放置
  -> 成功落位后才原子写入 IndexedDB
```

取消工作台始终回到桌面稳定态，不再返回或恢复日记草稿。现有 `StickerWorkflow` 建议拆为 `idle | composing | placingDesk | placingJournal`，临时 source、处理阶段、目标和错误由 store 的可序列化字段协调；File、ImageBitmap、Canvas、worker、Forge session 与对象 URL 只留在对应组件或 integration 生命周期。

### 5.2 图片输入与抠图

工作台图片页签提供文件选择和拖放。文件先检查 MIME、大小与可解码性，再通过浏览器图像解码和 Canvas 2D 规范化方向、尺寸与 PNG 像素；Canvas 重编码会去除 JPEG EXIF 等不需要的元数据。对象 URL 在 source 替换、取消和卸载时释放。

建议提供三个背景状态：

1. **保留矩形**：使用规范化 PNG 原图；不要求先抠图，保证模型不可用时仍能完成图片贴纸。
2. **自动抠图**：懒加载本地 worker、Transformers.js WASM 和固定 U-2-Netp 模型，显示模型加载与主体识别进度；成功后返回带 soft alpha 的 PNG。
3. **手动修整**：在 DOM 对话框内用 Canvas 2D 框选或涂抹保留区域，支持添加与移除；既可以修正自动结果，也可以直接从原图开始。

现有固定 Sticker Forge ES bundle 不升级；`src/integrations/sticker-forge.ts` 只扩展公开的 `StickerSource` union 和 `setSource()`。抠图不是 embed bundle 的公开 API，建议把固定上游提交中的 worker 算法、手动交互语义和同版本模型作为有来源记录的独立 vendored integration 引入，而不是把整个上游 React 应用复制进 Dear Desk。模型与代码分别保留 MIT、Apache-2.0、上游 commit、模型 revision、文件大小与 SHA-256。

### 5.3 目标选择与放置

工作台底部用两个同级按钮替代当前单一“放到桌面”：

- **放到桌面**：生成 `pendingSticker` 后进入 `placingDesk`，恢复现有 R3F 桌面并使用桌垫 raycast。点击成功前不写数据库。
- **放到日记**：生成同一 draft 后进入 `placingJournal`，恢复 R3F 并触发当前本子打开流程；进入 `editing` 后在纸页可放置区域显示 DOM 落位提示。点击纸页才创建持久化记录。

日记 placement 使用相对纸页的 `{ x, y }` 归一化坐标而不是屏幕像素，确保桌面与移动端重排后位置仍稳定。贴纸以持久化 PNG Blob 的对象 URL 显示，旋转单位仍为弧度、操作步长仍为 `15°`。放置模式期间 textarea 暂停指针输入，放置成功或取消后恢复；常态下只有贴纸自身接收选择/拖动，其余纸页仍可编辑文字。

日记贴纸可以独立于 `DailyEntry` 存在：repository 按 `journalDate` 查询 placement，不要求当天已有正文行。未来日期切换只需改 `selectedDate` 并重新查询，不需要迁移贴纸数据。

### 5.4 持久化和失败边界

图片工作台只在内存中保留原始上传；成功落位时，建议在一个事务中写入确认后的 source PNG `Asset`、`StickerDefinition`、Sticker Forge `StickerRenderAsset` 和目标 `StickerInstance`。文本贴纸不创建 source `Asset`。取消工作台、取消抠图、取消目标放置或快照失败均不写半成品。

自动抠图失败时保留原图并提供“手动修整”与“保留矩形”；模型/worker 不可用不得阻止文字贴纸或矩形图片贴纸。日记 placement 失败时留在放置模式并显示错误；移动提交失败时重新读取该 surface/date 的持久化位置。删除最后一个 instance 时同事务清理 definition、render asset 和可选 source asset。

## 6. 预计改动与影响评估

| 预计模块 | 预计责任 |
| --- | --- |
| `src/domain/sticker.ts`、可能的新 `src/domain/asset.ts` | 文字/图片 source union、图片限制、cutout provenance、桌面/日记 placement union、坐标 clamp 与校验 |
| `src/persistence/database.ts` | IndexedDB v3，新增 source assets 表和 surface/date 索引；迁移现有 v2 instance 为 `surface: 'desk'` |
| `src/persistence/sticker-repository.ts` | 按 surface/date 查询；原子创建/删除 source asset、definition、render asset 与 placement；移动和旋转两个 surface |
| `src/state/app-store.ts` | 独立打开/取消工作台、source 类型、目标选择、`placingDesk/placingJournal`、按日期加载日记贴纸和失败回滚 |
| `src/app/App.tsx` | 与“打开本子”并列的独立贴纸入口；保持工作台与 R3F Canvas 所有者互斥 |
| `src/features/journal/JournalPanel.tsx` | 删除日记草稿“制作贴纸”入口；加入当前日期 DOM 贴纸层、纸页放置和交互模式 |
| `src/features/stickers/StickerStudio.tsx` 及拆分组件 | 文字/图片页签、上传/拖放、抠图入口、进度/错误、双目标按钮；控制文件规模避免继续把所有逻辑堆在单文件 |
| `src/features/stickers/ImageSourcePanel.tsx` | 文件校验、规范化预览、原图/自动/手动处理选择 |
| `src/features/stickers/ManualCutoutDialog.tsx` | Canvas 2D 框选、画笔、添加/移除、缩放和确认 |
| `src/features/stickers/JournalStickerLayer.tsx` | 归一化坐标投影、选择、拖动、旋转、删除、对象 URL 生命周期 |
| `src/integrations/sticker-forge.ts` | 使用公开 `image` source；保持固定 bundle、flat capture 与幂等 destroy |
| 新的本地抠图 integration / worker | 懒加载固定模型、WASM 推理、进度、取消、重试和纯本地像素输出 |
| `public/models/`、第三方来源与许可证 | 固定 U-2-Netp 文件、revision、哈希、Apache-2.0 与上游代码来源；不访问远端 Hub |
| `package.json`、`package-lock.json` | 增加经批准的 Transformers.js 依赖；实施时逐项保留当前锁文件用户差异 |
| 测试与文档 | 领域、v2→v3、事务、工作流、图片生命周期、双目标、响应式和当前产品/架构事实同步 |

### 6.1 核心数据结构变化

建议把当前仅文字、仅桌面的结构扩展为可判别 union。字段名在实施前可以按真实 TypeScript 约束微调，但语义需保持：

```ts
interface ImageAsset {
  id: string
  kind: 'image'
  blob: Blob                 // 已规范化并经用户确认的 PNG，不保存原始上传
  mimeType: 'image/png'
  width: number
  height: number
  originalName: string
  processing: 'rectangular' | 'automatic' | 'manual'
  createdAt: string
}

type StickerDefinition =
  | { id: string; kind: 'text'; source: TextStickerSource; sourceAssetId?: never }
  | { id: string; kind: 'image'; sourceAssetId: string; source?: never }

type StickerInstance =
  | {
      surface: 'desk'
      position: { x: number; z: number }
      rotation: number
    }
  | {
      surface: 'journal'
      journalDate: LocalDate
      position: { x: number; y: number } // 0..1，基于纸页可放置区域
      rotation: number
    }
```

现有 `StickerRenderAsset` 继续保存 Sticker Forge 最终 flat PNG 与固定 upstream commit；`ImageAsset` 保存可解释的图片 source，二者职责不同。`sourceEntryDate` 不再是所有 definition 的必填来源：旧文字记录可以保留该字段作为 provenance，新独立工作台创建的 definition 不伪造“来自日记”。日记目标日期属于 `StickerInstance.journalDate`，不属于 source。

数据库建议升级到 v3：新增 `assets: 'id, kind, createdAt'`，把 `stickerInstances` 索引扩展为 `id, definitionId, surface, journalDate, updatedAt`。升级事务为所有现有 v2 instance 补 `surface: 'desk'`，保留原 `{ x, z }` 与旋转；不改写 v1/v2 日记、definition、render asset Blob。迁移失败不得删除或重建数据库。

### 6.2 上下游与跨模块影响

- `JournalPanel` 不再提供贴纸 source；工作台可以在没有 `DailyEntry` 时独立创建内容。日记只成为一种 placement surface。
- `App` 仍通过条件装载保证 R3F 与 Forge 不并存；自动/手动抠图的 Canvas 2D 不属于第二个 WebGL Canvas，但 worker 与 WASM 需要独立释放和取消边界。
- Sticker Forge 仍只负责制作视觉。图片文件、抠图模型、目标选择、source asset 和两个 surface 的位置不进入上游 session。
- repository 需要从当前 `list()` 全量加载改成 `listDesk()` 与 `listJournal(date)` 或等价查询，避免打开桌面时把所有历史日记 Blob 都载入内存。
- `StickerObject` 可以继续消费统一的 `PlacedSticker` render asset；日记层应复用 Blob URL 管理辅助逻辑，但不复用 R3F Mesh。
- 日记纸页贴纸层会与 textarea 共享 DOM 区域。放置模式必须明确暂停输入，常态需要正确的 pointer ownership、键盘选择和删除入口；透明 PNG 的 DOM 命中暂按矩形边界处理，不承诺 alpha 精确点击。
- 自动抠图依赖、WASM 和约 `4.57 MB` 模型只在用户首次请求自动抠图时懒加载；普通打开桌面、写日记、制作文字贴纸和矩形图片不得等待模型。
- 规范化图片、source PNG 与最终 Forge PNG 会占用 IndexedDB 配额。单文件限制、最长边限制、只保存处理后 source、事务失败反馈和删除清理都是必需边界。
- 当前主 bundle 已有 Vite 大包提示。worker、Transformers.js 和模型必须独立分包/静态资产，不进入首屏主 bundle；构建需记录每项资产增量。
- 产品范围将从“矩形图片、不抠图”改为“矩形或本地抠图图片”；实施结束必须同步 `docs/product/mvp.md`。数据库、资产所有权、worker/WASM 与日记 placement 改变当前架构，必须同步架构 HTML；修改 HTML 前需另行读取 HTML 规范。
- 固定上游应用源码和模型形成新的长期第三方资产约束，建议实施时新增 ADR，记录引擎 bundle 与抠图 integration 的不同更新边界。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 与已批准 MVP 冲突 | 未显式替代“图片透明轮廓提取非目标”就实施 | 产品文档与源码相互矛盾 | 本任务批准时明确替代旧边界；实施后同步 MVP，不把抠图写成既有事实 |
| 自动抠图在移动端过重 | 首次加载 Transformers.js/WASM/模型或高分辨率推理 | 长等待、内存峰值、页面冻结 | 懒加载、worker、4096 输入规范化、进度与取消；失败可回到矩形或手动模式 |
| 上游内部能力并非公开 API | 直接 import 上游 React 应用或私有路径 | 升级脆弱、样式与架构耦合 | 引擎只用公开 image API；抠图能力作为独立有来源 integration 固定版本并由 Dear Desk UI 包装 |
| 模型或许可证来源不清 | 只复制权重、不保存 revision/哈希/Apache 文本 | 无法审计和安全分发 | 保存 upstream commit、模型 revision、SHA-256、MIT/Apache-2.0 与来源说明 |
| 图片配额耗尽 | 保存原图、处理图、Forge 图或大量大图 | IndexedDB 事务失败、已有数据受压力 | 15 MB/4096 限制，只长期保存处理后 source 与最终 PNG；显示 quota 错误，原子回滚 |
| v2→v3 迁移破坏现有贴纸 | union/index 更新遗漏旧记录 | 007 贴纸消失或无法移动 | 迁移测试为旧 instance 补 `desk`；不修改旧 Blob；回退保留 v3 表和数据 |
| 日记贴纸遮挡正文 | 自由贴纸与 textarea 共用纸页 | 输入、选择或阅读困难 | 放置态暂停输入；常态仅贴纸命中；约束纸页边界并进行桌面/移动验收 |
| 响应式位置漂移 | 保存 CSS 像素坐标 | 更换视口后贴纸偏离纸页 | 保存 0..1 归一化纸页坐标，渲染时映射当前可放置矩形 |
| Canvas 所有权回归 | 工作台、桌面和抠图错误并发创建 WebGL renderer | WebGL context、事件和性能冲突 | 自动/手动抠图只用 Canvas 2D；真实浏览器持续断言最多一个 WebGL Canvas |
| 图片生命周期泄漏 | source 切换或取消时未释放 URL/bitmap/worker/texture | 连续制作后内存增长 | 组件 teardown、Abort/会话令牌、`revokeObjectURL`、worker terminate 和浏览器重复开关验收 |
| 自动抠图结果不可靠 | 复杂背景、透明主体、头发或低对比照片 | 用户无法得到可用贴纸 | 同屏保留原图、自动结果和手动修整；自动结果从不直接覆盖持久化事实 |
| 锁文件改动重叠 | 新依赖安装机械改写当前 `package-lock.json` 用户差异 | 覆盖用户工作或产生无关 diff | 实施前重新核对差异；安装后逐项比较，保留现有 `libc` 元数据删除或暂停请求用户决定 |

回退分三层：自动抠图失败时回退到手动或矩形图片；日记 placement 有问题时可暂时只开放桌面目标而保留已写入的 journal 数据读取；整体功能回退时关闭独立入口和新写入，但保留 IndexedDB v3、source asset 与 placement，不降级 schema、不清理用户图片。任何删除用户 Blob 的操作都需要单独授权。

## 8. 验证与验收

- 自动测试：覆盖文件类型/大小/尺寸、文字与图片 definition union、桌面/日记坐标 clamp、v2→v3 迁移、旧文字贴纸保持 `desk`、四表原子创建/删除、按 surface/date 查询、store 独立入口与双目标状态、取消/失败不写库、日记贴纸 DOM 交互、对象 URL 清理；worker 使用接口替身验证进度、取消和失败回退。
- 抠图验证：使用透明 PNG、普通 JPEG、复杂背景和无明显前景样本，确认矩形、自动、自动后手动添加/移除均生成非空 alpha；模型文件哈希、revision、许可证和同源加载路径与记录一致。
- 构建与静态检查：运行 `npm run lint`、`npm run test`、`npm run build`、`node scripts/check-doc-references.mjs`、`git diff --check`；记录主 bundle、worker、Transformers.js、WASM 与模型各自增量，确认模型不进入首屏 chunk。
- 浏览器验收：统一使用 ego-browser，在桌面 `1440 × 900` 与移动端 `390 × 844` 验证独立入口、日记内旧入口移除、文字贴纸回归、图片选择/拖放、三种背景路径、peel、两个目标、取消和错误；页面无横向溢出、键盘焦点可达、reduced-motion 可用。
- Canvas 与性能：全流程任意时刻最多一个 WebGL Canvas；连续进入/退出工作台、切换图片和自动/手动抠图后无残留 Canvas、worker、对象 URL 或控制台错误；记录首次与再次自动抠图耗时和移动端可接受性。
- 桌面目标：点击桌垫落位，移动、双向 `15°` 旋转、删除；未点击成功不写库；刷新后图片视觉、位置和方向恢复。
- 日记目标：选择后自动打开当天页面，在纸页落位，移动、旋转、删除；允许正文为空；关闭/重开本子、刷新页面、桌面/移动视口切换后仍按归一化位置恢复。
- 迁移与恢复：使用真实形状的 v1 日记和 v2 文字贴纸升级到 v3，验证文字、Blob、桌面坐标和方向不变；新图片 source asset/definition/render/instance 任一写入失败都不留下部分记录。
- 成功标准：用户不经过日记即可完成文字或图片贴纸；图片可本地保留矩形、自动抠图或手动修整；同一工作台能明确放到桌面或当天日记，两处均可交互并持久化，且不破坏现有日记、文字贴纸和单 Canvas 边界。

## 9. 待确认项与决策

### 决策 1：独立入口是否移除日记内旧入口

**建议：桌面提供唯一主入口，并移除 `JournalPanel` 的“制作贴纸”按钮。** 这最符合“贴纸系统和日记独立”；日记只作为输出目标。若保留日记快捷入口，用户仍会把贴纸理解为日记附属功能，而且需要继续维护未保存草稿跨工作台恢复。

### 决策 2：首切片抠图范围

**建议：同时提供“保留矩形、自动抠图、手动修整”。** 自动抠图满足快速使用，手动修整为模型失败提供可控出口，矩形模式保证低性能设备仍可完成。只做自动抠图范围更小，但复杂图片一旦失败就没有产品内补救。

### 决策 3：“放到日记”的视觉与交互语义

**建议：作为纸页上的可见 DOM 贴纸层，点击落位后可移动、`15°` 旋转和删除；不只是记录元数据或附件列表。** 这与“放到桌面”保持同一种空间痕迹心智模型。代价是需要处理贴纸与 textarea 的 pointer ownership 和遮挡。

### 决策 4：日记目标日期

**建议：本任务固定使用当前 `selectedDate`，当前即当天；不在工作台增加日期选择器。** 这样不会把尚未实现的历史翻页塞入贴纸任务，未来日期功能只需按已有 `journalDate` 查询。

### 决策 5：图片格式和大小

**建议：首切片支持 PNG、JPEG、WebP，单文件 `15 MB`，规范化最长边 `4096px`；不承诺 HEIC、AVIF、动画 GIF。** 这些格式覆盖主流桌面与手机浏览器，避免同时引入 HEIC 解码和动画语义。

### 决策 6：原始图片是否长期保存

**建议：只保存用户确认后的 source PNG 与最终 Forge PNG，不保存原始上传。** 这样可降低配额与隐私风险；代价是已放置贴纸将来无法无损重新抠图，若未来需要重新编辑，应建立独立资产保留与配额任务。

### 决策 7：抠图复用边界

**建议：Sticker Forge 引擎继续只走固定公开 image API；抠图以同一固定提交的算法、手动交互语义和模型为依据，作为独立 vendored integration 接入并记录 MIT/Apache 来源，不复制整个上游 React 应用。** 这既复用经过验证的能力，又不把 Dear Desk UI 和上游完整工作台耦合。若要求直接嵌入上游完整工作台，必须重新评估其 Gallery、导出、依赖、样式和数据所有权，范围会显著扩大。

### 决策 8：无正文日记

**建议：允许某日期只有日记贴纸而没有 `DailyEntry` 文本行。** 贴纸按 `journalDate` 独立查询，符合“一张照片也算一次有效记录”的产品定位；不创建空文本占位记录。

## 10. 最终批准方案

用户于 2026-08-08 22:24 CST 明确回复“按此执行”，批准本文完整方案与八项建议。最终执行清单如下：

- 建立独立贴纸工作台入口，并移除日记内的贴纸制作入口。
- 同时提供文字贴纸、图片矩形保留、自动抠图与手动修整。
- 最终贴纸可选择放到桌面或当前 `selectedDate` 的日记纸页。
- 图片仅支持 PNG、JPEG、WebP，限制 `15 MB`，最长边规范化到 `4096px`。
- 仅持久化确认后的 source PNG 与 Forge 最终 PNG，不保存原始上传。
- Sticker Forge 继续只使用固定提交的公开 API；抠图独立接入固定模型与可追溯第三方实现。
- 桌面与日记贴纸均支持放置、移动、`15°` 旋转、删除与重开恢复。
- 允许某日期只有日记贴纸而没有正文记录。

## 11. 实施记录

业务实现已完成：

- `src/domain/sticker.ts` 将 definition、draft 与 instance 改为文字/图片和 `desk`/`journal` discriminated union；新增图片限制、日记归一化坐标和 label。
- `src/persistence/database.ts` 升级 IndexedDB v3，新增 `stickerSourceAssets` 和 `[surface+journalDate]` 索引，并把 v2 instance 迁移为 `surface: desk`。
- `src/persistence/sticker-repository.ts` 实现四表原子创建/删除、按 surface/date 查询和坐标类型对应的移动。
- `src/state/app-store.ts` 建立 `idle | composing | placingDesk | placingJournal`，移除日记草稿依赖，分别维护桌面与当日日记贴纸。
- `App` 增加与“打开本子”并列的“贴纸工作台”；`JournalPanel` 移除制作入口并挂载 `JournalStickerLayer`。
- `StickerStudio` 支持文字/图片、选择或拖放、矩形/自动/手动三种背景路径、四种 Forge 材质和两个最终目标。
- 自动抠图移植固定上游 worker，使用 `@huggingface/transformers@4.2.0` 与同源 U-2-Netp；手动修整支持框选、画笔、添加/移除、画笔大小和缩放。
- `public/models/BritishWerewolf/U-2-Netp/` 包含 config、Apache-2.0 LICENSE、SOURCE 与固定 ONNX；未持久化原始上传。
- 增加响应式工作台、日记贴纸层与手动抠图样式；桌面仍只有 R3F Canvas，制作时切换为 Forge Canvas。
- React 质量检查发现并修正日记贴纸对象 URL 的多余 effect state 写入；图片 object URL、worker 和 bitmap 均有释放/终止路径。

当前没有创建提交、推送或 PR。原有 `package-lock.json` 的 `libc` 删除仍保留；实施期间出现的无关未跟踪文档均未修改。

## 12. 验证结果

已完成：

- `npm run lint`：通过。
- `npm test`：使用任务专用临时目录后，10 个测试文件、27 项用例全部通过；覆盖图片类型/大小/4096px 规范化、v2→v3、四表事务、surface/date 查询、独立入口、双目标、日记移动/旋转/删除。首次直接运行被宿主环境中不可用的 Windows 临时子目录阻断，所有测试文件均未加载，不是断言失败。
- `npm run build`：通过；Vite 生成独立 background-removal worker 与 WASM 资源。主 bundle 与 worker 超过默认 500 kB 提示为性能告警，不影响构建。
- 固定模型核对：ONNX `4,574,861` 字节，SHA-256 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`，与批准记录一致。
- `git diff --check`：通过。
- `package-lock.json`：确认原工作区已有的 `libc` 元数据删除仍是删除，没有被安装依赖恢复；新增差异来自固定 Transformers 及其传递/可选依赖。

实施会话结束时尚未完成：

- 当前会话没有 `ego-browser` 工具或可执行文件，不能按项目规则进行桌面 `1440 × 900`、移动 `390 × 844`、自动模型真实推理和 IndexedDB 重开浏览器验收；没有用其他浏览器冒充结果。
- 当前环境也找不到 `/Users/song/Desktop/docs-html/AGENTS.md`，且可用技能中没有并行任务正在要求的 `$bun-html-docs`；因此没有实质修改 `docs/index.html` 或 `docs/architecture/system-overview.html`。
- `node scripts/check-doc-references.mjs` 被实施期间新增、与本任务无关的 `docs/changes/2026-08-08-001-require-bun-html-docs.md` 阻断；该文件缺模板章节，本任务未擅自修改。

后续收口：

- `d28772f` 已在双页日记任务中使用当时恢复的 `$bun-html-docs` 同步 `docs/index.html` 与 `docs/architecture/system-overview.html`，系统入口和架构长文现已覆盖独立工作台、图片抠图、双 surface 与 IndexedDB v3。
- 2026-08-09 全仓 `node scripts/check-doc-references.mjs` 已通过；此前缺模板章节的独立记录已按完整结构补齐。
- 项目指定浏览器工具在本次收口会话仍不可用，未补造自动浏览器证据；开发者（用户）明确确认当前工作区成果已验收，本任务据此关闭。

## 13. 文档同步检查

- 产品文档：已更新 `docs/product/mvp.md`，把贴纸改为独立入口、文字/图片、矩形/本地抠图、桌面/日记双目标，并移除“透明轮廓非目标”冲突。
- 架构文档：`docs/architecture/sticker-system.md` 记录真实调用链、IndexedDB v3、worker/WASM/模型、日记 DOM 层、失败路径与源码地图；后续 `d28772f` 已同步 `system-overview.html`。
- 决策文档：新增 `DD-ADR-20260808-001`，并在既有 Sticker Forge ADR 中链接扩展边界。
- 文档入口：后续 `d28772f` 已把独立工作台、图片抠图和双目标更新为当前源码事实。
- 引用检查：2026-08-09 全仓检查通过。
- 验收状态：开发者（用户）已明确验收；未执行的自动浏览器验证继续作为证据边界保留，不再阻塞任务关闭。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-08 22:01 CST | 用户 | 要求新增图片贴纸与抠图，把贴纸系统从日记中独立出来，并支持放到桌面或日记。 |
| 2026-08-08 22:01 CST | Codex | 创建待确认记录；开始核对当前源码、MVP、架构、决策和固定 Sticker Forge 能力。 |
| 2026-08-08 22:06 CST | Codex | 完成只读核对；补齐独立入口、图片/抠图、本地模型、双 surface placement、v3 迁移、风险、验证和八项待确认决策。 |
| 2026-08-08 22:08 CST | Codex | 文档引用与 Git 差异检查通过；确认未修改业务源码、产品或架构当前事实。 |
| 2026-08-08 22:24 CST | 用户 | 明确回复“按此执行”，批准完整方案与八项建议。 |
| 2026-08-08 22:24 CST | Codex | 将任务推进为实施中，开始按最终执行清单修改源码、测试、依赖与同步文档。 |
| 2026-08-08 23:01 CST | Codex | 业务源码、模型、自动测试、构建、产品 Markdown、贴纸架构 Markdown 与新 ADR 已完成；记录 ego-browser、HTML 规范/技能和无关文档检查三项外部阻断。 |
| 2026-08-09 18:50 CST | 用户 / Codex | 用户要求先提交贴纸工作台相关文件；Codex 复核范围并重跑 lint、测试、构建、模型哈希与差异检查，准备以 `feat(stickers): add independent sticker workbench` 单独提交，排除双页日记与其他无关工作区文件。 |
| 2026-08-09 19:40 CST | 开发者（用户） | 确认当前工作区成果已验收，同意在 HTML 当前事实和全仓引用检查已补齐后将本任务标记为已完成。 |
