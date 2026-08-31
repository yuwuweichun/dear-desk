# DD-20260830-002 房间概念图生成记录

## 首轮产物

- 候选图：`room-concept-v1.png`
- 尺寸：`1672 × 941`
- SHA-256：`3dc7736ed07d76ca2ede126b8fb91766b69c0223b3d4adc4c958b7d2c3c667a5`
- 生成方式：Codex 内置 `image_gen`，未使用 CLI/API 回退
- 用例分类：`stylized-concept`
- 图像角色：后续程序化房间建模的候选参考图；用户接受前不作为产品事实或建模输入

## 最终提示

```text
Use case: stylized-concept
Asset type: modeling-oriented concept art for a future procedural Three.js room
Primary request: Create one simple, intimate study room that visually harmonizes with the existing Dear Desk procedural furniture. The room should feel unmistakably like a quiet study, but remain sparse and easy to decompose into programmatic 3D parts.
Scene/backdrop: A clearly readable architectural shell with one rear wall, one side wall, visible wall-floor junctions, warm medium-dark wood plank floor, one simple rectangular window, and one modest open wooden bookcase containing a restrained number of books. Add at most one small framed blank artwork and one small plant; no other clutter.
Subject: Center the existing-style writing setup: one medium-dark walnut three-drawer writing desk with a softly rounded thick top, narrow-wide-narrow drawer arrangement, three small aged-brass knobs, four slightly tapered wooden legs, and understated aprons. On the desk place one continuous low-profile dark olive woven desk mat with compressed darker edging, and one closed cool dark-ink-green cloth notebook with a small horizontal brass nameplate. Keep these three objects clearly visible and visually dominant.
Style/medium: Polished stylized 3D concept render, bright gentle semi-realistic “light skeuomorphic” look suitable for procedural Three.js reconstruction; clean coherent geometry, modest rounded bevels, restrained PBR materials, not photorealistic and not toy-like.
Composition/framing: Landscape 16:9, main front three-quarter room view from slightly above seated eye level, mild wide angle without distortion. Show the complete desk and enough of the floor, rear wall, side wall, window, bookcase, and room corner to understand proportions. Do not let a chair or foreground object block the desk.
Lighting/mood: Soft daytime window light, warm-neutral interior bounce, calm and contemplative. The room background has lower contrast and saturation than the desk setup.
Color palette: Muted gray-sage walls centered around #8FA89E; walnut desk around #73411F with darker #593219 structure; dark olive desk mat around #2F432D with #283E29 binding; cool ink-green notebook around #173F35; warm ivory paper accents and restrained aged brass.
Materials/textures: Legible walnut grain, subtle woven cloth on mat and notebook, matte painted walls, lightly textured wood floor, low-contrast book spines. Materials should read clearly but avoid dense microdetail.
Constraints: Keep the room arrangement simple and structurally plausible. Preserve the single three-drawer desk, single desk mat, and single notebook as the focal grouping. Every major element should be separable into code-built geometry. No text, no labels, no logo, no watermark.
Avoid: people, animals, a second desk, desk lamp, computer, monitor, visible UI, fantasy architecture, elaborate moldings, floor-to-ceiling library walls, dense decorations, piles of objects, dramatic fog, extreme depth of field, harsh cinematic lighting, fisheye distortion, cut-off desk, blocked drawers, photorealistic photography, or toy-diorama proportions.
```

## 候选检查

- 通过：横向主三分之四构图；桌子完整可见，没有椅子或前景遮挡。
- 通过：后墙、左侧墙、房间角、墙—地交界、窗、地板和书架关系清楚。
- 通过：只有一张桌子、一张桌垫和一本本子；无人物、动物、电脑、显示器、文字、标志或水印。
- 通过：灰鼠尾草绿墙面、胡桃木、深橄榄织物、冷墨绿本子和黄铜细节形成与 V12/V2.2 相容的层级。
- 通过：陈设克制，书架、书、单幅空白画和一株小植物足以表达书房感，主要部件可以拆成程序化几何。
- 限制：图像中的桌体轮廓、抽屉比例、桌垫尺寸和本子尺度是生成式近似；后续必须以当前源码规格为几何事实，只把本图用于房间布局、材料关系与光照方向。
- 限制：单张图没有给出相机背面、房间右后方和窗外几何；若后续相机范围需要覆盖这些区域，应先补同设计的结构参考或明确推断边界。

## 后续停点

首轮候选已被用户要求精简，不再作为最终建模参考；它仅保留为生成过程证据。

## 验收修订：空房间壳

### 产物

- 任务内版本：`room-concept-v2-empty-shell.png`
- 正式概念资产：`../../concepts/simple-study-room-shell.png`
- 尺寸：`1672 × 941`
- SHA-256：`099bc0850f774746eb4e0465936f6c915d1639ee7c9832e8273ae24809d76cfa`
- 生成方式：Codex 内置 `image_gen` 精确编辑；`room-concept-v1.png` 是唯一 edit target
- 用例分类：`precise-object-edit`
- 图像角色：仅含窗户、墙和地板的程序化房间壳候选参考；用户接受前不启动 `$img2threejs`

### 编辑提示

```text
Use case: precise-object-edit
Asset type: modeling-oriented empty room shell concept for procedural Three.js reconstruction
Input image: Image 1 is the edit target.
Primary request: Remove every piece of furniture, every desk object, and every decoration from Image 1. The final image must contain only the window, walls, wall corner, wall-floor trim/baseboards, and wooden floor.
Remove completely: the walnut desk, all drawers and legs, desk mat, notebook, brass hardware, bookcase, every book, plant and pot, framed artwork and frame, and any shadows or contact marks belonging to those removed objects.
Fill the removed areas naturally with continuous gray-sage painted wall, existing baseboard geometry, and continuous wood plank floor that matches the surrounding perspective, plank direction, grain, finish, lighting, and shadows.
Preserve invariants exactly: keep the same 16:9 canvas, camera position, perspective, crop, room dimensions, left window shape and location, window trim and sill, view through the window, rear wall, side wall, room corner, baseboards, floor plank direction, gray-sage wall color, warm wood-floor color, soft daytime window light, exposure, and calm stylized 3D rendering style.
Constraints: Change only the removal and inpainting of objects. Do not redesign the room. Do not move, resize, add, or replace the window. Do not alter the camera or lighting. The empty room must remain structurally plausible and clean for programmatic modeling.
Avoid: any furniture, desk, chair, shelf, books, plants, artwork, frames, lamps, rugs, curtains, doors, outlets, switches, wall decorations, objects, people, animals, text, logo, watermark, new architectural features, or composition drift.
```

### 修订检查

- 通过：只保留一扇窗、两面墙、墙角、踢脚线与木地板。
- 通过：桌子、桌垫、本子、书架、书、画框、植物及其接触阴影均已移除。
- 通过：被遮挡区域由连续墙面、踢脚线和相同方向木地板自然补齐，没有残留悬浮几何。
- 通过：画幅、相机、窗户位置、墙角、地板透视、日间窗光和整体灰鼠尾草绿/暖木色关系基本保持。
- 通过：没有新增门、家具、灯具、装饰、人物、文字、标志或水印。
- 限制：生成式补全只提供可见面参考；相机背面、墙体厚度、窗洞深度和室外几何仍需在后续规格中标为推断。

## 后续停点

等待用户审阅空房间壳。只有用户明确接受 `simple-study-room-shell.png` 作为建模参考后，才可启动 `$img2threejs` 的图像适用性、状态初始化、质量契约和分阶段建模流程。
