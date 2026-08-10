# DD-20260806-002：确定技术基础并建立首个纵向切片

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 技术基础 / 首个纵向切片 |
| 创建时间 | 2026-08-06 12:15 CST |
| 最后更新 | 2026-08-09 19:40 CST |
| 当前阶段 | 开发者（用户）已验收，任务完成 |
| 源码基线 | 仓库没有初始提交；当前分支为 `docs/document-driven-workflow`，没有业务源码 |
| 实现提交 | `130b62f`：`feat(core): 建立技术基础与首个纵向切片` |
| 关联任务 | 已批准的 `docs/product/mvp.md` 与文档流程任务批准清单 |

> 用户已批准本文第 9 节四项技术决策。第 10 节锁定的首个纵向切片已经实现并验证；贴纸、抽屉、翻页、台灯和新增镜头转场均未混入本任务。

## 1. 给阅读者的结论

Dear Desk 现在已经具备可运行的首个纵向切片。应用使用 React、TypeScript、Vite、Three.js、React Three Fiber、Zustand 和 Dexie；Three.js 场景只投影可序列化状态，IndexedDB 负责持久保存当天记录，普通编辑界面使用 DOM。

用户可以点击 3D 桌面上的本子，在 DOM 面板中保存当天一句话；关闭原标签页并打开同源新页面后，内容会从 IndexedDB 恢复。单画布、移动端布局、失败反馈和本地日期规则均有验证。贴纸、镜头走近与开本动画、抽屉、翻页和台灯仍不属于当前实现。

## 2. 用户需求

用户已经批准以下产品约束：

1. 支持文字和基础矩形图片贴纸，不做透明轮廓与高级材质。
2. 首版不做语音。
3. 本子只做轻量翻页。
4. 台灯是可选氛围状态。
5. 数据使用 IndexedDB 本地持久化，不做账号和云同步。

用户要求在产品范围批准后先审核技术栈、数据边界和第一段可运行功能。本文先完成审批，并在用户于 2026-08-06 13:21 CST 批准后按最终清单实施。

## 3. 当前源码事实

- `package.json`、Vite、TypeScript、ESLint、Vitest 与 npm lockfile 已建立；项目声明 Node.js `>=22`。
- `src/main.tsx` 组合生产 repository、Zustand store 与 React 根；`src/app/App.tsx` 装配唯一 3D 场景和 DOM 编辑器。
- `src/scene/DeskScene.tsx` 使用 React Three Fiber `createRoot(canvas)` 管理唯一 WebGL 画布，并按容器尺寸、DPR 和 ResizeObserver 更新；`src/scene/NotebookObject.tsx` 通过透明 mesh 命中区发出打开本子 intent。
- `src/domain/daily-entry.ts` 定义本地日期、`DailyEntry` 与 1 到 500 字符规则；`src/persistence/database.ts` 的 IndexedDB v1 只有 `dailyEntries`。
- `src/state/app-store.ts` 协调加载、打开、关闭和保存；`JournalPanel` 局部持有未保存草稿，repository 写入成功后才更新持久化记录。
- `docs/architecture/system-overview.html` 已依据真实源码建立调用链、失败路径与源码地图。
- 当前没有贴纸、Asset、台灯、过去日期、镜头转场或第二个 WebGL 画布。

第 5、6 节保留批准前的方案说明；第 11 至 13 节记录实际实施与验证结果。

## 4. 目标与非目标

### 4.1 目标

- 建立可启动、可构建、可测试的 React + TypeScript 前端工程。
- 建立且只建立一个 Three.js 画布，并呈现稳定桌面与可点击本子。
- 明确 DOM UI、Three.js 场景、内存状态、领域模型与 IndexedDB 的所有权边界。
- 保存并恢复当天一条文本记录，覆盖加载、保存、成功和失败状态。
- 用自动测试和 ego-browser 验证桌面、移动端及页面重新打开后的持久化。
- 实现后依据真实源码生成第一篇 `docs/architecture/system-overview.html`。

