# DD-20260808-001：建立 main 默认分支

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 工程配置 |
| 创建时间 | 2026-08-08 20:24 CST |
| 最后更新 | 2026-08-09 19:30 CST |
| 当前阶段 | 开发者（用户）已验收，任务完成 |
| 源码基线 | `e97a596cb944d7eeb7d81002c3f8083bd8dd0654` |
| 实现提交 | 未创建；本任务按批准方案不创建新提交 |
| 关联任务 | 用户要求为当前仓库建立 `main` 分支、推送远端并设为默认分支 |

> 用户已批准本方案；实施范围只包含建立并推送 `main`、切换 GitHub 默认分支和回写验证记录。

## 1. 给阅读者的结论

仓库已经从提交 `e97a596c` 建立本地和远端 `main`，GitHub 默认分支已经由 `docs/document-driven-workflow` 切换为 `main`。原分支继续保留，没有创建额外提交、PR 或标签。

## 2. 用户需求

- 用户原始要求：为当前仓库建立 `main` 分支，推送远程并作为默认分支。
- Codex 解释：`main` 应从当前已推送分支 `docs/document-driven-workflow` 的头提交建立；完成后本地检出 `main`、设置 `origin/main` 为上游，并将 GitHub 仓库的 `default_branch` 设置为 `main`。
- 限制：不创建额外提交，不删除或改写现有分支，不创建 PR。

## 3. 当前源码事实

- 本地当前检出分支为 `main`，跟踪 `origin/main`。
- 本地 `main`、`origin/main`、`docs/document-driven-workflow` 与 `origin/docs/document-driven-workflow` 都指向提交 `e97a596cb944d7eeb7d81002c3f8083bd8dd0654`。
- `origin` 为 `https://github.com/yuwuweichun/dear-desk.git`。
- GitHub 仓库元数据确认默认分支为 `main`；本地 `origin/HEAD` 也指向 `origin/main`。
- 当前 GitHub 登录身份为 `yuwuweichun`。
- 本任务只改变 Git 分支与仓库元数据，不改变产品、运行时代码、数据模型或当前应用调用链。
- 本任务记录仍是未提交文件，因为用户没有要求创建提交；它没有随 `main` 分支推送到远端。

## 4. 目标与非目标

### 4.1 目标

- 从当前提交建立本地 `main`。
- 将 `main` 推送至 `origin` 并配置本地上游为 `origin/main`。
- 将 GitHub 仓库默认分支设置为 `main`。
- 验证本地、远端和 GitHub 默认分支三者一致。

### 4.2 非目标

- 不删除或重命名 `docs/document-driven-workflow`。
- 不创建提交、标签、PR 或 GitHub Release。
- 不修改业务源码、依赖、工程配置、产品文档、架构文档或持久化数据。
- 不调整分支保护规则。

## 5. 方案说明

1. 在干净工作区从当前提交创建并检出 `main`。
2. 使用 `git push -u origin main` 推送并建立跟踪关系。
3. 通过 GitHub 仓库管理能力把默认分支更新为 `main`。
4. 重新读取 GitHub 仓库元数据与远端引用，确认 `default_branch=main`、`origin/main` 存在且提交 SHA 与本地一致。

该顺序保证 GitHub 只会在 `main` 已真实存在后切换默认分支，避免默认分支指向无效引用。

## 6. 预计改动与影响评估

- 本地 Git：新增 `refs/heads/main`，指向当前提交；当前检出分支切换为 `main`。
- 远端 Git：新增 `refs/heads/main`，指向同一提交。
- 本地跟踪配置：`main` 跟踪 `origin/main`。
- GitHub 仓库元数据：默认分支由 `docs/document-driven-workflow` 改为 `main`。
- 文档：本记录在实施后回写真实命令、结果、偏差与验证证据。

### 6.1 核心数据结构变化

无。产品领域类型、公共接口、IndexedDB schema、事件和运行时状态均不改变。

### 6.2 上下游与跨模块影响

- 新 clone、未指定目标的 PR、GitHub 仓库首页与部分自动化将以 `main` 为默认基线。
- 现有 `docs/document-driven-workflow` 分支及其提交历史保持不变。
- 当前未发现需要同步修改的产品或架构文档；分支管理事实由本任务记录负责追踪。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 推送失败 | 网络、凭据或远端权限异常 | `main` 只存在本地 | 已通过 GitHub 设备授权解决；未在失败阶段切换默认分支 |
| 默认分支切换失败 | GitHub 管理入口不可用或规则阻止 | 远端已有 `main`，但默认仍为旧分支 | 首次 TLS 超时后重试成功，并重新读取元数据验证 |
| 自动化仍引用旧分支 | 外部工作流硬编码旧分支名 | 部分 CI 或集成行为不随默认分支变化 | 仓库内未发现本任务需要修改的相关配置；外部集成不在本次范围 |
| 需要回退 | 切换默认分支后出现兼容问题 | 新 clone/PR 基线不符合预期 | 将 GitHub 默认分支改回 `docs/document-driven-workflow`；不删除 `main` |

## 8. 验证与验收

