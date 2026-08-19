# 铭牌刻字颜色视觉对比

生成日期：2026-08-19  
评审状态：等待选择最终颜色  
关联记录：[`DD-20260819-005`](../changes/2026-08-19-005-nameplate-color-comparison.md)

## 对比说明

五张截图使用相同的文字“我的本子”、玄冬楷书、近处机位、场景光照和黄铜铭牌，只替换凹刻纹理的主体色、阴影与边缘高光。页面查询参数只用于本次视觉评审，不写入 Zustand、IndexedDB 或用户设置；无查询参数时仍使用当前默认的深咖啡铜。

由于刻字在完整桌面截图中占比较小，本文优先展示同一坐标裁切的铭牌局部，原始 1920×1050 截图可点击下方“完整截图”查看。

## 候选结论

| 候选 | 主色 | 视觉评价 |
| --- | --- | --- |
| 黑色 | `#161616` | 对比最强、识别最稳，传统机械刻字感最明显；气质略硬。 |
| 深咖啡铜 | `#4a2d15` | 与黄铜同属暖色系，凹刻自然且不过分跳出；当前推荐。 |
| 深青铜 / 青铜黑 | `#304238` | 与墨绿色封面呼应，整体感强；在当前光线下色差较含蓄。 |
| 暗酒红 | `#5a2424` | 有旧印章和漆填刻字的感觉，个性更强；不如黑色中性。 |
| 深铜棕 | `#57321f` | 比深咖啡铜更暖，复古感明显；与黄铜接近时边界较柔。 |

推荐优先比较“深咖啡铜”和“黑色”：前者更像自然氧化后的黄铜凹槽，后者在当前镜头距离下可读性最好。最终颜色尚未写成产品决策。

## 1. 黑色

![黑色刻字局部](../assets/nameplate-color-comparison/black-detail.png)

[查看完整截图](../assets/nameplate-color-comparison/black.png)

## 2. 深咖啡铜

![深咖啡铜刻字局部](../assets/nameplate-color-comparison/espresso-detail.png)

[查看完整截图](../assets/nameplate-color-comparison/espresso.png)

## 3. 深青铜 / 青铜黑

![深青铜刻字局部](../assets/nameplate-color-comparison/bronze-detail.png)

[查看完整截图](../assets/nameplate-color-comparison/bronze.png)

## 4. 暗酒红

![暗酒红刻字局部](../assets/nameplate-color-comparison/oxblood-detail.png)

[查看完整截图](../assets/nameplate-color-comparison/oxblood.png)

## 5. 深铜棕

![深铜棕刻字局部](../assets/nameplate-color-comparison/copper-detail.png)

[查看完整截图](../assets/nameplate-color-comparison/copper.png)

## 选择后续

用户选择最终颜色后，再将对应色板固化为默认产品表现，并同步更新产品事实；本评审文档本身不改变既有铭牌内容、字体、字符限制或持久化设置。
