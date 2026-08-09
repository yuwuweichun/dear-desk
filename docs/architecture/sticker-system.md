# 当前贴纸系统架构

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 当前源码事实 |
| 最后更新 | 2026-08-08 |
| 对应任务 | `DD-20260808-002` |
| 数据版本 | IndexedDB v3 |

## 1. 用户调用链

贴纸系统与日记是两个并列入口。桌面稳定状态同时显示“打开本子”和“贴纸工作台”；日记编辑器不再读取正文草稿来制作贴纸。

```text
贴纸工作台
  -> 选择文字或图片
  -> 图片可保留矩形 / 自动抠图 / 手动修整
  -> Sticker Forge 预览材质与 peel
  -> 捕获 flat 透明 PNG
  -> 选择放到桌面或放到日记
  -> 点击目标区域落位
  -> 移动 / 15° 旋转 / 删除
  -> IndexedDB 恢复
```

“放到日记”使用 store 当前的 `selectedDate`。当前产品还没有历史日期切换，因此实际目标是当天。某日期可以只有贴纸而没有 `DailyEntry` 文本行。

## 2. 运行时所有权

- `src/app/App.tsx` 提供独立入口，并在 `composing` 时卸载 Dear Desk R3F 场景、挂载 `StickerStudio`。
- `src/features/stickers/StickerStudio.tsx` 拥有 source 类型、图片处理结果、Forge session、材质和目标选择等临时制作状态。
- `src/integrations/sticker-forge.ts` 只调用固定 commit 的公开 `createSticker`、`setSource`、`setOptions`、`reset`、`getState` 和 `destroy`。
- `src/integrations/background-removal.worker.ts` 在 worker 中运行浏览器 WASM 推理；不创建 WebGL renderer，也不访问远端模型。
- `src/features/journal/JournalStickerLayer.tsx` 是纸页上的 DOM 贴纸投影；`src/scene/StickerObject.tsx` 是桌面上的 R3F 投影。
- `src/state/app-store.ts` 拥有 `idle | composing | placingDesk | placingJournal` 工作流、两个 surface 的可见集合和选择状态。
- `src/persistence/sticker-repository.ts` 是贴纸持久化唯一写入口。

因此任意时刻仍只有一个活跃 WebGL Canvas：桌面由 R3F 拥有，制作时由 Sticker Forge 拥有；图片规范化、手动修整和自动抠图只使用 Canvas 2D、worker 与 WASM。

## 3. 图片处理链路

`normalizeStickerImage()` 只接受 PNG、JPEG、WebP，拒绝超过 `15 MB` 的文件。浏览器解码并应用图像方向后，把最长边限制为 `4096px`，统一转成 PNG。原始上传文件不会进入 IndexedDB。

三种背景路径共享同一份规范化 PNG：

- 保留矩形：直接把规范化 PNG 交给 Forge。
- 自动抠图：worker 从同源 `/models/BritishWerewolf/U-2-Netp/` 读取固定 U-2-Netp ONNX 模型，以 `320 × 320` letterbox 输入生成 soft matte，再将结果恢复到原图大小。
- 手动修整：DOM 工作台使用 Canvas 2D 蒙版，支持框选、画笔、添加、移除、画笔大小和缩放；确认后输出新的透明 PNG。

Forge 收到浏览器 object URL 形式的公开 `image` source。object URL 在 source 切换或组件卸载时回收；确认后的 source PNG 才进入持久化。

## 4. IndexedDB v3 数据结构

| 表 | 记录 | 职责 |
| --- | --- | --- |
| `dailyEntries` | `DailyEntry` | 某日期的正文，可不存在 |
| `stickerSourceAssets` | `StickerSourceAsset` | 已确认图片 source PNG；文字贴纸不创建 |
| `stickerDefinitions` | `StickerDefinition` | 文字或图片定义、Forge 参数和快照引用 |
| `stickerRenderAssets` | `StickerRenderAsset` | 固定 Forge commit 生成的 flat PNG |
| `stickerInstances` | `StickerInstance` | `desk` 世界坐标或 `journal + journalDate` 归一化坐标 |

图片贴纸创建在一个 Dexie 事务中写入 source asset、definition、render asset 和 instance；删除时在同一事务清理四类记录。文字贴纸不创建 source asset。v2→v3 升级给旧 instance 补 `surface: 'desk'`，保留原位置、旋转、definition 和 PNG。

## 5. 坐标与交互

- 桌面位置使用 `{ x, z }` 世界坐标，并限制在桌垫边界。
- 日记位置使用 `{ x, y }` 的 `0..1` 归一化纸页坐标，使响应式尺寸变化后仍能恢复相对位置。
- 两个 surface 共用选择、`15°` 旋转、删除命令；移动使用各自的 pointer 投影和坐标 clamp。
- 日记正常编辑时贴纸层本身不拦截 textarea，只有贴纸对象接收 pointer；`placingJournal` 时纸页层接管点击，正文输入暂时禁用。

## 6. 失败路径

- 文件类型、大小或解码失败：停留在工作台，不写库。
- 自动模型加载、推理或 worker 失败：显示错误并保留“矩形/手动修整”退路，不写库。
- 用户取消自动抠图：终止 worker，不改变当前图片。
- Forge 未 ready 或 flat 捕获失败：保留制作状态，不进入放置。
- IndexedDB 创建失败：保留 pending draft 和放置状态，显示可重试错误。
- 移动写入失败：重新读取两个 surface，恢复持久化事实。
- 删除失败：保留 UI 记录并显示错误，不假装已删除。

## 7. 第三方与源码地图

- Sticker Forge 固定 commit：`068caa49eef69745564a5debbc01bab3fcd31042`，MIT；vendored 文件位于 `public/vendor/sticker-forge/`。
- U-2-Netp 模型随同一固定提交保存于 `public/models/BritishWerewolf/U-2-Netp/`，Apache-2.0；ONNX 文件大小 `4,574,861` 字节，SHA-256 为 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`。
- 浏览器推理依赖固定为 `@huggingface/transformers@4.2.0`；worker 设置 `allowRemoteModels = false`。

主要源码：

- `src/domain/sticker.ts`：definition/draft/instance union、坐标规则和验证。
- `src/persistence/database.ts`：IndexedDB v1→v2→v3 schema 与迁移。
- `src/persistence/sticker-repository.ts`：双 surface 查询与原子事务。
- `src/state/app-store.ts`：独立制作与双目标状态机。
- `src/features/stickers/`：工作台、手动抠图和统一控制条。
- `src/features/journal/JournalStickerLayer.tsx`：日记 DOM 放置与拖动。
- `src/scene/StickerObject.tsx`：桌面 R3F PNG 投影。
