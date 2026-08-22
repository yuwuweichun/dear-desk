# DD-20260820-001：替换日记字体资源

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 已替代 |
| 类型 | 功能 / 字体资源 |
| 创建时间 | 2026-08-20 00:00 CST |
| 最后更新 | 2026-08-21 23:29 CST |
| 当前阶段 | 被当前 OFL 字体方案替代，未执行 |
| 源码基线 | 当前 `main` 工作区；创建记录前 Git 状态为干净 |
| 实现提交 | 尚未创建 |
| 关联任务 | 删除开发环境云峰晶晶体，新增瑞美加张清平硬笔行书和乐米春序晚星体 |

> 本文是待审阅方案。批准前只修改本文档，不修改业务源码、字体资源、工程配置或持久化数据。

## 1. 给阅读者的结论

当前日记字体菜单包含纸页宋体、玄冬楷书和仅开发环境提供的云峰晶晶体。本次建议移除云峰晶晶体，保留纸页宋体与玄冬楷书，并新增用户指定的瑞美加张清平硬笔行书、乐米春序晚星体，使生产环境可选四种字体。新字体计划作为本地 Web Font 随应用离线分发，继续由同一个字体偏好同时控制 textarea 和保存后的正文，日记数据仍为纯文本。

来源核验发现，两款新字体的公开页面虽然标注可免费商用，但不是明确的 OFL、Apache 或其他标准开源许可证；瑞美加页面限制嵌入式用途，乐米页面明确写出 App/游戏嵌入式用途需另外授权。将字体打包到 Dear Desk 的 Web App 可能落入该限制，因此在实施前必须确认用户已取得可用于软件内嵌、再分发和离线 Web 使用的授权，或将本次范围改为仅开发环境评估。

## 2. 用户需求

### 用户原始要求

1. 删除开发环境的云峰晶晶体。
2. 新增“100font-瑞美加张清平硬笔行书”。
3. 新增“100font-乐米春序晚星体”。
4. 下载来源不限定于用户给出的 100font 页面，可以寻找其他直链；用户认为两款字体免费商用。

### Codex 对需求的解释

- 默认目标是将两款字体作为生产构建中的本地 Web Font，供日记输入框和已保存正文选择。
- 纸页宋体和玄冬楷书保留；字体偏好 ID、`localStorage` 键、纯文本 `DailyEntry` 和日记入口不改变。
- 云峰晶晶体的开发服务器路由、开发字体注入、资源文件和相关测试/文档均删除。
- “免费商用”不自动等于“允许嵌入软件并再分发字体文件”；必须以字体作者/版权方对 Web/App 嵌入的明确授权为准。

## 3. 当前源码事实

- `src/domain/journal-font.ts` 定义三个字体 ID：`paper`、`jingjing`、`xuandong`；菜单元数据为纸页宋体、云峰晶晶体、玄冬楷书。
- `src/features/journal/JournalPanel.tsx` 通过 `import.meta.env.DEV || option.id !== 'jingjing'` 隔离云峰晶晶体：开发环境显示三项，生产环境显示纸页宋体和玄冬楷书；开发环境还动态注入 `/dev-fonts/YunFengJingJingTi-Regular.ttf`。
- `src/styles.css` 注册生产资源 `/fonts/Xuandong-Kaishu.ttf`，并通过 `--journal-writing-font` 让 textarea 与正文共享字体栈；`jingjing` 选择器仍存在。
- `vite.config.ts` 仅在 `serve` 阶段暴露 `dev-assets/fonts/YunFengJingJingTi-Regular.ttf` 的 `/dev-fonts/` 路径。
- `dev-assets/fonts/YunFengJingJingTi-Regular.ttf` 是当前云峰晶晶体文件；`public/fonts/Xuandong-Kaishu.ttf` 是现有生产字体资源。
- `src/domain/journal-font.test.ts` 和 `src/features/journal/JournalPanel.test.tsx` 覆盖字体偏好回退、菜单、切换及恢复；现有测试断言包含 `jingjing`。
- 产品事实文档 `docs/product/mvp.md` 当前记录生产可选纸页宋体/玄冬楷书、开发额外提供云峰晶晶体。

### 字体来源核验事实

