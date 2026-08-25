# DD-20260824-001：音效与音乐系统

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 |
| 创建时间 | 2026-08-24 11:12 CST |
| 最后更新 | 2026-08-25 16:01 CST |
| 当前阶段 | 用户已授权创建提交，音效系统完成；背景音乐文件留待后续任务接入 |
| 源码基线 | `9c45769`；工作区已有本任务记录这一项未提交修改，实施时必须保留 |
| 实现提交 | 本次提交（包含源码、音频资产、文档、验证结果与验收状态） |
| 关联任务 | 用户提出“本子翻开动画搭配音效、全局背景音乐，并商榷是否增加 UI 交互音效” |

> 本文保留任务从提出、批准、实施到验收的完整记录；最终实现范围以第 10 至 14 节为准。

## 1. 给阅读者的结论

本任务已经为 Dear Desk 增加一套克制、可关闭的音频体验。用户提供的 4 条音效素材已处理为开本快速翻页、日期翻页、关本、抽屉打开和抽屉关闭 5 条独立文件。右上角已有全局音频设置入口，展开卡片分别控制音乐与音效的开关和音量。背景音乐资源尚未加入，本期只完成可持久化的音乐控制，不播放占位音乐。

4 条输入 MP3 均可解码。抽屉合并轨在约 `1.43s` 至 `1.90s` 的清晰静音分隔处完成拆分，其原始响度明显低于其余三条素材，导出时已经做克制的响度匹配。当前实现使用原生 `HTMLAudioElement` 的页面级控制器，由 Zustand 状态边沿触发语义音效，不把播放对象放进 store 或 Three.js。

## 2. 用户需求

### 2.1 用户原始要求

- “记录需求，音效与音乐系统”。
- 本子翻开动画搭配音效。
- 增加全局背景音乐。
- 可能也使用 UI 交互音效，但该项待商榷。
- 2026-08-25 补充：用户提供 4 个音频文件，分别对应开本快速翻页、日期翻页、关本，以及合并的抽屉打开/关闭；合并轨需拆成两个独立文件。
- 2026-08-25 补充：处理后的音频需放入项目，并在对应动作发生时播放。
- 2026-08-25 补充：右上角增加音频设置按钮；展开卡片分别提供“音乐”和“音效”的音量调节与快捷开关。当前没有音乐资源，但本期先完成音乐设置。
- 2026-08-25 补充：记录适合 Dear Desk 的公版古典曲目、明确开放录音来源，以及温暖与轻松欢快两个方向的 Suno 生成提示词；本次提交只完成音效系统，音乐文件后续补充。

### 2.2 Codex 对需求的解释

- **确定需求**：五类音效必须与现有 `opening`、`closing`、`journalTurnPhase === 'turning'`、`pastTracesPhase === 'opening' | 'closing'` 的成功状态边沿建立稳定同步关系；无效、被 guard 拒绝或加载失败的操作不应出声。
- **确定需求**：音乐与音效拥有独立开关和音量；偏好由页面级所有者持有并跨桌面、本子与贴纸工作台保持一致。
- **合理推断**：音频必须提供清晰的静音和音量控制，并处理浏览器禁止未交互自动播放的限制，否则“全局背景音乐”无法形成可靠、可验收的行为。
- **合理推断**：音频素材应作为本地资源随应用发布，记录来源与许可，不让核心体验依赖外网音频地址。
- **合理推断**：音乐资源未提供时，音乐控件只维护偏好，不伪造播放状态、不发起空资源请求；后续新增音乐需继续使用同一控制器。
- **待确认项**：4 条用户提供素材的来源与可分发许可尚未给出；默认开关/音量和 reduced-motion 声音策略等待随最终方案批准。

## 3. 当前源码事实

