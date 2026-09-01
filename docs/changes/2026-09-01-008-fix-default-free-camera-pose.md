# DD-20260901-008：修复默认自由视角初始机位

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待验收 |
| 类型 | 修复 |
| 创建时间 | 2026-09-01 18:40 CST |
| 最后更新 | 2026-09-01 19:00 CST |
| 当前阶段 | 实施完成，等待用户验收 |
| 源码基线 | 工作树当前 HEAD b551d69815d62e6325dd352bce974d84d87abde5 |
| 实现提交 | 尚未创建 |
| 关联任务 | 修复默认开启自由视角时刷新页面初始相机位置错误 |

> 本次用户已明确要求直接修复，允许修改源码、测试和同步文档。

## 1. 给阅读者的结论

默认开启自由视角后，刷新页面时相机没有套用当前桌面机位，只设置了 OrbitControls 的目标点，导致初始位置落在 Three.js 默认相机位置。修复后，自由 OrbitControls 初始化会先应用当前 `deskCameraPreset` 的完整相机 pose，再接管旋转控制。

## 2. 用户需求

用户反馈：切换默认开启自由视角后，网页刷新时初始摄像头位置出错。用户已批准直接修复。

## 3. 当前源码事实

- `src/state/app-store.ts` 当前新会话默认 `freeCameraEnabled: true`。
- `src/scene/DeskScene.tsx` 的 `CameraRig` 在自由视角开启时跳过固定机位 pose 应用。
- 同文件的 `FreeOrbitCamera` 初始化时设置 `controls.target`，但没有设置 `camera.position`、`camera.quaternion` 和 `camera.fov`。
- `src/scene/DeskScene.tsx` 的 `applyCameraPose()` 已是现有机位 pose 应用函数，可复用。

## 4. 目标与非目标

### 4.1 目标

- 刷新页面后默认自由视角从当前默认机位正确开始。
- 手动开启自由视角时保持当前固定机位，不产生跳变。

### 4.2 非目标

- 不改变默认开启决策、OrbitControls 限制、相机目标或持久化策略。

## 5. 方案说明

在 `FreeOrbitCamera` 获取当前 pose 后调用既有 `applyCameraPose(camera, pose)`，再设置 OrbitControls 的 target 和限制。这样刷新与手动开启都使用同一套机位数据，不新增状态或初始化逻辑。

## 6. 预计改动与影响评估

- `src/scene/DeskScene.tsx`：在 OrbitControls 初始化前应用 pose。
- 如现有测试可覆盖场景初始化，则补充对应断言；否则运行现有状态、场景和全量测试确认无回归。
- 本记录回写真实验证结果。

### 6.1 核心数据结构变化

无。

### 6.2 上下游与跨模块影响

只影响自由 OrbitControls 的初始相机姿态；固定机位、相机过渡、工作流退出和数据持久化不变。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 手动开启时相机重复应用 pose | 当前相机已经处于该固定 pose | 无可见影响 | 应用相同 pose 是幂等操作；出现跳变时回退调用位置 |

## 8. 验证与验收

- 自动测试：运行场景、状态和 App 相关测试。
- 构建与静态检查：运行 lint、全量测试、production build、文档引用和 diff 检查。
- 浏览器验收：刷新页面确认默认自由视角从正确桌面机位开始，并可立即旋转；关闭后回位行为不回归。
- 成功标准：刷新后的相机位置与原默认固定机位一致，不再落在 Three.js 默认位置。

## 9. 待确认项与决策

无。用户已批准最小根因修复。

## 10. 最终批准方案

用户于 2026-09-01 明确回复“批准”。执行清单为：复用 `applyCameraPose()` 在 `FreeOrbitCamera` 创建 controls 前初始化相机 pose，随后运行验证。

## 11. 实施记录

已实施：

- `src/scene/DeskScene.tsx` 在创建 `OrbitControls` 后、配置 target 前调用既有 `applyCameraPose(camera, pose)`。
- 刷新和手动开启自由视角现在都从当前 `deskCameraPreset` 的完整位置、旋转和 FOV 开始。
- 未修改自由视角默认开启、控制范围、退出工作流或持久化逻辑。

## 12. 验证结果

已完成：

- `npm test -- --run src/state/app-store.test.ts src/app/App.test.tsx`：2 个测试文件、27 个测试通过。
- `npm run lint`：通过。
- `npm run build`：通过；Vite 仅报告既有大 chunk 警告。
- `node scripts/check-doc-references.mjs`：通过。
- `git diff --check`：通过。
- 浏览器视觉验收：当前环境未提供 `ego-browser`，未执行真实刷新、拖动和关闭回位验收。

## 13. 文档同步检查

- 产品文档：默认开启事实已由 `DD-20260901-007` 同步；本次仅修复初始化，不需再次修改产品范围。
- 架构文档：相机初始化调用链变化，实施后确认是否需要补充当前事实。
- 决策文档：无需更新。
- 文档入口：无需更新。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-09-01 18:40 CST | Codex | 建立 bug 记录，确认根因是自由 OrbitControls 初始化漏掉完整 camera pose。 |
| 2026-09-01 18:40 CST | 用户 | 批准直接修复。 |
| 2026-09-01 19:00 CST | Codex | 完成 pose 初始化修复并通过相关测试、lint、构建和文档检查，状态更新为待验收。 |
