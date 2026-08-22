# DD-20260821-004：移除云峰晶晶体并加入志莽行书

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 / 字体资源 / 许可证 |
| 创建时间 | 2026-08-21 23:40 CST |
| 最后更新 | 2026-08-23 02:05 CST |
| 当前阶段 | 实施、验证和提交前预先验收均已完成 |
| 源码基线 | Git `d3d4594`；工作区已有文档状态回写，未修改业务源码 |
| 实现提交 | 本次提交（由 Git 记录） |
| 关联任务 | 删除开发环境云峰晶晶体，加入 Google Fonts 的 Zhi Mang Xing / 志莽行书 |

> 用户于 2026-08-22 明确批准本方案；以下记录进入实施阶段。不会修改日记正文或持久化数据。

## 1. 给阅读者的结论

云峰晶晶体目前只在开发环境菜单中出现，来源和软件嵌入授权不稳定，不应继续保留。志莽行书来自 Google Fonts 的 OFL 目录，上游同时提供字体文件和 `OFL.txt`，许可证允许将字体随网页或软件嵌入、打包和再分发，只需保留版权声明及许可证文本。

批准后，生产日记字体菜单将保留纸页宋体、玄冬楷书、随峰体，并新增志莽行书；开发环境不再额外显示云峰晶晶体。默认字体仍为纸页宋体，已有 `jingjing` 偏好安全回退到默认值，日记正文和数据结构不变。

## 2. 用户需求

### 用户原始要求