- `docs/product/mvp.md` 将 Dear Desk 定位为安静、可反复回到的私人工作台；当前明确排除的是语音录制、语音播放和语音资源管理，并未定义环境音乐或界面音效。新增产品音频不等于新增语音能力，但实施时需要同步修订产品范围说明。
- `src/state/app-store.ts` 通过 `NotebookPhase` 管理 `desk -> approaching -> opening -> editing -> closing -> retreating -> desk` 状态，并由 `requestNotebookOpen()`、`advanceNotebookPhase()` 等动作限制合法转场。这是开本音效触发语义的现有来源。
- `src/scene/notebook-transition.ts` 定义开本阶段时长：标准桌面为 `1.6s`、紧凑视口为 `1.04s`、reduced-motion 为 `0.06s`。`src/scene/NotebookObject.tsx` 按相同阶段和时长推进 3D 开合进度；`src/scene/DeskScene.tsx` 同时负责相机过渡和阶段完成。
- 同一时长表中的关本阶段为标准桌面 `1.12s`、紧凑视口 `0.72s`、reduced-motion `0.06s`；`0.696s` 关本音轨分别延迟约 `0.424s`、`0.024s` 或 `0s`，让主要合拢声靠近视觉终点。
- `src/app/App.tsx` 的 `ProductApp` 组合桌面、日记与贴纸工作台；当前全局轻量字体偏好也由该层拥有并通过 `localStorage` 恢复。若音频偏好只包含音量、静音和开关，这一层是现有架构中可参考的全局所有权边界。
- `docs/decisions/2026-08-06-002-local-first-data-and-scene-projection.md` 规定 Zustand 只协调可序列化应用状态，Three.js 只做视觉投影，运行对象不能写入 store 或 IndexedDB。`HTMLAudioElement`、Web Audio 节点、音频缓冲和播放句柄同样属于运行对象，不应进入 Zustand 或 IndexedDB。
- 当前 `package.json` 没有专用音频依赖；仓库的 `public/` 与 `src/` 中没有 `.mp3`、`.wav`、`.ogg`、`.m4a`、`.aac` 或 `.flac` 音频资产。
- 用户提供的素材实际位于 `/Users/song/Downloads/`：`paper-crumpling-and-book-foley-parchment-crinkle-movement.mp3`（`1.656s`，开本快速翻页）、`page-flip-smaller-page.mp3`（`0.984s`，日期翻页）、`book-closing.mp3`（`0.696s`，关本）、`drawer-opening-amp-closing.mp3`（`4.200s`，抽屉开合合并轨）。文件名、时长、码率和波形均已读取，尚未复制或改写原文件。
- 抽屉轨的有效声音大致位于 `0.48s–1.43s` 与 `1.90s–3.31s`，中间有约 `0.47s` 静音；首尾也有静音。其综合响度约 `-35.5 LUFS`，其余三条约为 `-24.7` 至 `-28.6 LUFS`，直接混用会让抽屉明显偏小。
- 日期翻页由 `requestJournalTurn()` 完成目标页预读后进入 `journalTurnPhase: 'turning'`，`PageTurnSheet` 的标准视觉时长为 `720ms`；在请求被拒或预读失败时不会进入该阶段。音效应观察成功阶段，而不是在导航按钮点击时盲播。
- 中央抽屉动画由 `pastTracesPhase` 驱动，打开和关闭均为 `0.3s`；关闭既可能来自关闭按钮/Escape/遮罩，也可能来自选择一条旧痕迹。音效应观察 `opening` / `closing` 状态边沿，从而覆盖所有成功入口。
- `src/integrations/sticker-forge.ts` 存在上游 Sticker Forge 配置 `sound: { enabled: true, volume: 0.45 }`，它只属于该集成的制作体验，不是 Dear Desk 的全局音乐、音效控制或持久化系统。
- `src/scene/notebook-transition.test.ts` 已覆盖开合阶段时长、紧凑视口和 reduced-motion 端点，但当前没有音频触发、解锁、清理、偏好恢复或视图连续播放测试。
- 实施开始前 `git status --short` 只有本任务既有的未跟踪变更记录，没有其他未提交业务源码；本次差异均属于本任务，没有回退用户文件。

## 4. 目标与非目标

### 4.1 目标

