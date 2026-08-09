# DD-ADR-20260807-001：Sticker Forge 版本与单 Canvas 所有权

## 状态

已接受，2026-08-07 17:46 CST。本文整理编号 007 已批准并已实现的长期集成边界。

> 2026-08-08 扩展：图片 source、本地抠图与桌面/日记双 surface 的长期边界见 `DD-ADR-20260808-001`。本文的固定 Forge commit、公开 API 和单活跃 WebGL Canvas 决策继续有效。

## 背景

Dear Desk 的文字贴纸必须使用开源项目 `CatsJuice/sticker-forge`，不能用自研 Canvas 文字纹理或近似外观替代。上游公开 API 会创建并拥有独立的 Three.js WebGL renderer，但不会导出可直接加入 Dear Desk React Three Fiber 场景的 Mesh、Material 或 Texture。若同时常驻桌面 R3F 和 Sticker Forge renderer，应用会出现第二个活跃 WebGL Canvas；若访问上游私有场景对象，则会把集成绑在未承诺的内部实现上。

上游当前没有 tag、GitHub Release 或面向 npm 消费的稳定 `exports`。因此运行版本、离线能力、许可证和销毁生命周期都需要由 Dear Desk 显式负责。

## 决策

1. 文字贴纸制作真实运行 `CatsJuice/sticker-forge`，固定上游 commit `068caa49eef69745564a5debbc01bab3fcd31042`。
2. 官方 ES bundle、source map、类型声明和 MIT LICENSE 随仓库存放在 `public/vendor/sticker-forge/`；运行时不依赖 CDN，也不使用同名非官方 npm 包。
3. 任意时刻只有一个活跃 WebGL Canvas。进入制作阶段时卸载 Dear Desk R3F 桌面并挂载 Sticker Forge；确认或取消时先调用上游 `destroy()`，再恢复桌面。
4. Sticker Forge 拥有制作阶段的轮廓、材质、光照与 peel 预览。确认时先 `reset()` 并等待 flat 状态，再从其 Canvas 生成、按 alpha bounds 裁切透明 PNG。
5. Dear Desk 拥有贴纸文字源、Forge 选项、PNG Blob、桌面位置、旋转、选择与删除。桌面 R3F 只把 PNG Blob 投影为纹理，不复刻 Sticker Forge 渲染，也不持久化 peel 瞬时状态。
6. 集成层只调用上游公开的 `createSticker`、`setSource`、`setOptions`、`reset`、`getState` 和 `destroy`，不得访问其私有 renderer、scene 或 mesh。

## 原因

- 固定并 vendoring 官方产物可核实真实来源，在上游无稳定发布入口时避免版本漂移与离线失效。
- Canvas 所有者切换满足项目单活跃 WebGL Canvas 约束，也把 renderer 创建与销毁边界放在可测试的 React 生命周期内。
- 保存上游实际输出的 PNG，既保留 Sticker Forge 的视觉结果，又让多张桌面贴纸共享 Dear Desk 现有 R3F renderer。
- 业务数据与 WebGL 运行对象分离，延续 `DD-ADR-20260806-002` 的本地事实与场景投影原则。

## 影响

### 正向影响

- 运行时可以证明贴纸由指定开源系统生成，而非外观仿制。
- 页面重开不需要重放上游 renderer；PNG Blob、坐标和旋转可以直接恢复。
- 贴纸数量不会线性增加 WebGL context，桌面交互仍由一个 R3F 场景统一处理。
- 固定 commit、来源说明和许可证使第三方代码可审计、可离线使用。

### 代价与限制

- 制作阶段不能与 3D 桌面同时可见；两种 Canvas 所有者之间需要严格的卸载顺序。
- PNG 是确认时的平面结果，桌面上不能继续运行 peel 动画或无损修改 Forge 参数。
- 上游升级必须重新核对公开 API、产物、许可证、快照行为和 Canvas 释放，不能只替换 bundle 文件。
- 图片输入已由 `DD-ADR-20260808-001` 批准并实现；SVG 仍不支持。图片容量、解码、抠图和资产生命周期由新决策约束。

## 替代方案

### 自研文字贴纸纹理

已拒绝。它无法满足用户指定使用 Sticker Forge 的要求，也是编号 004 被替代的原因。

### 同时常驻 Dear Desk 与 Sticker Forge Canvas

未采用。它违反单活跃 Canvas 约束，并增加 WebGL context、事件和移动端性能风险。

### 复制上游 shader 或私有 Mesh 到 R3F

未采用。上游没有把这些对象作为公共接口导出，复制内部实现会造成隐式 fork，也难以证明桌面视觉仍由固定上游产物生成。

### 在线 CDN 或跟随上游 main

未采用。当前无稳定发布版本，在线加载会引入网络依赖与不可控漂移。

## 后续约束

- 任何上游 commit 变更都必须更新 `SOURCE.md`、许可证核对、持久化来源字段和集成验收证据。
- 不得让制作 Canvas 与桌面 Canvas 同时活跃；若产品要求并排预览，必须建立新任务和决策记录。
- 图片/SVG 贴纸、桌面 peel 动画、可编辑已放置贴纸或新的持久化资产格式需要独立审批。
- 回退功能时保留 IndexedDB v2 表和用户 Blob，不自动清库或降级 schema。
