# DD-20260806-004：接入基础文字贴纸纵向切片

## 文档信息

| 字段 | 内容 |
| --- | --- |
| 状态 | 待确认 |
| 类型 | 功能 / 贴纸系统 / 本地持久化 |
| 创建时间 | 2026-08-06 15:38 CST |
| 最后更新 | 2026-08-06 15:38 CST |
| 当前阶段 | 方案审阅，尚未执行 |
| 源码基线 | 仓库没有初始提交；当前分支 `docs/document-driven-workflow`，基于编号 002 的未提交实现 |
| 实现提交 | 尚未创建 |
| 关联任务 | 用户指出贴纸系统尚未接入；对应已批准 MVP 场景 B |

> 本文是待审阅方案。批准前不新增贴纸表、组件、场景对象或持久化数据。

## 1. 给阅读者的结论

贴纸是 Dear Desk 核心循环“把一句话变成空间痕迹”的第一项能力，但编号 002 明确只实现当天文字记录，因此当前源码没有贴纸模型、数据库表、制作器或场景对象。

建议先实现文字贴纸的完整纵向切片：从当天记录制作一张文字贴纸，把它放到桌垫，移动、旋转或删除，并在重新打开页面后恢复。图片贴纸随后单独接入，因为它还需要 Blob 存储、容量限制、图片解码和对象 URL 生命周期；先把空间交互与持久化边界验证清楚更稳妥。

## 2. 用户需求

用户指出“贴纸系统现在也未接入”。已批准的 `docs/product/mvp.md` 要求：

- 短文本可以制作成贴纸。
- 图片可以制作基础矩形贴纸。
- 贴纸可放置、移动、旋转和移除。
- 贴纸位置与朝向在重新打开页面后保持。

Codex 建议本任务先交付文字贴纸闭环，图片贴纸作为紧随其后的独立切片，不把两种风险同时加入第一版贴纸 schema 与交互。

## 3. 当前源码事实

- `src/domain/` 只有 `DailyEntry`，没有 `StickerDefinition`、`StickerInstance` 或 `Asset`。
- `src/persistence/database.ts` 的 IndexedDB v1 只有 `dailyEntries: 'date, updatedAt'`。
- `src/state/app-store.ts` 只拥有当天记录与本子打开状态，没有贴纸集合、选择或空间编辑动作。
- `src/scene/DeskScene.tsx` 呈现桌面、本子、铅笔和杯子，没有可持久化场景对象集合。
- 当前没有相机拖动控制，因此贴纸拖动暂时不会与 OrbitControls 冲突；后续若加入相机控制仍需维持手势所有权。
- `docs/product/mvp.md` 已定义贴纸产品范围，但编号 002 将贴纸明确列为非目标，所以“未接入”是已知后续范围，不是当前实现偏差。

## 4. 目标与非目标

### 4.1 目标

- 从当天记录文字创建一张基础文字贴纸。
- 首次创建后进入放置模式，点击桌垫确定位置。
- 已放置贴纸可以选择、拖动、按固定步长旋转和删除。
- 贴纸内容、颜色、位置与朝向写入 IndexedDB，重新打开页面后恢复。
- 贴纸拖动被限制在允许桌垫范围，不触发相机或本子操作。
- DOM 制作器和控制栏保持键盘可用；Three.js 只投影贴纸数据。

### 4.2 非目标

- 本任务不支持图片贴纸、透明轮廓、材质上传或图片裁剪。
- 不支持缩放、层级排序、复制、多选、吸附或自由变形。
- 不支持贴纸复用库、市场、分享或云同步。
- 不实现物理剥离、卷边、闪粉、全息或声音。
- 不在本任务加入相机自由旋转或第二个 WebGL 画布。

## 5. 方案说明

### 5.1 用户流程

```text
打开当天本子
  -> 选择“做成贴纸”
  -> 确认短文本与颜色
  -> 进入桌面放置模式
  -> 点击桌垫放下
  -> 选择后移动 / 旋转 / 删除
  -> 重新打开页面后恢复
```

