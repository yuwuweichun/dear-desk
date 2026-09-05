# 当前装饰工坊与贴纸系统架构

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 当前源码事实 |
| 最后更新 | 2026-09-04 |
| 对应任务 | `DD-20260808-002`, `DD-20260820-005`, `DD-20260904-001` |
| 数据版本 | IndexedDB v5；墙面 surface 复用现有索引，无 schema 升级 |

## 1. 用户调用链

“装饰工坊”是文字与图片装饰的唯一用户入口，与日记并列。桌面稳定状态同时显示“打开本子”和“装饰工坊”；打开本子后，左页固定展示当前右页日期的贴纸并提供“前往装饰工坊”入口；日记编辑器不读取正文草稿来制作装饰。

```text
装饰工坊
  -> 选择文字或图片
  -> 图片可保留矩形 / 自动抠图 / 手动修整
  -> Sticker Forge 预览材质与 peel
  -> 捕获 flat 透明 PNG
  -> 选择放到桌面 / 日记 / 墙面
  -> 点击目标区域落位
  -> 移动 / 桌面日记 0.5×～2×、墙面 0.5×～5× 等比缩放 / 15° 旋转 / 完成或删除
  -> IndexedDB 恢复
```

“放到日记”使用 store 当前的 `selectedDate`，它仍固定表示今天。`DD-20260809-001` 新增的历史双页浏览使用独立 `journalCursor`，不会把贴纸目标悄悄改成正在查看的历史页。某日期可以只有贴纸而没有 `DailyEntry` 文本行，这类日期也会进入日记页序。

## 2. 运行时所有权

- `src/app/App.tsx` 提供独立入口，并在 `composing` 时卸载 Dear Desk R3F 场景、挂载 `StickerStudio`。
- `src/features/stickers/StickerStudio.tsx` 拥有 source 类型、图片处理结果、Forge session、材质和目标选择等临时制作状态。
- `src/integrations/sticker-forge.ts` 只调用固定 commit 的公开 `createSticker`、`setSource`、`setOptions`、`reset`、`getState` 和 `destroy`。
- `src/integrations/background-removal.worker.ts` 在 worker 中运行浏览器 WASM 推理；不创建 WebGL renderer，也不访问远端模型。
- `src/features/journal/JournalStickerLayer.tsx` 是纸页上的 DOM 贴纸投影；`src/scene/StickerObject.tsx` 和 `WallStickerObject.tsx` 分别负责桌面水平面与北墙垂直面的 R3F 投影。
- `src/state/app-store.ts` 拥有 `idle | composing | placingDesk | placingJournal | placingWall` 工作流、三个 surface 的可见集合和共享选择状态。
- `src/persistence/sticker-repository.ts` 是贴纸持久化唯一写入口。

`openStickerStudioFromJournal()` 会先把 `notebookPhase` 从 `editing` 收回 `desk`，再切换 `stickerWorkflow: composing`；日记 DOM 与桌面 R3F 随之卸载，Sticker Forge 接管制作 Canvas。取消制作后回到桌面空闲态。

因此任意时刻仍只有一个活跃 WebGL Canvas：桌面由 R3F 拥有，制作时由 Sticker Forge 拥有；图片规范化、手动修整和自动抠图只使用 Canvas 2D、worker 与 WASM。

## 3. 图片处理链路

`normalizeStickerImage()` 只接受 PNG、JPEG、WebP，拒绝超过 `15 MB` 的文件。浏览器解码并应用图像方向后，把最长边限制为 `4096px`，统一转成 PNG。原始上传文件不会进入 IndexedDB。

三种背景路径共享同一份规范化 PNG：

- 保留矩形：直接把规范化 PNG 交给 Forge。
- 自动抠图：worker 从同源 `/models/BritishWerewolf/U-2-Netp/` 读取固定 U-2-Netp ONNX 模型，以 `320 × 320` letterbox 输入生成 soft matte，再将结果恢复到原图大小。
- 手动修整：DOM 工作台使用 Canvas 2D 蒙版，支持框选、画笔、添加、移除、画笔大小和缩放；确认后输出新的透明 PNG。

Forge 收到浏览器 object URL 形式的公开 `image` source。object URL 在 source 切换或组件卸载时回收；确认后的 source PNG 才进入持久化。

## 4. IndexedDB v5 数据结构

| 表 | 记录 | 职责 |
| --- | --- | --- |
| `dailyEntries` | `DailyEntry` | 某日期的正文，可不存在 |
| `stickerSourceAssets` | `StickerSourceAsset` | 已确认图片 source PNG；文字贴纸不创建 |
| `stickerDefinitions` | `StickerDefinition` | 文字或图片定义、Forge 参数和快照引用 |
| `stickerRenderAssets` | `StickerRenderAsset` | 固定 Forge commit 生成的 flat PNG |
| `stickerInstances` | `StickerInstance` | surface、位置、旋转与等比尺寸；旧记录缺少尺寸时按 `1×` 读取 |

