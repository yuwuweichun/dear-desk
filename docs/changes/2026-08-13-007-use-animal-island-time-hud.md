# DD-20260813-007：左上角使用 Animal Island 时间 HUD

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 |
| 创建时间 | 2026-08-13 17:51 CST |
| 最后更新 | 2026-08-13 18:09 CST |
| 当前阶段 | 用户已通过明确提交指令预先验收，任务完成 |
| 源码基线 | `4fabeaba951610af12f50a0748d8f250785cf13e` |
| 实现提交 | 本次 `feat(ui): use Animal Island time HUD` 提交 |
| 关联任务 | 将左上角显示时间的组件替换为 `animal-island-ui` 的 HUD 风格“星期/日期 + 时间”组件 |

> 用户已批准按第 10 节清单实施，并再次明确删除“今天还是空白”等旧内容状态；本次明确要求提交，按项目规则构成对已批准、验证通过结果的预先验收。

## 1. 给阅读者的结论

左上角当前不是时钟，而是“所选日记日期 + 今日记录状态”的自定义信息块。建议直接替换为已安装的 `animal-island-ui@1.5.1` 原生 `Time` 组件，并明确传入 `type="hud"`。最终外观与用户提供的参考一致：左侧显示英文全大写星期及英文月日，右侧显示浏览器本地 24 小时时间。

组件继续只在桌面空闲态出现；打开日记、进入贴纸工作台或选中贴纸时仍按现有规则隐藏。本次不改变日记日期、记录状态、持久化或 Three.js 场景。

## 2. 用户需求

- 用户原始要求：左上角显示时间的组件使用 Animal Island UI 的组件，采用“hud 风格：星期/日期 + 时间”。
- 用户随后提供组件截图，确认目标就是 `animal-island-ui` 的原生 HUD 时间组件，而不是仅模仿其视觉。
- Codex 解释：使用 `<Time type="hud" />`，保留组件自带的英文星期、英文月份缩写、24 小时时间、闪烁冒号和响应式样式，不对组件内部文案或排版另行本地化。

## 3. 当前源码事实

- `src/app/App.tsx` 的 `ProductApp` 在左上角渲染 `.date-block`，第一行调用 `formatLocalDate(selectedDate)`，第二行显示由加载状态和当天正文决定的 `entryState`。
- `.date-block` 只在 `showDeskActions` 为真时可见；该条件要求应用处于桌面态、贴纸流程空闲且没有选中桌面贴纸。
- `src/styles.css` 自行定义 `.date-block` 的 surface、边框、阴影和桌面/移动端字号。
- `src/main.tsx` 已全局导入 `animal-island-ui/style`；`package.json` 固定依赖 `animal-island-ui@1.5.1`，无需新增或升级依赖。
- 已安装包的 `TimeProps` 支持 `type?: 'hud' | 'game'`。其中 `hud` 正是“左右结构：星期/日期 + 时间”；运行实现按浏览器本地 `Date` 每秒刷新，并显示英文星期、英文月份缩写和 `HH:mm`。
- `src/animal-island-ui.d.ts` 当前只声明样式模块。库入口的类型解析在本工程曾需要本地适配；实现时必须以 TypeScript 构建结果确认是否需要补充 `Time` 声明。
- `docs/product/mvp.md` 当前把左上角描述为“日期状态”；`docs/architecture/system-overview.html` 也记录日期状态只在桌面 idle 阶段显示。
- 当前工作区已有与本任务无关的桌垫改动：`docs/changes/2026-08-13-006-remove-desk-mat-corner-tabs.md`、`docs/product/mvp.md`、`src/scene/models/create-desk-mat-model.ts`、`src/scene/models/model-factories.test.ts`。本任务不得回退或覆盖这些修改。

## 4. 目标与非目标

### 4.1 目标

- 左上角直接渲染 `animal-island-ui` 的 `Time` 组件。
- 显式使用 `type="hud"`，得到参考图中的“星期/日期 + 时间”横向 HUD。
- 保留现有桌面空闲态显示、其他工作流隐藏的规则。
- 在桌面和移动端避免 HUD 与右上颜色编辑入口、底部桌面操作或视口边界重叠。
- 用针对性自动测试确认组件类型和显隐规则。

### 4.2 非目标

- 不把星期或月份改成中文，也不改变第三方组件内部格式。
- 不继续显示当前日记所选日期或“今天有一页 / 今天还是空白”等记录状态。
- 不改变日记日期逻辑、store、IndexedDB schema 或持久化数据。
- 不修改 Animal Island UI 包源码，不升级依赖。
- 不改变桌面场景、镜头、颜色编辑器、日记或贴纸交互。

## 5. 方案说明

`ProductApp` 将删除现有 `entryState` 派生逻辑和 `.date-block` 内部两行文本，改为在同一显示条件下挂载 `<Time className="desk-time-hud" type="hud" />`。组件本身拥有当前时间、每秒刷新和卸载清理逻辑，Dear Desk 只负责页面位置、显隐和必要的移动端约束。

