# DD-20260823-007：探索记忆房间 Gaussian Splatting 背景

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已取消 |
| 类型 | 调研 |
| 创建时间 | 2026-08-23 18:40 CST |
| 最后更新 | 2026-08-24 17:58 CST |
| 当前阶段 | 用户已放弃该实验，并已验收历史记录保留与 DD-20260824-003 清理结果 |
| 源码基线 | `c200eec` |
| 实现提交 | 无（实验在提交前取消并清理；历史记录随本次提交归档） |
| 关联任务 | 用户希望尝试把当前纯色背景替换为低饱和、低清晰度、不可接近的“记忆里的房间” Gaussian Splatting 背景 |

> 用户已于 2026-08-23 明确回复“执行”，批准按本文推荐默认项实施。

> **取消说明：** 用户于 2026-08-24 确认该方向已经放弃，并要求删除全部相关源码。本文保留为历史试验与验证记录，不再描述当前可用能力；实际清理见 `DD-20260824-003`。

## 1. 给阅读者的结论

建议先实施一个可随时关闭的技术与视觉 PoC：保留当前程序化桌子、本子、贴纸、镜头和单一 WebGL Canvas，只在远景加入一个固定范围、低对比度的 Gaussian Splatting 房间，并用轻量房间壳作为首屏与失败回退。PoC 只回答“这种背景是否增强空间与光阴感，同时不抢走桌面焦点、不卡住移动端”三个问题，不在本次扩展为完整房间探索。

## 2. 用户需求

- 用户原始目标：尝试“记忆里的房间”方向，用 Gaussian Splatting 表现远处墙面、窗、书架和植物的模糊轮廓。
- 用户期待：前景程序化桌子继续清晰并拥有真实光照；背景降低饱和度、对比度与清晰度，使用景深；用户不能靠近背景；首屏先显示轻量房间壳，Splat 加载后柔和替换。
- Codex 解释：本次先做受控 PoC，不把 Gaussian Splatting 变成新的场景主角或自由探索能力。

## 3. 当前源码事实

- `src/app/App.tsx` 的 `ProductApp` 在普通桌面状态挂载 `DeskScene`，进入 Sticker Forge 制作状态时卸载桌面场景，继续遵守任意时刻单一活跃 WebGL Canvas 的既有决策。
- `src/scene/DeskScene.tsx` 使用 `@react-three/fiber` 的 `createRoot` 接管一个显式 Canvas，当前 renderer 为高性能 WebGL、开启抗锯齿和阴影，DPR 上限为 `1.5`，相机 far plane 为 `40`。
- `DeskContents` 当前用 `<color attach="background">` 和同色 fog 形成纯色远景；现有半球光、主方向光、补光与 `SceneEnvironment` 只服务程序化桌子、本子和贴纸。
- `CameraRig` 集中拥有桌面端和移动端 `far`、`front`、`near` 三组相机姿态。`FreeOrbitCamera` 已禁用平移和缩放并限制俯仰，但当前没有限制水平环绕角度，用户可围绕桌子转到房间未采集的一侧。
- `docs/product/mvp.md` 明确 Three.js 服务于空间记忆和时间沉积，并把自由走动、完整房间列为非目标；受控、不可接近的背景 PoC 不必改变这一产品边界。
- `docs/decisions/2026-08-06-002-local-first-data-and-scene-projection.md` 要求 Three.js 只做状态投影且未经批准不增加第二个 WebGL Canvas。本次背景不需要业务状态或持久化数据。
- 当前依赖包含 `three ^0.185.1`、`@react-three/fiber ^9.7.0`，不包含 Gaussian Splatting renderer、Drei 或后处理库。
- 2026-08-23 只读核对的候选依赖：`@sparkjsdev/spark 2.1.0` 为 MIT，peer dependency 是 `three >=0.180.0`，公开说明支持把 Splat 与 mesh 放进同一 Three.js rendering pipeline，并支持 PLY、compressed PLY、SPZ、SPLAT、KSPLAT 和 SOG。`@mkkellogg/gaussian-splats-3d 0.4.7` 更偏向自有 Viewer；`@react-three/drei 10.7.8` 虽与当前 React/R3F 兼容，但仅为一个 Splat 组件会引入较宽的传递依赖面。

