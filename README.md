# Dear Desk

Dear Desk 是一个会随着使用逐渐留下痕迹的私人工作台。

本项目采用文档驱动的协作方式。产品范围、项目架构、任务方案和实施记录从 [文档入口](./docs/index.html) 开始阅读。

当前阶段：文档流程已通过验收，首版产品范围已批准。编号 002 已实现 3D 本子入口、DOM 当天文字编辑与 IndexedDB 恢复，现处于待验收；镜头聚焦转场和基础贴纸分别在编号 003、004 等待审批。

本地开发服务固定为 `http://127.0.0.1:5164`。运行 `npm run dev` 启动；端口被占用时会明确失败，不会自动切换端口。

## Spec Kit

项目使用 GitHub Spec Kit `0.16.2` 辅助拆解复杂功能。仓库中的 `.specify/` 保存脚本、模板和项目宪法，`.agents/skills/` 保存 Codex 的 `$speckit-*` 技能；首个真实复杂功能开始后，规格会保存在 `specs/<编号>-<功能名>/`。

Spec Kit 不替代 Dear Desk 的文档审批制度。每项任务仍先创建 `docs/changes/` 记录；复杂功能在获得规格阶段批准后按以下顺序工作：

```text
$speckit-specify
$speckit-clarify
$speckit-plan
$speckit-tasks
$speckit-analyze
```

将最终范围和执行清单回写对应变更记录并获得实施批准后，才运行 `$speckit-implement`。简单文案、局部样式或范围明确的小修复继续使用简短变更记录，不强制生成完整规格。

本机工具安装与验证：

```bash
brew install uv
uv tool install --python /opt/homebrew/bin/python3.12 \
  --from git+https://github.com/github/spec-kit.git@v0.16.2 specify-cli
specify version
specify check
```

项目初始化使用的固定命令为：

```bash
specify init . --integration codex --integration-options="--skills" --script sh --force
```

重新初始化或升级前先审查工作区；`--force` 会合并当前目录并可能覆盖同名文件。升级后必须重新核对 `AGENTS.md`、`.specify/memory/constitution.md`、项目模板和 `.agents/skills/`。
