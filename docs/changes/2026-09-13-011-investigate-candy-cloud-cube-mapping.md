# DD-20260913-011：修正 Candy Cloud 四墙连续映射

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 修复 |
| 创建时间 | 2026-09-13 00:00 CST |
| 最后更新 | 2026-09-13 20:20 CST |
| 当前阶段 | 已实施并经用户验收 |
| 源码基线 | `001bca36d99d86645a38329c435deccc5c201bf2` |
| 实现提交 | 本次提交 |
| 关联任务 | 修正 Candy Cloud 像天空盒一样跨四面墙连续显示 |

> 本轮已废弃工作树中“旧 cube-net 翻转补丁”和“未闭合 panorama 周长映射”的错误尝试，按用户批准的修复方案重新实施。

## 1. 给阅读者的结论

当前 Candy Cloud 不连续的直接根因是墙面 UV 的周长分段顺序与房间几何方向不一致。代码把片段按“西、北、东、南”排列，但墙体的实际连续方向是“西、南、东、北”；结果是每个墙角都把纹理接到了错误的下一面墙。

正确结果应是一张真正可闭环的连续墙面图，沿房间真实周长映射到四面墙。房间不需要改成正方形：当前宽 `42`、深 `33`，四面墙高均为 `18`，这些尺寸与桌子、窗洞和机位绑定，保持不变。

## 2. 用户需求

用户要求放弃之前无效的 Candy Cloud 方案，定位对应的概念效果，并真正解决四面墙贴图不能连接的问题。用户期待的是类似天空盒的连续空间图案：墙角处图案自然延续，不是四张独立图片拼接。

Codex 对需求的解释：本轮只修正墙面映射和必要的墙纸资源，不扩大为自由房间、通用天空盒系统或墙体尺寸重构。

## 3. 当前源码事实

- 房间入口为 `DeskContents -> StudyRoomShell -> createStudyRoomShellModel`；主题由 `src/domain/wallpaper-theme.ts` 定义，当前墙纸选择仍由 `localStorage` 保存。
- `src/scene/models/model-specs.ts` 的室内尺寸为 `width: 42`、`depth: 33`；墙底 `-5.025`、墙顶 `12.975`，墙高为 `18`。
- 当前工作树把旧 `candy-cloud-cube-net.png` atlas 字段和新增 `candy-cloud-panorama.png` 全景字段同时保留。运行时优先采样 panorama，因此旧 atlas 的 layout/翻转配置在该路径下是无效残留。
- 当前 `create-study-room-shell-model.ts` 使用四段 U 区间：西 `0..33/150`、北 `33/150..75/150`、东 `75/150..108/150`、南 `108/150..1`。但几何顶点方向为：西北→西南、南东→南西、东南→东北、北西→东北。按空间连接关系，连续顺序应为西→南→东→北。
- 北墙有窗洞，被拆成四块几何，但总长仍为 `42`；窗洞不应让 UV 在面板边缘重新开始。
- 已找到的概念资源是 `docs/assets/concepts/simple-study-room-shell-reference-pack/00-primary-perspective.png` 和 `01-top-plan.png` 等房间壳体参考，没有单独的 Candy Cloud 概念图。`candy-cloud-cube-net.png` 是旧贴图资源，不是连续概念图；`candy-cloud-panorama.png` 是当前工作树新增资源，左右边缘没有形成可靠闭环。
- 当前相关工作树文件：`src/domain/wallpaper-theme.ts`、`src/scene/SceneColorEditor.tsx`、`src/scene/models/create-study-room-shell-model.ts`、`src/scene/models/model-factories.test.ts`、`docs/product/mvp.md`、`docs/architecture/study-room-shell.md` 和新增墙纸资源。它们属于此前错误尝试，待批准后整体清理，不在其上继续叠加补丁。

### 合理推断

即使只修正 UV 顺序，当前 panorama 在首尾接缝处仍可能出现断裂，因为资源左右边缘本身不是同一连续图案。要达到用户描述的天空盒效果，运行资源必须同时满足“面顺序正确”和“首尾可闭环”。

## 4. 目标与非目标

### 4.1 目标

- 让 Candy Cloud 沿四面墙真实周长连续映射，并在四个墙角保持图案方向和位置连续。
- 使用一张首尾闭环的连续墙纸资源；不再依赖旧的五格 cube-net 拼接。
- 保持房间 `42 × 33 × 18`、窗洞、桌子、相机、贴纸和持久化行为不变。
- 删除旧 atlas 在运行时不再需要的配置和无效工作树改动。
- 为墙面顺序、尺寸和北墙窗洞连续 UV 增加最小自动测试，并同步产品/架构事实。

### 4.2 非目标

- 不把房间改成正方形，不调整墙高。
- 不新增第二个 WebGL Canvas、自由走动、通用天空盒 API 或主题商城。
- 不改变墙纸选择入口、主题 ID、`localStorage` key、贴纸系统或其他场景材质。

## 5. 方案说明

本次已按以下最小方案实施：