### 4.2 非目标

- 不在本任务实现文字贴纸或图片贴纸。
- 不实现过去日期浏览、旧痕迹抽屉、轻量翻页或台灯状态。
- 不实现账号、服务端、云同步、遥测平台或跨设备迁移。
- 不引入第二个 WebGL 画布、物理引擎、完整设计系统或通用 3D 编辑器。
- 不把 Three.js 对象、材质、纹理或相机对象写入 IndexedDB。
- 不为尚未实现的完整 MVP 预建全部页面、表结构和抽象层。

## 5. 方案说明

### 5.1 推荐技术栈

| 领域 | 推荐选择 | 选择理由 | 暂不选择 |
| --- | --- | --- | --- |
| 工程与 UI | Vite + React + TypeScript strict | 单页交互、DOM 表单和 Three.js 生命周期可以使用同一组件模型；开发与构建配置较小 | 不引入 SSR 或全栈框架，首版没有服务端需求 |
| 3D 场景 | Three.js + React Three Fiber | 保留 Three.js 能力，同时让单画布与 React 页面生命周期一致 | 不直接手写完整 Three.js 生命周期，避免重复维护装载和卸载边界 |
| 客户端状态 | Zustand | DOM 与 Canvas 可共享少量序列化状态和意图；API 小，适合按领域拆分 | 不把 Three.js 对象放入 store；不引入大型事件框架 |
| 本地数据库 | IndexedDB + Dexie | 原生 IndexedDB 满足产品决策；Dexie 提供可测试的事务、版本和查询封装，并能在后续保存图片 Blob | 不使用 `localStorage` 承载业务数据，不引入服务端数据库 |
| 样式 | 原生 CSS | 首个切片的界面有限，可直接建立少量语义 token 和响应式规则 | 不引入组件库或 CSS-in-JS 运行时 |
| 自动测试 | Vitest + Testing Library + `fake-indexeddb` | 覆盖领域规则、repository、store 和 DOM 行为，不要求真实浏览器才能运行大部分测试 | 首任务不额外引入一套浏览器测试框架；真实浏览器验收使用 ego-browser |
| 包管理 | npm + lockfile | 当前环境已有 npm，减少额外工具前提 | 不同时维护多种 lockfile |

依赖版本在实施时选择彼此兼容的稳定版本并写入 lockfile；不在方案阶段猜测未来解析出的精确补丁版本。`package.json` 建议声明 Node.js `>=22`，当前 Node.js `v26.0.0` 可用于本地执行。

### 5.2 状态与所有权边界

```text
用户输入 / 点击
  -> DOM 组件或 Scene intent
  -> Zustand 应用动作
  -> DailyEntryRepository
  -> Dexie / IndexedDB
  -> 可序列化领域状态
  -> DOM 与 Three.js 分别投影
```

- **领域层**只包含可序列化类型和规则，不依赖 React、Three.js 或 Dexie。
- **持久化层**拥有 IndexedDB schema、迁移和读写；业务组件不能直接调用 IndexedDB。
- **应用 store**拥有当前日期、已加载记录、打开物件和异步状态，调用 repository 完成加载与保存。
- **DOM 编辑器**拥有尚未保存的输入草稿；只有显式保存成功后才更新持久化记录。
- **Three.js 场景**读取可序列化状态并发出 `openNotebook` 等用户意图，不拥有业务事实。
- **Three.js 运行对象**只存在于 Canvas 生命周期内，不进入 store 或数据库。

### 5.3 首个纵向切片

