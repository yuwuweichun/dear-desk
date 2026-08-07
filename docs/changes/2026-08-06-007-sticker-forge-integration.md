# DD-20260806-007：基于 Sticker Forge 重做贴纸系统

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待验收 |
| 类型 | 功能 / 贴纸系统 / 第三方库集成 |
| 创建时间 | 2026-08-06 18:56 CST |
| 最后更新 | 2026-08-07 18:53 CST |
| 当前阶段 | 已按批准方案完成实施与验证，等待用户验收 |
| 源码基线 | `dd7d08e`；当前源码没有贴纸实现 |
| 实现提交 | 本记录所在提交 |
| 关联任务 | 用户明确要求贴纸系统必须使用 `CatsJuice/sticker-forge` |

> 用户纠正：此前 004 自研文字贴纸方案方向错误。编号 007 已按批准边界以 <https://github.com/CatsJuice/sticker-forge> 固定提交 `068caa49eef69745564a5debbc01bab3fcd31042` 为真实制作核心完成实施；004 仅保留历史审阅用途。

## 1. 给阅读者的结论

004 的历史文件名来自最初“基础文字贴纸纵向切片”的范围，不代表当前技术方案。该方案未获批准，现已标记为“已替代”。

当前首切片只交付文字贴纸，制作与最终视觉真实运行 Sticker Forge：应用在独立制作阶段挂载其官方 ES bundle，用户确认时从 Sticker Forge 的 WebGL 画布生成透明 PNG 快照；Dear Desk 再把这份真实输出作为现有 R3F 桌面中的场景投影，负责放置、移动、旋转、删除和恢复。实现没有用自研外观冒充 Sticker Forge，也没有为桌面上的每张贴纸常驻额外 WebGL renderer。

制作阶段会暂时卸载桌面 R3F 场景并挂载 Sticker Forge 的 WebGL 画布，返回桌面前销毁它；浏览器验收已确认任意时刻只有一个活跃 WebGL Canvas，但应用生命周期存在 R3F 与 Forge 两种 Canvas 所有者。

## 2. 用户需求

- 贴纸系统必须使用 `https://github.com/CatsJuice/sticker-forge`。
- 不接受绕开该项目、仅复刻部分外观或继续维护自研贴纸核心的方案。
- 当前错误实现全部撤回，只保留本需求记录进入后续审批。
- 用户于 2026-08-07 再次确认：实现贴纸系统时应使用此前指定的开源系统，不能把 004 的 `basic-sticker-system` 文件名误读为继续自研。

## 3. 审批时源码事实

- 批准时基线 `dd7d08e` 尚未接入贴纸模型、贴纸 UI 或 Sticker Forge 依赖；`src/scene/DeskScene.tsx` 当时只组合桌体、本子、铅笔和杯子。
- 项目文档此前只提到“不实现高级 Sticker Forge 能力”，没有记录“必须使用 CatsJuice/sticker-forge”的硬性约束，这是需求遗漏。
- 004 的未提交实现没有使用 Sticker Forge，因此不能进入验收或保留为当前事实。
- `package.json` 当前使用 React `19.2.8`、Three.js `0.185.1`、R3F `9.7.0`、Dexie `4.4.4`；IndexedDB v1 只有 `dailyEntries`。
- 上游当前没有 tag 或 GitHub Release，根 `package.json` 也没有面向 npm 消费的 `exports`。官方复用产物是 `public/embed/sticker-forge.es.js`、`sticker-forge.iife.js` 与 `sticker-forge.d.ts`。
- 固定提交 `068caa49eef69745564a5debbc01bab3fcd31042` 的 ES bundle 面向 ES2020，刻意内嵌 Three.js；其 `createSticker(target, options)` 会创建自己的 `THREE.WebGLRenderer`，把 Canvas 附加到 DOM 宿主，并要求 SPA 在卸载前调用 `destroy()`。
- 上游公开输入覆盖文字、图片与 SVG；公开控制面覆盖 `setSource`、`setOptions`、`reset`、`resize`、`getState` 和 `destroy`，并发出 peel 与 error 事件。公开 API 不返回可挂入外部 R3F scene 的 Mesh、Material 或 Texture，也不管理多贴纸桌面坐标与持久化。
- 上游许可证为 MIT，分发其 bundle 或实质代码时必须保留版权与许可文本。

