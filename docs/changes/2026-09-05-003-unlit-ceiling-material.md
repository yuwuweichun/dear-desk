# DD-20260905-003：顶面改用不受光照材质

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待验收 |
| 类型 | 修复 |
| 创建时间 | 2026-09-05 00:00 HKT |
| 最后更新 | 2026-09-05 00:00 HKT |
| 当前阶段 | 实施完成，等待用户验收 |
| 源码基线 | 当前工作区；前置任务 `DD-20260905-002` 尚未提交 |
| 实现提交 | 尚未创建 |
| 关联任务 | 暂时给房间顶面使用不受光照影响的材质 |

> 本文是待审阅方案。批准前只允许只读检查和修改本文档。

## 1. 给阅读者的结论

顶面和侧墙当前复用同一个墙面材质，但侧墙和水平顶面受到的光照方向不同，因此顶面在画面中明显偏暗。建议只把顶面材质替换为 `THREE.MeshBasicMaterial`，继续复用墙面 albedo 纹理；侧墙、地板、房间尺寸和相机不变。

## 2. 用户需求

用户原始要求：暂时给顶面使用不受光照影响的材质。

Codex 解释：仅改变顶面显示材质为不参与光照计算的基础材质，保持顶面几何、位置、纹理和遮挡职责不变。

## 3. 当前源码事实

- `src/scene/models/create-study-room-shell-model.ts` 的 `materials.wall` 是 `THREE.MeshStandardMaterial`，包含 albedo、roughness、bump、AO 和 emissive 响应。
- 恢复的顶面 `study-room-ceiling-background-blocker` 当前直接使用 `materials.wall`，因此水平顶面与侧墙共享颜色纹理，但不共享视觉亮度。
- 顶面位于 `y=12.955`，负责阻断自由视角从房间顶部看到 renderer 背景。
- 项目已有 `THREE.MeshBasicMaterial` 用例：同文件的窗外 backdrop 使用它，且不受方向光影响。
- 前置变更 `DD-20260905-002` 已通过自动检查，但当前工作区尚未提交。

## 4. 目标与非目标

### 4.1 目标

- 顶面使用不受光照影响的材质。
- 继续使用现有墙面 albedo 纹理，避免重新生成颜色资源。
- 保持顶面尺寸、位置、遮挡、生命周期和房间其余材质不变。

### 4.2 非目标

- 不调整侧墙颜色或灯光。
- 不修改墙高、房间尺寸、相机轨道和窗户。
- 不新增依赖、画布或材质系统抽象。

## 5. 方案说明

在房间材质工厂中新增一个顶面专用 `THREE.MeshBasicMaterial({ color: '#ffffff', map: wallAlbedo, side: THREE.DoubleSide })`，顶面创建时改用该材质。该材质与现有 `wallAlbedo` 共享纹理对象，销毁仍由当前统一资源释放逻辑负责；侧墙继续使用 `materials.wall`。

## 6. 预计改动与影响评估

- `src/scene/models/create-study-room-shell-model.ts`：增加顶面基础材质并让顶面使用它；将该材质加入材料释放和类型结构。
- `src/scene/models/model-factories.test.ts`：断言顶面材质为 `THREE.MeshBasicMaterial`，侧墙仍为标准材质。
- `docs/architecture/study-room-shell.md`：补充顶面与侧墙使用不同光照模型的当前事实。
- 本变更记录：记录批准、实施和验证结果。

### 6.1 核心数据结构变化

不变化。仅增加一个场景材质实例，不改变持久化数据、运行时节点结构或公共接口。

### 6.2 上下游与跨模块影响

只影响房间顶面的渲染亮度；墙体、窗户、自由视角、墙面贴纸和房间背景开关保持原调用链。共享的 `wallAlbedo` 纹理不复制，资源数量只增加一个材质。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 顶面与侧墙在极端视角下仍有色差 | 基础材质不再响应光照 | 顶面显示更均匀，但可能比侧墙更亮 | 先按用户要求采用最小改动；回退顶面材质引用即可 |

## 8. 验证与验收

- 自动测试：运行房间模型相关测试，确认顶面使用 `MeshBasicMaterial`、侧墙保持 `MeshStandardMaterial`。
- 构建与静态检查：运行 `npm run check`。
- 浏览器验收：用户未明确要求，默认不执行。
- 成功标准：顶面不再使用墙面标准材质；其余房间行为和测试不回归。

## 9. 待确认项与决策

无。建议按上述最小方案执行。

## 10. 最终批准方案

用户已于 2026-09-05 明确批准。执行：修改顶面材质、补充材质类型断言、同步架构文档并运行验证。

## 11. 实施记录

已实施：

- `src/scene/models/create-study-room-shell-model.ts` 新增顶面专用 `THREE.MeshBasicMaterial`，复用 `wallAlbedo`，并让顶面使用该材质；侧墙继续使用 `MeshStandardMaterial`。
- `src/scene/models/model-factories.test.ts` 增加顶面/侧墙材质类型断言。
- `docs/architecture/study-room-shell.md` 同步顶面材质事实。

方案偏差：无。

## 12. 验证结果

- `npm test -- --run src/scene/models/model-factories.test.ts`：通过，15 个测试通过。
- `npm run check`：通过；Lint、全量 31 个测试文件/131 个测试、TypeScript/Vite 构建和文档引用检查均通过。
- 浏览器视觉验收：未执行，用户未要求；实际顶面亮度仍需用户在浏览器中确认。

## 13. 文档同步检查

- 产品文档：无需修改；产品范围不变。
- 架构文档：已更新 `docs/architecture/study-room-shell.md`。
- 决策文档：预计无需新增。
- 文档入口：预计无需修改。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-09-05 00:00 HKT | Codex | 创建待确认方案；确认顶面与侧墙复用标准材质导致光照差异。 |
| 2026-09-05 00:00 HKT | 用户 | 明确批准按方案执行。 |