- [100font 瑞美加张清平硬笔行书](https://www.100font.com/thread-232.htm)：页面说明由张清平先生逐字书写 GB2312 6763 字；许可段写明个人和企业可免费使用、包括商业用途，但同时写明不可用于“嵌入式用途”，下载入口为夸克网盘，页面没有提供标准开源许可证文件。
- [100font 乐米春序晚星体](https://www.100font.com/thread-1794.htm)：页面描述为日常手写硬笔风格；许可段写明全媒体商业发布场景，但“App 以及游戏等嵌入式用途”需另外授权，版本/来源指向 [Lemi Font](https://font.leminet.cn/#/)。官方站当前显示版本 `1.001`、简体中文 `6923` 字、约 `8.53MB`，许可标签为“免费商用”。
- 当前未确认两款字体存在可直接下载且允许 Web/App 嵌入的标准开源发行包；100font 页面提供的是网盘链接，不是可审计的上游版本发布地址。

### 标准许可证候选补充核验

以下候选在作者/维护者仓库中可直接核验到 SIL Open Font License 1.1（OFL 1.1）文本，适合优先评估本地 Web Font 分发：

- [霞鹜文楷 LXGW WenKai](https://github.com/lxgw/LxgwWenKai)：作者仓库提供 `OFL.txt`，并附带允许为 Web Font 子集化/转换格式的额外许可；仍需随资源保留许可证和版权声明。
- [马善政毛笔楷书 Ma Shan Zheng](https://github.com/google/fonts/tree/main/ofl/mashanzheng)：Google Fonts 官方仓库 `ofl/mashanzheng/OFL.txt` 明确为 OFL 1.1。
- [志莽行书 Zhi Mang Xing](https://github.com/google/fonts/tree/main/ofl/zhimangxing)：Google Fonts 官方仓库 `OFL.txt` 明确为 OFL 1.1。
- [龙藏体 Long Cang](https://github.com/google/fonts/tree/main/ofl/longcang)：Google Fonts 官方仓库 `OFL.txt` 明确为 OFL 1.1。
- [站酷快乐体 ZCOOL KuaiLe](https://github.com/google/fonts/tree/main/ofl/zcoolkuaile)：Google Fonts 官方仓库 `OFL.txt` 明确为 OFL 1.1，不应误标为 Apache 2.0。
- [站酷小薇 ZCOOL XiaoWei](https://github.com/google/fonts/tree/main/ofl/zcoolxiaowei)：Google Fonts 官方仓库 `OFL.txt` 明确为 OFL 1.1。
- [站酷庆科黄油体 ZCOOL QingKe HuangYou](https://github.com/google/fonts/tree/main/ofl/zcoolqingkehuangyou)：Google Fonts 官方仓库 `OFL.txt` 明确为 OFL 1.1。
- [刘建毛草 Liu Jian Mao Cao](https://github.com/google/fonts/tree/main/ofl/liujianmaocao)：Google Fonts 官方仓库 `OFL.txt` 明确为 OFL 1.1。
- [思源黑体 Source Han Sans](https://github.com/adobe-fonts/source-han-sans) 与 [思源宋体 Source Han Serif](https://github.com/adobe-fonts/source-han-serif)：Adobe 官方仓库 `LICENSE.txt` 明确为 OFL 1.1，适合作为高覆盖率的无装饰回退字体。

本次核验的中文手写候选主要是 OFL 1.1；没有把仅有下载站标签、作者声明或“免费商用”描述的字体归类为 Apache 2.0。Apache 2.0 在中文手写字体中并不常见，若采用 Apache 字体，仍应以字体包内的 `LICENSE`/`NOTICE` 和作者仓库为准。

### 资源网站与使用边界

- [Google Fonts](https://fonts.google.com/)：可预览和筛选中文字体；对应的 [google/fonts 仓库](https://github.com/google/fonts) 可核验每个字体目录中的 `OFL.txt`、`METADATA.pb` 和字体文件。生产项目应从仓库发行包下载并本地打包，不依赖在线 CSS。
- [Adobe Fonts 开源仓库](https://github.com/adobe-fonts)：思源黑体/宋体的作者维护仓库和 Releases，适合核验版本、许可证和构建产物。
- [字体作者 GitHub 仓库](https://github.com/lxgw/LxgwWenKai)：对非 Google Fonts 字体，优先使用作者仓库的 Release、许可证和哈希。
- [SIL Open Font License 官方说明](https://openfontlicense.org/)：核对 OFL 1.1 的嵌入、再分发、修改、保留名称和禁止单独售卖字体文件的条件。
- [100font](https://www.100font.com/) 与 [猫啃网](https://www.maoken.com/)：适合发现字体和查看中文预览，但属于索引/整理站；下载前仍需回到作者仓库或字体包内许可证核验，不能仅凭站点标签判断可嵌入 Web/App。

上述授权限制是当前待确认事实，不把“用户认为免费商用”写成已获嵌入授权。

## 4. 目标与非目标

### 4.1 目标

- 删除云峰晶晶体的开发资源、开发路由、运行时注入、字体 token、菜单项、测试和文档事实。
- 新增两款用户指定字体，并在满足授权条件时作为生产离线 Web Font 提供。
- 将字体菜单更新为：纸页宋体、玄冬楷书、瑞美加张清平硬笔行书、乐米春序晚星体。
- 保持字体偏好持久化、输入/阅读同步、正文纯文本和已有 `DailyEntry` 数据兼容。
- 随仓库记录字体文件的来源、版本、SHA-256、文件格式、授权证据和分发限制。

### 4.2 非目标

- 不实现用户上传字体、字体管理器、字体删除或跨设备同步。
- 不改变贴纸文字、HUD、品牌标题、铭牌字体或其他 UI 字体。
- 不修改日记正文数据结构、IndexedDB 表、Three.js Canvas 所有权或字体选择入口位置。
- 不在没有明确嵌入授权的情况下把新字体静默打入生产构建。

## 5. 方案说明

批准并确认授权后，采用现有“字体 ID + 本地 `@font-face` + `localStorage` 偏好”的最小变更路径：为两款字体加入稳定 ID 和 CSS family token；字体文件放入 `public/fonts/`，由生产构建复制并离线加载；删除云峰晶晶体的 `dev-assets` 文件和 Vite `serve` 中间件；清理 `JournalPanel` 的开发字体过滤/注入；更新字体样例与回退逻辑。

如果用户不能确认可用于 Web/App 嵌入的授权，则只允许采用“开发环境评估、不进入生产构建”的替代方案；该替代方案会保留新的开发资源路由并增加范围，不应在未重新批准前自行切换。

## 6. 预计改动与影响评估

预计实施文件及责任：

- `src/domain/journal-font.ts`：移除 `jingjing`，新增两个稳定字体 ID、显示名和预览元数据。
- `src/features/journal/JournalPanel.tsx`：删除开发环境过滤和云峰晶晶体动态 `@font-face` 注入；保持生产菜单和偏好回退兼容。
- `src/styles.css`：删除云峰晶晶体 token/预览规则；注册两款新字体并为日记字体栈增加新 family。
- `vite.config.ts`：删除 `/dev-fonts/` 开发字体中间件及其映射。
- `public/fonts/`：新增两款已核验字体文件；删除不再使用的生产/开发资源按批准方案执行。
- `dev-assets/fonts/README.md`：删除云峰晶晶体记录，改为说明无开发字体资源或按最终授权方案记录。
- `src/domain/journal-font.test.ts`、`src/features/journal/JournalPanel.test.tsx`：更新 ID、菜单数量、非法/旧偏好回退及切换恢复断言。
- `docs/product/mvp.md`：同步新的生产字体集合与不再提供云峰晶晶体的事实。
- `docs/architecture/system-overview.html`：同步字体资源所有权、生产加载路径、失败回退和授权边界；若 HTML 实质修改，按项目要求使用 `$bun-html-docs`。
- 本变更记录：在批准、实施、验证和待验收阶段持续回写真实事实。

### 6.1 核心数据结构变化

`DailyEntry`、IndexedDB 日记表、`JOURNAL_FONT_STORAGE_KEY` 和 `localStorage` 存储模型不变。`JournalFontId` 从 `paper | jingjing | xuandong` 变为 `paper | xuandong | ruimei-zhangqingping | lemi-chunxu-wanxing`（最终 ID 名称在批准执行清单中锁定）。

已有 `jingjing` 偏好在新版本读取时应回退到默认 `paper`，不迁移为其他字体；这样不会把已删除资源当作仍然可用。

### 6.2 上下游与跨模块影响

- 日记输入和正文继续共同消费字体 CSS token，不触碰文本保存链路。
- 生产构建体积预计至少增加约 8.53MB 的乐米字体文件，瑞美加文件大小需下载后实测；首屏字体加载和缓存会受影响。
- 字体中文覆盖、标点、英文数字混排、行高和移动端换行需分别验收。
- 新字体的授权证据、版本和哈希必须与资源一起记录，避免仅保留第三方下载页描述。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| 嵌入授权不足 | 字体允许商业设计但禁止 App/Web 嵌入 | 发布合规风险 | 实施前取得作者/版权方书面嵌入授权；否则仅开发评估或改用标准开源替代字体 |
| 来源不可审计 | 仅有网盘镜像，无版本/许可证文件 | 无法证明分发依据 | 优先官方/作者直链；保存下载页、授权原文、版本和 SHA-256；核验失败不进入生产 |
| 字体文件过大 | 两款完整 CJK TTF 直接打包 | 首屏和构建产物增大 | 先保留离线完整字体以保证覆盖；必要时另立任务做经授权的子集化 |
| 字符覆盖不足 | 用户输入超出 GB2312 或字体字符集 | 方框/系统回退 | 用产品样例、生僻字、标点、数字和英文做 `fc-scan`/浏览器覆盖检查；保留稳定回退栈 |
| 旧偏好失效 | 用户 `localStorage` 中保存 `jingjing` | 菜单状态异常 | 读取时将未知/已删除 ID 回退到 `paper`，增加回归测试 |
| 字形可读性差 | 长段正文使用装饰性字体 | 阅读负担上升 | 默认仍为纸页宋体；菜单提供即时切换；桌面/移动长文分别验收 |

## 8. 验证与验收

- 自动测试：字体 ID/标签、默认值、旧 `jingjing` 偏好回退、菜单四项、选择后 textarea/正文同步、重新挂载恢复、纯文本未改变。
- 资源检查：字体文件格式、family/style、字符覆盖、文件大小、SHA-256、来源和授权记录；构建产物必须不包含云峰晶晶体或 `/dev-fonts/`。
- 构建与静态检查：`npm run lint`、目标测试、完整测试、`npm run build`、`git diff --check`、`node scripts/check-doc-references.mjs`。
- 浏览器验收：使用 `ego-browser` 检查桌面 `1440 × 900` 与移动 `390 × 844`；分别切换四种字体，输入中文长句/标点/数字/英文，验证编辑与阅读字形、换行、焦点、菜单和无溢出。
- 持久化：选择新字体后关闭并重新打开本子/刷新页面，确认偏好恢复；把旧 `jingjing` 写入 `localStorage` 后确认安全回退。
- 成功标准：授权证据允许离线 Web/App 分发；四种生产字体均能离线加载且缺字可回退；云峰晶晶体完全移除；字体切换不修改日记正文。

## 9. 待确认项与决策

1. **授权范围（必须确认）**：是否已取得瑞美加张清平硬笔行书和乐米春序晚星体用于 Dear Desk Web App 的本地嵌入、随构建再分发和离线使用的授权？建议在确认前不进入生产构建。
2. **若未取得嵌入授权**：是否改为仅开发环境评估，还是改用具有 OFL/Apache 等明确嵌入许可的替代字体？建议优先取得授权；否则选择标准开源替代。
3. **字体显示名/顺序**：建议顺序为“纸页宋体、玄冬楷书、瑞美加张清平硬笔行书、乐米春序晚星体”，并使用短 ID `ruimei`、`lemi`；如需完整品牌名显示可在菜单中保留完整名称。
4. **完整字体还是子集**：建议首版使用完整文件以保证中文覆盖，接受构建体积增加；子集化另立任务。

## 10. 最终批准方案

尚未批准。批准后记录授权决策、字体来源/版本/哈希和最终执行清单。

## 11. 实施记录

尚未实施。

## 12. 验证结果

尚未验证。

## 13. 文档同步检查

- 产品文档：待批准后更新 `docs/product/mvp.md`。
- 架构文档：待批准后更新 `docs/architecture/system-overview.html`，并按 HTML 文档规则验证。
- 决策文档：当前不新增 ADR；若确认长期字体授权/分发原则，再另立决策记录。
- 文档入口：待批准后检查 `docs/index.html` 是否需要同步当前字体状态。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-20 00:00 CST | Codex | 创建待确认方案；完成现有源码/文档检查和两款字体来源页面核验，未修改业务源码。 |
| 2026-08-20 00:00 CST | Codex | 补充核验 OFL 1.1 候选及作者/维护者资源网站；确认中文手写候选主要为 OFL 1.1，未将下载站“免费商用”标签视为 Apache/OFL 许可。 |
| 2026-08-21 23:29 CST | 用户 / Codex | 用户确认当前应使用 OFL 字体；本提案中的两款嵌入授权未确认字体不再执行，由已落地的随峰体 OFL 方案替代。 |