制作器使用 DOM。首版默认带入当天记录，允许压缩为最多 60 个字符，并提供少量固定色板；不开放任意材质参数。创建完成前不写入半成品，确认放置时用一个 Dexie 事务同时保存定义与实例。

### 5.2 场景投影与空间操作

- 每个 `StickerInstance` 映射为桌垫上方略微抬起的平面 mesh。
- 文字由运行时 Canvas 2D 绘制为 `CanvasTexture`；纹理对象只存在于 Three.js 生命周期，不写入 store 或 IndexedDB。
- 放置与拖动通过桌垫平面的 raycast 得到世界坐标，并 clamp 到批准边界。
- 拖动开始后由贴纸拥有 pointer capture，阻止事件冒泡到本子或未来相机控制。
- 旋转使用选中贴纸后的 DOM 图标按钮，每次固定旋转 `15°`；删除要求明确命令，不做隐式拖出删除。

### 5.3 状态与持久化

领域层分别保存“贴纸是什么”和“贴纸放在哪里”。场景根据两者组合渲染；数据库和 store 不保存 Mesh、Texture、Vector3 或 PointerEvent。

应用启动时 repository 一次加载定义与实例，在 store 中形成可序列化贴纸快照。每次移动在 pointer up 时持久化最终坐标，拖动过程只更新内存投影，避免每帧写 IndexedDB。

## 6. 预计改动与影响评估

| 预计模块 | 预计责任 |
| --- | --- |
| `src/domain/sticker.ts` | 定义文字贴纸、空间实例、边界与验证规则 |
| `src/persistence/database.ts` | 升级 IndexedDB 到 v2，新增定义与实例表，保留 v1 日记数据 |
| `src/persistence/sticker-repository.ts` | 事务创建、加载、移动、旋转与删除贴纸 |
| `src/state/app-store.ts` 或贴纸 slice | 管理贴纸集合、制作/放置/选择模式和持久化动作 |
| `src/features/stickers/StickerComposer.tsx` | DOM 文字编辑、固定色板与创建命令 |
| `src/features/stickers/StickerControls.tsx` | 选中贴纸后的旋转和删除命令 |
| `src/scene/StickerObject.tsx`、`DeskScene.tsx` | CanvasTexture、raycast、拖动与场景投影 |
| 自动测试与文档 | 覆盖 v1→v2 迁移、事务、边界、交互、重开恢复与架构更新 |

### 6.1 核心数据结构变化