1. 应用启动并打开唯一 Canvas，显示固定视角的桌面和一本可识别的本子。
2. 应用按浏览器本地日历日期生成 `YYYY-MM-DD` 键，从 repository 加载当天记录。
3. 用户点击 3D 本子，或通过等价的键盘可访问 DOM 控件打开本子面板。
4. 用户在 DOM 文本区输入最多 500 个字符并点击保存。
5. store 调用 repository；repository 在一个 IndexedDB 写操作中新增或更新当天记录。
6. 保存成功后显示明确状态，并以数据库返回值更新内存状态；失败时保留草稿并显示可重试错误。
7. 页面重新加载或关闭后再打开时，应用从 IndexedDB 恢复同一天的内容。

WebGL 不可用时显示清楚的场景降级提示，同时保留 DOM 的“打开本子”入口，使核心记录和持久化仍可验收；降级状态不会伪装成完整 3D 体验。

## 6. 预计改动与影响评估

### 6.1 预计改动清单

| 预计模块 | 责任与调用关系 |
| --- | --- |
| `package.json`、lockfile、Vite/TypeScript/Vitest/ESLint 配置 | 定义运行、构建、测试和静态检查入口；不承载业务规则 |
| `src/main.tsx`、`src/app/App.tsx` | 装载 React 应用、全局样式、单 Canvas 与 DOM 面板 |
| `src/scene/DeskScene.tsx`、`src/scene/NotebookObject.tsx` | 呈现桌面与本子，将指针交互转换为应用 intent，不直接读写数据库 |
| `src/features/journal/JournalPanel.tsx` | 显示日期、草稿、保存与错误状态；保持普通表单语义和键盘可用性 |
| `src/domain/daily-entry.ts` | 定义 `DailyEntry`、日期键和文本约束，不依赖框架 |
| `src/persistence/database.ts`、`src/persistence/daily-entry-repository.ts` | 定义 IndexedDB v1 schema 与 `getByDate`/`save` 边界 |
| `src/state/app-store.ts` | 协调加载、打开本子、保存和失败状态；只保存可序列化业务状态 |
| `src/**/*.test.*`、测试 setup | 覆盖日期规则、repository、store 和 DOM 编辑流程 |
| `docs/architecture/system-overview.html` 及必要本地资源 | 实现完成后解释真实入口、所有权、调用链、失败路径和源码地图 |
| `docs/product/mvp.md`、本文、`docs/index.html`、相关决策记录 | 回写真实实施范围、验证结果、技术决策和当前项目状态 |

文件名可以在实施时按实际局部组织微调，但不能改变上述所有权和依赖方向；若需要改变公共边界或扩大切片范围，必须回到本文重新确认。

### 6.2 核心数据结构变化

当前没有业务数据。建议首个 schema 只创建一张表：

```ts
type LocalDate = string // 浏览器本地日期，格式 YYYY-MM-DD

interface DailyEntry {
  date: LocalDate       // 主键；首版每天最多一条记录
  text: string          // 去除首尾空白后 1..500 个字符
  createdAt: string     // 首次保存时间，ISO 8601
  updatedAt: string     // 最近保存时间，ISO 8601
}
```

IndexedDB 数据库建议命名为 `dear-desk`，schema 版本为 `1`，`dailyEntries` 以 `date` 为主键。更新已有日期时保留 `createdAt`，只改变 `text` 和 `updatedAt`。空文本不写入数据库；本任务不预建 `Asset`、`StickerDefinition`、`StickerInstance` 或 `DeskState` 表。

应用状态建议保持最小：

```ts
interface JournalState {
  selectedDate: LocalDate
  entry: DailyEntry | null
  notebookOpen: boolean
  loadStatus: 'idle' | 'loading' | 'ready' | 'error'
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  errorMessage: string | null
}
```

草稿由 `JournalPanel` 局部持有，避免每次输入都改变持久化事实。后续新增贴纸或台灯时通过新的数据库版本迁移，不修改 v1 记录语义。

### 6.3 上下游与跨模块影响

