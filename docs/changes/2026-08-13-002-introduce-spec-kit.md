# DD-20260813-002：引入 GitHub Spec Kit 规范驱动工作流

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待验收 |
| 类型 | 工程流程 / 工具集成 |
| 创建时间 | 2026-08-13 10:44 CST |
| 最后更新 | 2026-08-13 17:33 CST |
| 当前阶段 | 实施与验证完成，等待用户验收 |
| 源码基线 | `9444278b4189be27a60a2a918edb9817d5e31f6c` (`refactor(scene): rebuild desk and notebook visuals`)；工作区已有其他未提交修改 |
| 实现提交 | 本次 `chore(tooling): introduce spec kit workflow` 提交 |
| 关联任务 | 在现有 Dear Desk 项目中引入 GitHub Spec Kit，并先说明引入后的变化与使用方式 |

> 用户已于 2026-08-13 10:55 CST 明确回复“批准执行”。Spec Kit `0.16.2` 已完成安装、项目初始化、规则校准和验证；本文等待用户验收。

## 1. 给阅读者的结论

Spec Kit 现已作为 Dear Desk **复杂功能的规格拆解工具** 引入，而没有替换现有审批制度。仓库已经增加 `.specify/` 和 `.agents/skills/`；首个真实复杂功能启动后，再由 `$speckit-specify` 创建按功能组织的 `specs/` 目录以及后续 `spec.md`、`plan.md`、`tasks.md`。现有 `docs/changes/` 仍是用户审批、实施回写和验收状态的唯一入口，长期项目原则仍由 `AGENTS.md` 与已接受 ADR 约束。

日常使用会变成：先创建 `docs/changes/` 任务记录并获得批准，再针对复杂功能使用 `$speckit-specify`、`$speckit-clarify`、`$speckit-plan`、`$speckit-tasks` 和 `$speckit-analyze`；确认规格、技术方案和任务互相一致后，才运行 `$speckit-implement`。一行文案、简单 CSS 或范围清楚的小修复仍沿用简短变更记录，不强制创建一整套 Spec Kit 产物。

默认 `python3` 仍为 `3.9.6`，但 Spec Kit 工具环境已明确使用 Homebrew Python `3.12.13`。本机现已安装 `uv 0.12.3` 和锁定的 `specify-cli 0.16.2`，CLI 对应官方 `v0.16.2` tag 的解析提交为 `4871b485f97c7fa452ec58eba325d87536c55c34`。

## 2. 用户需求

### 2.1 用户原始要求

- 在当前 Dear Desk 项目中引入 GitHub Spec Kit。
- 引入之前，先简单说明引入后会发生什么变化，以及如何使用。
- 采用 GitHub Spec Kit 的规范驱动链路：需求规格、技术方案、任务清单、一致性检查、代码实现。

### 2.2 Codex 的解释

- “引入”包含准备兼容运行时、安装或调用 `specify-cli`、以 Codex integration 初始化当前仓库、检查生成内容，并让生成工作流服从本项目既有审批与文档规则。
- Spec Kit 生成的功能规格不能绕过 `docs/changes/` 的用户批准门槛；`$speckit-implement` 只有在对应变更记录已批准后才允许修改业务源码、依赖、工程配置或持久化数据。
- 本任务只引入和校准工具，不顺带创建新的产品功能规格，也不修改 Dear Desk 产品行为。

## 3. 当前源码事实

- 仓库当前分支为 `main`，基线提交为 `9444278b4189be27a60a2a918edb9817d5e31f6c`。
- 初次检查时存在本任务之外的本子相关未提交修改；批准后的再次检查显示当前只剩未跟踪的 `docs/changes/2026-08-13-001-round-notebook-spine.md` 和本文。工作区变化由用户或其他流程产生，本任务不回退、不覆盖，也不把它们计入实施差异。
- 实施基线没有 `.specify/`、`.agents/skills/` 或 `specs/` 文件；当前已生成 `.specify/` 的 20 个项目文件和 `.agents/skills/` 的 10 个技能，仍未创建任何真实或示例 `specs/` 功能目录。
- `AGENTS.md` 和 `docs/decisions/2026-08-06-001-documentation-as-review-interface.md` 已确立：每个独立任务先写 `docs/changes/` 记录，用户批准前不得修改业务源码、依赖或工程配置，实施后必须回写真实结果并进入“待验收”。
- `docs/product/mvp.md` 定义 Dear Desk 当前产品范围；Spec Kit 初始化不应改变该范围。
- `package.json` 是 Node 22+ 的 React/Vite/TypeScript 工程；项目质量入口为 `npm run check`，依次运行 lint、测试、构建和文档引用检查。
- 当前 shell 中 `/usr/bin/python3` 为 Python `3.9.6`，但 `/opt/homebrew/bin/python3.12` 为 Python `3.12.13`；未找到 `uv` 与 `specify`。因此可复用合格的 Python 3.12，只需补充 `uv` 与 CLI。

