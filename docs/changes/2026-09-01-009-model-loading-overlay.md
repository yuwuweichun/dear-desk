# DD-20260901-009：模型加载期间显示 Animal Island 加载动画

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待验收 |
| 类型 | 功能 |
| 创建时间 | 2026-09-01 16:50 CST |
| 最后更新 | 2026-09-01 17:35 CST |
| 当前阶段 | 已实施，等待用户验收 |
| 源码基线 | 当前工作树（未创建本任务提交） |
| 实现提交 | 尚未创建 |
| 关联任务 | 进入页面时模型尚未完成加载时，先显示 animal-island-ui 加载动画，避免直接显示未准备好的 UI |

> 本文是待审阅方案。批准前只允许只读检查和修改本文档。

## 1. 给阅读者的结论

当前页面会先挂载桌面操作 UI，而 Three.js 场景仍在配置 renderer、创建材质和生成程序化模型。建议在场景准备完成前由全屏加载层覆盖应用内容，使用项目已安装的 `animal-island-ui` `Loading` 组件；准备完成后以短暂淡出移除加载层，用户再看到可操作的桌面。

本次只处理首屏模型准备阶段，不客制化动画、不增加新的加载资源，也不改变模型生成和业务数据流程。

## 2. 用户需求

### 用户原始要求

- 进入页面时模型可能尚未加载完成。
- 模型未准备好时不适合直接显示 UI。
- 先使用 `animal-island-ui` 提供的加载动画，后续再客制化。

### Codex 解释

- “模型加载完成”以当前 `DeskScene` 完成 R3F root 配置并提交场景渲染为首版就绪信号。
- 加载层必须覆盖桌面、工具按钮和入口，避免用户在场景未准备好时操作。

## 3. 当前源码事实

- `src/app/App.tsx` 的 `ProductApp` 直接渲染 `DeskScene`，同时渲染时间 HUD、桌面按钮、工具栈和其他 DOM UI。
- `src/scene/DeskScene.tsx` 在挂载后通过 `acquireRoot(canvas)` 和异步 `root.configure()` 建立 R3F 根；成功后调用 `root.render(<DeskContents ... />)` 并把 `unavailable` 设为 `false`。
- `src/scene/DeskScene.tsx` 的 `DeskContents` 通过 effect 异步设置材质库；在材质可用前只渲染背景色，模型组件随后各自创建程序化模型。
- 当前 `DeskScene` 只有异常时显示 `fallback`，没有“正在准备场景”的就绪状态或全局遮罩。
- `animal-island-ui` 已安装为 `1.5.1`，其 `Loading` 组件由包入口导出并已随 `animal-island-ui/style` 加载样式；组件支持 `active` 属性，并提供 Animal Island 风格全屏插画动画。
- 当前单 Canvas 约束和“数据模型与 Three.js 场景对象分离”决策不要求改变；加载层属于 DOM 视觉投影。

### 合理推断

- 加载层应由 `ProductApp` 控制可见范围，才能覆盖 `DeskScene` 之外的桌面 DOM UI；仅在 Canvas 内添加动画不足以满足“不要直接显示 UI”。
- 通过已有 `DeskScene` 回调报告就绪，比在多个 UI 调用方分别增加等待判断更小且能覆盖所有入口。

## 4. 目标与非目标

### 4.1 目标

- 首屏场景未就绪时显示 `animal-island-ui` `Loading` 动画。
- 加载层覆盖全屏并阻止底层 UI 交互。
- 场景就绪后移除加载层并显示现有 UI。
- 保留现有场景异常 fallback 行为。
- 为就绪状态留下一个最小自动测试，并完成构建与浏览器验收。

### 4.2 非目标

- 不重写模型工厂、材质生成或 Three.js Canvas。
- 不引入新的 loading 依赖、状态管理或持久化字段。
- 不客制化 `animal-island-ui` 动画。
- 不处理贴纸工作台内部的独立加载阶段。

## 5. 方案说明