- 为本子翻开动画增加一次、可预测、不会因 React 重渲染或双重挂载而重复播放的同步音效。
- 为本子关闭、日期翻页、中央抽屉打开和中央抽屉关闭增加单次、语义正确的音效；失败或被拦截的意图不播放。
- 预留跨桌面、日记与贴纸工作台连续播放的全局背景音乐能力，并遵守浏览器用户手势解锁规则；本期没有音乐资源，不生成或接入占位音乐。
- 提供用户可发现的静音/播放与音量控制；确定并实现偏好生命周期后，页面重开行为可验证。
- 建立背景音乐与效果音分离的统一音频运行边界，支持暂停、恢复、资源加载失败和组件卸载清理。
- 使用本地、来源与许可清楚、适合发布的音频资源，并同步产品与架构文档。
- 把 4 条输入素材处理为 5 条面向网页的本地音效，保留原始输入文件不变，并记录处理参数、来源状态和校验值。

### 4.2 非目标

- 不增加语音录制、用户音频上传、语音播放、波形编辑或音频资源库。
- 不增加云端串流、账号同步、跨设备音频偏好同步或远端动态歌单。
- 不制作完整音乐播放器、曲目管理、播放列表或可视化频谱。
- 不让 Three.js 场景对象、Zustand 或 IndexedDB 持有浏览器音频运行对象。
- 不给普通按钮、保存、贴纸、调色或相机操作增加通用点击音；本期音效仅限用户明确列出的五类动作。
- 不默认改动 Sticker Forge 自带的 `sound` 配置；是否与全局静音联动需另行确认。

## 5. 方案说明

音频分成两个总线：`music` 负责未来的循环背景音乐，`sfx` 负责本期五类音效；两者共享一个页面级音频控制器，但分别拥有 `enabled` 与 `volume`。浏览器音频运行对象只在控制器内部存活，React 组件通过语义事件调用，例如 `playSound('notebook-open')`，而不是直接操作文件或播放器。相同语义的新触发会重启单个音轨，不无限叠加实例；不同语义可以自然衔接。

页面首次载入时只读取轻量音频偏好，不绕过浏览器自动播放策略。背景音乐若处于启用状态，应在第一次合格用户操作后开始或恢复；自动播放被拒绝时保持可恢复状态，不显示误导性的“正在播放”。音乐在 `ProductApp` 生命周期内保持同一实例，因此切换桌面、日记和贴纸工作台不会从头播放。页面失去可见性时是否暂停、恢复时是否续播，按最终确认项实施。

开本、关本、日期翻页和抽屉开合均由应用层观察已成功进入的状态边沿并只触发一次。开本音轨 `1.656s` 与标准开本 `1.6s` 基本一致；关本音轨较短，按关闭动画结束点反推延迟，使最终合拢声落在视觉终点附近；日期翻页在 `turning` 开始时播放；抽屉音轨拆分后会去掉首尾静音、做极短淡入淡出和约 `0.3s–0.45s` 的节奏适配，以匹配现有抽屉动画，而不修改抽屉状态机时长。

右上角使用一个扬声器图标按钮，展开紧凑设置卡。卡内固定为“音乐”和“音效”两行，每行包含可访问的快捷开关、音量滑杆和百分比读数；开关关闭时保留上次非零音量，重新打开恢复该音量。点击卡外、按 Escape 或再次点击入口关闭。桌面端向左展开，移动端限制在视口内且不遮挡主要操作；入口保持页面级可用，不能因切换桌面、本子或贴纸工作台而丢失偏好。

## 6. 预计改动与影响评估

- 在 `src/audio/` 新增音频偏好解析/持久化、原生音频控制器、React 页面级桥接和语义音效清单，不新增第三方音频依赖。
- 在 `src/app/App.tsx` 或独立 provider 中建立页面级音频生命周期，读取偏好、完成首次用户手势解锁，并保证跨工作流切换连续播放。
- 在右上角新增 `AudioSettingsControl`，复用现有 `IconButton` 与 Lucide 图标，并按现有 8px 内面板圆角、键盘焦点和移动端安全区规范实现。
- 从现有状态边沿触发五类音效；不得把音频播放塞进每帧 `useFrame()`，也不得因 React StrictMode 或组件重挂载重复触发。
- 在 `public/audio/` 加入处理后的 `notebook-open.mp3`、`notebook-close.mp3`、`page-turn.mp3`、`drawer-open.mp3`、`drawer-close.mp3`；原始 Downloads 文件不改写、不复制进仓库。新增 `SOURCE.md` 记录输入文件名、处理命令、时长、哈希与用户提供的许可信息。
- 为偏好解析、开关/音量交互、播放拒绝、状态边沿单次触发、失败意图不播放、卸载清理和音乐缺省资源行为增加针对性自动测试。
- 实施完成后同步 `docs/product/mvp.md`；音频所有权、运行时生命周期和偏好存储会改变当前架构事实，因此同步 `docs/architecture/system-overview.html`。修改该 HTML 时必须按项目规则使用 `$bun-html-docs`。

