# Dear Desk V1-V10 配色台账

状态：V1-V10 已全部否决。V2 仅为当前运行回退值，不代表视觉验收通过。

## 比较边界

- V2-V10 固定模型、灯光、曝光、纹理、PBR、`1440 × 900` 视口与远景/近景机位，只改变背景、木桌和桌垫角色色。
- V1 使用用户否决时的真实旧截图和旧 PBR，不伪造为新材质下的渲染。
- 本子固定为 `#173F35` / `#0E2D27`，纸张固定为 `#FFFBE7` / `#E6DCC4`。
- 无参数产品页和 production build 均保持 V2；候选不会写入持久化状态。

## 精确色值

| 版本 | 色系 | 背景 | 木桌主面 | 木桌框架 | 木桌嵌板 | 桌垫工作面 | 桌垫 bumper | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V1 | Warm Studio | `#DCE4E0` | `#AD927C` | `#705E50` | `#BCA28B` | `#78958A` | `#526F65` | 已否决，禁止默认恢复 |
| V2 | 冷灰胡桃木 + 蓝灰 | `#D5DAD8` | `#927054` | `#5F4939` | `#AA8768` | `#73858A` | `#4C5E63` | 已否决；当前运行回退值 |
| V3 | 海军蓝 + 蜂蜜木 | `#D8DEE2` | `#A9794F` | `#654832` | `#BF9268` | `#536B7B` | `#344B59` | 已否决 |
| V4 | 陶土酒红 + 烟熏木 | `#DDD8D2` | `#856047` | `#573E31` | `#A77B5C` | `#8A5D59` | `#603F3C` | 已否决 |
| V5 | 石墨灰 + 焦糖木 | `#D3D5D5` | `#9A6C46` | `#59402F` | `#B5845C` | `#5C6263` | `#3B4142` | 已否决 |
| V6 | 灰紫 + 深核桃木 | `#DDD9DE` | `#89634D` | `#503A2F` | `#A77E66` | `#71697A` | `#4E4857` | 已否决 |
| V7 | 赭黄 + 黑胡桃木 | `#D9D8D1` | `#795640` | `#463228` | `#956E54` | `#9A8354` | `#6D5C38` | 已否决 |
| V8 | 丹宁蓝 + 浅烟橡木 | `#D7DADD` | `#A4866B` | `#625044` | `#B99A7E` | `#596D82` | `#3D5064` | 已否决 |
| V9 | 砖红 + 深橡木 | `#DAD6D2` | `#805943` | `#4B352A` | `#9B7057` | `#985F4F` | `#693F35` | 已否决 |
| V10 | 黑白中性 + 古铜木 | `#D5D7D7` | `#8B6548` | `#49372B` | `#A67E5D` | `#4F5555` | `#303535` | 已否决 |

## 截图索引

每版均包含 `overview.png`（远景）和 `detail.png`（近景）：

- V1：`assets/v01/overview.png`、`assets/v01/detail.png`
- V2：`assets/v02/overview.png`、`assets/v02/detail.png`
- V3：`assets/v03/overview.png`、`assets/v03/detail.png`
- V4：`assets/v04/overview.png`、`assets/v04/detail.png`
- V5：`assets/v05/overview.png`、`assets/v05/detail.png`
- V6：`assets/v06/overview.png`、`assets/v06/detail.png`
- V7：`assets/v07/overview.png`、`assets/v07/detail.png`
- V8：`assets/v08/overview.png`、`assets/v08/detail.png`
- V9：`assets/v09/overview.png`、`assets/v09/detail.png`
- V10：`assets/v10/overview.png`、`assets/v10/detail.png`

## 用户结论

用户已明确判定 V1-V10 全部不通过。后续不得把其中任一整套方案恢复为默认；如复用单个色值，必须放入新的、可独立验收的方案并提供真实截图。下一步转向开放颜色编辑器，用实时试色区分配色问题与模型造型问题。