合理推断：Spark 是当前最符合“复用现有 renderer、保留单 Canvas、直接融合 mesh”的候选，但真实 bundle 增量、R3F 生命周期、透明排序、移动端性能和资源释放仍必须通过 PoC 测量，不能仅凭包说明视为已验证。

## 4. 目标与非目标

### 4.1 目标

- 在现有单一 WebGL Canvas 内验证受控 Gaussian Splatting 远景。
- 提供轻量首屏回退、异步载入、柔和替换和失败回退。
- 保持桌面、本子、贴纸和 DOM 工作流的现有交互与视觉焦点。
- 给出桌面端和移动端可执行的性能与视觉验收门槛。

### 4.2 非目标

- 不实现自由走动、完整房间或可交互家具。
- 不允许相机靠近或穿入 Splat 背景。
- 不让 Splat 接管持久化数据、桌面物件或产品状态。
- 不在未确认素材来源、许可证和性能预算前发布生产默认背景。

## 5. 方案说明

建议采用开发态 A/B PoC，而不是直接替换生产默认背景：

1. 通过开发 URL 参数 `?memory-room=1` 开启；无参数页面继续呈现当前纯色背景。PoC 不增加新的常驻 UI、用户偏好或持久化字段。
2. 首帧立即渲染低成本 `MemoryRoomShell`：一面低对比墙、地面交界和窗光承接面。它负责加载前画面、失败回退和前景桌子的实时接影。
3. 在现有 R3F `gl` 与 scene 中只创建一个 `SparkRenderer`，异步加入一个 `SplatMesh`；不得使用会创建独立 renderer、camera 或 Canvas 的 Viewer 模式。
4. 首选使用本地、来源和许可证明确的 `.spz` 室内资产。资产只覆盖桌子后方的墙、窗、书架和植物，不包含人物、显示屏、镜面和作为前景主角的桌子；在编辑工具中裁掉漂浮点和靠近相机的无关区域。
5. 将 Splat 定位在程序化桌子后方，保留前景 mesh 的清晰材质与实时阴影。Splat 使用拍摄时的烘焙光照；PoC 的方向光固定为与素材一致的中性偏午后方向，不承诺对 Splat 做真实实时重光照。
6. 通过资产预处理、降低背景对比与饱和度、限制 Gaussian 数量和远景构图获得“记忆感”。首个 PoC 不引入全画面景深后处理；只有确认 Spark 能正确参与深度且性能仍有余量后，才在本任务已批准范围内尝试只让远景变软的深度景深，否则保留预处理柔化方案。
7. 资源加载完成后，用约 `600ms` 的背景 opacity/中性遮罩过渡完成替换；若当前 Spark API 不支持稳定的全局 alpha，则让房间壳保留为低对比基底，并仅淡出中性遮罩，不修改 Spark 私有 shader。
8. PoC 开启时把自由视角水平角度限制在当前桌面正面的约 `±20°`，继续禁止平移与缩放，避免用户进入采集盲区。无参数生产页面的既有自由视角不变。
9. 加载失败、WebGL2 不可用、资源超时或设备性能不满足门槛时，安静保留房间壳；日记和贴纸入口必须继续可用。

传统 Gaussian Splatting 的颜色与光照来自采集过程，无法直接支持连续的真实昼夜重光照。因此“本地时间驱动的清晨/黄昏/夜晚房间”不属于首个 PoC。后续若空间方向成立，可单独比较中性 Splat + 程序化窗光、多时段 Splat 切换或可重光照表示，不能把静态 Splat 写成已经具备光阴变化。

## 6. 预计改动与影响评估