### 6.1 核心数据结构变化

预计新增轻量、可序列化偏好，具体字段待确认后定稿。建议形态如下：

```ts
interface AudioChannelPreference {
  enabled: boolean
  volume: number
}

interface AudioPreferences {
  version: 1
  music: AudioChannelPreference
  sfx: AudioChannelPreference
}
```

- 音量范围为 `0..1`，写入前归一化和校验；建议默认值为音乐关闭/`0.3`、音效开启/`0.6`。音乐默认关闭可以避免未来补入资源后给既有用户突然自动出声。
- 偏好属于当前浏览器的呈现设置，建议使用带版本的 `localStorage` 键，读取失败或旧值非法时回到已确认默认值；不修改 IndexedDB schema。
- 播放状态、当前时间、解锁 Promise、`HTMLAudioElement`、`AudioContext`、节点和缓冲均为当前页面运行态，不持久化。
- 音效语义枚举只包含本期明确的 `notebook-open`、`notebook-close`、`page-turn`、`drawer-open` 与 `drawer-close`，不提前加入保存、贴纸或通用按钮事件。

### 6.2 上下游与跨模块影响

- **上游用户意图**：成功打开/关闭本子、日期翻页、打开/关闭旧痕迹抽屉，以及操作全局音频控制；保存、贴纸和普通按钮不在本期音效范围内。
- **应用状态**：沿用 `NotebookPhase` 判断开本边沿；不需要为音频复制第二套本子状态机。
- **场景投影**：`NotebookObject` 和相机动画仍只负责画面；音频控制器消费阶段事实，不持有 Mesh 或 Canvas。
- **工作流切换**：背景音乐所有者必须位于桌面、日记、贴纸工作台共同父级，避免路由/条件渲染导致重启。
- **Sticker Forge**：其局部 `sound` 当前独立。若最终要求一个静音按钮控制所有声音，需要评估上游实例是否支持运行时同步，并把该联动加入批准清单。
- **存储**：建议只新增 `localStorage` 偏好，不升级 IndexedDB；清除站点数据后恢复默认。
- **资源与发布**：音频文件增加构建产物体积和网络传输，需要在选材后记录格式、码率、循环接缝、文件大小和许可。
- **测试**：jsdom 不会真实播放声音，单元测试应验证命令、状态与清理；真实听感、循环接缝、响度和移动端策略必须通过浏览器与人工听觉验收。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 自动播放被浏览器阻止 | 页面载入后未发生用户手势就调用播放 | 背景音乐不响，UI 状态与事实不一致 | 使用首次合格交互解锁；捕获播放拒绝并保留可恢复状态 |
| 音效重复播放 | StrictMode 重挂载、多个组件同时观察阶段或 effect 重跑 | 一次动作听到叠音 | 由单一页面级桥接按状态边沿去重；增加五类触发的重复渲染测试 |
| StrictMode 清理演练后永久静音 | 开发环境首次挂载立即执行 effect cleanup，控制器被标记为 disposed | UI 正常但所有动作音效都不调用播放器 | 偏好 effect 重放时重新激活控制器；增加 dispose → setPreferences → play 回归测试和真实浏览器 play 探针 |
| 音画不同步 | 桌面、移动和 reduced-motion 时长不同 | 声音晚于动画结束或节奏不一致 | 选择短素材并定义各模式策略；按现有时长做浏览器验收 |
| 背景音乐干扰或造成突发响声 | 默认音量过高、用户环境安静或恢复页面时突然播放 | 降低舒适度和信任 | 使用保守默认音量、可见总控和渐入/渐出；最终默认行为需用户确认 |
| 循环接缝明显 | 素材首尾不适合无缝循环 | 长时间停留时出现跳点 | 选用可循环素材并人工验收；不合格时替换资产 |
| 标签页后台仍持续播放 | 页面不可见时未定义策略 | 干扰用户并浪费资源 | 明确 `visibilitychange` 策略；按最终选择暂停/续播 |
| 音频资源加载失败 | 文件缺失、解码不支持或网络中断 | 静音或交互延迟 | 失败不阻断核心工作流；控制器降级并提供可重试状态 |
| 素材许可不清 | 使用来源不明或限制发布的音乐 | 无法合法分发 | 只接收/选用许可可核验资产，记录来源、作者、许可和哈希；否则暂停资产合入 |
| 音效响度不一致 | 直接使用当前输入文件，抽屉轨比关本轨低约 10 LUFS | 用户频繁调音量仍忽大忽小 | 导出时匹配感知响度并限制 true peak；最终以浏览器人工听感复核 |
| 音画时长不一致 | 抽屉视觉仅 `0.3s`，原始两段声音约 `0.95s` / `1.40s` | 面板已出现或抽屉已闭合后仍有明显拖尾 | 去静音后适度时间压缩与短淡入淡出，不改变现有状态机时长 |
| UI 音效过密 | 给所有按钮统一加声 | 工作台变得嘈杂且失败动作也可能响 | 只绑定获批的领域完成事件；可独立关闭 SFX |
| 与现有未提交改动冲突 | 后续修改 `App.tsx`、`DeskScene.tsx` 或架构 HTML | 覆盖用户工作或文档失真 | 实施前重新读取差异并在当前工作树上合并，不回退已有修改 |

