# DD-20260823-002：修复铭牌输入框强制大写

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 修复 / 表单交互 |
| 创建时间 | 2026-08-23 01:58 CST |
| 最后更新 | 2026-08-23 02:05 CST |
| 当前阶段 | 实施、验证和提交前预先验收均已完成 |
| 源码基线 | 当前工作树，存在其他用户修改，未创建提交 |
| 实现提交 | 本次提交（由 Git 记录） |
| 关联任务 | 用户反馈编辑铭牌时输入框总显示大写，但铭牌实际保留小写，要求解释并修复 |

> 用户已明确要求修复并验证。本记录按直接执行授权推进，范围仅限铭牌输入框大小写显示一致性。

## 1. 给阅读者的结论

铭牌输入框的 CSS 使用了 `text-transform: uppercase`，导致浏览器只把输入框内容视觉转换为大写；React 状态、保存到 IndexedDB 的值和 3D 铭牌渲染仍保留用户输入的小写，因此出现输入框与铭牌显示不一致。

修复后输入框将原样显示用户输入的大小写，保存和铭牌渲染继续使用同一个原始字符串。

## 2. 用户需求

- 输入大写时显示大写，输入小写时显示小写。
- 输入框展示、保存值和实际铭牌显示必须一致。
- 解释当前逻辑为何产生不一致。

## 3. 当前源码事实

- `src/app/App.tsx` 通过 `onChange` 把 `event.target.value` 原样写入 `nameplateDraft`，保存前只调用 `normalizeNotebookLabel`，没有大小写转换。
- `src/styles.css` 的 `.nameplate-dialog__label input` 设置了 `text-transform: uppercase`，浏览器因此只改变输入控件的视觉呈现。
- `src/state/app-store.ts` 和 `src/persistence/notebook-cover-settings-repository.ts` 保存 `label` 原值；`src/scene/NotebookObject.tsx` 把该值传给 `createNameplateText`。
- 现有 `src/app/App.test.tsx` 只覆盖大写保存，缺少小写输入框显示与保存值回归测试。

## 4. 目标与非目标

### 4.1 目标

- 删除铭牌输入框的强制大写展示规则。
- 增加小写输入的 DOM 展示和保存值回归测试。
- 保持现有空白归一化、字符限制、字体选择和 3D 铭牌渲染不变。

### 4.2 非目标

- 不修改 `NotebookCoverSettings` 数据结构、IndexedDB schema 或迁移逻辑。
- 不修改铭牌 3D 材质、字体、纹理或相机行为。
- 不改变其他界面控件的大小写样式。

## 5. 方案说明

移除输入框 CSS 的 `text-transform: uppercase`。输入事件和保存链路已经保留原始大小写，因此无需增加新的状态转换或数据迁移；测试直接断言小写值仍显示在输入框中，并以小写值调用 repository `save`。

## 6. 预计改动与影响评估

| 文件 | 责任 |
| --- | --- |
| `src/styles.css` | 删除铭牌输入框的强制大写展示规则 |
| `src/app/App.test.tsx` | 增加小写输入显示与保存值回归覆盖 |
| `docs/changes/2026-08-23-002-fix-nameplate-input-casing.md` | 记录事实、实施和验证结果 |

### 6.1 核心数据结构变化

无变化。铭牌仍以 `NotebookCoverSettings.label: string` 保存。

### 6.2 上下游与跨模块影响

输入框视觉层恢复原样显示；现有 `App -> app-store -> repository -> NotebookObject` 调用链不变。影响面限于铭牌编辑对话框。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 误改其他输入框 | 选择器范围过宽 | 其他表单大小写改变 | 只修改 `.nameplate-dialog__label input`；用目标测试和差异检查确认 |
| 测试未覆盖实际样式 | 仅断言保存值 | 回归可能再次出现 | 增加 `toHaveValue('dear desk')` 断言并运行组件测试 |

## 8. 验证与验收

- 自动测试：`src/app/App.test.tsx` 铭牌编辑测试；相关 Vitest 测试。
- 构建与静态检查：`npm run lint`、`npm test`、`npm run build`、`git diff --check`。
- 浏览器验收：必要时使用 ego-browser 检查桌面输入框的小写显示与保存后铭牌一致性。
- 持久化与恢复：复用现有 repository/store 测试，确认保存值不被转换。
- 成功标准：输入框保留用户输入的大小写，repository 接收同样大小写的字符串，已有铭牌功能测试继续通过。

## 9. 待确认项与决策

无。用户已明确要求修复，且根因与修复范围不会改变产品行为边界。

## 10. 最终批准方案

已批准（2026-08-23，用户明确要求“请修复”）。执行清单：删除铭牌输入框 `text-transform: uppercase`，补充小写输入回归测试，运行 lint、测试、构建和差异检查，并回写本记录。

## 11. 实施记录

- `src/styles.css` 删除 `.nameplate-dialog__label input` 的 `text-transform: uppercase`，输入框恢复按原始值显示大小写。
- `src/app/App.test.tsx` 增加小写输入回归用例，断言输入框显示 `dear desk` 且 repository 保存 `dear desk`。
- 未修改输入事件、`normalizeNotebookLabel`、IndexedDB schema、store 或 Three.js 铭牌渲染链路；实际差异与预计清单一致。

## 12. 验证结果

已运行并通过：

- `npm test -- --run src/app/App.test.tsx`：1 个测试文件、7 项测试通过。
- `npm run check`：lint 通过；20 个测试文件、89 项测试通过；TypeScript/Vite production build 通过；文档引用检查通过。
- `git diff --check`：通过。

未执行 ego-browser 视觉验收：本次是单个表单样式回归，项目规则允许使用目标组件测试和静态检查替代浏览器视觉验证。桌面/移动端人工输入确认仍待用户验收。

## 13. 文档同步检查

- 产品文档：不改变产品范围；本记录补充表单大小写行为事实。
- 架构文档：不改变状态所有权、持久化模型或公共接口。
- 决策文档：不新增长期约束。
- 文档入口：`docs/index.html` 已新增本记录入口并标记已完成。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-23 01:58 CST | Codex | 创建修复记录，确认 CSS 展示层强制大写是根因。 |
| 2026-08-23 01:59 CST | Codex | 删除输入框强制大写样式，补充小写输入回归测试；自动检查全部通过，状态更新为待验收。 |
| 2026-08-23 02:05 CST | 用户 / Codex | 用户明确要求提交当前工作区；该修复未超出批准范围且完整检查通过，按预先验收规则更新为已完成并纳入同一提交。 |