```ts
interface StickerDefinition {
  id: string
  kind: 'text'
  text: string
  color: 'paper' | 'rose' | 'gold' | 'mint'
  sourceEntryDate: LocalDate
  createdAt: string
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

IndexedDB v2 建议新增：

```text
stickerDefinitions: 'id, kind, sourceEntryDate, createdAt'
stickerInstances:   'id, definitionId, updatedAt'
```

升级只新增表，不改写 `dailyEntries`。v1 数据必须原样保留。首次切片一张 definition 对应一张 instance，但仍保持二者分离，为后续图片资源和复用保留清晰边界。

### 6.2 上下游与跨模块影响

- `DailyEntry` 不增加贴纸数组；关联由 `StickerDefinition.sourceEntryDate` 查询，避免日记记录承担双向同步。
- repository 返回领域对象，不向 store 暴露 Dexie table、collection 或事务。
- store 保存 number/string 构成的坐标与旋转；scene 在渲染时转换为 Three.js 对象。
- 删除实例与其首次切片专属 definition 必须在同一事务完成，避免孤立记录。
- 003 若先实施，贴纸入口只能在 `editing` 阶段出现；放置模式会先关闭本子并回到 `desk` 稳定态。
- 图片贴纸后续新增 `Asset` 与 `kind: 'image'`，不得改变文字定义的既有语义。

## 7. 风险、边界与回退

| 风险 | 发生条件 | 影响 | 缓解与回退 |
| --- | --- | --- | --- |
| v2 升级损坏日记 | 错误重建 v1 表 | 已保存文字丢失 | 只新增表；用 fake-indexeddb 验证 v1→v2 |
| 拖动时频繁写库 | 每个 pointer move 都持久化 | 卡顿与事务堆积 | 移动过程只改内存，pointer up 写最终值 |
| 中文纹理模糊 | CanvasTexture 分辨率不足 | 贴纸不可读 | 固定纹理像素密度并在移动端验收 |
| 事件穿透 | pointer capture 或 stopPropagation 缺失 | 拖贴纸时误开本子 | 拖动期间独占手势并覆盖自动测试 |
| 坐标超出桌垫 | 直接保存未约束 raycast 点 | 贴纸消失或难以找回 | 领域层 clamp，持久化前再次验证 |
| definition 成为孤儿 | 删除只移除 instance | 本地数据持续膨胀 | 同事务清理首次切片专属 definition |

回退代码时保留 IndexedDB v2 新表，不自动删除用户贴纸。若回退版本仍按 v1 打开数据库，它不会读取新表；任何清除贴纸数据的动作必须单独授权。

## 8. 验证与验收

- 自动测试：文字长度与颜色规则、空间边界、repository 事务、v1→v2 升级、store 模式和失败回滚。
- 构建与静态检查：运行 `npm run lint`、`npm run test`、`npm run build`。
- 浏览器验收：使用 ego-browser 在桌面和移动端创建、放置、移动、旋转、删除文字贴纸。
- Canvas 检查：确认文字纹理非空、中文可读、拖动前后像素与位置真实变化。
- 持久化与恢复：放置后重新加载并关闭/重开页面，坐标与旋转保持；删除后重开不恢复。
- 手势：拖动贴纸不打开本子、不移动相机，越界拖动被限制在桌垫内。
- 迁移：先在 v1 保存日记，再升级 v2，确认日记和新增贴纸同时存在。
- 成功标准：用户能把当天一句话变成一张留在桌上的可操作痕迹。

## 9. 待确认项与决策

### 决策 1：首个贴纸切片范围

**建议：先完成文字贴纸闭环，图片贴纸紧随其后单独审批。** 这次只承担空间交互与 v2 持久化，不同时引入 Blob 和图片生命周期。

### 决策 2：贴纸来源

**建议：默认带入当天记录，制作器允许缩短为最多 60 个字符。** 不要求先在正文中做文本选择，降低触屏和选区复杂度。

### 决策 3：旋转方式

**建议：选中后使用 DOM 图标按钮按 `15°` 旋转。** 比双指旋转更容易发现、测试和在桌面/移动端保持一致。

### 决策 4：实施顺序

**建议：002 收尾后先做 003，再做 004。** 贴纸放置模式可以复用 003 已稳定的 `desk` 状态，避免同时改相机、本子状态机和场景手势。

## 10. 最终批准方案

尚未批准。批准后记录文字/图片边界、来源、旋转方式与实施顺序。

## 11. 实施记录

尚未实施。当前没有贴纸数据、Dexie v2、制作器或场景贴纸对象。

## 12. 验证结果

已完成源码与产品范围只读核对；自动测试、迁移、构建和浏览器验收需在方案批准并实施后执行。

## 13. 文档同步检查

- 产品文档：已存在贴纸 MVP 范围；实施后补充本切片已完成和图片仍待实现的事实。
- 架构文档：实施后增加贴纸定义/实例、v2 schema、手势和场景投影链路。
- 决策文档：v2 本地数据边界和 definition/instance 分离若获批，应形成长期决策。
- 文档入口：批准或实施时加入 `docs/index.html`，并用 ego-browser 验证。

## 14. 审阅记录

| 时间 | 参与者 | 记录 |
| --- | --- | --- |
| 2026-08-06 15:34 CST | 用户 | 指出贴纸系统尚未接入。 |
| 2026-08-06 15:38 CST | Codex | 确认贴纸是 002 的明确非目标，并建立文字贴纸纵向切片待确认方案。 |