回退时可删除音频控制器、控制入口和本地资产，并移除语义触发；若仅音频资源不可用，系统必须降级为当前无声体验而不影响本子、日记、贴纸或持久化数据。

## 8. 验证与验收

- **自动测试**：偏好默认值/非法值回退/写入失败；音乐/音效独立开关和音量；五类成功状态边沿各播放一次；无效请求、预读失败和 dirty guard 不播放；静音后无播放命令；播放拒绝、重播和卸载清理；音乐无资源时不请求或报错。
- **构建与静态检查**：运行目标测试、`npm run lint`、`npm run build` 与 `node scripts/check-doc-references.mjs`；最终交付前按影响范围运行 `npm run check`。
- **浏览器验收**：使用固定地址 `http://127.0.0.1:5164` 和 `ego-browser` 验证桌面及移动视口；覆盖设置卡打开/关闭、键盘操作、开本、关本、前后翻页、抽屉开合、静音、音量调整、刷新恢复、播放拒绝和 reduced-motion。浏览器自动化验证请求与布局，实际响度、音色和同步感仍需人工听觉验收。
- **持久化与恢复**：按最终确认策略验证刷新和重新打开页面后的音频开关、音乐音量、音效音量；清除对应站点偏好后回到确认的默认值。
- **成功标准**：五类动作音效不重叠、不会在失败意图上误播且与动画节奏一致；用户可以立即关闭音乐或音效并独立调节音量，刷新后偏好恢复；音乐资源缺省时不发起无效请求；加载或播放失败不阻断核心功能；所有素材许可和文档事实完整。

## 9. 待确认项与决策

1. **最终方案批准**：已决定采用音乐默认关闭/`30%`、音效默认开启/`60%`，两类偏好均写入 `localStorage`；设置入口页面级常驻，五类音效仅观察成功状态边沿。用户于 2026-08-25 11:51 CST 回复“执行”，构成方案批准。
2. **素材许可**：用户已明确要求把其提供的 4 条 MP3 纳入当前项目，但没有提供外部下载页、作者或许可名称。`SOURCE.md` 必须如实记录“用户提供并授权当前项目使用，公开再分发许可待补证”，不得声称已核验第三方许可；公开发布前需补证或替换。
3. **reduced-motion 策略**：仍播放动作音效，因为减少视觉运动不等同于静音；抽屉使用已经压缩的短音，本子与日期翻页保留素材原时长。用户可通过音效快捷开关立即关闭。
4. **后台与音乐**：本期没有音乐资源，不存在后台播放；控制器预留页面不可见时暂停、回来后续播的策略，随未来音乐素材接入任务验证。
5. **Sticker Forge 联动**：本期不改第三方 Sticker Forge 的局部 `sound`，音效设置只控制 Dear Desk 新增的五类音效；统一静音需在验证上游运行时接口后另立范围。