1. 保留 Candy Cloud 主题入口，但删除旧 cube-net atlas 的运行时定义与分支。
2. 使用一张真正首尾可闭环的横向连续墙纸资源。资源的水平图案代表房间内周长，垂直方向代表统一墙高。
3. 按实际几何连接顺序分配 UV：西 `0..33/150`、南 `33/150..75/150`、东 `75/150..108/150`、北 `108/150..1`；北墙四个窗洞面板共享北墙统一区间。
4. 为四墙尺寸、墙高、UV 顺序和窗洞连续性保留一个目标测试；资源边缘用静态检查或图像尺寸/边缘证据验证。

选择该方案是因为问题在共享的墙体投影层，而不是每个调用方。一次修正墙体几何和资源定义即可覆盖所有墙面，避免在四面墙分别补偿。

## 6. 预计改动与影响评估

- `src/domain/wallpaper-theme.ts`：保留 `plain`/`candy-cloud` 主题和现有存储契约，移除不再使用的 cube-net atlas 元数据，指向闭环连续资源。
- `src/scene/models/create-study-room-shell-model.ts`：修正四墙连续 UV 的面顺序；保留北墙窗洞按整墙区间映射；保留顶面为暖象牙色，不把墙纸错误延伸到天花板。
- `src/scene/models/model-factories.test.ts`：将断言改为真实连续顺序，并覆盖统一墙高、`42 × 33` 长度和北墙窗洞区间。
- `public/assets/wallpapers/candy-cloud-panorama.png`：替换为首尾闭环的连续墙纸资源；旧 `candy-cloud-cube-net.png` 不再作为运行时资源。
- `docs/product/mvp.md`、`docs/architecture/study-room-shell.md`：删除旧 cube-net 当前事实，写明四墙闭环全景映射和真实房间尺寸。
- `docs/changes/2026-09-13-011-investigate-candy-cloud-cube-mapping.md`：持续记录批准、实施、验证和待验收结果。

### 6.1 核心数据结构变化

不改变 `WallpaperThemeId`、`localStorage` key、贴纸数据、IndexedDB 或任何公共业务状态。仅删除墙纸主题内部不再使用的 atlas 描述字段，主题资源仍是静态 public asset。

### 6.2 上下游与跨模块影响

调用链仍为 `ProductApp -> DeskScene -> DeskContents -> StudyRoomShell -> createStudyRoomShellModel`。仅影响房间墙面材质与几何 UV；墙纸选择 UI 继续复用现有 `SceneColorEditor`，桌面、窗框、地板、墙贴和相机不受影响。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 全景首尾不闭合 | 资源边缘颜色/图案不匹配 | 起始墙角仍有断缝 | 使用首尾闭环资源并做边缘验证；失败时不交付视觉通过 |
| 墙面方向反转 | UV 顺序或某面顶点方向再次混用 | 图案镜像或墙角错接 | 用四面真实顶点方向写断言，统一按西→南→东→北验证 |
| 误改房间尺寸 | 为了让贴图“看起来相等”调整模型 | 桌子、窗洞、机位关系回归 | 尺寸测试固定 `42 × 33`、墙高 `18` |
| 保留无效 atlas 逻辑 | 旧字段继续被误用 | 后续维护再次回到错误方案 | 本轮删除运行时 atlas 分支和对应测试/文档描述 |

## 8. 验证与验收

- 自动测试：目标模型测试、墙纸主题测试和全量测试。
- 构建与静态检查：`npm run lint`、`npm run build`、`node scripts/check-doc-references.mjs`、`git diff --check`。
- 浏览器验收：本轮用户明确关注视觉连续性；实施后需检查 Candy Cloud 的四个墙角和至少两个自由视角。若无法执行浏览器验收，记录未覆盖范围，不写成通过。
- 持久化与恢复：主题选择契约不变，至少保留现有主题刷新恢复测试/检查。
- 成功标准：四墙真实尺寸不变；顺着任一墙角观察时，云层、星星和装饰图案连续跨墙；无旧 atlas 运行时分支或无效配置。

## 9. 待确认项与决策

已确认执行“清理当前错误改动 + 修正真实周长 UV + 更换为首尾闭环连续资源”这一整套方案。无需调整四面墙为等宽，也无需调整高度。

## 10. 最终批准方案

用户于 2026-09-13 17:00 CST 回复“批准”。执行清单为：清理错误工作树改动、准备闭环资源、修正墙面 UV、更新测试与文档、运行目标/全量验证并将状态改为“待验收”。

## 11. 实施记录

