# DD-20260813-006：删除桌垫珊瑚角标

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待验收 |
| 类型 | 修复 |
| 创建时间 | 2026-08-13 17:47 CST |
| 最后更新 | 2026-08-13 17:50 CST |
| 当前阶段 | 实施与验证完成，等待用户验收 |
| 源码基线 | Git commit `4fabeab`，工作区干净 |
| 实现提交 | 尚未创建 |
| 关联任务 | 用户要求删除桌垫两个角上的粉红色装饰物 |

> 用户已授权方案完成后直接执行并创建一次提交；当前按最终执行清单实施。

## 1. 给阅读者的结论

当前桌垫左前角和右后角各有一个珊瑚粉色装饰角标。建议直接删除这两个纯装饰 Three.js 实例，并同步修正模型结构标记、测试和产品当前事实。删除不会改变桌垫主体、包边、织线、贴纸放置范围、交互或持久化。

## 2. 用户需求

- 用户原始要求：删除桌垫两个角上的粉红色 object。
- Codex 解释：删除 `desk-mat-coral-corner-tabs` 的两个实例及仅用于描述它们的结构文案，不用其他装饰替代。
- 验收意图：任何支持的桌面视角下都不再显示这两个粉红色角标，桌垫与贴纸交互保持原样。

## 3. 当前源码事实

- `src/scene/models/create-desk-mat-model.ts` 的 `createDeskMatModel()` 在 `form-refinement` 及更高构建阶段创建一份 `InstancedMesh`，名称为 `desk-mat-coral-corner-tabs`，包含两个 `0.72 x 0.3` 的圆角板实例。
- 两个实例分别位于模型局部坐标 `[-3.55, 0.12, 2.76]` 和 `[3.55, 0.12, -2.36]`，使用 `materials.brass`，只作为装饰，不标记为交互面。
- 该对象当前借用 `DeskMatModelNodes.seam` 字段进入运行节点和 `surface` 销毁组；字段名与对象语义不一致，但没有发现外部调用方读取该节点。
- 贴纸命中由独立的 `desk-mat-interaction-surface`、collider 和 `stickerBounds` 提供，不依赖角标几何。
- `src/scene/models/model-factories.test.ts` 锁定根结构字符串 `bumper-well-corner-tabs`，但没有断言角标必须存在。
- `docs/product/mvp.md` 把“珊瑚角部 tab”写为当前产品事实；该事实在删除后必须同步。
- `docs/architecture/system-overview.html` 说明可见桌垫与透明命中面分离，没有把角标列为交互依赖。
- 当前 Git 工作区在建立本记录前无未提交改动。

## 4. 目标与非目标

### 4.1 目标

- 删除桌垫上的两个珊瑚粉色装饰角标。
- 移除与角标对应的无效运行节点占位和结构描述。
- 保持模型测试与产品当前事实和源码一致。

### 4.2 非目标

- 不调整桌垫尺寸、轮廓、主体、内嵌工作场、包边或织线。
- 不改变桌垫、桌子、本子或背景配色。
- 不改变贴纸放置、拖动、碰撞、状态或持久化。
- 不引入替代装饰，不改相机、灯光、Canvas 或材质库。

## 5. 方案说明

在 `createDeskMatModel()` 中移除角标几何和 `InstancedMesh` 的创建，把运行时节点接口和销毁组改为只表达仍存在的桌垫部件，并将根结构描述从 `bumper-well-corner-tabs` 改为不含角标的 `bumper-well`。这比隐藏、缩放为零或保留空节点更准确，也能减少一个 draw call 和一份几何资源。

产品文档删除“珊瑚角部 tab”这一当前事实。架构所有权、交互链路和长期决策均不改变，因此不新增 ADR；现有 HTML 架构文档不需要实质修改。

## 6. 预计改动与影响评估

- `src/scene/models/create-desk-mat-model.ts`：删除角标实例创建；从 `DeskMatModelNodes`、runtime destruction group 和节点映射中移除借用的 `seam` 节点；更新根结构标记。
- `src/scene/models/model-factories.test.ts`：更新结构断言，并增加角标对象不存在的回归断言。
- `docs/product/mvp.md`：从当前桌垫视觉事实中删除珊瑚角标描述。
- `docs/changes/2026-08-13-006-remove-desk-mat-corner-tabs.md`：批准后记录实际实施与验证结果，并更新到“待验收”。

### 6.1 核心数据结构变化

- 运行时 TypeScript 接口 `DeskMatModelNodes` 删除内部字段 `seam`。源码搜索未发现工厂之外的消费者，因此不影响应用公共接口或持久化兼容。
- Three.js 根节点 `userData.structure` 从 `bumper-well-corner-tabs` 改为 `bumper-well`，只用于模型描述和测试，不进入 Zustand、IndexedDB 或用户数据。
- 领域类型、事件、store、repository、数据库 schema 和默认值均不变。

### 6.2 上下游与跨模块影响