- `package.json`、`package-lock.json`：精确加入 `@sparkjsdev/spark 2.1.0`，不引入 Drei 或另一个 Viewer；构建后记录真实 bundle 增量。
- `src/scene/DeskScene.tsx`：把开发参数和背景 profile 传入场景；保持现有 root、renderer、事件与生命周期所有权不变；PoC 开启时增加水平环绕边界。
- `src/scene/MemoryRoomBackdrop.tsx`：新增背景所有者，负责 Spark renderer、Splat mesh、异步加载、变换、释放、载入完成和错误回退。
- `src/scene/MemoryRoomShell.tsx`：新增轻量墙面、地面交界、窗光承接面和透明接影面；不承载业务交互。
- `src/scene/memory-room-profile.ts`：集中定义开发开关、素材 URL、变换、加载超时、淡入时间和能力回退，避免把试验常量散落在业务组件。
- `src/scene/memory-room-profile.test.ts`：覆盖参数解析、默认关闭、超时/能力回退和相机水平边界等纯逻辑。
- `public/rooms/memory-room/`：保存经裁剪压缩的 `.spz` 资产、`SOURCE.md`、许可证或使用授权说明；未确认许可的临时素材不得进入提交。
- `THIRD_PARTY_NOTICES.md`：记录 Spark 的版本、MIT 来源和房间资产来源。
- `docs/architecture/system-overview.html`：如 PoC 实际接入源码，使用 `$bun-html-docs` 同步单 Canvas 场景背景所有权、加载和失败链路。
- 本记录：回写真实依赖、资产、文件、bundle/性能、视觉验证和偏差。PoC 保持开发态时不把它写入 `docs/product/mvp.md` 的当前生产事实；若用户后续批准转为默认体验，另行更新产品范围。

### 6.1 核心数据结构变化

- 不修改 Zustand store、领域类型、IndexedDB schema 或用户偏好。
- 新增只读 `MemoryRoomProfile`，预计包含 `enabled`、`assetUrl`、`position`、`rotation`、`scale`、`loadTimeoutMs`、`fadeDurationMs` 和自由视角水平边界。
- `idle/loading/ready/failed` 仅存在 `MemoryRoomBackdrop` 的运行时生命周期中；刷新后从开发参数重新计算，不持久化。

### 6.2 上下游与跨模块影响

- 上游：`ProductApp` 和 URL 只决定是否启用 PoC，不持有 Spark 或 Three.js 对象。
- 场景：`DeskContents` 同时投影程序化桌子和背景；Spark 必须复用 `DeskScene` 已有的 renderer，并随 R3F scene 卸载释放 worker、buffer、mesh 和 renderer plugin。
- 相机：三个预设继续不变；只有 PoC 的自由环绕增加水平边界。
- 光照：程序化 mesh 继续响应现有光源；Splat 使用烘焙颜色，方向光只需在视觉上与其一致。
- Sticker Forge：进入制作状态仍卸载整个桌面 Canvas，因此 Spark 资源必须可靠释放，不能在后台保留第二个 WebGL 生命周期。
- DOM 日记、贴纸持久化和场景颜色编辑器不改变。颜色编辑器的 `background/fog` 对 Splat 不一定生效，PoC 开启时应明确由 background profile 接管远景色调，避免宣称编辑器能重着色 Splat。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 写实背景与轻拟物桌子割裂 | 素材曝光、透视、尺度或清晰度不匹配 | 画面像两层拼贴 | 先固定一个机位完成校准；降低 Splat 对比和饱和度；保留房间壳与接影面；不通过则关闭参数回退纯色 |
| 烘焙光照无法随时间变化 | 尝试实时改变 Splat 的太阳方向或色温 | 背景与桌面光照矛盾 | PoC 固定中性午后；动态光阴另立任务，不把色调覆盖冒充重光照 |
| 透明排序或深度不正确 | Splat 与桌腿、地面或景深后处理组合异常 | 漂浮、穿插、错误模糊 | 先把 Splat 限制为远景；使用简单接影 plane；不访问私有 shader；景深失败则回退预处理柔化 |
| 资产过大或解码阻塞 | Gaussian 数量或 SPZ 体积超预算 | 首屏迟缓、移动端掉帧或崩溃 | 目标资产不超过 `15 MB`；裁剪和压缩；异步载入；超时/低能力保持房间壳 |
| 自由视角暴露采集盲区 | 当前 OrbitControls 可水平环绕一整圈 | 看到空洞、背面和漂浮点 | PoC 开启时限制正面约 `±20°`；仍禁止平移与缩放 |
| 资源未释放 | 进入 Sticker Forge 或反复挂载场景 | worker、GPU buffer 或监听器泄漏 | 在组件 cleanup 中显式 dispose；反复进入/退出工作台验证 Canvas 和内存稳定 |
| 素材授权不清 | 使用网络样例或第三方扫描但没有再发布许可 | 无法提交或发布 | 只提交来源与许可证明确的本地资产；否则素材仅用于临时本地调研并从最终差异移除 |
| 依赖或 bundle 成本过高 | Spark 实际生产 bundle 远高于预期 | 影响所有用户下载 | 仅开发参数动态导入并记录 build 增量；不达门槛时删除依赖和 PoC 模块，保留本记录结论 |