## 10. 最终批准方案

已于 2026-08-25 11:51 CST 批准。最终执行清单为：处理并导入 5 条音效；新增原生页面级音频控制器和版本化偏好；新增右上角双通道设置卡；绑定五类成功状态边沿；补齐单元/组件测试；使用 `$bun-html-docs` 同步架构 HTML，并同步产品文档、变更记录与素材来源记录；运行全量检查及桌面/移动浏览器验收。素材先按“用户授权当前项目使用、公开再分发许可待补证”纳入。

## 11. 实施记录

已按批准清单完成：

- `public/audio/` 新增开本、关本、日期翻页、抽屉打开和抽屉关闭 5 条 48 kHz 双声道 MP3。原始 Downloads 文件未改写；抽屉合并轨按静音区间拆分、压缩为 `0.462s` / `0.490s` 并加短淡入淡出。五条输出综合响度为 `-24.3` 至 `-24.5 LUFS`。
- `public/audio/SOURCE.md` 记录 4 条输入和 5 条输出的文件名、处理参数与 SHA-256，并明确外部作者、下载页和公开再分发许可待补证。
- `src/audio/audio-preferences.ts` 新增版本 1 偏好、音乐关闭/30% 与音效开启/60% 默认值、音量归一化、未知版本/JSON/Storage 失败回退。
- `src/audio/audio-controller.ts` 新增五类资源映射、每语义单播放器、重播归零、延迟关本声、最新静音检查、播放失败降级和卸载释放。浏览器验收发现 StrictMode cleanup 演练会让首版控制器永久 disposed，已改为偏好 effect 重放时重新激活并增加回归测试。
- `src/audio/AudioRuntime.tsx` 观察 `NotebookPhase`、`JournalTurnPhase` 与 `PastTracesPhase` 的成功状态边沿。关本按标准桌面约 `424ms`、紧凑视口约 `24ms`、reduced-motion `0ms` 延迟主要合拢声。
- `src/features/settings/AudioSettingsControl.tsx` 和 `src/app/App.tsx` 新增右上角双通道设置卡、开关、滑杆、百分比、点击外部/Escape 关闭与 `localStorage` 持久化；音乐没有资源时只维护偏好。移动端首次验收发现卡片覆盖 HUD，首次下移后又覆盖工具列，最终改为在音频按钮左侧展开并下移，三者互不重叠。
- `src/styles.css` 完成桌面/移动响应式布局；`src/test/setup.ts` 为 jsdom 补齐无声媒体方法 mock，不影响生产播放器。
- 新增偏好、控制器、状态边沿与设置组件测试，并扩展 App 持久化测试。没有新增依赖、IndexedDB schema、Zustand 音频状态、音乐资源、通用按钮音效或 Sticker Forge 联动。

### 11.1 后续背景音乐候选与生成提示词

本节只记录后续选材依据，不把音乐资源描述为当前实现。后续接入音乐必须另立任务，核验具体录音许可、循环接缝、综合响度、首次用户手势、页面隐藏后的暂停/恢复和最终听感；本次提交不包含背景音乐文件。

#### 开放录音来源