在 `ProductApp` 增加一个页面级 `sceneReady` 状态，初始为 `false`；`DeskScene` 增加就绪回调，在场景 root 配置并提交首次场景渲染后通知父组件。`ProductApp` 在现有内容之上渲染 `Loading active={!sceneReady}`，并用最小项目样式将其提升为全屏遮罩。若场景初始化失败，不把 loading 永久盖住异常 fallback：失败路径将把就绪回调置为结束状态，再由已有 `SceneFallback` 提供可用入口。

该方案只增加一个跨组件的状态边界，复用既有 `DeskScene` 生命周期和第三方组件，不改变业务 store。

## 6. 预计改动与影响评估

- `src/app/App.tsx`：导入 `Loading`，持有页面级场景准备状态，并把回调传入 `DeskScene`；渲染全屏加载层。
- `src/scene/DeskScene.tsx`：增加可选就绪回调，在 configure 成功或失败时通知父层；清理时重置回调，避免卸载后残留就绪状态。
- `src/styles.css`：增加加载遮罩的定位、层级、背景和无障碍状态样式，复用现有主题色。
- `src/app/App.test.tsx`：扩展现有 `DeskScene` mock，验证未就绪时 loading 存在、回调后消失。
- `docs/product/mvp.md`：若实际行为与首屏验收相关，同步补充“场景准备期间显示加载动画”的当前实现事实。
- `docs/architecture/system-overview.html`：补充 `ProductApp -> DeskScene -> Loading overlay` 的运行时边界和失败路径。

### 6.1 核心数据结构变化

不改变 IndexedDB、Zustand store、业务实体或公共持久化接口。新增的 `sceneReady` 仅是 `ProductApp` 的临时 React UI 状态，生命周期随页面挂载和场景挂载存在。

### 6.2 上下游与跨模块影响

只影响 `ProductApp` 与 `DeskScene` 的 UI 生命周期协作，以及首屏 CSS 和测试。模型工厂、Canvas 数量、贴纸工作台和本地仓储不受影响。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 就绪信号过早 | renderer 已配置但子模型仍处于首个 effect 创建阶段 | 极短时间内可能看到空场景 | 以首次场景 render 后的帧作为信号；若验收发现闪现，再将信号收紧到模型组件统一回调 |
| 初始化失败时遮罩不退出 | configure 抛错或容器尺寸暂时为 0 | 用户无法使用已有 fallback | 失败分支同时通知结束；保留并验证 `SceneFallback` |
| 第三方动画样式覆盖 | Loading 包样式与项目主题层级冲突 | 遮罩颜色或层级异常 | 使用项目专属外层 class，不修改 node_modules；构建和浏览器验收确认 |

回退方式：删除页面级 Loading 渲染和就绪回调，恢复现有 `DeskScene` 接口即可；不涉及数据迁移。

## 8. 验证与验收

- 自动测试：`App.test.tsx` 验证 loading 的出现与就绪回调后的消失；既有测试保持通过。
- 构建与静态检查：运行 `npm run check`，包含 lint、Vitest、TypeScript/Vite build 和文档引用检查。
- 浏览器验收：慢速 CPU/网络或人为延迟初始化时，首屏只显示 Animal Island 加载动画；场景就绪后动画消失，桌面 UI 可操作；初始化异常时显示原 fallback。
- 持久化与恢复：不适用；本次无持久化变化。
- 成功标准：模型未准备好时不显示可操作桌面 UI，准备完成后正常进入现有桌面，加载动画无额外依赖和控制台错误。

## 9. 待确认项与决策

- 建议批准使用现有 `animal-island-ui` `Loading` 原样作为首版加载动画，并采用全屏遮罩；本次不等待后续客制化设计。
- 建议将模型“已加载”定义为当前场景 root 完成首次 render；若浏览器验收发现空场景闪现，再在同一任务内收紧信号。

## 10. 最终批准方案

用户于 2026-09-01 17:02 CST 回复“批准”。最终执行清单：

1. 在 `ProductApp` 增加临时 `sceneReady` 状态，使用 `animal-island-ui` `Loading` 作为全屏首屏遮罩。
2. 在 `DeskScene` 增加就绪状态回调：首次 root render 后结束 loading，初始化失败时交给已有 fallback。
3. 增加遮罩样式和 `App.test.tsx` 就绪切换测试。
4. 回写产品、架构与本任务记录，并运行完整检查。

