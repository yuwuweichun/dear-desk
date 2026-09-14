# DD-20260914-004：修复贴纸首次拖动跳动并统一手型光标

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 修复 |
| 创建时间 | 2026-09-14 18:30 CST |
| 最后更新 | 2026-09-14 19:20 CST |
| 当前阶段 | 已验收并提交 |
| 源码基线 | 当前工作区 `git status`；保留已有未提交修改 |
| 实现提交 | 待写入本次提交 |
| 关联任务 | 修复贴纸选中/拖动时的首次位移，并使用 animal-island 手型光标 |

> 本记录先于业务源码修改创建。当前仅完成只读检查。

## 1. 给阅读者的结论

当前贴纸拖动确实会把首次点击的鼠标位置直接作为贴纸的新中心，因此点击贴纸边缘后开始移动时会出现轻微跳动。建议在按下时保存鼠标命中点与贴纸中心的差值，后续预览和提交都保留该差值。

拖动中的光标目前使用浏览器 `grab`/`grabbing`，与项目其余 Animal Island 风格不一致。建议复用已安装 `animal-island-ui` 的 Cursor 样式资源，仅替换光标呈现，不改变贴纸交互或数据模型。

## 2. 用户需求

- 首次选中并拖动贴纸时，点击位置不应造成贴纸初始跳动。
- 移动状态使用 `animal-island-ui` 提供的手型光标。
- 保持现有桌面、日记、墙面贴纸移动与持久化行为。

## 3. 当前源码事实

- `src/scene/StickerObject.tsx` 在 `onPointerDown` 设置拖动状态，`positionFromEvent()` 直接将射线交点返回为贴纸中心坐标；因此第一次 `onPointerMove` 会把贴纸中心对齐到鼠标。
- `src/scene/WallStickerObject.tsx` 使用相同模式，将墙面射线交点直接转换为贴纸归一化中心坐标。
- `src/features/journal/JournalStickerLayer.tsx` 的 `positionFromPointer()` 直接将鼠标相对纸页位置返回为贴纸中心坐标。
- 三条路径均在按下时调用 `onSelect()`，但没有记录拖动起点偏移。
- 桌面/墙面组件通过 `document.body.style.cursor` 设置 `grab`、`grabbing`；日记样式在 `src/sticker-workbench.css` 设置 `grab`/`grabbing`。
- `animal-island-ui` 1.5.1 已导出 `Cursor`，其 `cursor.css` 使用包内 `cursor-icon.1ea93a65.png` 手型资源；`src/main.tsx` 当前只加载包的总样式入口。

## 4. 目标与非目标

### 4.1 目标

- 三个贴纸表面均保持按下位置相对贴纸的拖动偏移。
- 使用现有 `animal-island-ui` 手型光标资源覆盖贴纸移动态。
- 补充一个最小自动检查，锁定拖动偏移计算不把按下点当作新中心。

### 4.2 非目标

- 不改变贴纸坐标、缩放、旋转、边界 clamp 或 IndexedDB 结构。
- 不新增光标依赖、图片资源或通用拖动框架。
- 不执行默认浏览器视觉验收。

## 5. 方案说明

在每条现有拖动路径的 `pointerdown` 中计算并保存拖动偏移；`pointermove`/`pointerup` 的位置投影先加回该偏移，再交给已有预览和提交回调。点击不移动时不产生位置写入；从贴纸中心拖动时偏移为零，行为保持不变。

复用 `animal-island-ui` 的 Cursor CSS 及其导出的手型资源，移除现有 `grab`/`grabbing` 的浏览器光标覆盖。桌面/墙面继续通过现有 body 光标生命周期控制，日记贴纸沿用现有 class 结构。

## 6. 预计改动与影响评估