### 3.1 真实流程边界

当前审批调用链为：

```text
用户提出任务
  -> docs/changes/ 变更记录（待确认）
  -> 用户明确批准
  -> 修改源码与配套文档
  -> 自动检查与必要的浏览器验收
  -> 变更记录回写（待验收）
  -> 用户接受（已完成）
```

预计加入 Spec Kit 后，复杂功能在“批准”和“实施”之间增加可审查的规格拆解；现有状态机与审批权不变。

## 4. 目标与非目标

### 4.1 目标

- 在不覆盖用户现有修改的前提下，以 Codex integration 初始化 Spec Kit。
- 将 Spec Kit 与 Dear Desk 的现有文档审批制度明确对接，避免出现两套互相竞争的事实来源。
- 固定 `specify-cli` 版本及可复现的安装/初始化说明。
- 确认 `.specify/`、`.agents/skills/` 和基础配置可用，且生成文件可以被 Git 审查。
- 记录复杂功能与小改动分别如何使用 Spec Kit。

### 4.2 非目标

- 不在本任务中实现新的 Dear Desk 产品功能。
- 不改变 IndexedDB、Zustand、React、Three.js 或 DOM/WebGL 所有权。
- 不把所有小改动强制扩展为 `spec.md + plan.md + tasks.md`。
- 不让 `.specify/memory/constitution.md` 覆盖或削弱 `AGENTS.md`、产品文档和已接受 ADR。
- 不自动创建提交、推送远端或创建 PR。

## 5. 方案说明

### 5.1 两套文档的职责

| 文档 | 职责 | 是否具有批准权 |
| --- | --- | --- |
| `docs/changes/<任务>.md` | 用户可读的范围、风险、批准、实施事实和验收记录 | 是，仍是任务审批主入口 |
| `AGENTS.md` | Codex 长期协作规则和硬性门槛 | 是，约束所有 Spec Kit 命令 |
| `docs/product/`、`docs/architecture/`、`docs/decisions/` | 当前产品事实、架构事实和长期决策 | 是，不得被生成模板静默推翻 |
| `.specify/memory/constitution.md` | 把既有原则映射为 Spec Kit 可消费的项目宪法 | 否；内容必须与上列文档一致 |
| `specs/<功能>/spec.md` | 单个复杂功能的用户需求与验收标准 | 否；作为对应变更记录的详细附件 |
| `specs/<功能>/plan.md` | 已批准需求的技术实现方案 | 否；若出现新架构决策，回写变更记录并重新批准 |
| `specs/<功能>/tasks.md` | 可执行、按依赖排序的实现任务 | 否；不得扩大已批准范围 |

### 5.2 引入后的日常流程

复杂功能推荐流程：

```text
创建 docs/changes 记录
  -> 用户批准目标与 Spec Kit 使用范围
  -> $speckit-specify
  -> $speckit-clarify
  -> 用户审阅关键需求决策
  -> $speckit-plan
  -> $speckit-tasks
  -> $speckit-analyze
  -> 将最终清单回写 docs/changes 并取得实施批准
  -> $speckit-implement
  -> npm run check + 必要的 ego-browser 验收
  -> 回写 docs/changes，状态改为待验收
```

范围明确的小改动继续使用当前简化流程，不强制运行 Spec Kit。这样可以保留规范驱动对复杂功能的价值，同时避免为一行文案或局部样式承担过高文档成本。

### 5.3 项目宪法映射

初始化后将把以下既有约束映射进 Spec Kit constitution，而不是创造第二套原则：

- 文档先行、明确批准后实施、完成后回写。
- TypeScript 维持 strict，用户可见行为有相称测试。
- 持久化数据与 Three.js 场景对象分离，未经批准不增加第二个 WebGL Canvas。
- 产品行为、架构和长期决策变化分别同步对应文档。
- 前端视觉与交互按项目规则使用 ego-browser 验收。
- 分支名和提交遵循 Conventional Commits；未经要求不自动提交或推送。

## 6. 预计改动与影响评估

批准后预计执行：