- Canvas 只通过 store selector 读取需要的状态，点击本子只调用 `openNotebook()`；场景层不引用 Dexie。
- `JournalPanel` 调用 store 的加载与保存动作，不知道 IndexedDB 表名或事务细节。
- store 依赖 repository 接口；测试可以注入内存实现，生产入口注入 Dexie 实现。
- repository 接收领域值并返回 `DailyEntry`，不得返回 Dexie collection 或数据库游标到上层。
- 数据只位于当前浏览器 origin。清除站点数据、使用另一浏览器或另一设备时不会恢复，这是已批准的产品边界，不属于同步故障。
- 本任务没有历史用户数据，不需要迁移；未来 schema 变化必须递增版本并单独审核迁移与回退。
- 未来图片 Blob 适合继续使用 IndexedDB，但不会在本次提前建表或验证容量策略。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 3D 与业务状态耦合 | mesh 或 Three.js 对象直接进入 store/数据库 | 无法可靠序列化、测试和迁移 | 只传递领域 ID、布尔状态和 intent；测试依赖方向 |
| IndexedDB 写入失败 | 隐私模式限制、容量不足、事务中断 | 用户以为内容已保存 | 保存成功只以事务完成为准；保留草稿、显示错误并允许重试 |
| 日期边界不一致 | UTC 日期代替用户本地日期 | 午夜附近记录落到错误日期 | 集中使用本地日期 helper 并覆盖时区边界测试 |
| Canvas 阻断表单交互 | 拖动或点击事件穿透 | 无法稳定输入或误操作相机 | 编辑器使用 DOM；打开时明确管理 pointer event 和焦点 |
| 移动设备 WebGL 性能不足 | 像素比或场景复杂度过高 | 卡顿、发热或空白画布 | 首个场景保持低多边形、限制 DPR，并提供 DOM 降级入口 |
| 依赖过多但价值未验证 | 首切片引入完整 UI、物理或资产管线 | 初始化成本和维护面扩大 | 只采用第 5.1 节依赖；新增依赖需说明具体调用方 |
| 回退误删本地数据 | 撤销代码时同时清库 | 用户记录不可恢复 | 代码回退默认保留 IndexedDB v1；任何清库动作需单独授权 |

若实施失败，可删除本任务新增的应用文件并恢复文档状态；默认不删除已经写入的 `dear-desk` IndexedDB。首个 schema 没有旧数据迁移，因此代码层回退不需要逆向迁移。

## 8. 验证与验收

- 自动测试：领域文本规则、本地日期键、repository 新增/更新与失败、store 加载/保存状态、DOM 表单保存行为。
- 构建与静态检查：执行类型检查、ESLint、Vitest 和生产构建；所有命令必须成功。
- 浏览器验收：使用 ego-browser 在桌面与移动端验证场景非空、本子可打开、表单不被 Canvas 遮挡、键盘路径可用且没有页面溢出。
- Canvas 检查：读取 Canvas 像素确认不是全空或全透明，并验证 resize 后相机与桌面仍正确取景。
- 持久化与恢复：保存一句话，重新加载；再关闭并重新打开本地页面，确认同一本地日期内容恢复。
- 失败路径：模拟 repository 写入失败，确认错误可见、草稿仍在且不会显示虚假的“已保存”。
- 文档：运行 `node scripts/check-doc-references.mjs`，并用 ego-browser 验证新增架构 HTML 的桌面、移动端、搜索、导航和术语交互。
- 成功标准：用户能完成“打开本子 -> 保存一句话 -> 重新打开后恢复”，且源码、自动测试、产品文档、任务记录和架构文档描述一致。

## 9. 待确认项与决策

### 决策 1：前端与 3D 集成方式

**建议：Vite + React + TypeScript + Three.js + React Three Fiber。** 这让 DOM 与单 Canvas 共享应用生命周期，同时仍把领域数据与 Three.js 对象分离。替代方案是原生 Three.js，但首版需要额外手写装载、卸载和 UI 同步边界。