## 4. 目标与非目标

### 4.1 目标

- 从当天编辑文本制作一张由 Sticker Forge 真实渲染的文字贴纸。
- 允许用户在制作阶段体验 Sticker Forge 的轮廓、材质、光照和 peel 渲染，并把确认时的透明画布快照作为桌面视觉来源。
- 把贴纸放到桌垫允许区域，选择后移动、按 `15°` 旋转或删除。
- 持久化文字源、必要的 Forge 选项、PNG 快照、桌面坐标和方向，并在重新打开页面后恢复。
- 固定并记录上游 commit、MIT 许可证和销毁生命周期；运行时必须实际执行 Sticker Forge bundle。
- 任意时刻只保留一个活跃 WebGL canvas：进入制作阶段前卸载 R3F 桌面，退出前销毁 Sticker Forge，再恢复 R3F 桌面。

### 4.2 非目标

- 首切片不支持图片或 SVG 上传；上游虽然支持，但图片资产输入作为后续独立切片。
- 不把上游未公开的 Mesh、ShaderMaterial 或内部 renderer 私有成员复制进 R3F。
- 不在桌面上为每张贴纸创建 Sticker Forge canvas，也不让多个 WebGL context 随贴纸数量增长。
- 不持久化 peel 动画瞬时状态，不实现贴纸编辑、复制、缩放、多选、层级排序或高级物理剥离。
- 不引入 npm 中同名或非官方包；上游当前没有可核实的 npm 消费入口。

## 5. 方案说明

### 5.1 用户流程

```text
本子编辑态选择“制作贴纸”
  -> 把当前短文本带入 Sticker Forge 制作阶段
  -> 暂时卸载 R3F 桌面，只挂载一个 Sticker Forge renderer
  -> 调整首切片开放的文字颜色与材质，并预览 peel 效果
  -> 确认后等待贴纸回到 flat 状态，读取其 Canvas 为透明 PNG Blob
  -> destroy() Sticker Forge，恢复 R3F 桌面并进入放置模式
  -> 点击桌垫，在一个 Dexie 事务中保存定义、渲染资产与实例
  -> 选择后移动 / 旋转 / 删除
  -> 页面重开后由 PNG Blob 恢复同一视觉，由实例恢复位置与方向
```

取消制作只销毁临时 renderer 和内存快照，不写数据库。确认制作后若用户取消放置，也不写半成品。贴纸只有在桌垫点击成功时成为持久化事实。

### 5.2 上游适配边界

- 固定使用上游 commit `068caa49eef69745564a5debbc01bab3fcd31042` 的 `sticker-forge.es.js` 与声明文件，并随代码保存 MIT `LICENSE` 和来源说明。
- React 适配器只负责 `createSticker()`、事件订阅、`setSource()`、`setOptions()`、Canvas 快照和 `destroy()`；不得访问上游私有 renderer、scene 或 mesh。
- Sticker Forge 拥有制作阶段的渲染与轮廓视觉；Dear Desk 不复刻其贴纸外观。桌面阶段只显示确认时由上游 Canvas 生成的透明 PNG。
- Dear Desk 仍拥有业务状态、位置与生命周期。Forge 的 `StickerState` 只用于等待 ready/flat 和显示制作反馈，不进入 Zustand 或 IndexedDB。

### 5.3 桌面交互

