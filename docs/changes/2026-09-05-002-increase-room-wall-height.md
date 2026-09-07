# DD-20260905-002：恢复房间顶面并限制自由视角轨道

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待验收 |
| 类型 | 功能 |
| 创建时间 | 2026-09-05 00:00 HKT |
| 最后更新 | 2026-09-05 00:00 HKT |
| 当前阶段 | 实施完成，等待用户验收 |
| 源码基线 | `2c5ea92` |
| 实现提交 | 尚未创建 |
| 关联任务 | 恢复已删除的房间顶面，并确保自由视角轨道不越出房间 |

> 本文是待审阅方案。批准前只允许只读检查和修改本文档。

## 1. 给阅读者的结论

原方案“将墙高提高到 1.2 倍”作废。删除墙顶的原因是自由视角可能从墙顶外看到 renderer 背景；本次改为恢复原来的顶部隔离面，并修正自由视角轨道的上边界。

现有机位的水平轨道半径最大约为 `16.33`，小于房间半深 `16.5`，因此不需要扩大房间。只限制向上俯仰到顶面以下，墙体高度和窗口保持原值。

## 2. 用户需求

用户修正要求：恢复墙顶，并确保摄像头的轨道始终在房间以内；如果当前房间大小已经足够，则不修改房间大小。

Codex 解释：恢复 `study-room-ceiling-background-blocker` 和 `ceilingInset=0.02`；验证现有自由视角水平轨道在 `42 × 33` 房间范围内；将自由视角最高点限制在顶面以下；不扩大房间。

## 3. 当前源码事实

- `src/scene/models/model-specs.ts` 中 `floorTopY=-5.025`、`wallTopY=12.975`，当前有效墙高为 `18`；删除顶面时一并删除了 `ceilingInset=0.02`。
- `src/scene/models/create-study-room-shell-model.ts` 使用 `wallTopY` 生成四面墙，但当前不再创建顶部隔离面。
- `src/scene/wall-sticker-layout.ts` 从同一规格推导墙面贴纸边界和 `WALL_HIT_SURFACE`。
- `src/scene/DeskScene.tsx` 的 `FreeOrbitCamera` 使用 `OrbitControls`，禁用平移和缩放，仅设置固定 `minPolarAngle=0.22`、`maxPolarAngle=π/2-0.08`；没有根据房间顶面限制向上轨道。
- 现有六个桌面/移动端机位的最大轨道半径约为 `16.33`，小于房间半深 `16.5`；因此当前水平轨道无需扩大房间。
- `docs/architecture/study-room-shell.md` 当前记录房间顶部开放，需要改回顶面隔离面的事实。

## 4. 目标与非目标

### 4.1 目标

- 恢复房间顶部隔离面，位置与原实现一致：`wallTopY - ceilingInset = 12.955`。
- 确保自由视角相机位置的水平轨道不越过房间四周边界，并确保相机高度不超过顶面。
- 保持墙体有效高度 `18`、地板、房间宽深、窗洞、墙厚、材质和持久化数据不变。

### 4.2 非目标

- 不提高墙壁高度，不改变窗户位置或窗洞高度。
- 不改变房间宽度 `42`、深度 `33`，除非边界验证证明现有轨道确实越界。
- 不改变墙面贴纸数据结构和已有墙面装饰位置语义。
- 不新增第二个 WebGL 画布，不创建提交、推送或 PR。

## 5. 方案说明

恢复删除前的最小顶面实现：在 `STUDY_ROOM_MODEL_SPEC` 恢复 `ceilingInset: 0.02`，在房间工厂中恢复一个 `ROOM_WIDTH × ROOM_DEPTH` 的水平顶面，并挂载到 `StudyRoomShellNodes`。自由视角继续使用同一 OrbitControls，但根据当前机位的轨道半径和目标点计算允许的最高俯仰角，使相机不超过 `wallTopY-ceilingInset`；同时用自动测试覆盖所有预设的水平边界和垂直上界。

## 6. 预计改动与影响评估