图片贴纸创建在一个 Dexie 事务中写入 source asset、definition、render asset 和 instance；删除时在同一事务清理四类记录。文字贴纸不创建 source asset。v2→v3 升级给旧 instance 补 `surface: 'desk'`，保留原位置、旋转、definition 和 PNG。

墙面装饰只增加 `StickerInstance.surface = 'wall'` 联合成员。v5 已有 `surface` 索引，因此无需新表、迁移或版本升级；`listWall()` 直接按该索引恢复实例。

## 5. 坐标与交互

- 桌面位置使用 `{ x, z }` 世界坐标；透明命中面覆盖 `12 × 8` 桌板顶面，坐标 clamp 按当前等比尺寸保留旋转外接圆净空，不再限制在桌垫边界。
- 日记位置使用 `{ x, y }` 的 `0..1` 归一化纸页坐标，使响应式尺寸变化后仍能恢复相对位置。
- 墙面位置也使用 `{ x, y }` 的 `0..1` 归一化北墙坐标。`wall-sticker-layout.ts` 从 `STUDY_ROOM_MODEL_SPEC` 映射到世界坐标，并按最大边 `1.72` 的外接圆净空避开墙边和窗框；首次放置、拖拽和恢复共用同一布局函数。
- 三个 surface 共用选择、`0.25×` 步进的等比缩放、`15°` 旋转、完成和删除命令；桌面和日记范围为 `0.5×～2×`，墙面范围为 `0.5×～5×`。移动使用各自的 pointer 投影和坐标 clamp。尺寸保存在可选 `scale` 字段，旧记录和无效值按 `1×` 读取，不升级 IndexedDB schema。历史字段 `rotationY` 在墙面投影中解释为 Z 轴旋转，避免数据迁移。
- 日记正常编辑时左页贴纸层接收贴纸对象 pointer，右页只承载正文 textarea；`placingJournal` 时左页贴纸层接管点击，正文输入暂时禁用。贴纸仍使用当前 `selectedDate` 写入日记，历史日期只读。
- `placingWall` 时只挂载一个透明北墙命中平面；墙面装饰与 `StudyRoomShell` 一同受 `showRoomBackground` 控制。若房间此前隐藏，确认“放到墙面”会先恢复房间。

## 6. 失败路径

- 文件类型、大小或解码失败：停留在工作台，不写库。
- 自动模型加载、推理或 worker 失败：显示错误并保留“矩形/手动修整”退路，不写库。
- 用户取消自动抠图：终止 worker，不改变当前图片。
- Forge 未 ready 或 flat 捕获失败：保留制作状态，不进入放置。
- IndexedDB 创建失败：保留 pending draft 和放置状态，显示可重试错误。
- 读取贴纸时发现 `stickerInstances.definitionId` 或 `stickerDefinitions.previewAssetId` 缺失：跳过该残缺关联记录，继续返回其他完整贴纸；本次读取不改写或删除原始数据。
- 移动写入失败：重新读取三个 surface，恢复持久化事实。
- 删除失败：保留 UI 记录并显示错误，不假装已删除。

## 7. 第三方与源码地图

- Sticker Forge 固定 commit：`068caa49eef69745564a5debbc01bab3fcd31042`，MIT；vendored 文件位于 `public/vendor/sticker-forge/`。
- U-2-Netp 模型随同一固定提交保存于 `public/models/BritishWerewolf/U-2-Netp/`，Apache-2.0；ONNX 文件大小 `4,574,861` 字节，SHA-256 为 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`。
- 浏览器推理依赖固定为 `@huggingface/transformers@4.2.0`；worker 设置 `allowRemoteModels = false`。

主要源码：

- `src/domain/sticker.ts`：definition/draft/instance union、坐标、尺寸规则和验证。
- `src/persistence/database.ts`：IndexedDB v1→v2→v3 schema 与迁移。
- `src/persistence/sticker-repository.ts`：三 surface 查询与原子事务。
- `src/state/app-store.ts`：独立制作与三目标状态机。
- `src/features/stickers/`：工作台、手动抠图和统一控制条。
- `src/features/journal/JournalStickerLayer.tsx`：日记 DOM 放置与拖动。
- `src/scene/StickerObject.tsx`：桌面 R3F PNG 投影。
- `src/scene/WallStickerObject.tsx`、`src/scene/wall-sticker-layout.ts`：墙面 R3F PNG 投影、拖拽平面和窗洞净空。