- 删除云峰晶晶体。
- 添加 [Google Fonts 志莽行书](https://fonts.google.com/specimen/Zhi+Mang+Xing)。
- 确认该字体是否可以放入网页。

### Codex 对需求的解释

- 将志莽行书作为生产日记字体选项，而不是替换全局 UI 字体。
- 使用 Google Fonts 上游 `google/fonts/ofl/zhimangxing` 的 `ZhiMangXing-Regular.ttf` 和 `OFL.txt`，不依赖运行时 Google Fonts CDN。
- 默认值继续为 `paper`，不改变日记正文或 IndexedDB。

## 3. 当前源码事实

- `src/domain/journal-font.ts` 当前定义 `paper | jingjing | xuandong | suifeng`；`jingjing` 是云峰晶晶体，`suifeng` 是随峰体。
- `src/features/journal/JournalPanel.tsx` 生产环境过滤 `jingjing`，开发环境额外显示它，并动态注入 `/dev-fonts/YunFengJingJingTi-Regular.ttf`。
- `vite.config.ts` 只在开发服务器暴露 `dev-assets/fonts/YunFengJingJingTi-Regular.ttf`。
- `src/styles.css` 有 `jingjing`、`xuandong`、`suifeng` 三个日记字体选择器和预览规则。
- `src/domain/journal-font.test.ts` 使用 `jingjing` 验证不可用字体回退；`src/features/journal/JournalPanel.test.tsx` 当前断言开发菜单显示云峰晶晶体。
- Google Fonts 上游目录 [`ofl/zhimangxing`](https://github.com/google/fonts/tree/main/ofl/zhimangxing) 包含 `ZhiMangXing-Regular.ttf`、`OFL.txt`、`METADATA.pb` 和 `upstream_info.md`。
- 上游 `METADATA.pb` 标记 `license: "OFL"`、设计者 `Wei Zhimang`、字体版本文件 `ZhiMangXing-Regular.ttf`，覆盖 `chinese-simplified` 和 `latin`。
- 上游 `OFL.txt` 为 SIL Open Font License 1.1，明确允许字体随软件 bundled、embedded、redistributed；再分发必须同时保留版权声明和许可证。

## 4. 目标与非目标

### 4.1 目标

- 删除云峰晶晶体的开发字体资源、开发路由、动态注入、菜单项和相关测试断言。
- 新增志莽行书生产字体资源、OFL 许可证文本、来源记录和稳定字体 ID。
- 让志莽行书同时作用于日记 textarea、只读正文和字体预览菜单。
- 保持已有字体偏好、正文、IndexedDB 和默认字体兼容。

### 4.2 非目标

- 不替换全局 UI 的 Nunito / Noto Sans SC。
- 不改变纸页宋体、玄冬楷书或随峰体的默认顺序与许可证事实。
- 不新增用户上传字体、远端 CDN 加载、字体子集化或字体格式转换。
- 不改变 `DailyEntry`、IndexedDB、`localStorage` 键或日记交互入口。

## 5. 方案说明

将志莽行书按现有生产字体资源模式放入 `public/fonts/`，新增 `@font-face` 和 `data-journal-font="zhimang"` 样式。将 `jingjing` 从稳定可用 ID 列表和菜单元数据删除；读取历史 `jingjing` 偏好时因值不再被识别而回退 `paper`。删除开发 Vite 中间件和资源文件，确保生产和开发都不再请求云峰晶晶体。

## 6. 预计改动与影响评估

- `public/fonts/ZhiMangXing-Regular.ttf`：新增 Google Fonts 上游字体文件。
- `public/fonts/ZhiMangXing-OFL.txt`：保存上游 OFL 1.1 许可证原文。
- `public/fonts/ZhiMangXing-SOURCE.txt`：记录 Google Fonts、GitHub 上游、版本、设计者、覆盖范围和 SHA-256。
- `src/domain/journal-font.ts`：删除 `jingjing`，新增 `zhimang`。
- `src/features/journal/JournalPanel.tsx`：删除开发字体注入和生产/开发过滤逻辑，菜单改为统一生产字体集合。
- `src/styles.css`：删除 `jingjing` 选择器和预览，新增志莽行书字体栈。
- `vite.config.ts`：删除开发字体路由和映射。
- `dev-assets/fonts/YunFengJingJingTi-Regular.ttf` 与 README：删除云峰晶晶体开发资源及其说明。
- 相关测试：更新字体 ID、菜单数量、历史 `jingjing` 回退和志莽行书切换/恢复断言。
- `docs/product/mvp.md`、`docs/architecture/system-overview.html`、`docs/index.html`：同步字体集合、资源所有权和许可证边界；HTML 修改必须使用 `$bun-html-docs`。

### 6.1 核心数据结构变化

`JournalFontId` 从 `paper | jingjing | xuandong | suifeng` 调整为 `paper | xuandong | suifeng | zhimang`。`JOURNAL_FONT_STORAGE_KEY`、`DailyEntry`、IndexedDB 和正文纯文本不变。旧 `jingjing` 偏好不迁移，读取时安全回退到 `paper`。

### 6.2 上下游与跨模块影响

字体菜单增加一个生产选项，开发环境减少一个选项；textarea 和正文继续共享 `--journal-writing-font`。生产构建增加一个 TTF 和许可证/来源文本，删除开发服务器字体路由；不影响 Three.js、贴纸、日记保存和页面翻页。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 许可证遗漏 | 只复制 TTF，不复制 `OFL.txt` | 无法完整满足再分发条件 | 将上游 OFL 原文和版权声明随资源提交 |
| 旧偏好失效 | 用户 `localStorage` 中保存 `jingjing` | 读取到未知字体 ID | 统一回退 `paper`，增加回归测试 |
| 全局 UI 范围误扩展 | 把志莽行书应用到根字体栈 | 所有控件排版改变 | 只作用于日记容器和字体预览 |
| 字体体积影响加载 | 完整中文 TTF 进入生产构建 | 缓存和首选加载成本增加 | 先保留完整上游文件；子集化另立任务 |

## 8. 验证与验收

- 自动测试：字体 ID、旧 `jingjing` 回退、生产菜单不含云峰、志莽行书选择和偏好恢复。
- 资源检查：`file`、`fc-scan`、SHA-256、OFL 文本完整性、构建产物路径和无 `/dev-fonts/` 引用。
- 构建与静态检查：`npm run lint`、`npm test`、`npm run build`、文档引用检查、`git diff --check`。
- 浏览器验收：桌面和移动端打开字体菜单，确认志莽行书已加载、textarea/正文同步、刷新后偏好恢复、无横向溢出。
- 成功标准：生产字体集合为纸页宋体、玄冬楷书、随峰体、志莽行书；云峰晶晶体完全移除；网页离线加载志莽行书，不依赖 Google Fonts CDN。

## 9. 待确认项与决策

1. 默认字体仍保持纸页宋体；志莽行书作为用户主动选择项，不改变既有正文样式。

## 10. 最终批准方案

已批准（2026-08-22）。最终执行清单为：删除云峰晶晶体开发链路；加入志莽行书生产资源与 OFL 文件；更新字体 ID、菜单、CSS、测试、产品/架构/入口文档；旧偏好回退 `paper`。

## 11. 实施记录

已完成源码与资源实施：

- `src/domain/journal-font.ts` 删除 `jingjing`，新增 `zhimang`；默认仍为 `paper`。
- `src/features/journal/JournalPanel.tsx` 删除开发字体注入，生产/开发统一使用四项字体；字体菜单随后由 `DD-20260823-001` 提升到首页全局入口。
- `src/styles.css` 删除云峰选择器，注册 `Zhi Mang Xing` 并绑定日记正文、输入和预览。
- `vite.config.ts` 删除 `/dev-fonts/` 中间件；删除 `dev-assets/fonts/YunFengJingJingTi-Regular.ttf`，README 改为无开发字体资源。
- `public/fonts/` 新增 `ZhiMangXing-Regular.ttf`、`ZhiMangXing-OFL.txt`、来源和上游元数据文件。
- 旧 `jingjing` 偏好未迁移，读取时回退到 `paper`。

## 12. 验证结果

- Google Fonts 页面：可访问 `https://fonts.google.com/specimen/Zhi+Mang+Xing`。
- 上游仓库：`google/fonts/ofl/zhimangxing` 存在 `ZhiMangXing-Regular.ttf` 和 `OFL.txt`。
- 上游许可证：SIL Open Font License 1.1，允许网页/软件嵌入、打包和再分发，要求保留版权与许可证。
- 字体资源已下载并完成 `file`、`fc-scan` 和 SHA-256 核验：TTF 4,063,532 bytes，SHA-256 `644e0cae9b40f0b10ab729a01bd32032e3973bac22be3dccae01bf6ae7fde969`。
- 定向测试：2 个测试文件、11 项通过；全量测试：20 个测试文件、85 项通过。
- `npm run lint`、`npm run build`、`node scripts/check-doc-references.mjs`、`git diff --check` 均通过。
- 生产构建 `dist/fonts/` 包含志莽行书 TTF 与 OFL 文件，不包含云峰晶晶体或 `/dev-fonts/`。
- `ego-browser` 桌面 1470×923 与移动 390×844 验收通过：菜单显示四项字体，选择志莽行书后 `document.fonts.check` 为 true，`data-journal-font`/`localStorage` 为 `zhimang`，移动端无横向溢出。
- 本次提交前重新运行 `npm run check`：lint 通过，20 个测试文件、89 项测试通过，TypeScript/Vite production build 与文档引用检查通过；`git diff --check` 通过。

## 13. 文档同步检查

- 产品文档：`docs/product/mvp.md` 已同步生产内容字体集合和云峰晶晶体删除事实。
- 架构文档：`docs/architecture/system-overview.html` 已同步字体资源所有权、加载路径和历史偏好回退。
- 决策文档：不新增长期架构决策。
- 文档入口：`docs/index.html` 已同步为已完成并保留本记录入口。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-21 23:40 CST | 用户 / Codex | 用户提出删除云峰晶晶体、添加 Google Fonts 志莽行书并询问网页嵌入许可；Codex 核验 Google Fonts 上游 OFL 1.1 文件，创建待确认方案，未修改业务源码。 |
| 2026-08-22 00:05 CST | 用户 / Codex | 用户明确批准字体方案；开始删除云峰晶晶体并加入志莽行书的源码、资源、测试和文档实施。 |
| 2026-08-22 00:05 CST | Codex | 完成源码、字体资源、测试、构建、产品/架构/入口文档同步和桌面/移动端浏览器验收；状态更新为待验收。 |
| 2026-08-23 02:05 CST | 用户 / Codex | 用户明确要求提交当前工作区；在差异未超出已批准范围且完整检查通过后，按预先验收规则更新为已完成并纳入同一提交。 |