- `src/scene/models/model-specs.ts`：恢复 `ceilingInset`。
- `src/scene/models/create-study-room-shell-model.ts`：恢复顶面节点、运行时节点和资源释放链路。
- `src/scene/DeskScene.tsx`：为自由 OrbitControls 增加房间顶面上界计算；不改变房间尺寸。
- `src/scene/models/model-factories.test.ts`：恢复顶面存在性断言，并保留有效墙高为 `18` 的断言。
- `src/scene/DeskScene` 相关测试或最小纯计算测试：覆盖六个机位轨道在房间水平边界内、相机最高点不超过顶面。
- `docs/architecture/study-room-shell.md`：恢复室内顶部隔离面的当前事实，并补充自由视角边界约束。
- 本变更记录：记录批准、实施和验证结果。

### 6.1 核心数据结构变化

不变化。仅恢复一个场景节点并调整相机控制约束；墙面贴纸仍使用归一化 `{x,y}` 坐标，已有持久化记录无需迁移。

### 6.2 上下游与跨模块影响

墙体高度、墙面贴纸边界、命中面和固定机位不变；房间工厂重新生成顶面。自由视角仍可环绕桌面，但不会从顶部或四周穿出房间。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 轨道边界计算错误 | 自由视角旋转到极限 | 相机穿出顶面或墙面 | 用六个机位的几何边界测试覆盖；必要时回退相机约束或顶面恢复 |

## 8. 验证与验收

- 自动测试：运行房间模型、相机边界和墙面布局相关 Vitest 测试，确认顶面存在且轨道边界联动。
- 构建与静态检查：运行 `npm run check`。
- 浏览器验收：本次未明确要求，默认不执行。
- 持久化与恢复：无数据结构变化，不需要迁移验证。
- 成功标准：顶面恢复；有效墙高仍为 `18`；六个机位的自由轨道均位于房间内；墙面贴纸布局测试通过；构建、Lint、测试和文档引用检查通过。

## 9. 待确认项与决策

无。建议按上述最小方案执行；若边界计算证明当前房间尺寸足够，则不修改房间宽深。

## 10. 最终批准方案

用户已于 2026-09-05 明确批准。执行清单：

1. 恢复 `ceilingInset` 与房间顶面。
2. 为自由 OrbitControls 增加顶面上界，并验证水平轨道边界。
3. 恢复/新增对应自动测试。
4. 同步 `docs/architecture/study-room-shell.md` 的顶部与相机事实。
5. 运行验证命令并回写结果，状态更新为“待验收”。

## 11. 实施记录

已实施：

- `src/scene/models/model-specs.ts` 恢复 `ceilingInset=0.02`。
- `src/scene/models/create-study-room-shell-model.ts` 恢复 `study-room-ceiling-background-blocker` 顶面及 `StudyRoomShellNodes.ceiling`。
- `src/scene/free-orbit-camera.ts` 增加顶面/地板俯仰边界和房间水平轨道校验；`src/scene/DeskScene.tsx` 接入自由视角控制。
- `src/scene/free-orbit-camera.test.ts` 增加六个桌面/移动端机位的轨道边界测试；房间模型测试恢复顶面断言。
- `docs/architecture/study-room-shell.md` 与 `docs/architecture/system-overview.html` 同步恢复顶面和自由视角边界事实。

方案偏差：无。房间墙高、宽度和深度均未修改。

## 12. 验证结果

- `npm test -- --run src/scene/free-orbit-camera.test.ts src/scene/models/model-factories.test.ts src/scene/wall-sticker-layout.test.ts`：通过，3 个文件、17 个测试通过。
- `npm run check`：通过；Lint、全量 31 个测试文件/131 个测试、TypeScript/Vite 构建和文档引用检查均通过。
- `git diff --check`：通过；仅有 Git 关于工作区换行符的提示。
- 浏览器视觉验收：未执行，用户未要求；因此未覆盖实际浏览器中的自由视角手动旋转画面。

## 13. 文档同步检查

- 产品文档：无需修改；产品范围不变，且 `mvp.md` 已保留顶部隔离面的产品事实。
- 架构文档：已更新 `docs/architecture/study-room-shell.md` 与 `docs/architecture/system-overview.html`。
- 决策文档：无需新增。
- 文档入口：无需修改；文档引用检查通过。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-09-05 00:00 HKT | Codex | 创建待确认方案；完成顶面删除历史、房间规格与自由相机轨道的只读检查。 |
| 2026-09-05 00:00 HKT | 用户 | 作废“墙高提高 1.2 倍”方案，改为恢复顶面并约束自由视角轨道。 |
| 2026-09-05 00:00 HKT | 用户 | 明确批准按新方案执行。 |