- 回退旧 cube-net 翻转和未闭合 panorama 工作树改动。
- `src/domain/wallpaper-theme.ts` 删除 atlas 字段，Candy Cloud 改为引用 `candy-cloud-panorama.png`。
- `src/scene/models/create-study-room-shell-model.ts` 按真实房间周长映射四面墙；西/南/东/北区间为 `0..33/150`、`33/150..75/150`、`75/150..108/150`、`108/150..1`，并修正东墙/北墙的顶点 U 方向。
- `src/scene/SceneColorEditor.tsx` 将预览卡片改为连续 panorama。
- `src/scene/models/model-factories.test.ts` 更新连续周长、墙高、窗洞面板和顶面不贴墙纸断言。
- `public/assets/wallpapers/candy-cloud-panorama.png` 使用 imagegen 生成首尾闭环横向 Candy Cloud 资源。
- 根据用户反馈，以旧 `candy-cloud-cube-net.png` 为风格参考重新生成 `candy-cloud-panorama.png`；保留原粉色/蓝绿色/紫色云层、星星和糖果装饰，仅改变为连续全景布局。
- 用户继续反馈墙角存在细小突出结构；确认其来源为 `createStudyRoomShellModel` 生成的四个 `study-room-corner-*` 封边柱，已删除该几何、节点字段和无用的 `wallThickness` 配置。
- 用户再次确认墙角仍有错位；核对后确认采样区间完整，问题在全景资源的首尾边缘不一致。已保留旧风格并对当前 panorama 做确定性水平无缝处理。
- 用户确认资源应按“左墙→前墙→右墙→后墙→左墙”卷曲闭环；已按该顺序重做资源，并让运行时使用 `THREE.RepeatWrapping`。
- 用户提供最新截图后要求继续核对采样逻辑；已确认四面墙原先各自 clone panorama，现改为四墙共享同一个 `THREE.Texture`，避免墙面之间出现纹理对象状态差异。
- 产品与架构文档删除旧 cube-net 当前事实并写回真实尺寸与连续映射规则。

## 12. 验证结果

- 目标测试：2 个文件、18 项通过。
- 全量测试：32 个文件、137 项通过。
- `npm run lint`：通过。
- 全景边缘检查：左右边缘逐像素 RMSE 为 `0`，资源尺寸保持 `2172×724`。
- 四墙闭环资源最终尺寸：`2148×732` PNG；左右边缘逐像素 RMSE 为 `0`。
- `npm run build`：通过；仅有项目既有大 chunk 输出，无新增失败。
- `node scripts/check-doc-references.mjs`：通过。
- `git diff --check`：通过。
- 资源复核：当前 `candy-cloud-panorama.png` 为 `2148×732` PNG，当前映射代码和四墙 UV 未改变。
- 墙体目标测试：`model-factories.test.ts` 16 项通过。
- `npm run lint`：通过。
- 统一纹理采样后目标测试：`model-factories.test.ts` 16 项通过；四面墙 map 引用相同纹理对象。
- 浏览器视觉验收：未执行；本轮按项目默认规则未启动浏览器，用户仍需验收四个墙角的实际画面。

后续用户已确认修复结果正常，并明确要求创建提交。

## 13. 文档同步检查

- 产品文档：已更新 Candy Cloud 为首尾闭环全景四墙映射。
- 架构文档：已更新资源、周长 UV 顺序、墙高和顶面不贴墙纸事实。
- 决策文档：不新增长期架构决策。
- 文档入口：`node scripts/check-doc-references.mjs` 已通过。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-09-13 16:30 CST | Codex | 复核当前工作树，确认旧 atlas 翻转与未闭合 panorama 是两套错误尝试；定位真实 UV 根因，确认房间为 `42 × 33 × 18`，墙高已统一，不需要调整。 |
| 2026-09-13 17:00 CST | 用户 | 批准清理错误改动、修正真实周长 UV 并使用首尾闭环连续资源。 |
| 2026-09-13 17:25 CST | Codex | 完成实施与自动验证，任务进入待验收；浏览器视觉验收留待用户确认。 |
| 2026-09-13 17:40 CST | 用户 | 指出首版连续资源风格偏离旧 Candy Cloud，要求按旧墙纸样式重做。 |
| 2026-09-13 17:40 CST | Codex | 以旧 cube-net 作为风格参考重新生成连续 panorama 并替换项目资源，未改变映射代码。 |
| 2026-09-13 17:52 CST | 用户 | 反馈墙与墙连接处仍有细微错位，并要求删除墙角突出细小结构。 |
| 2026-09-13 17:58 CST | Codex | 确认错位主要来自 panorama 首尾边界采样差异；删除四个墙角封边柱及无用配置，目标测试和 lint 通过。 |
| 2026-09-13 18:15 CST | 用户 | 要求执行全景接缝修复。 |
| 2026-09-13 18:15 CST | Codex | 保留旧 Candy Cloud 风格，对 panorama 做确定性水平无缝处理；左右边缘 RMSE 为 0。 |
| 2026-09-13 18:50 CST | 用户 | 明确要求按四面体连续首尾相接设计墙纸，并在墙纸运行时正确应用。 |
| 2026-09-13 18:55 CST | Codex | 按左→前→右→后顺序重做连续资源，启用 `RepeatWrapping`，目标测试 16 项和 lint 通过。 |
| 2026-09-13 19:08 CST | Codex | 根据最新截图继续排查，将四面墙的独立 panorama clone 合并为共享纹理对象，并补充共享 map 断言；目标测试和 lint 通过。 |