1. 解决或选用 Python 3.11+ 运行时，并安装 `uv`（若系统已有其他合格 Python，则优先复用）。
2. 查询并锁定当时的官方稳定 `specify-cli` Release 版本，以 `uv tool install specify-cli` 或锁定 GitHub Release 的方式安装。
3. 在仓库根目录运行 Codex integration 的现有项目初始化命令；执行前查看 CLI 帮助并确认不会覆盖现有文件，必要时使用官方提供的冲突处理参数。
4. 审查所有生成差异，保留 `.specify/`、`.agents/skills/` 与必要模板；不接受对用户现有业务源码或任务记录的意外覆盖。
5. 将既有项目原则映射到 `.specify/memory/constitution.md`，并明确其从属于 `AGENTS.md`、当前产品/架构文档和已接受 ADR。
6. 在仓库的 Markdown 使用说明中补充 Dear Desk 的 Spec Kit 命令顺序、适用范围和审批门槛；若确需实质修改 HTML 文档入口，必须先满足项目要求的 `$bun-html-docs` 技能前置，否则不修改 HTML 并记录未覆盖项。
7. 运行 Spec Kit 自检、`npm run check` 和文档引用检查，逐项核对 Git diff，回写本文并标记为“待验收”。

预计主要新增或修改路径：

| 路径 | 预计责任 |
| --- | --- |
| `.specify/` | 官方脚本、模板、配置和项目 constitution |
| `.agents/skills/` | Codex 可发现的 `$speckit-*` 技能 |
| `specs/` | 后续功能规格目录；本任务不伪造产品功能规格 |
| `README.md` 或等价 Markdown 指南 | 记录项目内的实际命令、版本和审批衔接 |
| `AGENTS.md` | 仅在生成技能无法自然继承现有规则时，补充最小且不重复的 Spec Kit 边界 |
| 本任务记录 | 回写真实版本、生成文件、冲突处理、验证结果和偏差 |

### 6.1 核心数据结构变化

不改变应用运行时类型、公共接口、IndexedDB schema 或持久化数据。新增内容仅为 Git 跟踪的 Markdown、脚本、模板和 AI 助手技能文件。

### 6.2 上下游与跨模块影响

- **Codex 会话**：新增 `$speckit-*` 技能；通常需要重新启动或重新加载 Codex 会话后才能发现新技能。
- **开发流程**：复杂功能多出规格、澄清、方案、任务和一致性检查阶段。
- **源码与运行时**：初始化本身不应改变 React/Vite 构建或产品运行行为。
- **文档体系**：`specs/` 提供功能级细节，`docs/changes/` 继续记录批准与验收；两者必须互相引用，不能产生不同结论。
- **Git**：生成内容会增加可审查文件数量；安装在用户工具环境中的 CLI 本体通常不提交到仓库。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 初始化覆盖现有文件 | 直接运行 init 且未审查冲突 | 用户规则或修改丢失 | 先查看帮助和 Git 状态，初始化后立即审查 diff；保留用户文件，拒绝意外覆盖 |
| 两套流程互相矛盾 | constitution 或 spec 被当成更高事实来源 | 绕过批准或文档失真 | 明确 `docs/changes` 审批主入口和事实优先级；冲突先回写并等待确认 |
| 环境不满足要求 | 继续使用 Python 3.9.6，且无 `uv` | CLI 无法安装或运行 | 实施前准备 Python 3.11+ 与 `uv`，记录准确版本 |
| CLI 版本漂移 | 安装未锁定版本或跟踪 `main` | 团队生成结果不一致 | 锁定官方稳定 Release，并在 README/记录中写明版本 |
| 小改动流程过重 | 所有任务都强制全套命令 | 文档成本高、交付变慢 | 只对多模块、需求复杂或高风险功能使用完整链路 |
| 生成脚本扩大执行面 | 未审查技能便运行 implement | 意外修改范围 | 审查生成技能与任务列表；实施仍受批准记录限制 |

回退方式：删除本任务实际生成的 `.specify/`、`.agents/skills/`、空的 `specs/` 及对应说明改动，并卸载锁定版本的 `specify-cli`。回退前后均不得触碰用户既有未提交修改；若后续已有功能规格被使用，则先保留或导出这些 Markdown 历史，不做直接删除。

## 8. 验证与验收