### 决策 2：状态与持久化封装

**建议：Zustand 管理最小应用状态，Dexie 封装 IndexedDB。** Zustand 不保存 Three.js 对象，Dexie 不暴露到 UI。替代方案是 React Context 加原生 IndexedDB，依赖更少但事务、版本、测试替身和跨 Canvas/DOM 动作会更繁琐。

### 决策 3：第一个纵向切片

**建议：3D 本子入口 + DOM 当天文本编辑 + IndexedDB 恢复。** 这同时验证产品核心“痕迹会留下”和关键技术边界。首任务不加入贴纸，因为图片资产、摆放坐标和 Canvas 手势会显著扩大数据与交互范围。

### 决策 4：首个数据库范围

**建议：v1 只建立 `dailyEntries`。** 不为后续贴纸、图片、台灯预建空表；后续按已实现功能升级 schema，避免预计模型过早成为兼容负担。

## 10. 最终批准方案

用户于 2026-08-06 13:21 CST 明确回复“批准”，第 9 节四项技术决策全部按建议采用：

1. 使用 Vite、React、TypeScript、Three.js 与 React Three Fiber。
2. 使用 Zustand 管理最小应用状态，Dexie 封装 IndexedDB。
3. 首个切片实现“3D 本子入口 + DOM 当天文本编辑 + IndexedDB 恢复”。
4. IndexedDB v1 只创建 `dailyEntries`，不预建后续功能空表。

最终执行清单为第 4.1、5、6 和 8 节内容。实施不得加入贴纸、抽屉、翻页、台灯、账号、云同步或第二个 WebGL 画布；若需要改变上述范围或所有权边界，必须暂停并重新确认。

## 11. 实施记录

2026-08-06 13:21 CST 进入实施阶段。完成的实际文件与责任如下：

- 工程基础：`package.json`、`package-lock.json`、Vite、TypeScript、ESLint、Vitest 配置与应用入口。
- 领域与持久化：`src/domain/daily-entry.ts`、`src/persistence/database.ts`、`src/persistence/daily-entry-repository.ts`；数据库 v1 只有 `dailyEntries`。
- 状态与 UI：`src/state/`、`src/app/App.tsx`、`src/features/journal/JournalPanel.tsx` 与 `src/styles.css`；草稿留在组件局部，成功保存后才更新 store。
- 3D 场景：`src/scene/DeskScene.tsx` 与 `src/scene/NotebookObject.tsx`；只有一个 Canvas，3D 本子和 DOM 按钮发出同一打开意图。
- 自动测试：4 个测试文件共 8 项测试，覆盖领域、repository、store 和 DOM 保存/失败路径。

2026-08-06 15:14 CST 根据用户补充要求，将 Vite 本地开发服务固定为 `127.0.0.1:5164` 并启用 `strictPort`。端口被占用时启动命令会明确失败，不会静默切换。

实际实现有两项局部偏差，但不改变批准的架构或行为范围：

1. 首次使用高层 `<Canvas>` 时，真实浏览器中的绘图缓冲区停留在 `300 × 150`。最终改用 React Three Fiber 官方 `createRoot(canvas)`，显式配置尺寸、DPR、事件和 ResizeObserver，并加入 StrictMode 安全的 root 获取与释放管理。
2. R3F 不能对只有事件处理器的 Group 直接 raycast。最终为本子加入透明几何体命中区，并在响应式相机更新后显式刷新 camera world matrix，保证指针投射准确。

用户提出的镜头走近、转正、本子开合和贴纸系统没有静默加入 002；已分别记录为 003 与 004 待确认任务。

## 12. 验证结果

