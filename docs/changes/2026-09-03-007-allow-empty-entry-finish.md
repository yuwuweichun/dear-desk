# DD-20260903-007：允许空内容收笔

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 修复 |
| 创建时间 | 2026-09-03 23:39 CST |
| 最后更新 | 2026-09-03 23:58 CST |
| 当前阶段 | 已实施并完成验收 |
| 源码基线 | 批准前工作树 |
| 实现提交 | 本次提交 |
| 关联任务 | 当前收笔逻辑与空内容收笔需求 |

> 本文是待审阅方案。批准前只允许只读检查和修改本文档。

## 1. 给阅读者的结论

当前“收笔”会把编辑中的内容与已保存内容比较，并在按钮层额外要求正文和标题都非空。因此空正文时按钮直接禁用；即使绕过按钮，生产 repository 也会因 domain 校验拒绝空正文。本次建议仅放行正文为空的保存链路，不新增数据模型或入口。

## 2. 用户需求

- 用户原始要求：说明当前收笔逻辑；内容为空时，也允许收笔。
- Codex 解释：保留已有的防止未收笔切换/关闭行为，仅允许收笔动作在正文为空时完成。

## 3. 当前源码事实

- `src/features/journal/JournalPanel.tsx` 的 `JournalBook` 在进入书写时把当前页标题和正文复制到 `draftTitle`、`draft`，并以两者与当前已保存值的差异计算 `dirty`。
- 收笔按钮的 `disabled` 条件同时检查 `overLimit`、`titleOverLimit`，以及书写中 `activeDraft.trim()` 和 `activeTitle.trim()` 是否为空；因此正文为空时按钮直接禁用，标题为空时也直接禁用。
- 收笔动作调用 `saveDraft`，再进入 `useAppStore` 的 `saveJournalEntry`，最终调用 repository 的 `save`。
- `src/persistence/daily-entry-repository.ts` 的生产实现调用 `normalizeEntryText`；`src/domain/daily-entry.ts` 当前对正文执行 `trim()` 后拒绝空字符串，并抛出“请先写下一点内容”。标题同样拒绝空字符串。
- `src/features/journal/JournalPanel.test.tsx` 已覆盖非空内容保存、保存失败保留草稿及 dirty 草稿拦截翻页/切换/关闭，但没有覆盖空正文收笔。
- `src/domain/daily-entry.test.ts` 当前把空正文列为校验失败场景；这与本次新需求冲突，需要同步修正。
- `docs/architecture/system-overview.html` 的状态表仍记录“空文本……拒绝收笔”，这是需要随源码修复更新的旧事实。

## 4. 目标与非目标

### 4.1 目标

- 允许正文为空时点击“收笔”。
- 保持非空内容的保存与书写态阻止逻辑不变。

### 4.2 非目标

- 不改变标题、贴纸、日期切换、关闭本子或持久化结构。

## 5. 方案说明

方案为：允许 `normalizeEntryText` 将空白正文规范化为 `''`，保留长度限制；移除 `JournalPanel` 对空正文的收笔禁用条件，但继续要求标题非空并保留所有长度校验。这样已有记录可以被清空，新页面也可以以空正文收笔。

## 6. 预计改动与影响评估

预计修改 `src/domain/daily-entry.ts`、`src/features/journal/JournalPanel.tsx` 及对应测试；同步修正 `docs/architecture/system-overview.html` 中空文本失败描述，并在本记录中写入实际结果。不会新增抽象、依赖、数据表或状态字段。

### 6.1 核心数据结构变化

不变化。`DailyEntry.text` 仍为字符串；空正文以 `text: ''` 保存，标题仍为非空字符串。现有日期主键和更新时间语义不变。

### 6.2 上下游与跨模块影响

上游是编辑态按钮和 `saveDraft`；下游是 `saveJournalEntry`、`DailyEntryRepository.save` 与 IndexedDB `dailyEntries`。共享 domain 校验放行后，内存测试 repository 和生产 Dexie repository 保持同一调用形态。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 空正文产生日期记录 | 收笔复用现有保存流程 | 新页面可能被索引为该日期 | 这是本次需求的直接结果；不改变空标题约束，失败仍保留草稿 |

## 8. 验证与验收

- 自动测试：更新正文规范化测试，补充新页面空正文收笔与已有记录清空的回归检查。
- 构建与静态检查：按项目现有命令执行。
- 浏览器验收：未要求，默认不执行。
- 持久化与恢复：确认空收笔不会破坏已有内容。
- 成功标准：空正文点击收笔后退出书写态，且不产生非预期数据。

## 9. 待确认项与决策

是否允许“空正文收笔”在没有历史记录时创建一条标题非空、正文为空的 `DailyEntry`：当前建议允许，因为用户要求“内容为空时也允许收笔”，且现有保存接口是按日期 upsert。若只希望退出书写态而不创建记录，需要另行改变保存语义。

## 10. 最终批准方案

用户于 2026-09-03 批准。执行清单：放行空正文 domain 校验；移除 UI 空正文禁用；补测试；更新产品与架构事实；运行 lint、测试、build 与文档引用检查。

## 11. 实施记录

已完成。修改 `src/domain/daily-entry.ts` 放行空正文；修改 `src/features/journal/JournalPanel.tsx` 移除正文非空的收笔禁用条件；更新 `src/domain/daily-entry.test.ts` 及 `src/features/journal/JournalPanel.test.tsx`，覆盖新页空正文收笔和清空已有正文；同步 `docs/product/mvp.md` 与 `docs/architecture/system-overview.html`。未扩大批准范围。

## 12. 验证结果

已验证：定向 domain/JournalPanel 测试 2 个文件、15 个用例通过；完整检查中的 29 个测试文件、127 个用例通过，新增的第二个空正文回归测试随后再次通过；lint、`tsc -b`、Vite build 和 `check-doc-references.mjs` 均通过。构建仍有既有的大 chunk warning，不影响成功结果。未执行浏览器验收（用户未要求）。

## 13. 文档同步检查

- 产品文档：已在日记范围补充正文可为空、标题仍非空。
- 架构文档：已更新空正文收笔与保存失败条件。
- 决策文档：无需更新，未改变数据模型或长期架构约束。
- 文档入口：无需更新。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-09-03 23:39 CST | Codex | 创建待确认方案。 |
| 2026-09-03 23:42 CST | 用户 | 批准按方案实施。 |
| 2026-09-03 23:58 CST | Codex | 实施完成，验证通过。 |
