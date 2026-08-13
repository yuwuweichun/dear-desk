# Research: Refine Desk Color and Material System

## Decision 1: Use Semantic Surface Roles

**Decision**: Treat background, desk, mat, notebook, and coral as roles rather than unrelated swatches: quiet canvas, warm structure, cooler work surface, focal object, and sparse accent.

**Rationale**: [Material 3 color roles](https://m3.material.io/styles/color/roles) assigns surface colors to backgrounds and large low-emphasis regions and uses surface-container levels for hierarchy. [Apple HIG Color](https://developer.apple.com/design/human-interface-guidelines/color) recommends semantic purpose, restrained application, and avoiding similar overlapping colors. These UI principles are adapted to a 3D scene as perceptual hierarchy; neither vendor prescribes these PBR values.

**Alternatives considered**: Independent by-eye swatches were rejected because they provide no stable hierarchy. Three equally saturated brand surfaces were rejected because they compete with the notebook.

## Decision 2: Warm Studio Was Implemented and Rejected

**Rejected decision**: Background `#DCE4E0`; wood top/frame/panel `#AD927C`, `#705E50`, `#BCA28B`; mat field/bumper `#78958A`, `#526F65`; wood PBR AO `.16`, bump `.0022`, clearcoat `.06`, clearcoat roughness `.82`, roughness `.80`; cloth PBR AO `.16`, bump `.0021`, roughness `.95`, sheen `.12`, sheen roughness `.95`.

**Observed rejection evidence**: Under the actual ACES tone mapping and existing warm/cool light rig, the source-space OKLCH hierarchy did not produce a good composition. The tabletop rendered pink-beige and weak, the mat rendered pale baby-mint, and the background/mat/desk became three similarly light gray-pastel planes. The notebook remained dark but looked abruptly placed rather than integrated. The user explicitly rejected the result as “好丑”.

**Negative constraint**: Do not restore this palette as a whole. Do not reuse the broader combination of a pale cool-gray-green background, pale pink-beige wood, and pale gray-green mat around the unchanged dark-green notebook. Do not treat low chroma or mathematically ordered lightness as sufficient acceptance evidence. Reconsidering any individual value requires new product-render screenshots, an explanation of why the rejected visual symptoms will not recur, and explicit user approval.

**Alternatives considered**:

- “Cool Fog” used a blue-gray background and slightly cooler material set. It was rejected as more clinical and because wood chroma nearly matched the notebook.
- “Paper Neutral” was most restrained but gave wood and mat almost identical lightness, making separation too dependent on hue and texture.
- A warmer, darker oak/gray-green set was considered, but it created stronger structural contrast and less of the requested calm, background-deferential composition.

**Lesson**: The stronger structural contrast previously rejected on theoretical grounds is now preferable to the flat pastel result. Future iterations must tune against the rendered product first and use color-space metrics only as supporting evidence.

## Decision 3: Make Palette Tokens the Sole Base-Color Owner

**Decision**: Convert only wood and cloth procedural albedo to neutral luminance modulation and explicitly tint all consuming materials from `SCENE_PALETTE`.

**Rationale**: Current wood albedo bakes approximately `[217,166,111]`, while the main wood material has no explicit token tint; current cloth albedo bakes approximately `[19,189,178]` and is multiplied by another saturated mint tint. This mixed ownership makes palette changes unpredictable. A neutral map plus semantic material tint supports one wood map across top/frame/panel and one cloth map across field/bumper without adding textures.

**Alternatives considered**: Baking final chromatic colors into maps was rejected because one shared wood texture cannot express three base roles cleanly. Adding separate maps was rejected because the fixed 16-texture budget is already saturated.

## Decision 4: Keep Texture Subordinate to Material Identity

**Decision**: Preserve existing multi-scale wood grain and woven cloth algorithms while reducing albedo, bump, clearcoat, and sheen amplitudes within the envelopes in `plan.md`.

**Rationale**: [Apple HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials) treats material as a way to establish depth, layering, and hierarchy and recommends using effects sparingly. Fine detail that dominates at distance becomes decoration and can shimmer under mipmapping. Macro variation should identify the material; meso detail provides tactility; micro detail remains weakest.

**Alternatives considered**: Flat colors were rejected because the user explicitly asked to refactor texture and because they erase wood/cloth identity. Conspicuous grain, weave, gloss, blur, or translucency were rejected because they compete with notebook edges and do not match the material semantics.

## Decision 5: Freeze Lighting and Effective Notebook Appearance

**Decision**: Do not alter the hemisphere light, directional lights, RoomEnvironment, fog distances, renderer exposure, geometry, or UVs. Lock notebook/paper colors, fixed kraft/paper samples, material parameters, and material-family mappings with tests.

**Rationale**: A lighting or exposure change would alter the notebook's effective appearance even if its material color stayed constant. The user explicitly requires the notebook color to remain unchanged. Current notebook materials are isolated from wood/cloth, so this invariant can be mechanically enforced.

**Alternatives considered**: Retuning the mint fill light to match the new palette was rejected as an unapproved scope expansion. If existing light color causes an unacceptable cast during implementation validation, the task must pause for renewed approval rather than silently compensating.

## Decision 6: Validate Hierarchy in Product and Material Views

**Decision**: Validate desktop/mobile product views at far, front, and near presets, plus desk/mat review views under representative light presets. Include grayscale inspection and identical-camera before/after notebook comparison.

**Rationale**: Material role pairings target perceptible separation, and Apple recommends checking varied display and lighting conditions. Numeric source-color luminance is useful only as design evidence because PBR, environment light, and tone mapping determine final pixels. Product views prove composition; review views isolate texture and grazing response.

**Alternatives considered**: Token-only tests were rejected because they cannot detect multiplication, lighting cast, moire, or loss of material identity. Review-scene-only validation was rejected because its exposure and framing differ from the product.

## Current Constraints Confirmed

- Current model budget: 45 draw calls, 80,000 triangles, 16 textures, one shadow-casting light, DPR 1-1.5.
- Current fixed scene measurement: 31 draw calls, 38,556 triangles, 16 textures.
- Current focused test `src/scene/models/model-factories.test.ts`: 8 tests passed during planning.
- `SCENE_PALETTE.wood` and `mintSoft` currently have no runtime consumer; no new consumer will be invented.
- CSS and Sticker Studio also contain the old mint literal. They are DOM-theme surfaces and remain out of scope; the WebGL Canvas uses `alpha: false`, so its background controls the product desk scene.
- `docs/architecture/system-overview.html` says 12 shared textures in two places, while source and tests use 16. The skill was not present in the session's initial Available skills snapshot and disallows implicit invocation, but the user explicitly supplied `$bun-html-docs`; implementation closeout can therefore correct the existing shell page and run its required direct-file desktop/mobile verification.

## Official References

- [Material 3: Color roles](https://m3.material.io/styles/color/roles)
- [Material 3: Choosing a scheme](https://m3.material.io/styles/color/choosing-a-scheme)
- [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple HIG: Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