- 自动测试：不适用；无业务源码变化。
- 构建与静态检查：不适用；无源码、依赖或工程配置变化。
- 浏览器验收：不适用；无前端行为变化。
- 持久化与恢复：不适用；无产品数据变化。
- Git 验证：确认本地 `main`、`origin/main` 和原分支指向预期 SHA，工作区除本记录外无新增修改。
- GitHub 验证：重新读取仓库元数据，确认默认分支为 `main`。
- 成功标准：`main` 已存在于本地和远端、设置上游成功、GitHub 默认分支为 `main`，且旧分支未删除。

## 9. 待确认项与决策

- 已确认：从当前 `docs/document-driven-workflow` 的头提交建立 `main`，完成后保留旧分支。
- 无其余待确认项。

## 10. 最终批准方案

用户于 2026-08-08 20:28 CST 明确回复“批准”。最终执行清单如下：

1. 从提交 `e97a596cb944d7eeb7d81002c3f8083bd8dd0654` 建立本地 `main`。
2. 推送 `main` 到 `origin` 并设置本地上游。
3. 将 GitHub 默认分支设置为 `main`。
4. 保留 `docs/document-driven-workflow`，不创建提交、PR 或标签。
5. 验证本地、远端和 GitHub 默认分支状态并回写本文档。

## 11. 实施记录

1. 使用 `git switch -c main` 从 `e97a596cb944d7eeb7d81002c3f8083bd8dd0654` 创建并检出本地 `main`。
2. 首次 `git push -u origin main` 因本地 HTTPS Git 没有用户名或凭据失败；该失败没有创建远端引用。
3. 尝试通过已连接的 GitHub 管理入口创建远端分支，但安装令牌返回 `403 Resource not accessible by integration`，没有产生远端变更。
4. 从 GitHub 官方发布包下载便携版 `gh 2.94.0` 到 `/tmp`，下载的 Linux amd64 压缩包 SHA-256 为 `a757f1ba6db18f4de8cbadb244843a5f89bc75b5e7c6fc127d2bd77fbd12ed62`，与官方校验和一致。
5. 用户通过 GitHub 设备登录明确授权，CLI 确认登录身份为 `yuwuweichun`；凭据临时保存在 `/tmp/dear-desk-gh-config`，没有安装系统包；完成 GitHub 写操作后，该凭据目录、便携 CLI 和下载包均已删除。
6. 使用临时 CLI 凭据成功执行等价的 `git push -u origin main`，远端新增 `main`，本地 `main` 开始跟踪 `origin/main`。
7. 使用 `gh repo edit yuwuweichun/dear-desk --default-branch main` 更新默认分支；首次请求发生 TLS 握手超时，第二次重试成功。
8. 使用 `git remote set-head origin main` 将本地缓存的 `origin/HEAD` 同步到新的默认分支。
9. 验证完成后删除 `/tmp` 中的明文凭据目录、便携 CLI、压缩包与校验和文件。

方案偏差：原计划使用现有 Git/连接器凭据，实际环境不满足；因此增加了经用户批准的便携版 GitHub CLI 下载与设备授权。目标分支、提交 SHA、保留旧分支、不创建提交/PR/标签等已批准范围均未改变。

## 12. 验证结果

- `git status --short --branch`：当前分支为 `main`，跟踪 `origin/main`；仅本任务记录为未跟踪文件。
- `git branch --all --verbose --no-abbrev`：本地 `main`、`origin/main`、原本地分支和原远端分支都指向 `e97a596cb944d7eeb7d81002c3f8083bd8dd0654`。
- `git rev-parse HEAD` 与 `git rev-parse origin/main`：结果完全一致，均为上述 SHA。
- `gh repo view yuwuweichun/dear-desk --json nameWithOwner,defaultBranchRef,url`：返回 `defaultBranch=main`。
- `git symbolic-ref refs/remotes/origin/HEAD`：返回 `refs/remotes/origin/main`。
- 旧分支 `docs/document-driven-workflow` 在本地与远端均保留。
- 自动测试、构建、浏览器和持久化验证：不适用；没有业务源码、工程配置或产品数据变化。

## 13. 文档同步检查

- 产品文档：未修改；产品行为未变化。
- 架构文档：未修改；运行时架构未变化。
- 决策文档：未修改；未引入跨任务长期架构约束。
- 文档入口：未修改；本任务为小型 Git 管理记录，不新增独立入口。
- 文档引用检查：`node scripts/check-doc-references.mjs` 通过。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-08 20:24 CST | Codex | 创建待确认方案；完成本地 Git 与 GitHub 仓库只读核对。 |
| 2026-08-08 20:28 CST | 用户 | 明确回复“批准”，同意按第 10 节执行。 |
| 2026-08-08 20:44 CST | Codex | 完成 `main` 创建、推送、默认分支切换和 Git/GitHub 验证；状态更新为待验收。 |
| 2026-08-08 20:48 CST | Codex | 文档引用检查通过；删除本次任务在 `/tmp` 中创建的凭据与 CLI 临时文件。 |
| 2026-08-09 19:30 CST | 开发者（用户） | 确认当前工作区未验收成果已验收，同意将本任务标记为已完成并按任务提交记录。 |
