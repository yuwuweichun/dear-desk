# DD-ADR-20260808-001：本地图片抠图与双贴纸表面

## 状态

已接受，2026-08-08 22:24 CST。用户在 `DD-20260808-002` 中明确批准本文对应的长期边界。

## 背景

基础文字贴纸把制作入口绑定在日记草稿上，实例只表达桌面世界坐标，也没有图片 source 资产。新增图片、抠图和“放到日记”若继续塞进 `DailyEntry` 或 Three.js 对象，会混淆正文、资产和空间投影的生命周期；若调用远端抠图服务，又会破坏 local-first 边界。

Sticker Forge 的固定公开 API 已支持图片 URL 和透明 alpha，但其完整 React 工作台、自动抠图 worker 与手动抠图 UI 不属于 embed API。因此 Dear Desk 需要在不复制上游私有 renderer 的前提下明确图片处理和 placement 所有权。

## 决策

1. 贴纸工作台是桌面上的独立产品入口，不读取或恢复日记草稿；日记编辑器不提供制作入口。
2. `StickerDefinition` 使用文字/图片 discriminated union。图片定义引用确认后的 `StickerSourceAsset` PNG，原始上传不持久化。
3. 自动抠图固定复用 Sticker Forge commit `068caa49eef69745564a5debbc01bab3fcd31042` 所采用的 `BritishWerewolf/U-2-Netp` 模型与 worker 算法；模型、许可证和来源随仓库存放，运行时禁止远端模型。
4. 手动抠图由 Dear Desk 的 DOM + Canvas 2D 工具负责，提供框选、画笔、添加/移除、画笔大小和缩放；它不创建第二个 WebGL renderer。
5. Sticker Forge 继续只负责公开 image/text source 的轮廓、材质、peel 预览与 flat PNG 捕获；Dear Desk 不访问其私有 renderer、scene 或 mesh。
6. `StickerInstance` 使用 `desk | journal` union。桌面保存 `{x,z}` 世界坐标；日记保存 `journalDate + {x,y}` 归一化纸页坐标。
7. 日记贴纸按日期独立于 `DailyEntry` 查询，允许只有贴纸而没有正文的日期。
8. IndexedDB v3 新增 source asset 表，并将旧 v2 instance 迁移为 `surface: 'desk'`；不清库、不降级、不复制原始上传。

## 原因

- 独立入口让贴纸成为与本子并列的创作工具，取消或失败不会影响日记正文。
- source PNG、Forge PNG 与 placement 分层后，可以分别解释可编辑来源、最终视觉和空间位置，同时保持数据可序列化。
- 同源模型与远端禁用保证图片不离开当前浏览器；固定 commit、模型 hash 和许可证使供应链可审计。
- 两种 surface 的 discriminated union 阻止桌面坐标被误当成 DOM 坐标，并为未来历史日期查询保留稳定索引。
- DOM 日记层遵循“普通表单优先 DOM”的既有决策，R3F 只负责需要空间关系的桌面投影。

## 影响

### 正向影响

- 文字和图片共享同一个 Forge 视觉与两种目标动作。
- 自动抠图失败时仍可选择矩形或手动修整，不会阻断整个贴纸流程。
- 桌面和日记贴纸都能移动、旋转、删除并在重开后恢复。
- 旧 v2 文字贴纸无需重新生成即可继续显示。

### 代价与限制

- 浏览器 WASM 和本地模型增加静态资源体积；首次自动抠图需要明显加载时间。
- 当前不保存原始上传，已放置图片不能无损返回原图重新抠图。
- 手动修整为响应式工作区，会把超大图最长边降到 `1600px` 后输出。
- “放到日记”只使用表示今天的 `selectedDate`。后续 `DD-20260809-001` 已增加独立的历史只读 `journalCursor`，没有改变 placement 目标或本决策的数据边界。

## 替代方案

### 远端抠图 API

未采用。它需要上传私人图片、网络可用性、服务凭据和新的隐私边界。

### 把图片 Blob 放入 `DailyEntry`

未采用。正文与资产生命周期不同，而且贴纸可以存在于没有正文的日期。

### 复制整个 Sticker Forge 工作台

未采用。它会把 Dear Desk 与上游 Gallery、导出、样式和应用状态耦合；固定 embed API 与独立抠图集成的边界更清楚。

### 日记也使用第二个 R3F Canvas

未采用。纸页贴纸不需要空间光照或遮挡，第二个 WebGL renderer违反单活跃 Canvas 决策。

## 后续约束

- 更换 Sticker Forge commit、模型 revision、模型文件或推理依赖必须建立新任务，重新记录 hash、许可、性能和抠图质量。
- 若需要重新编辑已放置图片，必须先批准原始资产保留、配额、去重与隐私策略。
- 历史日期选择只能复用 `journalDate` 查询，不得把 placement 重新耦合到 `DailyEntry` 是否存在。
- 回退 UI 时保留 IndexedDB v3 和用户资产；不得自动删除 source/render Blob 或尝试 schema 降级。
