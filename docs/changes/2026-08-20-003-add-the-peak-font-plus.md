# DD-20260820-003：新增随峰体 Plus 日记字体

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 类型 | 功能 / 字体资源 |
| 创建时间 | 2026-08-20 17:14 CST |
| 最后更新 | 2026-08-20 17:59 CST |
| 当前阶段 | 实施完成，已按用户提交指令完成预先验收授权 |
| 源码基线 | Git commit `1a66431`；工作区已有未跟踪变更记录 `001`、`002` |
| 实现提交 | 本次提交（由 Git 记录） |
| 关联任务 | 用户询问 Nunito，并要求在项目中添加 100font 随峰体 OFL 字体 |

> 用户已于 2026-08-20 明确回复“批准”。以下执行清单已锁定；实施只限于新增随峰体 Plus 日记字体及必要的源码、资源和文档同步。

## 1. 给阅读者的结论

`Nunito` 是一款圆润、开放、偏友好界面气质的无衬线字体。当前 Dear Desk 用它显示全局 UI 的拉丁字母，中文字符由 `Noto Sans SC` 承担；它不是日记手写字体。随峰体 Plus 则是覆盖简繁中文、英文、数字和标点的手写字体，两者职责和阅读密度不同。

本次建议保留 Nunito 作为全局 UI 字体，把官方 `The Peak Font Plus / 随峰体Plus / 隨峰體Plus` 作为新的生产日记字体选项，同时作用于日记 textarea 和保存后的只读正文。官方页面明确声明 SIL Open Font License，允许个人、商业、软件嵌入与再分发；官方当前下载包实际为 `V1.002`，字体文件约 15.1 MiB。全局替换 Nunito 会改变所有界面控件与 HUD 的视觉和排版，不纳入默认方案。

## 2. 用户需求

### 用户原始要求