- [Open Goldberg Variations](https://opengoldbergvariations.org/)：Kimiko Ishizaka 演奏的巴赫《哥德堡变奏曲》BWV 988。项目官网明确说明录音与乐谱属于 public domain，下载页提供 MP3、WAV、AIFF 与 FLAC，并写明 “free of copyright (all uses allowed)”。
- [Open Well-Tempered Clavier](https://welltemperedclavier.org/index.html)：Kimiko Ishizaka 演奏的巴赫《平均律钢琴曲集》第一卷 BWV 846–869，项目提供免费公共领域录音与乐谱。
- [Musopen](https://musopen.org/music/)：收录多种许可的古典演奏录音。后续只能逐条选择明确标为 `Public Domain` 或 `CC0` 的录音；`CC BY` 需要按许可署名，`CC BY-NC` 不用于可能商业发布的项目。网站的 “royalty-free” 描述不能代替逐文件许可核验。

古典作品本身进入公版，不代表 Spotify、YouTube 或任意唱片录音可以复制进项目。后续下载必须来自原始发布页，并在 `public/audio/SOURCE.md` 或对应音乐来源记录中保存曲名、作曲者、演奏者、下载地址、下载日期、许可原文/截图和文件 SHA-256。

#### 候选曲目

| 方向 | 曲目 | 使用判断 |
| --- | --- | --- |
| 安静温暖 | 巴赫《哥德堡变奏曲：咏叹调》BWV 988 Aria | 当前首选；克制、温柔，Open Goldberg 有明确开放录音 |
| 安静温暖 | 巴赫《C 大调前奏曲》BWV 846 | 流动而稳定，Open Well-Tempered Clavier 有开放录音 |
| 安静温暖 | 萨蒂《Gymnopedie No. 1》 | 气质合适，但必须另找并核验具体录音许可 |
| 安静温暖 | 萨蒂《Gnossienne No. 1》 | 略带怀旧，旋律存在感高于巴赫候选 |
| 安静温暖 | 德彪西《Arabesque No. 1》 | 明亮细腻，但需要避免演奏动态过大 |
| 轻松欢快 | 巴赫《哥德堡变奏曲：Variation 1》 | 当前欢快方向首选之一；轻盈且已有明确开放录音 |
| 轻松欢快 | 巴赫《D 大调前奏曲》BWV 850 | 当前欢快方向首选；明亮、短促，已有开放录音 |
| 轻松欢快 | 莫扎特《C 大调第十六钢琴奏鸣曲》K.545 第一乐章 | 清晰欢快，但辨识度较高，可能抢占注意力 |
| 轻松欢快 | 佩措尔德《G 大调小步舞曲》BWV Anh.114 | 轻巧亲切；常被误署名为巴赫，来源记录需写佩措尔德 |
| 轻松欢快 | 舒曼《童年情景：异国和异国的人们》Op.15 No.1 | 温和活泼，需另找并核验具体录音许可 |

不优先使用《致爱丽丝》《月光奏鸣曲》《D 大调卡农》或《G 大调弦乐小夜曲》等高度熟悉的曲目：即使作品本身公版，也容易让用户注意音乐而不是桌面、纸页和动作音效。

#### Suno：温暖克制版

```text
Warm minimalist acoustic ambient for a cozy personal desk scene,
soft felt piano, delicate nylon-string guitar harmonics, subtle room tone,
slow and steady around 72 BPM, intimate and slightly nostalgic,
no vocals, no prominent drums, no dramatic melody, no vinyl crackle,
calm but not sleepy, sparse arrangement with space for paper and drawer sounds,
seamless background music loop
```

#### Suno：轻松欢快版

```text
Lighthearted and cheerful acoustic background music for a cozy personal desk scene,
gentle fingerpicked acoustic guitar, soft felt piano, warm marimba accents,
subtle brushed percussion and light hand percussion,
bright, relaxed and quietly playful, like organizing a desk on a sunny morning,
around 92 BPM, simple memorable motifs, warm organic textures,
calm enough for focused work, with plenty of space for page-turning and drawer sound effects,
instrumental, no vocals, no clapping, no whistling, no heavy drums,
no dramatic builds, no cinematic climax, no childish cartoon feeling,
clean production, consistent energy, designed for a seamless loop
```

若生成结果过于接近广告配乐，使用更克制的欢快备选：

```text
Cheerful minimalist acoustic ambient for a cozy desk application,
light fingerpicked nylon-string guitar, soft piano, delicate wooden percussion,
gentle steady pulse around 88 BPM, warm, fresh and quietly optimistic,
playful but restrained, focused and unobtrusive,
sparse arrangement, subtle melody, no vocals, no prominent drums,
no ukulele, no clapping, no whistling, no corporate advertising style,
no dramatic transitions or ending, seamless instrumental background loop
```

Suno 生成文件接入前还需保存生成日期、使用账号当时适用的条款/订阅权益、原始提示词、生成版本和下载文件哈希；本记录不对尚未生成的音乐作许可结论。

## 12. 验证结果

- **自动检查**：`npm run check` 通过；26 个测试文件、111 项测试全部通过，ESLint、TypeScript、Vite production build 与 `scripts/check-doc-references.mjs` 通过。构建只有既有大 chunk 警告。
- **音频资产**：FFmpeg 对 5 条输出完整解码无错误；均为 MP3、48 kHz、双声道，综合响度 `-24.3` 至 `-24.5 LUFS`，true peak 低于 `-2.6 dBTP`。输入/输出 SHA-256 已写入 `public/audio/SOURCE.md`。
- **桌面浏览器**：`ego-browser` 在 `1440 × 900` 验证单 Canvas、设置按钮与工具栈不重叠、卡片无横向溢出、默认值、开关、键盘滑杆、Escape 和刷新恢复。真实 `HTMLMediaElement.play()` 探针依次捕获 `drawer-open`、`drawer-close`、`notebook-open`、`notebook-close`、`page-turn`，五次 Promise 均 resolved。
- **静音与业务继续**：关闭音效后执行关本，页面回到 `desk` 且 play 探针为空；随后恢复开关。
- **移动浏览器**：`390 × 844`、DPR 2 下页面宽度等于视口、单 Canvas；最终卡片范围 `x=24..316`、时间 HUD 截止 `y=92`、工具栈从 `x=326` 开始，无彼此重叠，音乐 40%/音效 45% 偏好恢复且标签无裁切。
- **架构 HTML**：按 `$bun-html-docs` 直接打开本地文件，在 `1440 × 900` 与 `390 × 844` 验证声音章节、全文搜索成功/空态、ArrowDown/Enter/Escape、锚点/活动目录、复制、术语焦点卡、移动目录、内部代码横向滚动、无页面溢出、唯一文档首页组件及首页跳转。便捷截图在 `file://` 返回黑图，改用同一 Chromium 的 `Page.captureScreenshot` 后确认实际视觉正常。
- **人工边界**：Codex 只能验证播放调用、资源、响度指标和视觉同步时点，最终音色、响度舒适度、抽屉时间压缩听感仍需用户听觉验收。

## 13. 文档同步检查

- **产品文档**：已更新 `docs/product/mvp.md`，明确动作音效与“语音能力非目标”的边界、五类成功触发、双通道设置、持久化、音乐缺省、reduced-motion 和许可状态。
- **架构文档**：已使用 `$bun-html-docs` 更新 `docs/architecture/system-overview.html`，新增声音链路，并同步所有权、偏好存储、失败路径、源码地图与验证证据。
- **决策文档**：当前不新增 ADR。若最终引入跨标签页协调、远端串流、IndexedDB 音频资产或新的长期公共音频协议，再评估独立 ADR。
- **文档入口**：架构 HTML 仍使用现有唯一 `docs-home-navigation` 返回 `docs/index.html`，没有新增入口页面；浏览器跳转已验证。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-24 11:12 CST | Codex | 根据用户请求创建待确认需求记录；确定开本音效与全局背景音乐为目标，将 UI 音效范围、默认播放策略、控制粒度、持久化、后台策略、reduced-motion、素材和 Sticker Forge 联动列为待确认项。 |
| 2026-08-25 11:45 CST | 用户 / Codex | 用户提供 4 条音效并明确五类触发与右上角音乐/音效分控；Codex 核对实际文件、响度、抽屉静音分隔和源码状态边沿，收敛最终执行清单。等待用户批准默认值、reduced-motion 策略及素材可分发许可。 |
| 2026-08-25 11:51 CST | 用户 / Codex | 用户回复“执行”，批准最终执行清单。音乐默认关闭/30%，音效默认开启/60%，五类动作音效继续播放于 reduced-motion；4 条素材按用户授权纳入当前项目，公开再分发许可待补证。状态进入实施中。 |
| 2026-08-25 12:22 CST | Codex | 完成五条音效处理、原生控制器、五类状态边沿、双通道设置卡、偏好持久化、测试及产品/架构文档同步。浏览器验收发现并修复 StrictMode 永久静音与移动卡片两类重叠；111 项全量测试、lint、build、文档引用、音频解码、桌面/移动和五条真实播放探针通过。状态更新为待验收。 |
| 2026-08-25 16:01 CST | 用户 / Codex | 用户要求记录公版曲目、开放录音与 Suno 提示词，并明确提交音效系统、音乐文件后续补充。该提交指令构成预先验收授权；已批准范围、必要验证和文档回写均满足，任务状态更新为已完成并准备创建同一提交。 |
