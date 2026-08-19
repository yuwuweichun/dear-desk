# DD-20260819-005：铭牌刻字颜色视觉对比

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待验收 |
| 类型 | 视觉评审 / 3D 材质 |
| 创建时间 | 2026-08-19 18:00 CST |
| 最后更新 | 2026-08-19 18:50 CST |
| 当前阶段 | 用户已验收；等待 Git 索引权限恢复后创建提交 |
| 源码基线 | 当前工作树，未创建提交 |
| 实现提交 | 尚未创建 |
| 关联任务 | 用户要求将候选刻字颜色逐一替换并截图汇总到一个文档 |

## 1. 给阅读者的结论

本次生成五种刻字颜色的统一近景截图：纯黑、深咖啡铜、深青铜、暗酒红、深铜棕。截图使用同一铭牌文字、镜头、光照和字体，仅替换刻字颜色，便于直接比较。

## 2. 用户需求

- 将候选颜色逐一应用到铭牌刻字。
- 每种颜色生成视觉截图。
- 将所有结果放到一个文档中供选择。

## 3. 当前源码事实

- `src/scene/nameplate-text.ts` 使用暖金色材质和 Canvas 刻字纹理。
- 本次增加 `nameplate-color` 查询参数，仅用于视觉评审，不进入用户设置或 IndexedDB。
- 默认颜色保持深咖啡铜推荐值。

## 4. 目标与非目标

### 4.1 目标

- 生成五张同构桌面近景截图。
- 在 Markdown 文档中展示颜色代码、观察说明和截图。

### 4.2 非目标

- 不增加用户可选颜色设置。
- 不改变默认颜色、持久化模型或铭牌输入流程。

## 5. 方案说明

颜色通过 URL 查询参数注入场景投影，截图完成后产品默认仍为深咖啡铜。这样可以隔离视觉评审，不把临时方案变成公共数据模型。

## 6. 预计改动与影响评估

| 文件 | 责任 |
| --- | --- |
| `src/scene/nameplate-text.ts` | 增加评审色板和查询参数解析 |
| `docs/reviews/2026-08-19-nameplate-color-comparison.md` | 汇总五种截图和选择建议 |
| `docs/assets/nameplate-color-comparison/` | 保存浏览器截图 |

### 6.1 核心数据结构变化

无持久化变化；评审参数只读取 `window.location.search`。

### 6.2 上下游与跨模块影响

仅影响场景文字材质颜色，文字纹理、位置、字体和铭牌基座保持一致。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 评审参数误入产品配置 | 用户复制带参数 URL | 临时改变截图颜色 | 未传参数时固定深咖啡铜，参数不写入 store/数据库 |

## 8. 验证与验收

- 浏览器验收：桌面近景五种颜色均完成 1920×1050 截图，并从相同坐标生成铭牌局部图。
- 文档检查：截图路径有效；工程与文档引用检查结果见第 12 节。
- 成功标准：用户能在单文档中并列比较颜色并选择最终方案。

## 9. 待确认项与决策

颜色对比文档已由用户验收；最终产品颜色仍可在后续独立选择中确定，本任务不擅自固化新的默认色。

## 10. 最终批准方案

已批准生成对比截图；最终产品颜色待用户选择。

## 11. 实施记录

已实施：`src/scene/nameplate-text.ts` 增加五组评审色板，并通过只读 URL 查询参数 `nameplate-color` 选择截图颜色；无参数、无效参数和服务端环境均回退到深咖啡铜。参数没有进入 store、IndexedDB 或铭牌设置模型。

使用同一文字“我的本子”、同一近处机位、光照和玄冬楷书，生成五张 1920×1050 完整截图以及五张相同坐标的局部裁切图。汇总结果写入 `docs/reviews/2026-08-19-nameplate-color-comparison.md`。

实际文件：

- `src/scene/nameplate-text.ts`
- `docs/reviews/2026-08-19-nameplate-color-comparison.md`
- `docs/assets/nameplate-color-comparison/black.png` 与 `black-detail.png`
- `docs/assets/nameplate-color-comparison/espresso.png` 与 `espresso-detail.png`
- `docs/assets/nameplate-color-comparison/bronze.png` 与 `bronze-detail.png`
- `docs/assets/nameplate-color-comparison/oxblood.png` 与 `oxblood-detail.png`
- `docs/assets/nameplate-color-comparison/copper.png` 与 `copper-detail.png`

## 12. 验证结果

ego-browser 桌面验证已完成：五种参数均在 1920×1050 视口打开，页面正常渲染，字体和铭牌可见，截图构图一致；另生成相同坐标的局部裁切用于阅读。工程验证全部通过：`npm run lint`、`npm test`（17 个测试文件、70 项测试）、`npm run build`、`node scripts/check-doc-references.mjs`、`git diff --check`。

## 13. 文档同步检查

- 产品文档：本次没有把候选色写成最终产品决策；最终颜色选择后再更新默认铭牌颜色事实。
- 架构文档：无架构变化。
- 决策文档：最终颜色若成为长期约束再补充。
- 文档入口：颜色确定后视需要加入。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-19 18:00 CST | 用户 | 要求逐一应用候选颜色并生成统一对比文档。 |
| 2026-08-19 18:30 CST | Codex | 完成五组评审色板、统一截图、局部裁切和 Markdown 对比文档，等待用户选择最终颜色。 |
| 2026-08-19 18:45 CST | 用户 | 明确回复“已验收”，并要求创建一次提交。 |
| 2026-08-19 18:50 CST | Codex | Git `index.lock` 写入权限申请被执行环境拒绝（授权服务 404）；未创建提交，状态保留为待验收。 |