1. 询问 Nunito 是什么字体。
2. 在项目中添加 [100font 随峰体 OFL](https://www.100font.com/thread-961.htm)。

### Codex 对需求的解释

- 默认将随峰体 Plus 添加到现有日记字体选择器，供生产环境使用。
- 保留纸页宋体、玄冬楷书、现有全局 UI 字体和字体偏好机制。
- 不把“提到 Nunito”解释为“用随峰体替换全部 UI”；该范围需要用户另行明确确认。
- 本任务独立于 `DD-20260820-001` 中尚待授权确认的另外两款字体，不下载、不实现或顺带调整它们。

## 3. 当前源码事实

- `src/styles.css` 的根字体栈是 `Nunito, "Noto Sans SC", ...`；`animal-island-ui/style` 随依赖提供 Nunito 500/700/900 Latin WOFF2 和 Noto Sans SC 400/500/700 Latin/简中 WOFF2。
- `src/domain/journal-font.ts` 当前定义 `paper | jingjing | xuandong`；生产菜单显示纸页宋体、玄冬楷书，开发环境额外显示云峰晶晶体。
- `src/features/journal/JournalPanel.tsx` 把稳定字体 ID 写入 `localStorage`，并用 `data-journal-font` 控制输入与阅读字体；正文持久化仍是纯文本。
- `src/styles.css` 用 `--journal-writing-font` 同步 textarea 和只读正文；玄冬楷书已经采用 `public/fonts/*.ttf` + `@font-face` 的生产资源模式。
- `src/domain/journal-font.test.ts` 与 `src/features/journal/JournalPanel.test.tsx` 已覆盖字体 ID、偏好回退、切换与重新挂载恢复。
- `docs/product/mvp.md` 和 `docs/architecture/system-overview.html` 当前均记录生产两项、开发三项的日记字体事实。

### 随峰体 Plus 来源核验事实

- 用户提供的 100font 页面将字体标为手写、简体、繁体和 OFL，说明约 16,400 字，许可为 SIL Open Font License 1.1，并链接到 cjkFonts 官方来源。
- [cjkFonts 官方页面](https://cjkfonts.io/blog/ThePeakFontPlus)说明该字体由阿坤、Jeffrey Xuan、宇文满月贡献，cjkFonts 负责技术处理；允许个人与商业用途，并明确为 SIL Open Font License。
- 官方页面正文仍显示 `V1.001`，但官方下载端点当前返回 `ThePeakFontPlus_V1_002.zip`；包内更新日志说明 `V1.002` 修正“禼”字并添加若干符号。
- 官方 ZIP 为 `9,640,443` bytes，SHA-256 为 `496b566d165cbd17f6ef8055cf40e4476f47ab31c1e031c755ad7ad9b778a631`。
- 包内字体 `ThePeakFontPlus-Regular.ttf` 为 `15,798,916` bytes，SHA-256 为 `4a3ec7396adc029ad7fd25b4ddbf719e59f3a4a5ec03d6c95cbf07296e6d9f5b`。
- 字体内部 family 为 `The Peak Font Plus, 隨峰體Plus, 随峰体Plus`，style 为 `Regular`，foundry 为 `CJK`；文件内 `copyright` / `license` 元数据为空。
- 官方 ZIP 只包含 TTF、更新日志和特殊符号手册，没有随包提供 `OFL.txt`。实施时必须补充标准 OFL 1.1 文本及来源、版本、贡献者和哈希记录，不能只保留下载站标签。

## 4. 目标与非目标

### 4.1 目标

- 从 cjkFonts 官方 `V1.002` 包新增随峰体 Plus 生产字体资源。
- 在日记字体菜单增加“随峰体”选项，同时控制 textarea 与只读正文。
- 继续使用现有 `localStorage` 字体偏好键并保证未知值安全回退。
- 记录字体版本、官方来源、贡献者、文件哈希和 SIL OFL 1.1 许可证文本。
- 同步产品、架构和任务记录中的当前字体事实。

### 4.2 非目标

- 不替换全局 UI 的 Nunito / Noto Sans SC。
- 不修改贴纸文字、HUD、按钮、铭牌或其他非日记字体。
- 不删除云峰晶晶体，也不实施 `DD-20260820-001` 的瑞美加/乐米字体方案。
- 不改变 `DailyEntry`、IndexedDB、正文纯文本或字体菜单位置。
- 不做字体子集化、格式转换、用户上传字体或跨设备偏好同步。

## 5. 方案说明

批准后沿用现有生产字体路径：把官方 `ThePeakFontPlus-Regular.ttf` 放入 `public/fonts/`，增加 `@font-face` 和 `data-journal-font="suifeng"` 对应的 CSS 字体栈；在 `JournalFontId` 与菜单元数据中加入稳定 ID `suifeng`。默认字体仍为 `paper`，已有 `paper`、`jingjing`、`xuandong` 偏好不迁移。

字体资源随仓库保存标准 OFL 1.1 文本，并在来源说明中记录官方页面、版本、贡献者、ZIP/TTF 哈希和“官方包未内含许可证文件”的核验事实。生产构建继续离线工作，不依赖 100font、cjkFonts 或其他外网字体服务。

## 6. 预计改动与影响评估

- `public/fonts/ThePeakFontPlus-Regular.ttf`：新增官方 `V1.002` TTF。
- `public/fonts/ThePeakFontPlus-OFL.txt`：新增 SIL OFL 1.1 标准许可证文本和字体版权/来源说明；最终文件组织以许可证原文完整性为准。
- `src/domain/journal-font.ts`：加入 `suifeng` 稳定 ID、显示名“随峰体”和样例。
- `src/styles.css`：注册 `The Peak Font Plus`，增加日记容器和菜单样例的 `suifeng` 字体栈。
- `src/domain/journal-font.test.ts`：覆盖新 ID 的合法性、读写和回退。
- `src/features/journal/JournalPanel.test.tsx`：覆盖生产菜单新增项、选择、正文/输入共享状态和重新挂载恢复。
- `docs/product/mvp.md`：把生产日记字体事实更新为纸页宋体、玄冬楷书、随峰体。
- `docs/architecture/system-overview.html`：同步字体 ID、资源所有权、加载路径、失败回退和生产构建事实；必须使用项目要求的 `$bun-html-docs` 技能。
- `docs/index.html`：只做引用/当前状态检查；若需实质修改，同样必须使用 `$bun-html-docs`。
- 本记录：持续回写批准、实施文件、偏差、验证和验收状态。

### 6.1 核心数据结构变化

`JournalFontId` 从 `paper | jingjing | xuandong` 扩展为 `paper | jingjing | xuandong | suifeng`。`JOURNAL_FONT_STORAGE_KEY`、`DailyEntry`、IndexedDB 和贴纸数据结构不变。新 ID 的生命周期与现有字体相同：选择时写入 `localStorage`，重新打开日记时读取；存储不可用或值未知时回退 `paper`。

### 6.2 上下游与跨模块影响

- 日记工具栏新增一个菜单项，输入和阅读通过同一个 CSS token 切换。
- 生产静态资源至少增加约 15.1 MiB TTF，首次选择/加载该字体时增加传输、解析和缓存成本。
- 不影响全局 UI、Sticker Forge、3D Canvas 数量、日记保存链路和现有正文。
- 新字体覆盖简繁中文、英文、数字和标点，但仍应保留 `Songti SC, serif` 回退并验证生僻字、特殊符号与混排。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 字体资源体积较大 | 完整 TTF 随生产构建分发 | 加载和缓存成本增加 | 首版按用户指定保留完整覆盖；子集化/WOFF2 转换另立任务并保留 OFL 要求 |
| 官方包缺少许可证文件 | 只复制 ZIP 内容 | 仓库缺少可审计许可文本 | 随资源补充标准 OFL 1.1 全文、官方声明、贡献者、版本和哈希 |
| 页面版本与下载包版本不同 | 只读取页面正文 | 错误记录为 1.001 | 以官方端点实际 `V1.002` 文件、更新日志和哈希为实现基线 |
| 手写字形影响长文可读性 | 用户选择随峰体阅读长正文 | 阅读效率降低 | 保持纸页宋体默认值和即时切换能力；桌面/移动长文验收 |
| 字体加载失败 | 资源缺失、缓存或浏览器解码失败 | 字形退回系统字体 | 保留 `Songti SC, serif` 回退并检查构建产物路径 |
| 全局范围理解错误 | 把“添加”实现成替换 Nunito | 全部 UI 排版与尺寸改变 | 默认仅加入日记菜单；全局替换必须另行明确批准 |
| HTML 文档技能不可用 | `$bun-html-docs` 已存在磁盘但未注册到当前会话的可用技能清单 | 无法按项目规则回写架构 HTML | 实施前重新注册该技能或重新加载会话；不可静默改用手写 HTML |

回退方式：删除 `suifeng` 菜单元数据、CSS 声明和字体/许可证资源；已有 `localStorage` 中的 `suifeng` 会按现有未知值逻辑回退到 `paper`，日记正文无需迁移。

## 8. 验证与验收

- 自动测试：`suifeng` ID、菜单显示、选择后 `data-journal-font`、偏好写入/恢复、未知值回退、正文纯文本不变。
- 资源检查：`file`、`fc-scan`、`shasum -a 256`、文件大小、family/style、版本、字符覆盖、许可证全文和来源记录。
- 构建与静态检查：`npm run lint`、目标测试、`npm run test`、`npm run build`、生产产物字体存在性与无外网引用检查、`git diff --check`、`node scripts/check-doc-references.mjs`。
- 浏览器验收：使用 `ego-browser` 复用本任务空间，在桌面 `1440 x 900` 与移动 `390 x 844` 检查菜单、中文长句、简繁混排、数字英文标点、输入/阅读一致性、换行和无溢出；结束后按规则关闭任务空间。
- 持久化与恢复：选择随峰体后关闭并重新打开本子、刷新页面，确认 `localStorage` 偏好恢复；正文内容保持不变。
- 成功标准：随峰体只在日记选择后生效；生产环境离线加载官方 `V1.002`；默认 UI 和日记数据无回归；源码、产品、架构与变更记录一致。

## 9. 待确认项与决策

1. **使用范围**：建议只加入日记字体菜单，不替换全局 Nunito / Noto Sans SC。若用户希望替换全局 UI，需要另行评估所有控件、HUD 和移动端排版。
2. **显示名**：建议菜单显示“随峰体”，内部 ID 使用 `suifeng`，资源与许可证保留官方名 `The Peak Font Plus / 随峰体Plus`。
3. **资源格式**：建议本任务按官方完整 TTF 实施，接受约 15.1 MiB 增量；WOFF2 转换或子集化另立性能任务。
4. **HTML 文档技能**：用户已显式调用并提供 `$bun-html-docs`，本次架构 HTML 已按其内容契约完成更新和验证；不再是待确认项。

## 10. 最终批准方案

用户于 2026-08-20 明确批准执行。最终执行清单：

1. 保留 Nunito / Noto Sans SC 全局 UI，不替换全局字体。
2. 将官方随峰体 Plus `V1.002` 完整 TTF 加入生产资源，内部 ID 为 `suifeng`，菜单显示“随峰体”。
3. 让随峰体同时作用于日记 textarea 与只读正文，偏好继续使用现有 `localStorage` 键。
4. 随资源保存标准 OFL 1.1 原文、来源、贡献者、版本、文件大小与 SHA-256。
5. 更新单元测试、产品文档、架构 HTML 和本记录；使用 `$bun-html-docs` 完成架构 HTML 修改与本地验证。
6. 不实施 `DD-20260820-001` 中另外两款字体，不删除云峰晶晶体，不改变日记数据结构。

## 11. 实施记录

已完成实施，未创建提交。实际修改如下：

- 新增 `public/fonts/ThePeakFontPlus-Regular.ttf`、`ThePeakFontPlus-OFL.txt` 和 `ThePeakFontPlus-SOURCE.txt`；TTF 使用官方 V1.002，许可证为 SIL OFL 1.1 原文，来源和哈希随资源记录。
- `src/domain/journal-font.ts` 新增 `suifeng` ID 和“随峰体”菜单项；生产环境自动显示该项，开发环境继续保留云峰晶晶体。
- `src/styles.css` 新增随峰体 `@font-face`、日记共享字体 token 和菜单预览规则；全局 Nunito 根字体栈未改动。
- `src/domain/journal-font.test.ts` 与 `src/features/journal/JournalPanel.test.tsx` 覆盖新 ID、菜单显示、选择、输入字体和重新挂载恢复。
- `docs/product/mvp.md`、`docs/architecture/system-overview.html` 已同步生产字体集合、资源所有权和许可证来源；架构页保留原有 pre-shell 结构，仅更新事实内容，未重建壳层。

方案偏差：无。字体仍按批准方案使用完整 TTF，没有执行子集化/WOFF2 转换，也没有替换全局 Nunito。

## 12. 验证结果

- 使用 `ego-browser` 核验 100font 页面和 cjkFonts 官方页面：两者均声明 SIL OFL，官方端点可访问。
- 官方下载端点 HEAD：HTTP 200，`application/zip`，文件名 `ThePeakFontPlus_V1_002.zip`，长度 `9,640,443` bytes。
- 临时 ZIP 清单：`ThePeakFontPlus-Regular.ttf`、`更新日志.txt`、`特殊排版符号手册.txt`；没有 `OFL.txt`。
- `file` / `fc-scan`：TTF 可识别，Regular，family 含 `The Peak Font Plus / 隨峰體Plus / 随峰体Plus`。
- SHA-256：ZIP `496b566d165cbd17f6ef8055cf40e4476f47ab31c1e031c755ad7ad9b778a631`；TTF `4a3ec7396adc029ad7fd25b4ddbf719e59f3a4a5ec03d6c95cbf07296e6d9f5b`。
- 针对性测试：`npm test -- --run src/domain/journal-font.test.ts src/features/journal/JournalPanel.test.tsx`，2 个文件、10 项测试通过。
- 全量测试：`npm test`，18 个文件、76 项测试通过。
- 静态检查：`npm run lint` 通过。
- 生产构建：`npm run build` 通过；`dist/fonts/` 包含随峰体 TTF、OFL 和来源文件。Vite 保留既有大 chunk 警告，未出现新增编译错误。
- 资源检查：`file`、`fc-scan`、SHA-256 通过；family 为 `The Peak Font Plus, 隨峰體Plus, 随峰体Plus`，style 为 Regular，TTF SHA-256 为 `4a3ec7396adc029ad7fd25b4ddbf719e59f3a4a5ec03d6c95cbf07296e6d9f5b`。
- 文档检查：`node scripts/check-doc-references.mjs` 与 `git diff --check` 通过。
- 应用浏览器验收（`ego-browser`）：1440×900 和 390×844 均显示字体菜单；选择随峰体后 textarea 计算字体为 `"The Peak Font Plus", "Songti SC", serif`，`document.fonts` 状态为 loaded，刷新/重新打开本子后 `localStorage` 和 `data-journal-font` 均恢复 `suifeng`，页面无横向溢出。
- 架构 HTML 验收（`ego-browser` 直接打开 `file:///`）：1440×900、390×844 无页面横向溢出；搜索“随峰体”命中 4 个章节，空结果提示、ArrowDown/Enter 锚点跳转、Escape、移动目录展开和本地截图均通过。术语弹层的真实 DOM click/focus 事件可显示定义；复制按钮事件已触发，剪贴板反馈受浏览器权限限制未作为内容验收依据。
- 持久化：只验证字体偏好 `localStorage`，未写入或改变日记正文/IndexedDB 数据。

## 13. 文档同步检查

- 产品文档：已更新 `docs/product/mvp.md`，生产日记字体为纸页宋体、玄冬楷书、随峰体。
- 架构文档：已按 `$bun-html-docs` 内容契约核对并更新 `docs/architecture/system-overview.html` 的字体调用链、资源地图、验证状态和日期；保留已有 pre-shell 行为，完成桌面/移动视觉检查。
- 决策文档：不新增 ADR；现有本地资源与场景投影原则不变。
- 文档入口：实施后检查 `docs/index.html`，仅在当前状态需要同步时修改。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-20 17:14 CST | Codex | 创建待确认方案；解释 Nunito 职责，核验 100font 与 cjkFonts 官方来源、OFL 声明、V1.002 包内容、字体元数据和哈希；未修改业务源码。 |
| 2026-08-20 17:18 CST | Codex | 确认 `$bun-html-docs` 文件已安装但未注册到当前会话；按项目规则记录为实施阻塞项。 |
| 2026-08-20 17:26 CST | 用户 | 明确回复“批准”，批准保留 Nunito 全局 UI，并将随峰体 Plus V1.002 加入日记字体菜单。 |
| 2026-08-20 17:47 CST | Codex | 完成源码、资源、产品/架构文档、自动测试、构建和双视口浏览器验收；任务状态更新为待验收。 |
| 2026-08-20 17:59 CST | 用户 | 明确要求提交当前任务更改；按项目规则视为预先验收授权，任务状态更新为已完成并纳入本次提交。 |
