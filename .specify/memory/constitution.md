# Dear Desk Spec Kit Constitution

本文把 Dear Desk 已批准的项目规则映射为 Spec Kit 的规划门槛。它服务于规格、方案和任务生成，不替代 `AGENTS.md`、`docs/changes/`、当前产品/架构文档或已接受 ADR。

## Core Principles

### I. 文档先行与明确审批（不可绕过）

每个可独立验收的任务必须先建立 `docs/changes/YYYY-MM-DD-NNN-*.md`。只读检查和方案记录无需批准；修改业务源码、依赖、工程配置或持久化数据前，用户必须明确批准，并在变更记录中写入最终执行清单。Spec Kit 产物是该记录的功能级附件，`$speckit-implement` 不得替代批准步骤。

### II. 规格、实现与当前事实一致

`spec.md` 描述用户目标、场景、边界和可验证结果；`plan.md` 描述真实调用链、数据结构、接口、依赖和验证策略；`tasks.md` 只能拆解已经批准的范围。实现完成后必须逐项对照 Git 差异，回写实际文件、行为、偏差和验证结果。不得把预计实现写成当前事实。

### III. 小型可验收纵向切片

优先交付能独立运行和验收的最小纵向能力。不得实现 `docs/product/mvp.md` 的非目标，不为假设中的未来需求预建数据结构、抽象层或第二套渲染路径。简单文案、局部 CSS 和明确的小修复不强制使用完整 Spec Kit 链路。

### IV. 状态所有权与渲染边界

持久化领域数据必须与 Three.js 运行对象分离；场景只是可序列化状态的视觉投影。普通表单、编辑器和信息面板优先使用 DOM，只有空间关系、光照或遮挡进入 WebGL。未经独立批准不得增加第二个 WebGL Canvas，也不得把 Mesh、Texture、Material、Camera 或 DOM Event 写入应用持久状态。

### V. 风险相称的验证

用户可见行为必须有相称的自动测试；持久化能力必须验证页面重新打开后的恢复。实施结束运行 `npm run check` 和文档引用检查。前端视觉或交互变化按 `AGENTS.md` 使用 ego-browser 验证桌面和移动端；单组件样式重构按项目例外使用针对性检查。未执行的验证必须明确记录，不能写成通过。

## Project Constraints

- 运行时以当前 `package.json`、TypeScript strict 配置和现有 React/Vite/Three.js/Dexie/Zustand 边界为准；新增依赖必须在任务方案中说明必要性和替代方案。
- 产品范围以 `docs/product/mvp.md` 为准；架构、状态所有权、持久化或公共接口变化同步 `docs/architecture/`，长期约束同步 `docs/decisions/`。
- HTML 文档必须使用项目要求的 `$bun-html-docs` 技能；技能不可用时暂停 HTML 修改并记录未覆盖项。
- 分支名若需要创建，使用 `feat/`、`fix/`、`refactor/`、`docs/`、`test/`、`chore/` 等 Conventional Commits 类型前缀。未经用户明确要求，不创建提交、不推送、不创建 PR。
- 不在日志、规格、任务、截图或提交内容中写入密钥、令牌和个人信息。

## Spec Kit Workflow Gates

1. `$speckit-specify` 前：对应 `docs/changes/` 记录存在，且用户已批准进入规格阶段。
2. `$speckit-plan` 前：规格中的关键歧义已经澄清；新增范围或产品决策已回写变更记录并获得确认。
3. `$speckit-tasks` 前：方案引用真实源码路径，列明上下游、风险、回退、测试和文档同步责任。
4. `$speckit-analyze` 后：阻断级冲突必须修复；最终任务清单回写 `docs/changes/`。
5. `$speckit-implement` 前：变更记录状态为“已批准”或“实施中”，最终执行清单已明确批准。
6. 实施结束：完成自动检查与适用验收，回写事实并把任务标记为“待验收”；只有用户接受后才标记为“已完成”。

## Governance

发生冲突时，以可运行源码与自动测试、已批准且完成回写的任务记录、当前架构文档、产品与设计说明、旧记录和合理推断的顺序定位事实，但发现错误文档后必须修复或记录待确认项。`AGENTS.md` 与已接受 ADR 是本文的上位协作规则；本文不得削弱其审批门槛。

修改本文中的长期规则必须先创建变更记录并获得用户批准，同时更新 `AGENTS.md` 或相应 ADR。Spec Kit CLI 升级后必须审查生成差异，确保本 constitution、项目模板和技能仍遵守这些门槛。

**Version**: 1.0.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-08-13