- 自动测试：运行 `npm run check`，确认工具文件未破坏现有 lint、测试、构建与文档引用检查。
- 工具验证：运行 `specify version`，记录锁定版本；检查 Codex integration 生成的技能与模板路径。
- 工作流验证：在不修改业务源码的前提下，检查 `$speckit-*` 技能可被 Codex 发现；不在本任务中用虚构功能执行 `$speckit-implement`。
- 构建与静态检查：沿用 `package.json` 的 `check` 脚本。
- 浏览器验收：不适用；本任务不改变前端 UI，按项目规则无需浏览器视觉验证。
- 持久化与恢复：不适用；不改变 IndexedDB 或产品状态。
- 文档验证：运行 `node scripts/check-doc-references.mjs`，检查新增路径和引用；逐项核对批准清单与真实 Git diff。
- 成功标准：命令可用、版本固定、Codex 技能生成完整、现有文件未被意外覆盖、两套文档职责明确、全量项目检查通过。

## 9. 待确认项与决策

建议一次确认以下默认方案：

1. **流程关系**：Spec Kit 补充而不替代现有 `docs/changes/` 审批与回写制度。建议采用。
2. **使用范围**：完整 Spec Kit 链路只要求用于多模块、需求复杂或高风险功能；小改动继续使用简短变更记录。建议采用。
3. **版本策略**：实施时查询官方最新稳定 Release 并锁定准确版本，不跟踪 `main`。建议采用。
4. **运行时策略**：优先使用 `uv` 管理隔离的 CLI 工具环境；补齐 Python 3.11+，不修改 Dear Desk 的 Node 运行时或 npm 依赖。建议采用。
5. **首个功能规格**：本次只完成工具初始化和规则校准，不额外创建示例/虚构功能 spec；下一项真实复杂功能再创建首份 `specs/<功能>/`。建议采用。

这些决策不会改变产品体验、数据模型或应用架构。用户回复“批准”“按此执行”或等价表达后，将按第 10 节执行清单实施。

## 10. 最终批准方案

用户于 2026-08-13 10:55 CST 明确回复“批准执行”，第 9 节五项推荐决策全部通过。最终执行清单为：

1. 复用 `/opt/homebrew/bin/python3.12`，安装 `uv`，不修改 Dear Desk 的 npm 依赖或 Node 运行时。
2. 查询官方稳定 Release，锁定准确版本安装 `specify-cli`，记录工具版本。
3. 审查 CLI 帮助后，以 Codex integration 初始化当前目录，保护现有文件和用户修改。
4. 审查并校准 `.specify/`、`.agents/skills/` 和 constitution，使其服从 `AGENTS.md`、当前产品/架构文档与 ADR。
5. 补充 Markdown 使用说明，不创建虚构功能 spec，不修改产品行为或 HTML 文档。
6. 运行 Spec Kit 工具验证、`npm run check` 和文档引用检查；逐项核对真实差异并把本文更新为“待验收”。

## 11. 实施记录

已按批准清单完成，未修改产品运行时、业务源码、npm 依赖、IndexedDB schema 或用户数据：

1. 使用 Homebrew 安装 `uv 0.12.3`，复用 `/opt/homebrew/bin/python3.12`；未替换系统默认 Python，也未改变 Dear Desk Node 配置。
2. 查询 GitHub 官方 tags，锁定并安装 `specify-cli 0.16.2`；安装命令固定到 `v0.16.2`，没有跟踪 `main`。
3. 以 `codex + skills + sh` 初始化当前仓库，生成 `.specify/` 的 20 个文件和 `.agents/skills/` 的 10 个项目级 Codex 技能。首次沙箱执行因 `.agents/` 受保护而在写入前失败且未留下部分文件；获得受控权限后以同一命令成功完成。
4. 将 `.specify/memory/constitution.md` 从占位模板改为 Dear Desk 1.0.0 constitution，映射文档审批、MVP 范围、状态/渲染所有权、验证、Git 和验收门槛，并明确其从属于 `AGENTS.md` 与已接受 ADR。
5. 校准 `spec-template.md`、`plan-template.md` 和 `tasks-template.md`：增加对应变更记录字段、范围边界、constitution 检查、相称测试、文档回写、ego-browser 验收和“待验收”任务；删除会误导为自动建分支或自动提交的示例措辞。
6. 更新 `AGENTS.md` 和文档流程 ADR，固定 `docs/changes/` 与 `specs/` 的职责边界；更新 `README.md`，记录版本、安装、初始化、命令顺序和升级风险。
7. 更新根 `.gitignore`：默认忽略 `.agents/` 中未来可能出现的机器本地数据，只显式放行 `.agents/skills/**`；`.specify/feature.json` 继续由官方 `.specify/.gitignore` 作为每机当前功能指针忽略。
8. 没有创建 `specs/` 示例功能或虚构产品规格。干运行只计算出未来首个目录 `specs/001-spec-kit-smoke/spec.md`，未写文件、未切分支。