- `npm run lint`：通过。
- `npm run test`：通过，4 个测试文件、8 项测试全部成功。
- `npm run build`：通过。Vite 提示生产 JavaScript bundle 约 974 kB、gzip 后约 275 kB，超过默认 500 kB 阈值；这是后续分包优化风险，不影响本切片运行。
- 桌面浏览器 `1440 × 900`：只有一个 Canvas，页面无横向溢出，桌面、本子、铅笔和杯子可见；Canvas PointerEvent 命中本子后打开 DOM 面板并自动聚焦 textarea。
- 关闭/重开：在原标签页保存后打开 `/?reopen=1`，关闭原标签页，第二个标签页恢复完全相同的文本并显示“今天有一页”。
- 移动端 `390 × 844`：只有一个 Canvas，页面 `scrollWidth === clientWidth === 390`；面板、textarea 和保存按钮完整落在视口内，自动聚焦、保存与刷新恢复通过。
- 非空画面：移动端场景截图包含 8,635 种颜色，RGB 标准差为 43.11、36.26、32.34，alpha 全部不透明，排除空白、全透明或纯色画面。
- 持久化验收最终文本：`编号 002 移动端验收：保存后刷新仍然存在。`
- 运行时事件检查未发现页面错误或 WebGL context loss。
- 2026-08-06 16:45 CST 最终执行 `npm run check`：lint、4 个测试文件共 8 项测试、生产构建和文档引用检查全部通过。

## 13. 文档同步检查

- 产品文档：`docs/product/mvp.md` 新增当前实现覆盖表，明确当天文字已实现、镜头转场和贴纸仍未接入。
- 架构文档：新增 `docs/architecture/system-overview.html`，记录当前运行时、所有权、保存链路、失败路径、源码地图和后续边界。
- 决策文档：新增 `docs/decisions/2026-08-06-002-local-first-data-and-scene-projection.md`，固定 IndexedDB 事实来源与 scene 投影边界。
- 文档入口：`docs/index.html` 已更新 002、003、004 状态和新增架构/决策链接。
- 引用检查：所有本地 Markdown 与 HTML 路径由 `scripts/check-doc-references.mjs` 校验。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-06 12:15 CST | Codex | 根据已批准流程方案创建后续任务占位，未形成或执行技术方案。 |
| 2026-08-06 12:36 CST | 用户 | 明确回复“批准”，确认 `docs/product/mvp.md` 的五项产品范围决策，并要求随后审核技术基础与首个切片。 |
| 2026-08-06 12:36 CST | Codex | 将产品批准结果回写为当前事实，并把本记录从占位扩展为待确认技术方案；未初始化代码。 |
| 2026-08-06 13:21 CST | 用户 | 明确回复“批准”，接受第 9 节四项技术决策并授权按方案实施编号 002。 |
| 2026-08-06 13:21 CST | Codex | 写入最终批准方案并将任务状态更新为“实施中”。 |
| 2026-08-06 15:14 CST | 用户 | 指定项目本地开发端口为 `5164`。 |
| 2026-08-06 15:14 CST | Codex | 将 host、port 与严格端口策略集中写入 Vite 项目配置。 |
| 2026-08-06 15:34 CST | 用户 | 指出点击本子需要镜头走近、转到正面、本子打开后再衔接二维 UI，并指出贴纸系统尚未接入。 |
| 2026-08-06 15:38 CST | Codex | 确认两项需求均超出 002 的批准范围，分别建立 003 与 004 待确认记录，未扩大当前实施。 |
| 2026-08-06 16:22 CST | Codex | 完成桌面、关闭原标签页重开、移动端、Canvas 指针与非空像素验收。 |
| 2026-08-06 16:30 CST | Codex | 回写真实实施、验证和方案偏差，补齐产品、架构、决策与文档入口，将 002 推进为“待验收”。 |
| 2026-08-06 16:45 CST | Codex | 完成架构 HTML 桌面/移动端与搜索、目录、术语、复制交互验收；最终全量检查通过。 |
| 2026-08-09 19:40 CST | 开发者（用户） | 确认当前工作区未验收成果已验收，同意将本任务标记为已完成。 |