## 8. 验证与验收

- 自动测试：运行新增 profile 单测和现有场景相关测试；验证默认关闭、开发参数开启、能力/超时回退以及相机边界纯逻辑。
- 构建与静态检查：运行 `npm run lint`、`npm test`、`npm run build`、`node scripts/check-doc-references.mjs`；比较启用依赖前后的生产 JS bundle，并确认无参数生产路径不会请求房间资产。
- 浏览器验收：按项目规则使用 `ego-browser` 访问固定地址 `http://127.0.0.1:5164`，分别在桌面与移动 viewport 验证无参数基线和 `?memory-room=1`；检查远处/正面/近处机位、受限自由视角、本子开合、桌面贴纸选择、进入/退出 Sticker Forge、资源加载成功与强制失败回退、控制台错误和 canvas 非空像素。
- 性能门槛：目标 `.spz <= 15 MB`；加载完成后的桌面相对纯色基线中位 frame time 回退不超过 `25%`，桌面测试机稳定不低于 `45 FPS`，移动端真实设备目标不低于 `30 FPS`。仅使用桌面浏览器的移动 viewport 不能冒充真实移动 GPU 结果，若没有真机则把该项记为未覆盖。
- 持久化与恢复：预计不适用；本次不新增持久化状态。
- 成功标准：程序化桌子仍是最清晰、最高对比的视觉焦点；房间能被感知但不能被探索；首屏和失败状态可用；现有核心操作无回归；资产、bundle 和 frame time 达到上述门槛。
- 失败标准：背景明显抢焦、透视/光照无法融合、任一核心流程失效、无法可靠释放资源，或必须新增第二个 Canvas 才能运行。命中任一项就关闭并移除 PoC 运行代码，不扩大范围救场。

## 9. 待确认项与决策

建议按以下默认项批准；其中任何一项改变都会影响范围或主要体验：

1. **素材路线**：先寻找一个明确允许本地 PoC 和仓库再分发的室内样例，验证技术链；通过后再用目标房间的自采素材替换。若找不到可再分发样例，在用户提供或授权自采素材前只完成代码壳与本地临时验证，不提交资产。
2. **入口**：只用开发参数 `?memory-room=1`，不增加用户可见开关、不改变生产默认背景。
3. **光照**：首个 PoC 固定中性偏午后，不做本地时间驱动的 Splat 重光照；前景方向光与素材方向对齐。
4. **景深**：先用资产预处理产生柔和远景；仅在 Spark 深度兼容和性能预算通过时尝试 depth-aware DOF，失败就不引入后处理依赖。
5. **自由视角**：PoC 开启时把水平环绕限制为正面约 `±20°`；无参数页面保持现状。
6. **依赖**：精确使用 `@sparkjsdev/spark 2.1.0` 作为首选；如果最小集成证明它不能稳定复用现有 renderer 或释放资源，暂停并回写结论，不自动换成自带 Viewer 的库。

## 10. 最终批准方案

2026-08-23 用户明确回复“执行”，批准第 5、6、8、9 节的推荐默认项。最终执行清单：

