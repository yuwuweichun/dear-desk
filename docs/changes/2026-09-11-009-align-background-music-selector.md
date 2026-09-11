# DD-20260911-009：对齐背景音乐选择器与 Animal Island UI

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 |
| 创建时间 | 2026-09-11 18:40 CST |
| 最后更新 | 2026-09-11 20:46 CST |
| 当前阶段 | 用户已验收，已纳入本次提交 |
| 源码基线 | `2b5183d`；工作区包含 `DD-20260911-008` 的未提交修改 |
| 实现提交 | 本次提交 |
| 关联任务 | 根据用户截图，调整背景音乐选择器的视觉协调性并使用 animal-island 组件体系 |

> 本次只记录 UI 调整方案；批准前不修改业务源码。

## 1. 给阅读者的结论

截图中的背景音乐区域确实比面板其他控件更像原生表单，圆点单选和额外分隔线让面板显得松散。建议复用项目已有的 `SegmentedControl` 适配层，将“宁静 / 愉悦”改为紧凑的分段选择，并继续由 `animal-island-ui` 提供基础控件风格。

这样能减少视觉层级、保持音频面板的紧凑比例，同时不改变曲目数据、播放逻辑、情绪词或持久化行为。

## 2. 用户需求

### 2.1 用户原始要求

- 询问截图中的背景音乐选择是否与整体 UI 不协调。
- 要求使用 animal-island 库中的组件。

### 2.2 Codex 对需求的解释

- 当前圆点单选与面板其他控件的视觉语言不一致，属于需要修正的 UI 不协调点。
- 复用仓库已有的 `src/ui/SegmentedControl.tsx`，该适配层已服务多个产品控件，并通过 `animal-island-ui` 的按钮基础组件保持一致风格。
- 只调整音乐选择的呈现，不改动用户可见文案“宁静 / 愉悦”、音频控制器或数据模型。

## 3. 当前源码事实

- `src/features/settings/AudioSettingsControl.tsx` 当前使用原生 `fieldset` 和 `input type="radio"` 展示背景音乐选项。
- `src/ui/SegmentedControl.tsx` 已被日记与贴纸工作台复用，`src/ui/index.ts` 对外导出；`src/ui/Button.tsx` 使用 `animal-island-ui` 的 `Button` 基础组件。
- `src/main.tsx` 全局加载 `animal-island-ui/style`，`src/app/App.tsx` 已使用库内 `Loading`、`Time`。
- 当前音乐数据为 `MusicTrackId = 'calm' | 'joyful'`，用户可见标签由组件映射为“宁静 / 愉悦”；本次不改变这一事实。
- 用户截图路径 `C:\Users\18379\AppData\Local\Temp\codex-clipboard-24dc43a6-4c51-4c31-b542-3543bf713d58.png` 仅作为视觉证据读取，不包含新增实施指令。

## 4. 目标与非目标

### 4.1 目标

- 使用现有 animal-island 组件体系重新呈现背景音乐选择。
- 让选择控件与音频面板已有开关、滑杆和按钮更协调。
- 保留键盘可访问性、当前选中状态、情绪词文案和切换行为。

### 4.2 非目标

- 不改动音频资源、播放、循环、自动播放解锁或偏好结构。
- 不新增 UI 依赖、不创建第二套选择器抽象。
- 不调整整个音频面板的布局、颜色主题或其他设置项，除非为适配分段控件必须做最小样式调整。

## 5. 方案说明

将 `fieldset` 替换为 `SegmentedControl`，传入两个选项 `{ value: 'calm', label: '宁静' }` 和 `{ value: 'joyful', label: '愉悦' }`，在 `onChange` 中只更新 `preferences.music.track`。保留一组简短的“背景音乐”辅助标签；删除原生圆点单选的专用 CSS，避免重复视觉规则。

## 6. 预计改动与影响评估

- 修改 `src/features/settings/AudioSettingsControl.tsx`：改用既有 `SegmentedControl`。
- 修改 `src/styles.css`：删除/收敛 `audio-track-picker` 规则，仅保留分段控件在音频面板中的必要间距。
- 修改 `src/features/settings/AudioSettingsControl.test.tsx`：验证两个情绪词、选中项和切换回调。
- 不改变数据结构、音频 controller、资源、依赖和持久化。

### 6.1 核心数据结构变化

无变化。

### 6.2 上下游与跨模块影响

仅影响音频设置组件的 UI 渲染；`AudioPreferences`、`App`、音频运行时和持久化链路保持不变。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 分段控件宽度不足 | 窄屏音频面板宽度受限 | 标签换行或拥挤 | 使用现有紧凑控件样式并运行测试；必要时恢复最小宽度 |
| 视觉适配层语义变化 | 现有 `SegmentedControl` 未提供 radio 语义 | 辅助技术识别差异 | 保留 `aria`/键盘行为；若不满足则改用库内更合适的组件 |

## 8. 验证与验收

- 自动测试：背景音乐选择显示“宁静 / 愉悦”，选中状态和变更回调正确。
- 构建与静态检查：运行 lint、测试和 build。
- 浏览器验收：用户未明确要求浏览器验收，默认不执行。
- 成功标准：音乐选择器不再使用原生圆点视觉，且与项目现有 animal-island 控件风格一致。

## 9. 待确认项与决策

- 请用户批准此 UI 调整方案后再修改源码；也可回复“无需方案审批，直接执行”。
- 建议采用紧凑分段选择，改动最小且可复用现有组件。

## 10. 最终批准方案

用户于 2026-09-11 明确回复“批准”。最终执行清单：使用既有 `SegmentedControl` 替换原生圆点单选；保留“宁静 / 愉悦”标签与当前曲目状态；删除专用圆点样式；补充组件测试。

## 11. 实施记录

已完成：

- `src/features/settings/AudioSettingsControl.tsx` 使用项目已有的 `SegmentedControl` 替换原生圆点单选。
- 保留“宁静 / 愉悦”文案、选中状态与曲目变更回调；未修改音频控制器、偏好结构或资源。
- `src/styles.css` 删除圆点单选专用规则，增加分段控件在音频面板中的最小布局规则。
- `src/features/settings/AudioSettingsControl.test.tsx` 增加背景音乐分组、两个情绪词和选中状态测试。

方案偏差：无。复用了仓库现有 `SegmentedControl` 适配层，没有新增依赖或独立抽象。

## 12. 验证结果

已验证：

- `npm run lint`：通过。
- `npm run test -- --run src/features/settings/AudioSettingsControl.test.tsx`：2 个测试通过。
- `npm run test -- --run`：32 个测试文件、137 个测试通过。
- `npm run build`：通过；仅有既有的大 chunk 警告。
- `node scripts/check-doc-references.mjs`：通过。
- `git diff --check`：通过。
- 浏览器视觉验收：用户未明确要求，未执行；截图仅作为本次方案的视觉证据。

## 13. 文档同步检查

- 产品文档：无产品行为变化，无需更新；背景音乐行为仍由 `DD-20260911-008` 记录。
- 架构文档：无所有权、数据流或公共接口变化，无需更新。
- 决策文档：无新增长期决策。
- 文档入口：本记录创建后按既有引用检查。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-09-11 18:40 CST | Codex | 根据用户截图创建 UI 调整待确认方案；截图仅作为视觉证据。 |
| 2026-09-11 18:42 CST | 用户 | 明确回复“批准”。 |
| 2026-09-11 20:40 CST | Codex | 使用既有 SegmentedControl 完成调整，自动验证通过，任务状态更新为待验收。 |
| 2026-09-11 20:46 CST | 用户 | 明确回复“ok，通过，commit”，验收选择器调整。 |