- 修改 `src/scene/StickerObject.tsx`：增加桌面拖动起点偏移。
- 修改 `src/scene/WallStickerObject.tsx`：增加墙面拖动起点偏移。
- 修改 `src/features/journal/JournalStickerLayer.tsx`：增加日记拖动起点偏移，并在选中/拖动时应用手型 class。
- 修改 `src/sticker-workbench.css`：移除贴纸上的 `grab`/`grabbing` 浏览器光标规则。
- 修改 `src/main.tsx`：加载 `animal-island-ui` Cursor 样式资源。
- 更新本记录中的实施与验证事实；产品和架构文档无需同步，因用户可见行为修复不改变产品范围、数据模型或模块所有权。

### 6.1 核心数据结构变化

无持久化或公共数据结构变化。新增状态仅为组件生命周期内的拖动偏移引用，pointerup/cancel 后失效。

### 6.2 上下游与跨模块影响

预览和提交回调、仓储写入、贴纸坐标和边界 clamp 均保持不变；仅改变传入它们的拖动位置计算。三 surface 共享的选择状态不变。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 光标样式未覆盖 Canvas 或日记按钮 | 包样式作用域/优先级不一致 | 仍显示旧光标 | 使用已安装资源的 force 样式，保留现有状态生命周期并通过构建检查 |
| 拖动取消后偏移残留 | pointercancel 未清理 | 下一次拖动偏移错误 | 在 cancel 与 pointerup 清理引用/状态 |
| 现有未提交改动重叠 | 贴纸相关文件已有用户修改 | 误覆盖工作 | 只做局部补丁，修改前后检查 diff |

## 8. 验证与验收

- 自动测试：运行贴纸相关 Vitest，至少覆盖日记拖动偏移计算；桌面/墙面通过类型检查和现有回归测试覆盖。
- 构建与静态检查：`npm run lint`、`npx tsc -b --pretty false`、`npm run build`。
- 浏览器验收：按项目默认规则不执行。
- 持久化与恢复：本次不改变持久化结构，不新增恢复验证。
- 成功标准：从贴纸非中心位置按下后首次移动无跳动；三类贴纸拖动均保持抓取点；移动中显示 Animal Island 手型光标；现有测试、lint、类型检查和构建通过。

## 9. 待确认项与决策

无会改变范围的待确认项。建议按本记录直接实施。

## 10. 最终批准方案

2026-09-14 18:45 CST，用户明确回复“批准”。执行第 6 节清单。

## 11. 实施记录

已实施：

- `src/scene/StickerObject.tsx` 与 `src/scene/WallStickerObject.tsx` 在 pointerdown 保存世界坐标抓取偏移，preview/commit 使用带偏移的位置，并加载 Animal Island 手型光标 class。
- `src/features/journal/JournalStickerLayer.tsx` 保存归一化纸页坐标抓取偏移，选中贴纸使用 Animal Island 手型光标 class。
- `src/main.tsx` 加载 `animal-island-ui/es/components/Cursor/cursor.css`；`src/sticker-workbench.css` 删除旧 `grab`/`grabbing` 覆盖。
- `src/features/journal/JournalStickerLayer.test.tsx` 增加首次抓取偏移回归测试。

方案偏差：无。未修改数据模型、边界、缩放、旋转或持久化结构。

## 12. 验证结果

已验证：

- `npm run lint`：通过。
- `npx tsc -b --pretty false`：通过。
- `npm test -- --run src/features/journal/JournalStickerLayer.test.tsx src/domain/sticker.test.ts src/state/app-store.test.ts src/scene/wall-sticker-layout.test.ts`：4 个测试文件、21 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过；仅有既有 LF→CRLF 提示。
- 浏览器验收：未执行，按项目默认规则需用户手动确认桌面、墙面和日记三类贴纸的首次拖动及手型光标。

用户已于 2026-09-14 明确回复“验收通过”，并授权为当前任务创建提交。

## 13. 文档同步检查

- 产品文档：无变化；不改变产品范围。
- 架构文档：无变化；不改变所有权、数据流或持久化模型。
- 决策文档：无变化；不引入长期约束。
- 文档入口：无变化。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-09-14 18:30 CST | Codex | 创建待确认方案，确认首次拖动位置跳动来自未保存 pointerdown 偏移。 |