1. 以开发参数 `?memory-room=1` 启用，不改变默认产品页且不新增用户偏好。
2. 精确加入 `@sparkjsdev/spark 2.1.0`，复用现有 R3F renderer 和单一 Canvas。
3. 新增轻量房间壳、异步 Splat 背景、加载/失败回退和资源清理。
4. 使用来源与许可明确、体积不超过 `15 MB` 的本地 `.spz`；找不到可再分发资产时不提交未授权素材，并如实缩减为代码壳验证。
5. 固定中性偏午后光照；先通过资产预处理获得柔和远景，不强制引入景深后处理。
6. PoC 开启时将自由视角水平限制在正面约 `±20°`。
7. 添加聚焦测试，同步架构 HTML 与第三方说明，执行完整工程检查和 `ego-browser` 桌面/移动视觉验收。

## 11. 实施记录

已按批准清单完成开发态 PoC：

- `package.json`、`package-lock.json` 精确加入 `@sparkjsdev/spark 2.1.0`；`vite.config.ts` 把 Spark 排除出 Vite 开发依赖预打包，解决既有 `5164` 服务在安装新依赖后返回 `504 Outdated Optimize Dep` 的缓存问题。production build 仍将 Spark 拆成独立动态 chunk。
- `src/scene/memory-room-profile.ts` 集中拥有 `?memory-room=1` 开关、资产地址、600ms 淡入、8 秒超时、0.74 目标透明度和正面约 `±20°` 的相机边界；production 无论查询参数为何都保持关闭。
- `src/app/App.tsx` 只在初始化时解析 profile，并把稳定对象传入 `DeskScene`；没有新增用户偏好、store 字段或持久化数据。
- `src/scene/MemoryRoomShell.tsx` 新增低成本墙面、程序化地面、窗面和窗光承接面，负责首帧、接影和失败状态。
- `src/scene/MemoryRoomBackdrop.tsx` 在现有 R3F `WebGLRenderer` 和 scene 中动态创建 `SparkRenderer` 与 `SplatMesh`；WebGL2 不可用、超时或载入异常时保留 shell；ready 后淡入 Splat；卸载时移除并 dispose mesh 和 Spark renderer。
- `src/scene/DeskScene.tsx` 只在 profile 开启时挂载背景；实验自由视角围绕当前预设机位限制水平角度，三个既有相机预设不变。
- `scripts/generate-memory-room.mjs` 以固定 seed 生成项目自有 SPZ；`public/rooms/memory-room/memory-room.spz` 当前包含 `13,086` 个远墙 Gaussian，大小 `118,594` bytes，SHA-256 为 `7fb0535ff604352780fba56a7f447d1a97516d1e46bc61ede54796898371de0e`。Splat 只保留窗、远处树影、书架、书、植物与墙面；初版 Gaussian 地面因与桌腿交叠产生毛边，已删除，地面与接影由 shell 负责。
- `public/rooms/memory-room/SOURCE.md` 明确资产是项目代码生成而非真实扫描或第三方图片，并给出再生成命令；`THIRD_PARTY_NOTICES.md` 增加 Spark MIT 来源与用途。
- `src/scene/memory-room-profile.test.ts` 覆盖默认关闭、开发参数启用、production 强制关闭和相机边界中心。
- `docs/architecture/system-overview.html` 按 `$bun-html-docs` 规则同步单 Canvas 所有权、静态烘焙光照、加载/失败/释放链路、源码地图、bundle 成本和验证边界。

与预计方案的实现细化：没有提交来源不明的室内样例，而是直接生成可审计的 Dear Desk 自有 SPZ；这仍满足“本地、来源和许可证明确”的批准边界。没有引入额外后处理库或全屏 depth-aware DOF，远景柔化由资产尺度、低对比配色和 Spark `blurAmount` 完成。没有修改 `docs/product/mvp.md`，因为该体验仍只存在开发参数下，不是 production 默认产品事实。

## 12. 验证结果