实际方案偏差：批准方案预计“必要时补充 `AGENTS.md`”，审查后确认必须补充，否则 `$speckit-implement` 的批准门槛不会成为项目级可发现规则；同时为长期从属边界补充了既有文档流程 ADR。未修改 HTML 文档入口，因此没有触发 `$bun-html-docs` 前置。

## 12. 验证结果

- `uv --version`：`uv 0.12.3`。
- `specify version`：CLI `0.16.2`、Python `3.12.13`、Darwin arm64。
- `specify check`：通过；Codex CLI 被识别为 available，CLI 报告 ready to use。
- `bash -n .specify/scripts/bash/*.sh`：6 个脚本全部通过语法检查，并保持可执行权限。
- JSON 解析检查：`.specify/` 下全部 JSON 文件可由 `JSON.parse` 读取。
- `.specify/scripts/bash/create-new-feature.sh --dry-run --json --short-name spec-kit-smoke 'Spec Kit smoke validation'`：通过，返回 `001-spec-kit-smoke` 路径；确认未创建 `specs/` 文件或 Git 分支。
- `.agents/skills/`：10 个 `SKILL.md` 已生成；`.specify/`：20 个项目文件已生成。
- 敏感内容扫描：新增 `.agents/`、`.specify/` 和说明文档未命中 API key、access token、client secret、private key 或 password 赋值模式。
- `git check-ignore`：机器本地 `.agents/*` 默认忽略，`.agents/skills/**` 显式放行；`.specify/feature.json` 按官方规则忽略。
- `npm run check`：提交前复验通过。ESLint 通过；Vitest 13 个测试文件、55 项测试全部通过；TypeScript/Vite 构建通过；文档引用检查通过。构建保留既有 chunk size 警告，本任务未改变应用 bundle 输入。
- `git diff --check`：通过，无空白错误。
- 浏览器验收：未执行。本任务没有前端 UI、交互、运行时或持久化行为变化，按项目规则不需要视觉验证。

## 13. 文档同步检查

- 产品文档：本任务不改变产品范围，未修改 `docs/product/mvp.md`。
- 架构文档：本任务不改变运行时架构，未修改 `docs/architecture/system-overview.html`。
- 决策文档：已在 `docs/decisions/2026-08-06-001-documentation-as-review-interface.md` 补充 Spec Kit 从属边界，没有创建重复 ADR 或改变原审批状态机。
- 文档入口：未修改 `docs/index.html`；本任务的使用入口为 `README.md`，因此不触发 `$bun-html-docs` 或 HTML 视觉验证。
- 项目规则：已更新 `AGENTS.md`，使 Spec Kit 技能在后续会话中可直接读取审批边界。
- 引用检查：`node scripts/check-doc-references.mjs` 通过。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-13 10:44 CST | Codex | 创建待确认方案；核对现有审批制度、产品范围、架构决策、仓库状态和本地工具环境；尚未安装或初始化 Spec Kit。 |
| 2026-08-13 10:55 CST | 用户 / Codex | 用户明确回复“批准执行”，通过第 9 节五项推荐决策；任务进入实施。批准后复查确认本机已有 Python 3.12.13，且工作区只剩两份未跟踪任务记录。 |
| 2026-08-13 10:56-10:58 CST | Codex | 查询官方 tags，安装 `uv 0.12.3` 与锁定的 `specify-cli 0.16.2`；记录官方 tag 解析提交。 |
| 2026-08-13 10:58 CST | Codex | 首次初始化因沙箱禁止写入 `.agents/` 而在生成前失败；确认无部分文件后，以受控权限重跑同一官方命令并成功初始化。 |
| 2026-08-13 10:59-11:03 CST | Codex | 审查生成技能、脚本和模板；建立 Dear Desk constitution，校准任务模板、项目规则、README、ADR 与忽略策略，没有创建示例 spec。 |
| 2026-08-13 11:04 CST | Codex | Spec Kit 自检、shell/JSON 检查、干运行、敏感内容扫描、`npm run check`、文档引用和 Git 差异检查全部通过；任务进入待验收。 |
| 2026-08-13 17:33 CST | Codex | 按用户要求创建提交前再次运行全量 `npm run check`、Shell 语法、JSON 解析与差异检查；13 个测试文件、55 项测试通过，准备以 `chore(tooling): introduce spec kit workflow` 提交。 |