- 上游：`DeskScene` 仍以相同签名调用 `createDeskMatModel(materials)`，无需修改。
- 下游：桌垫 interaction surface、collider、贴纸 bounds 和 pointer event ownership 不变。
- 渲染：减少两个相同材质实例组成的一次绘制；其余模型阶段保持不变。
- 测试：模型工厂测试需要反映新结构，并显式防止角标回归。
- 配置与依赖：无变化。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 误删桌垫其他表面节点 | 把角标当前借用的 `seam` 与真正的织线或工作场混淆 | 桌垫局部缺失或释放异常 | 只删除命名角标创建块和对应字段；运行模型测试并检查资源预算 |
| 文档继续声称角标存在 | 只改源码不回写产品事实 | 用户审核界面与运行行为冲突 | 同步修改 `docs/product/mvp.md` 并运行引用检查 |
| 视觉留有意外空洞 | 角标实际承担遮挡或轮廓连接 | 桌垫角落观感异常 | 在桌面和移动端支持机位检查；若不接受，可恢复本任务的局部差异 |

## 8. 验证与验收

- 自动测试：运行模型工厂聚焦测试，确认角标对象不存在、桌垫节点和资源预算仍有效。
- 构建与静态检查：运行 `npm run check`，覆盖 lint、全量测试、production build 与文档引用检查。
- 浏览器验收：这是小型单组件视觉删除，按项目 Browser Automation 约束不做浏览器视觉验证，以针对性测试和修改文件检查验收。
- 持久化与恢复：不适用；本任务不读取或写入持久化状态。
- 成功标准：场景不再创建 `desk-mat-coral-corner-tabs`；桌垫交互数据保持原值；自动检查全部通过；产品文档不再宣称角标存在。

## 9. 待确认项与决策

需要用户确认按本方案直接删除两个角标，不添加替代装饰。没有其他会改变范围、体验、数据或架构的待确认项。

## 10. 最终批准方案

用户于 2026-08-13 17:50 CST 明确要求“写完方案之后执行，然后做一次提交”，批准本记录方案并授权完成实施后创建一次提交。

最终执行清单：

1. 删除 `desk-mat-coral-corner-tabs` 两个装饰实例及其内部 runtime 节点字段。
2. 更新桌垫结构描述和模型工厂回归测试。
3. 同步 `docs/product/mvp.md` 的当前产品事实。
4. 运行聚焦测试、完整 `npm run check` 和文档引用检查。
5. 核对实际 Git 差异，将记录更新为“待验收”，并创建 Conventional Commits 提交。

## 11. 实施记录

- `src/scene/models/create-desk-mat-model.ts`：删除 `desk-mat-coral-corner-tabs` 的 InstancedMesh、几何、材质引用和两个变换；删除内部 `seam` runtime 节点；将结构标记改为 `bumper-well`，surface 销毁组只保留工作场和织线。
- `src/scene/models/model-factories.test.ts`：更新结构断言，并增加角标命名对象不存在的回归断言。
- `docs/product/mvp.md`：将当前桌垫事实更新为不包含角部装饰。
- 实际改动与最终执行清单逐项一致，没有方案偏差；桌垫 interaction surface、collider、`stickerBounds`、材质库和持久化代码均未修改。

## 12. 验证结果

- 聚焦测试：`npm test -- --run src/scene/models/model-factories.test.ts`，1 个测试文件、12 项测试全部通过。
- 完整检查：`npm run check` 通过。
- Lint：ESLint 通过。
- 全量测试：13 个测试文件、55 项测试全部通过。
- 构建：TypeScript project build 与 Vite production build 通过；Vite 仅报告既有的大 chunk 提示，不阻断构建。
- 文档引用：`scripts/check-doc-references.mjs` 通过。
- 差异检查：`git diff --check` 通过；实际 Git 差异已与批准范围逐项核对。
- 浏览器验收：按项目对单组件样式/视觉小改的约束未执行；本次以模型对象不存在的针对性测试覆盖。待用户在实际场景中确认角落观感。

## 13. 文档同步检查

- 产品文档：已修改 `docs/product/mvp.md`，当前事实明确桌垫不包含角部装饰。
- 架构文档：无需修改；已核对可见模型与独立命中面所有权不变。
- 决策文档：无需修改；没有新增长期约束或架构决策。
- 文档入口：无需修改；任务状态不改变入口所展示的能力范围。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-13 17:47 CST | Codex | 创建待确认方案；完成源码、测试、产品、架构、决策和 Git 基线检查。 |
| 2026-08-13 17:50 CST | 用户 | 批准方案完成后直接执行，并要求完成一次提交。 |
| 2026-08-13 17:50 CST | Codex | 将状态更新为实施中，记录最终执行清单。 |
| 2026-08-13 17:50 CST | Codex | 完成源码、测试和产品文档同步；聚焦测试与完整检查通过，状态更新为待验收。 |