- PNG Blob 通过对象 URL 加载为 R3F texture；URL 和 Texture 只存在于组件生命周期，卸载时释放。
- 放置与拖动通过桌垫平面 raycast 得到世界坐标并在领域层 clamp；拖动过程只更新内存，pointer up 后持久化。
- 贴纸对象阻止 pointer 事件穿透到本子；DOM 控制条提供逆时针旋转、顺时针旋转和删除按钮。
- 初版每个 definition 只有一个 instance。删除时在同一事务删除 instance、definition 和对应快照资产。

## 6. 预计改动与影响评估

| 预计模块 | 预计责任 |
| --- | --- |
| `public/vendor/sticker-forge/` | 固定提交的 ES bundle、类型声明、MIT 许可证与来源说明 |
| `src/integrations/sticker-forge.ts` | 动态加载官方 bundle，封装创建、更新、快照和销毁生命周期 |
| `src/domain/sticker.ts` | 文字源、允许的 Forge 选项、实例坐标、旋转和边界规则 |
| `src/persistence/database.ts` | IndexedDB 升级到 v2，新增定义、渲染资产和实例表，保留 v1 日记 |
| `src/persistence/sticker-repository.ts` | 创建/加载/移动/旋转/删除的事务边界 |
| `src/state/app-store.ts` | 加载贴纸、制作/放置/选择模式与异步失败状态 |
| `src/features/stickers/StickerStudio.tsx` | 唯一的 Sticker Forge 宿主、文字/材质控件、预览与确认 |
| `src/features/stickers/StickerControls.tsx` | 选中实例后的旋转与删除命令 |
| `src/scene/StickerObject.tsx`、`DeskScene.tsx` | 快照纹理投影、raycast 放置/拖动与资源释放 |
| `src/app/App.tsx`、`src/styles.css` | 在桌面与制作阶段之间切换，保证不会同时挂载两个 WebGL Canvas |
| 测试与文档 | 适配器、事务、状态、交互、迁移、恢复和架构事实回写 |

### 6.1 核心数据结构变化

```ts
interface StickerDefinition {
  id: string
  kind: 'text'
  source: {
    text: string
    color: string
    fontFamily: string
    fontWeight: number
  }
  forge: {
    material: 'original' | 'holographic' | 'glitter' | 'reflective'
    materialIntensity: number
    outlineWidth: number
    outlineColor: string
  }
  previewAssetId: string
  sourceEntryDate: LocalDate
  createdAt: string
}

interface StickerRenderAsset {
  id: string
  blob: Blob
  mimeType: 'image/png'
  width: number
  height: number
  upstreamCommit: '068caa49eef69745564a5debbc01bab3fcd31042'
}

interface StickerInstance {
  id: string
  definitionId: string
  position: { x: number; z: number }
  rotationY: number
  createdAt: string
  updatedAt: string
}
```

IndexedDB v2 新增 `stickerDefinitions`、`stickerRenderAssets` 和 `stickerInstances`，只新增表，不改写 `dailyEntries`。Blob 是上游真实渲染结果；Three.js Texture、对象 URL、Mesh 和 Forge runtime 实例不得持久化。

### 6.2 上下游与跨模块影响