- `npm run lint`：通过。
- `npm test`：通过，21 个测试文件、94 项测试全部成功。
- `npm run build`：通过。主入口约 `1,205.99 kB / 342.81 kB gzip`；Spark 独立动态 chunk 约 `5,052.48 kB / 1,805.76 kB gzip`。Vite 继续报告大 chunk 警告；默认页面浏览器证据确认没有 Spark 或 SPZ 请求。
- `node scripts/check-doc-references.mjs`：通过。
- `git diff --check`：通过。
- `npm audit --omit=dev --json`：4 个 high、0 critical，全部来自既有 `@huggingface/transformers -> onnxruntime-node / sharp / adm-zip` 链且无可用自动修复；Spark 没有出现在漏洞链。
- SPZ 生成：`node scripts/generate-memory-room.mjs public/rooms/memory-room/memory-room.spz` 成功，输出 13,086 splats、118,594 bytes。
- `ego-browser` 桌面 `1470 × 923`：实验页实际显示模糊窗、树影、书架和植物，程序化桌子仍是最清晰焦点；单 Canvas、零横向溢出；受限自由视角可用；打开本子会退出自由视角并进入 `editing`；进入 Sticker Forge 后只剩 Forge Canvas，返回时 Splat 正常重建。
- `ego-browser` 移动 `390 × 844`、DPR 2：单 Canvas、零页面和 body 横向溢出，顶部工具与底部动作无重叠，Gaussian 远景不遮挡本子与桌垫。
- 失败回退：第一次 CDP 网络拦截未命中 Spark 内部读取，因此不计证据；随后临时改名 SPZ 并访问带 cache buster 的实验页，真实 404 后背景进入 failed，仍保留一个 Canvas、“打开本子”和零横向溢出，验证后在同一受控流程中恢复原文件。
- 性能：同一 ego-browser 环境的纯色基线为约 `33.3ms` 中位 frame time / `30.03 FPS`，实验页为约 `33.4ms` / `29.94 FPS`，相对回退约 `0.3%`，通过不超过 25% 的相对预算。该环境把两页共同限制在约 30Hz，无法证明绝对 `45 FPS` 桌面目标；没有真实移动 GPU，移动端 `30 FPS` 真机门槛仍未覆盖。
- 架构 HTML 直接 `file://` 验证：桌面与 `390 × 844` 移动端均无页面级横向溢出；搜索成功/空态、ArrowDown、Enter、Escape、锚点偏移、active 导航、移动目录、复制、Wiki hover/focus/click和唯一文档首页入口均通过，首页入口实际到达 `docs/index.html`。

## 13. 文档同步检查

- 产品文档：未修改；PoC 仅由开发参数开启，production 默认体验仍是纯色背景，不能写成已发布产品事实。
- 架构文档：已更新 `docs/architecture/system-overview.html`，覆盖场景所有权、加载、失败、释放、源码地图与验证边界。
- 决策文档：未修改；当前没有改变单 Canvas、本地优先或场景投影长期决策。若后续转为 production 默认背景，需要评估新的资产、性能和静态光照 ADR。
- 文档入口：未修改 `docs/index.html`；本次是既有架构页的事实更新和一份 Markdown 任务记录，没有新增独立 HTML 文档入口。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-23 18:40 CST | Codex | 创建待确认方案，尚未修改业务源码、依赖或工程配置。 |
| 2026-08-23 18:51 CST | Codex | 完成源码、产品、架构决策和候选依赖只读核对；建议开发参数启用的单 Canvas Spark + SPZ PoC，并记录静态 Splat 不可真实重光照的边界。 |
| 2026-08-23 18:55 CST | 用户、Codex | 用户回复“执行”，批准推荐方案；记录更新为实施中。 |
| 2026-08-23 20:35 CST | Codex | 完成单 Canvas Spark PoC、自有 SPZ、失败回退、相机限制、测试、构建、双视口浏览器验收与文档同步；状态更新为待验收。 |
| 2026-08-24 17:06 CST | 用户 / Codex | 用户确认方案已经放弃并要求清理；状态更新为已取消，运行时代码、依赖、测试、脚本和资产由 DD-20260824-003 删除。 |
| 2026-08-24 17:58 CST | 用户 / Codex | 用户确认高斯泼溅历史记录与放弃后的清理均已验收，并明确要求提交；本记录保持“已取消”，随清理结果一并归档。 |
