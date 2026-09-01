# DD-20260901-006：自由视角关闭期间按钮灰暗状态

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待验收 |
| 类型 | 修复 |
| 创建时间 | 2026-09-01 17:20 CST |
| 最后更新 | 2026-09-01 17:45 CST |
| 当前阶段 | 实施完成，等待用户验收 |
| 源码基线 | 工作树当前 HEAD b551d69815d62e6325dd352bce974d84d87abde5 |
| 实现提交 | 尚未创建 |
| 关联任务 | 分析并修正自由视角从开启到关闭时按钮长时间灰暗的问题 |

> 本文是待审阅方案。批准前只允许只读检查和修改本文档。

## 1. 给阅读者的结论

自由视角关闭时按钮变灰不是图标问题，而是按钮被显式设置为 disabled。关闭动作先把 `deskCameraTransitioning` 设为 `true`，桌面端相机回到固定机位的过渡持续 `0.72s`，在过渡完成前按钮由通用 disabled 样式显示为灰暗。

这段禁用的原意是阻止相机过渡期间重复操作，但它把“正在回位”表现成了不可用按钮。建议保留相机内部的过渡锁，同时让自由视角按钮在关闭过渡期间保持正常可见状态，或改为仅在必要时短暂锁定点击；具体修复前需确认是否允许关闭后立即再次开启自由视角。

## 2. 用户需求

用户明确放弃前一项组合图标与 hover 动效需求，恢复原有图标。用户同时指出：自由旋转摄像头从开启到关闭时，按钮较长时间处于灰色黯淡状态，不符合预期。

本记录只分析后一个行为问题，不包含图标或动效改动。

## 3. 当前源码事实

- `src/app/App.tsx` 将自由视角按钮绑定为 `disabled={deskCameraTransitioning}`。
- `src/state/app-store.ts` 的 `toggleFreeCamera()` 在开启状态被点击时返回 `{ freeCameraEnabled: false, deskCameraTransitioning: true }`。
- `src/scene/DeskScene.tsx` 的 `CameraRig` 在 `deskCameraTransitioning` 为真时从当前自由相机姿态过渡到当前固定机位。
- `src/scene/notebook-transition.ts` 的 `getDeskCameraTransitionDuration(false, false)` 返回 `0.72` 秒，移动端返回 `0.48` 秒。
- `src/scene/DeskScene.tsx` 同时使用定时器，在相同过渡时长后调用 `settleDeskCameraPreset()` 将 `deskCameraTransitioning` 设回 `false`。
- `src/ui/theme.css` 的 animal-island-ui 主题定义了 disabled 背景色 `--animal-bg-color-disabled: #ece8dc`；因此按钮灰暗是浏览器收到 `disabled` 后的预期样式结果。
- `FreeOrbitCamera` 在 `enabled` 变为 false 时通过 effect cleanup 销毁 `OrbitControls`；固定机位回位由 `CameraRig` 接管。

## 4. 目标与非目标

### 4.1 目标

- 消除关闭自由视角后约 0.72 秒的非预期灰暗观感。
- 保持相机从自由姿态回到固定机位的视觉过渡和防重复操作安全性。

### 4.2 非目标

- 不改变固定机位、OrbitControls 范围或图标。
- 不改变开启自由视角时的按钮 active 样式。

## 5. 方案说明

需要在“按钮视觉状态”和“相机过渡锁”之间拆开：最小方案是移除按钮的 `disabled={deskCameraTransitioning}`，并在 `onClick` 中由现有 store 逻辑拒绝过渡期间的重复切换；但这会让按钮在过渡期间仍可获得焦点，需要确认其视觉和键盘交互预期。更严格方案是保留 disabled，但改用专门的 `data-camera-transitioning` 样式，维持正常颜色并继续阻止点击；这仍然保留原生 disabled 语义，却需要覆盖主题 disabled 样式。

## 6. 预计改动与影响评估

用户于 2026-09-01 明确回复“批准”，按推荐方案执行：保留原生 disabled 过渡锁，仅覆盖自由视角按钮的灰暗视觉。

### 6.1 核心数据结构变化

无。`deskCameraTransitioning` 仍作为相机过渡锁存在。

### 6.2 上下游与跨模块影响

涉及自由视角按钮展示和相机过渡期间的输入策略，不改变场景数据或持久化。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 过渡期间重复点击 | 按钮不再原生 disabled | 可能产生无效点击反馈 | store 已有 transition guard；可采用保留 disabled、仅覆盖视觉的方案 |
| 灰暗样式仍被主题覆盖 | 选择器优先级不足 | 用户仍看到 disabled 灰色 | 使用明确的 `.free-camera-button` 过渡态选择器并验证构建/浏览器 |

## 8. 验证与验收

- 自动测试：确认关闭后状态转为 `freeCameraEnabled=false`，并在过渡完成前后验证按钮行为。
- 构建与静态检查：运行 lint、测试、production build 和文档引用检查。
- 浏览器验收：关闭自由视角后按钮不再长时间灰暗；相机仍平滑回到固定机位；过渡期间重复操作符合确认后的策略。
- 成功标准：视觉反馈与按钮可用性语义一致。

## 9. 待确认项与决策

请确认关闭过渡的约 0.72 秒内，按钮应当：

1. 保持正常颜色但点击无效（推荐，改动最小且保留过渡锁）；或
2. 继续不可点击，但采用非灰暗的“处理中”视觉。

## 10. 最终批准方案

用户于 2026-09-01 明确回复“批准”。最终执行清单：

1. 保留 `disabled={deskCameraTransitioning}` 与现有相机过渡锁。
2. 为 `.free-camera-button:disabled` 覆盖透明度、颜色、背景、边框和阴影，消除灰暗观感。
3. 补充关闭过渡期间仍为 disabled 的回归断言，并运行完整验证。

## 11. 实施记录

已实施：

- `src/styles.css` 新增 `.free-camera-button:disabled` 过渡态视觉覆盖，按钮在相机回位期间保持正常配色，但仍不可点击。
- `src/app/App.test.tsx` 确认关闭自由视角后按钮仍保持 disabled，防止重复切换。
- 未修改相机过渡时长、OrbitControls 或状态锁逻辑。

## 12. 验证结果

已完成：

- `npm test -- --run src/app/App.test.tsx`：1 个测试文件、12 个测试通过。
- `npm run lint`：通过。
- `npm run build`：通过；Vite 仅报告既有大 chunk 警告。
- `node scripts/check-doc-references.mjs`：通过。
- `git diff --check`：通过。
- 浏览器视觉验收：当前环境未提供 `ego-browser`，未执行真实点击与视觉验收。

## 13. 文档同步检查

- 产品文档：若修复仅调整按钮过渡态视觉，无需更新产品范围。
- 架构文档：相机过渡锁语义不变，无需更新架构文档。
- 决策文档：无需新增长期决策。
- 文档入口：无需更新。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-09-01 17:20 CST | Codex | 根据源码确认灰暗来自 `disabled={deskCameraTransitioning}` 与 0.72 秒固定机位回位过渡。 |
| 2026-09-01 17:40 CST | 用户 | 批准保留过渡锁、仅消除按钮灰暗视觉的方案。 |
| 2026-09-01 17:45 CST | Codex | 完成 CSS 覆盖与 disabled 回归断言；测试、lint、构建和文档引用检查通过，状态更新为待验收。 |