## 11. 实施记录

已按批准清单实施：

- `src/app/App.tsx` 增加页面级 `sceneReady` 状态，使用 `animal-island-ui` `Loading` 渲染全屏遮罩；贴纸工作台模式不显示该桌面加载层。
- `src/app/App.tsx` 保持 Loading 挂载，在场景就绪后传入 `active={false}`，按组件径向遮罩计算时长等待圆形退场，再移除外层。
- 本次用户反馈修正：Loading 不再在 ready 时直接卸载，而是先执行 `active={false}` 的内置圆形径向退场，动画结束后再移除外层；未加入背景图。
- `src/scene/DeskScene.tsx` 增加模型聚合就绪状态；材质库以及桌体、桌垫、房间背景（开启时）、本子分别报告完成后才结束遮罩。初始化失败时结束遮罩并保留既有 fallback，卸载时重置状态。
- `src/scene/NotebookObject.tsx` 增加本子模型就绪回调。
- `src/styles.css` 增加 `.scene-loading-overlay` 全屏层级样式。
- `src/app/App.test.tsx` 增加场景加载状态测试，并在 jsdom 中 mock 第三方 Loading 的 SVG 动画实现，生产代码仍使用真实组件。
- `docs/product/mvp.md` 和 `docs/architecture/system-overview.html` 已同步首屏加载与失败路径事实。

方案偏差：根据用户验收反馈，将原先过早的“首次 root render”信号收紧为实际首屏模型聚合就绪信号；仍在本任务批准范围内。

## 12. 验证结果

- `npm run lint`：通过。
- `npm run test -- src/app/App.test.tsx`：通过，13/13。
- `npm run build`：通过；Vite 仅报告既有的大 chunk warning。
- `npm run lint`：通过，无 warning。
- 本次退场调整后的 `npm run test -- src/app/App.test.tsx`：通过，13/13。
- 本次退场调整后的 `npm run lint`、`npm run build` 与文档引用检查：通过。
- `node scripts/check-doc-references.mjs`：通过。
- `npm run test`：28 个测试文件通过，122/125 通过；剩余 3 个失败均为 `src/scene/models/model-factories.test.ts` 中既有 V12 调色断言仍期待旧值 `#d5dad8` / `#423f2c`，与当前产品和架构文档记载的 V12 `#8FA89E` / `#2F432D` 冲突，不涉及本任务代码。
- 浏览器验收：未完成。`agent-browser` 命令不可用，Node REPL 中 Playwright 导入也因运行时模块导出错误失败；未将浏览器检查记为通过。开发服务器已成功启动并完成 Vite 编译。
- 持久化与恢复：本次无持久化变化，未执行专项恢复验收。

### 12.1 后续验收发现：就绪信号过早

用户验收发现 Loading 消失后模型仍未出现。根因是当前 `src/scene/DeskScene.tsx:869-872` 在 `root.render(<DeskContents />)` 调用后立即触发 `onReadyChange(true)`。`root.render` 只代表 R3F 根提交了组件树，并不代表 `DeskContents` 内部材质库和各模型已创建完成：材质库在 `DeskContents` 的 effect 中创建，桌面、桌垫、房间和本子又分别在各自 effect 中创建并通过 microtask 设置模型状态。因此当前 Loading 的结束周期是“Canvas/R3F root configure 完成并提交首个 React 场景树”，不是“所有首屏模型完成挂载”。这属于已批准方案中就绪信号定义过宽，待后续任务收紧为模型聚合就绪信号。

## 13. 文档同步检查

- 产品文档：已补充 `DD-20260901-009` 首屏加载遮罩事实。
- 架构文档：已补充 `ProductApp -> DeskScene -> Loading` 链路与初始化失败路径。
- 决策文档：不新增长期架构决策。
- 文档入口：文档引用检查通过。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-09-01 16:50 CST | Codex | 创建待确认方案，确认使用现有 `animal-island-ui` Loading 组件。 |
| 2026-09-01 17:02 CST | 用户 | 批准最终执行清单。 |
| 2026-09-01 17:03 CST | Codex | 完成实施与验证回写，状态更新为待验收。 |
