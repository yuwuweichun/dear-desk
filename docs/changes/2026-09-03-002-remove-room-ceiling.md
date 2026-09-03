# DD-20260903-002：删除书房壳体顶面

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待验收 |
| 类型 | 功能 |
| 创建时间 | 2026-09-03 00:15 CST |
| 最后更新 | 2026-09-03 00:30 CST |
| 当前阶段 | 实施完成，等待用户验收 |
| 源码基线 | Git commit `1852eb18a708d75838710b30db9145a831c7df40` |
| 实现提交 | 尚未创建 |
| 关联任务 | 删除书房壳体顶部隔离面 |

> 用户已于 2026-09-03 明确批准本方案。

## 1. 给阅读者的结论

当前书房壳体包含一个顶部隔离面，用于阻断 renderer 背景从开顶视线露出。建议删除该场景网格及其运行时节点，让房间顶部真正开放；四面墙、地板、窗户和桌面保持不变。

## 2. 用户需求

用户原始要求：删除房间的顶面，跳过验证测试。

Codex 解释：删除 `StudyRoomShell` 中的 `study-room-ceiling-background-blocker`，同步移除不再使用的类型、规格和测试断言；按用户要求不运行验证测试。

## 3. 当前源码事实

- `src/scene/models/create-study-room-shell-model.ts` 创建名为 `study-room-ceiling-background-blocker` 的平面并加入根节点。
- `StudyRoomShellNodes` 暴露 `ceiling` 节点。
- `src/scene/models/model-specs.ts` 的 `ceilingInset` 只用于计算该顶面高度。
- `src/scene/models/model-factories.test.ts` 断言顶面高度。
- 架构文档将该顶面描述为阻断背景露出的几何。

## 4. 目标与非目标

### 4.1 目标

- 房间壳体不再创建或挂载顶部隔离面。
- 删除对应的无效类型、规格和测试断言。

### 4.2 非目标

- 不删除四面墙、地板、窗户、墙角封边或桌面。
- 不改变相机、renderer 背景、房间开关或持久化模型。
- 按用户要求跳过自动化验证测试。

## 5. 方案说明

在房间模型工厂中删除顶面创建、挂载和运行时节点声明，同时删除只服务于顶面偏移的 `ceilingInset` 及其测试断言。同步修正架构文档中的当前事实，说明顶部不再承担背景遮挡职责。

## 6. 预计改动与影响评估

- `src/scene/models/create-study-room-shell-model.ts`：移除顶面节点创建和类型字段。
- `src/scene/models/model-specs.ts`：移除 `ceilingInset`。
- `src/scene/models/model-factories.test.ts`：移除顶面高度断言；不运行测试。
- `docs/architecture/study-room-shell.md`：更新房间组成和顶部行为。
- 本变更记录：记录实施事实和用户要求的验证豁免。

### 6.1 核心数据结构变化

`StudyRoomShellNodes` 删除 `ceiling` 运行时节点；其余节点和持久化数据不变。

### 6.2 上下游与跨模块影响

房间模型资源数量减少一个平面；模型评审、桌面场景和房间背景开关继续使用同一模型工厂。顶面移除后，renderer 清屏背景可能从房间顶部可见。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 顶部露出 renderer 背景 | 镜头朝向墙顶或房间上方 | 视觉边界变化 | 按用户要求保留开放顶部；如需遮挡可恢复顶面 |

## 8. 验证与验收

- 自动测试：按用户要求跳过。
- 构建与静态检查：按用户要求跳过验证测试，本次不运行。
- 浏览器验收：跳过。
- 持久化与恢复：无数据变化，不适用。
- 成功标准：源码不再创建房间顶面，相关类型和规格引用清理完成。

## 9. 待确认项与决策

无。用户已明确要求该修改并跳过验证测试。

## 10. 最终批准方案

用户于 2026-09-03 明确回复“批准”。执行清单：删除房间顶面及其类型/规格/测试引用，更新架构文档；跳过所有验证。

## 11. 实施记录

已实施：

- 删除 `createStudyRoomShellModel` 中的 `study-room-ceiling-background-blocker` 网格及 `StudyRoomShellNodes.ceiling`。
- 删除 `ceilingInset` 和顶面高度测试断言。
- 更新 `docs/architecture/study-room-shell.md`，记录房间顶部开放且 renderer 清屏背景可见。

## 12. 验证结果

按用户要求跳过测试、lint、构建和浏览器验收。

## 13. 文档同步检查

- 产品文档：产品范围不变，无需修改。
- 架构文档：已同步更新 `docs/architecture/study-room-shell.md` 与 `docs/architecture/system-overview.html`，记录顶部开放。
- 决策文档：无需更新。
- 文档入口：无需修改。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-09-03 00:15 CST | Codex | 创建待确认方案；确认顶面由房间模型工厂单独创建。 |
| 2026-09-03 00:20 CST | 用户 | 明确批准执行，并要求跳过验证测试。 |