- `JournalPanel` 需要把当前草稿作为制作意图传给 store；它不直接加载上游 bundle或访问 Dexie。
- `App` 根据贴纸工作流在 `DeskScene` 与 `StickerStudio` 之间切换，销毁顺序是硬性资源边界。
- repository 返回 definition、asset 与 instance 的可序列化组合，不向 UI 暴露 Dexie table。
- R3F 使用 Blob 的对象 URL 创建 Texture；错误或卸载时必须 revoke URL 并 dispose Texture。
- v1→v2 迁移必须保留已有日记；页面启动时日记与贴纸分别加载，某张损坏快照不能阻止日记编辑。
- 图片贴纸后续可复用 `StickerRenderAsset`，但本次不得预先实现上传、解码或配额 UI。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 上游无正式发布 | 直接跟随 `main` 或依赖在线脚本 | API 漂移或离线失效 | 固定 commit 并将官方产物与许可证随仓库存放 |
| Canvas 所有权冲突 | R3F 与 Forge 同时挂载 | 两个 WebGL context、事件和性能冲突 | 制作阶段切换 Canvas 所有者；自动测试断言页面最多一个 WebGL Canvas |
| 快照时仍处于 peel 状态 | 用户拖起后立即确认 | 保存弯曲或裁切画面 | 确认时调用 `reset()`，等待 flat/下一帧后再读取透明 PNG |
| WebGL 快照失败 | context lost、tainted canvas 或上游异常 | 无法进入放置 | 保留制作内容并显示可重试错误，不写数据库 |
| Blob 或纹理泄漏 | 忘记销毁 Forge、revoke URL 或 dispose Texture | 长期使用后内存增长 | 适配器和组件 teardown 测试，浏览器重复开关验证 |
| 上游快照与桌面比例不一致 | 整个宿主 Canvas 含透明边距 | 贴纸命中范围过大 | 保存画布尺寸与透明边界；实现时用 alpha bounds 裁切上游输出，不重绘视觉 |
| v2 升级错误 | 新表迁移破坏 v1 | 已保存日记丢失 | 只新增表并用 fake-indexeddb 验证 v1→v2 |

回退代码时保留 IndexedDB v2 表和用户数据，不自动清库。可以停止加载贴纸 UI 和场景投影，但删除 bundle、数据库内容或降级 schema 都需要单独授权。

## 8. 验证与验收

- 自动测试：领域边界、v1→v2、repository 事务、store 模式/回滚、适配器 `destroy()`、对象 URL/Texture 清理、Canvas 互斥和指针事件。
- 构建与静态检查：运行 `npm run check`；校验 vendor 来源、固定 commit、许可证和文档引用。
- 浏览器验收：按项目规定使用 ego-browser，在桌面和移动端制作、peel 预览、确认、放置、移动、旋转和删除；检查页面任意时刻只有一个 Canvas。
- 持久化与恢复：放置并旋转后刷新和关闭/重开页面，视觉、文本、位置和方向保持；删除后不恢复；v1 日记仍存在。
- 视觉证据：确认制作阶段 Canvas 非空，保存的 PNG 具有非空 alpha bounds，桌面纹理与确认前的 Forge flat 画面一致。
- 成功标准：浏览器运行时确实加载固定 Sticker Forge bundle 并由其产生持久化视觉；Dear Desk 不以自研渲染替代上游核心。

## 9. 待确认项与决策

1. **建议批准 Canvas 所有者切换。** 制作阶段暂时卸载 R3F，挂载一个 Sticker Forge Canvas；确认或取消时先 `destroy()` Forge，再恢复桌面。若要求 Sticker Forge 与桌面同时可见，就必须允许两个并发 WebGL Canvas，范围和性能风险更大。
2. **建议首切片只做文字贴纸。** 保持 004 的独立验收范围；图片/SVG 虽由上游支持，但上传、容量和资产生命周期另行审批。
3. **建议固定 commit 并 vendoring 官方产物。** 使用 `068caa49eef69745564a5debbc01bab3fcd31042`，不从在线 CDN 加载，也不把未发布仓库伪装成 npm 依赖。
4. **建议桌面交互保持 MVP 范围。** Forge 负责制作视觉与 peel 预览；Dear Desk 负责放置、移动、`15°` 旋转、删除和恢复，桌面不持久化 peel 状态。

## 10. 最终批准方案

用户于 2026-08-07 17:46 CST 明确回复“批转007”，按语义记录为批准编号 007。第 9 节四项建议全部确认：

1. 制作阶段与桌面阶段切换 Canvas 所有者，任意时刻只保留一个活跃 WebGL Canvas。
2. 首切片只交付文字贴纸，图片与 SVG 输入后续独立审批。
3. 固定并 vendoring 上游 commit `068caa49eef69745564a5debbc01bab3fcd31042` 的官方产物和 MIT 许可证，不使用在线 CDN。
4. Sticker Forge 负责制作视觉与 peel 预览；Dear Desk 负责放置、移动、`15°` 旋转、删除和重开恢复。