不再用 `aria-live="polite"` 包住每秒更新的时钟，避免屏幕阅读器持续播报时间变化。第三方 `Time` 当前没有内建时间语义；如自动无障碍检查证明需要补充描述，将在不改变参考外观的前提下由外层容器提供稳定标签。

## 6. 预计改动与影响评估

- `src/app/App.tsx`：从 `animal-island-ui` 导入 `Time`；删除只服务旧日期状态的 `formatLocalDate`、`entry`、`loadStatus` 和 `entryState` UI 读取/派生；在桌面空闲态渲染 `Time type="hud"`。
- `src/styles.css`：删除旧 `.date-block` 内容样式，保留或改名外层定位/隐藏规则；只为 HUD 增加页面级定位、层级、pointer events、过渡和必要的移动端尺寸约束，不重写第三方组件的核心视觉。
- `src/animal-island-ui.d.ts`：仅当现有包类型出口无法被 TypeScript 正确解析时，补充 `Time`、`TimeProps` 与 `TimeType` 的最小声明。
- 自动测试：增加一个聚焦 App/HUD 的组件测试，mock 重型场景子树和第三方时间组件，验证桌面空闲态传入 `type="hud"`，以及离开桌面空闲态后不显示。
- `docs/product/mvp.md`：把当前“日期状态”事实更新为原生 HUD 实时时钟，并同步当前实现覆盖描述。
- `docs/architecture/system-overview.html`：这是现有架构事实文档，若实质修改必须使用仓库要求的 `$bun-html-docs`。当前会话未提供该技能，因此本次方案不修改该 HTML；实施后将在本记录显式保留这项文档阻塞，除非实施前技能恢复可用。源码实现本身不改变架构边界。

### 6.1 核心数据结构变化

无变化。HUD 读取浏览器 `Date` 的运行时值，不进入 Zustand、领域类型或 IndexedDB；刷新页面后自然从当前本地时间重新生成。

### 6.2 上下游与跨模块影响

- 上游：浏览器本地系统时间与时区。
- 组件边界：`ProductApp` 直接消费第三方展示组件；不新增 Dear Desk 通用组件抽象，因为当前只有一个消费者且库已提供完整行为。
- 下游：仅 DOM 视觉与定时器生命周期；不影响 R3F Canvas、场景 draw call/texture 预算、日记数据或贴纸流程。
- 状态读取：移除 `entry` 和 `loadStatus` 的这两个 App 层订阅不会改变 store 数据或加载流程；`loadToday()` 仍由现有 effect 执行，供日记使用。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| HUD 宽度遮挡其他入口 | 窄屏或系统字体加载差异 | 左上时钟与右上颜色按钮重叠 | 使用组件自带移动断点并补最小页面级宽度约束；桌面和移动端分别验收 |
| 每秒更新造成无障碍噪声 | 外层保留 `aria-live` | 屏幕阅读器持续播报 | 删除旧 live region，不把时钟作为主动通知 |
| 类型出口解析失败 | 包声明与 `exports` 配置不匹配 | TypeScript 构建失败 | 只补齐本地 `Time` 最小声明，不修改依赖版本 |
| 旧记录状态入口消失 | 用户仍依赖“今天有一页”提示 | 桌面不再直接呈现正文存在性 | 这是本次替换的明确结果；日记打开后仍呈现真实内容 |
| 架构 HTML 无法同步 | `$bun-html-docs` 技能不可用 | HTML 中仍写“日期状态” | 在变更记录中列为未闭合文档项；技能可用后再按规定同步，不能把旧文档写成已更新 |

回退方式：恢复 `App.tsx` 的旧日期/记录状态块和对应 `.date-block` 样式，并移除本次 HUD 测试及声明；无持久化数据需要迁移或回滚。

## 8. 验证与验收

- 自动测试：针对 `ProductApp` 验证 `Time` 收到 `type="hud"`，桌面空闲态显示、非桌面空闲态隐藏；必要时用 fake timers 验证第三方组件不会遗留 interval。
- 构建与静态检查：运行相关 Vitest、`npm run lint`、`npm run build` 和 `node scripts/check-doc-references.mjs`。
- 浏览器验收：这是可见组件替换，获批实施后使用 `ego-browser` 检查桌面和移动端；确认外观与参考图一致、时间为浏览器当前本地时间、无横向溢出和控件重叠，并保留本地 task space。
- 持久化与恢复：不适用；确认刷新后 HUD 重新显示当前本地时间，且日记数据没有变化。
- 成功标准：左上角只显示原生 Animal Island UI HUD 时间组件；星期/日期在左、时间在右；桌面/移动端位置稳定；其他工作流显隐保持不变；检查通过。

## 9. 待确认项与决策

无待确认项。用户提供的截图已确认具体组件和 `hud` 变体；实现将保留第三方组件自带的英文格式。

## 10. 最终批准方案

用户于 2026-08-13 18:03 CST 明确回复“批准”，并要求删除“今天还是空白”内容组件。最终执行清单：

1. 将左上旧日期状态替换为 `animal-island-ui` 的 `<Time type="hud" />`。
2. 清理旧派生状态与样式，只保留 HUD 的页面定位、显隐和响应式约束。
3. 按构建需要补齐第三方 `Time` 类型声明。
4. 增加针对性组件测试。
5. 更新产品事实文档；按技能可用性处理架构 HTML 同步并如实记录。
6. 完成静态、构建、文档引用及桌面/移动浏览器验收，把状态更新为 `待验收`。

## 11. 实施记录

- `src/app/App.tsx` 直接从 `animal-island-ui` 导入 `Time`，并在 `showDeskActions` 为真时挂载 `<Time className="desk-time-hud" type="hud" />`。
- 删除 `selectedDate`、`entry`、`loadStatus` 的 App 层订阅、`entryState` 派生逻辑、`formatLocalDate` 导入、旧 `.date-block` 容器及 `aria-live`。桌面不再呈现“正在打开”“本地记录不可用”“今天有一页”或“今天还是空白”。
- `src/styles.css` 删除旧日期/内容卡片的自定义视觉，只保留 `.desk-time-hud` 的页面定位、pointer events 与场景叠层阴影；第三方 HUD 的排版、字体、边框和响应式字号保持原样。
- `src/app/App.test.tsx` 使用固定浏览器本地时间和真实第三方 `Time`，验证 `Thursday / Aug 13 / 17:53`、旧状态文案不存在，以及进入 `approaching` 后 HUD 从 DOM 卸载。
- TypeScript 可直接解析包内 `Time` 类型，因此未修改 `src/animal-island-ui.d.ts`，也未升级依赖。
- `docs/product/mvp.md` 已同步产品当前事实。
- 用户补充提供 `/Users/song/.codex/skills/bun-html-docs/SKILL.md` 后，已按 `$bun-html-docs` 完整读取内容契约与 shell 规范，并同步 `docs/architecture/system-overview.html` 的 HUD、适配边界、源码地图与验证证据。
- 与方案一致，无公共接口、数据结构、持久化、Three.js 或工作流偏差。

## 12. 验证结果

- `npm test -- --run src/app/App.test.tsx`：通过，1 个测试文件、1 个测试。
- `npm run lint`：通过。
- `npm run build`：通过；TypeScript 与 Vite production build 成功，只有既有的大 chunk 警告。
- `npm run check`：通过，包含 lint、14 个测试文件共 56 个测试、production build 和文档引用检查。
- `git diff --check`：通过。
- 源码扫描：旧状态文案只存在于断言其缺失的测试和历史任务记录中，运行源码无残留。
- 产品页桌面检查：`ego-browser` 在准确 `1440 × 900` 验证原生 HUD、当前本地时间、旧状态删除、颜色入口无重叠、无页面横向溢出。
- 产品页移动检查：同一 task space 在 `390 × 844` / DPR 2 验证 HUD 宽约 `245px`、与颜色入口间距约 `56px`、无重叠或横向溢出；点击“打开本子”进入 `approaching` 后 HUD 从 DOM 卸载。
- 架构 HTML：按 `$bun-html-docs` 直接打开本地文件，无预览服务；`1440 × 900` 验证搜索成功/空结果、ArrowDown/ArrowUp、Enter、Escape、锚点、复制、Wiki focus 和可见焦点；`390 × 844` 验证移动目录、Wiki click、代码/表格边界和无页面横向溢出。
- ego-browser task space `48` 已按本地页面规则保留，并只保留 Dear Desk 产品页与系统架构页两个相关标签。

## 13. 文档同步检查

- 产品文档：已更新 `docs/product/mvp.md` 的通用 DOM 当前事实和实现覆盖表。
- 架构文档：已使用用户提供的 `$bun-html-docs` 技能同步 `docs/architecture/system-overview.html`，并完成直接本地打开的双视口交互验证。
- 决策文档：无需更新；不改变长期架构或持久化边界。
- 文档入口：无需更新；本次不新增架构页面或长期入口。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-13 17:51 CST | Codex | 创建待确认方案，并完成源码、依赖、产品与架构事实检查。 |
| 2026-08-13 17:54 CST | 用户 / Codex | 用户用截图确认目标是 `animal-island-ui` 原生 HUD 时间组件；方案固定为 `<Time type="hud" />` 及其自带英文格式。 |
| 2026-08-13 18:03 CST | 用户 / Codex | 用户明确批准实施，并再次要求删除“今天还是空白”等旧内容状态；任务进入实施中。 |
| 2026-08-13 18:06 CST | 用户 / Codex | 用户补充提供 `$bun-html-docs` 的绝对路径；Codex 按技能完成架构 HTML 同步和双视口交互验证。实现、全量检查与文档回写完成，状态更新为待验收。 |
| 2026-08-13 18:09 CST | 用户 / Codex | 用户明确要求分析工作区更改并提交；实现未超出批准范围且必要验证通过，按项目规则视为预先验收，状态更新为已完成并纳入同一提交。 |