最终执行清单为第 4.1、5、6 和 8 节。实施不得改用自研贴纸核心、在线 CDN 或多贴纸多 Canvas 架构；若真实上游行为迫使改变这些边界，必须暂停并重新确认。

## 11. 实施记录

- `public/vendor/sticker-forge/` 已保存固定 commit `068caa49eef69745564a5debbc01bab3fcd31042` 的官方 ES bundle、source map、声明文件、MIT `LICENSE` 与 `SOURCE.md`；运行时不访问 CDN，也未增加同名 npm 依赖。`eslint.config.js` 只将未经修改的 vendor 产物排除在本项目 lint 之外。
- `src/integrations/sticker-forge.ts` 使用浏览器原生动态 import 加载 public vendor 产物，只封装公开 API。确认时调用 `reset()`，等待 flat 状态，以 34 ms timer 作为 RAF 被节流时的兜底，再按 alpha bounds 裁切为透明 PNG Blob；`destroy()` 幂等执行。
- `src/domain/sticker.ts` 已加入文字长度、固定上游 commit、Forge 选项、PNG 资产、桌面实例、坐标 clamp 与旋转归一化；`src/persistence/database.ts` 已升级为 v2，保留 v1 日记表并新增 definition、render asset、instance 三表。
- `src/persistence/sticker-repository.ts` 已实现三表原子创建/删除，以及加载、移动和旋转；一张损坏或缺失关联记录会被跳过，不阻塞其他贴纸与日记加载。
- `src/state/app-store.ts` 已加入 `idle/composing/placing` 工作流、贴纸加载、放置、选择、移动提交、`15°` 旋转、删除和错误状态。取消制作会回到本子并恢复未保存草稿；确认生成后才清除草稿，取消放置不写数据库。
- `JournalPanel` 已加入“制作贴纸”入口；`StickerStudio` 承载真实 Sticker Forge Canvas、文字、五种颜色和四种上游材质；`StickerControls` 提供放置取消、双向旋转、删除和错误反馈。
- `App` 在制作阶段条件卸载 `DeskScene`，制作结束销毁 Forge 后才恢复 R3F；`DeskScene` 负责桌垫 raycast、放置与选择，`StickerObject` 负责 Blob 对象 URL、Texture 生命周期、透明 PNG 投影、四边选中轮廓和拖动手势。
- `src/styles.css` 已补齐桌面与移动端制作器、控制条和错误状态。移动端选中贴纸时隐藏“打开本子”按钮，避免工具条重叠。

与批准方案的偏差：Vite 会拒绝从 `public/` 目录使用普通源码 import，因此适配器通过 `new Function('url', 'return import(url)')` 让浏览器直接加载固定 URL；这不改变来源、离线或模块所有权边界。首版自动测试集中覆盖领域、迁移、事务与 store；Forge 生命周期、Canvas 互斥、Texture/对象 URL 和指针行为由真实浏览器验收覆盖，未为未经修改的上游 bundle 建立单元测试。

## 12. 验证结果

- `npm run lint`：通过。
- `npm run test`：7 个测试文件、23 项测试全部通过；覆盖贴纸文本/边界/旋转、v1→v2 日记保留、三表创建/更新/删除事务、store 工作流及取消制作恢复未保存草稿。
- `npm run build`：通过；主 bundle 为 1000.85 kB、gzip 282.75 kB，保留 Vite 大于 500 kB 的既有性能提示。Sticker Forge 作为独立 vendor 动态加载，不进入该主 bundle。
- `node scripts/check-doc-references.mjs`：通过，无失效文档路径或未解释占位内容。项目自有文件的暂存差异通过 `git diff --cached --check`；原样 vendoring 的官方 `sticker-forge.es.js` 含上游构建产物既有尾随空白，未为迎合检查改写第三方产物。
- ego-browser 桌面验收（`1920 × 1050`）：确认实际加载固定 ES bundle，实际观察到 `peelstart`、`peelchange`、`peelend`；制作和桌面状态各只有一个 Canvas；保存 PNG Blob 非空并记录固定 upstream commit。
- 持久化验收：第一次未命中桌垫不会写库；成功放置一次原子创建 definition、asset、instance 三条记录；旋转持久化为 `0.26179938779914913` 弧度（精确 `15°`）；拖动位置被限制到 `z = 2.72`；刷新后 PNG、位置和方向恢复。
- 删除验收：删除同时清理三张表，记录数全部归零；刷新后贴纸不恢复。
- ego-browser 移动端验收（`390 × 844`）：页面 `scrollWidth === 390`、`scrollHeight === 844`，无横向溢出；制作器约 1.19 秒可用，取消制作后恢复“移动端贴纸”草稿，选中工具条不再与“打开本子”重叠。
- 最终页面回归：`1440 × 900` 与 `390 × 844` 下应用均只有一个 Canvas，页面宽高与视口一致；桌面和移动端截图确认 3D 场景非空且控件无重叠。
- HTML 文档验收：`docs/index.html` 与 `docs/architecture/system-overview.html` 在 `1440 × 900` 和 `390 × 844` 下均无页面横向溢出；全文搜索、空结果、方向键/回车跳转、Escape、锚点偏移、当前章节高亮、复制、Wiki 卡和移动目录均通过。ego 的 CSS 过渡时钟在目录测试中停于起始帧，手动完成同一 Web Animation 后确认侧栏最终边界为 `70–390px`，生产 CSS 的开/关目标态均正确。
- 最终浏览器测试数据已清理，三张贴纸表记录数均为零；未删除用户日记或执行数据库清空。

## 13. 文档同步检查

- 产品文档：`docs/product/mvp.md` 已补充 Sticker Forge 硬性约束、制作阶段材质/peel 与桌面平面快照边界，并把文字贴纸标为 007 已实现待验收；图片仍是后续独立切片。
- 架构文档：`docs/architecture/system-overview.html` 已记录 Canvas 所有者切换、Forge 快照链路、v2 schema、Blob/Texture 生命周期、失败路径和源码地图。
- 决策文档：已新增 `DD-ADR-20260807-001`，固定上游版本、许可证、单活跃 Canvas 和公开 API 适配边界。
- 文档入口：`docs/index.html` 已把 004 标为历史替代方案，将当前贴纸入口切到 007，并加入新决策记录。
- HTML 规范：修改前已完整阅读 `/Users/song/Desktop/docs-html/AGENTS.md`；本地 HTML 的桌面/移动端视觉、搜索、导航、Wiki、复制和响应式滚动均已使用 ego-browser 验证。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-06 18:56 CST | 用户 | 指出 004 方向错误，贴纸系统必须使用 `CatsJuice/sticker-forge`；要求撤回当前实现并提交新需求记录。 |
| 2026-08-06 18:56 CST | Codex | 确认此前文档遗漏该硬性约束，建立 007 待确认记录。 |
| 2026-08-07 17:42 CST | 用户 | 再次指出 004 的 `basic-sticker-system` 命名造成误导，要求实现必须使用此前指定的开源贴纸系统。 |
| 2026-08-07 17:42 CST | Codex | 解释 004 是已失效的历史方案；完成 Sticker Forge 上游 API、产物、许可证和 Canvas 所有权调研，并提交 007 可执行方案。 |
| 2026-08-07 17:46 CST | 用户 | 回复“批转007”，批准第 9 节四项建议及最终执行清单。 |
| 2026-08-07 18:53 CST | 用户 | 要求将 007 的实现、测试、vendor 产物与文档作为一次提交并推送到远程。 |
