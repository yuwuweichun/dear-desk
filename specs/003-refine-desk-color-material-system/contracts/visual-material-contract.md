# Visual Material Contract

## Purpose

This contract defines the externally observable result of the scene color/material refactor and the invariants implementation must preserve.

## Role Contract

1. The background is the quietest and lightest large plane.
2. The desk reads as warm, low-chroma natural wood and supports the composition.
3. The mat reads as cooler gray-green woven cloth and frames the work area.
4. The notebook remains `#173F35` / `#0E2D27`, is the deepest stable object, and is visually legible against the mat without depending on hue or texture alone.
5. Coral remains a sparse existing accent, not a large-surface color.

## Rejected Palette Contract

The following Warm Studio implementation is explicitly rejected and MUST NOT become a default or approved baseline:

- Background `#DCE4E0`.
- Wood `#AD927C` / `#705E50` / `#BCA28B`.
- Mat `#78958A` / `#526F65`.
- Wood PBR: AO `.16`, bump `.0022`, clearcoat `.06`, clearcoat roughness `.82`, roughness `.80`.
- Cloth PBR: AO `.16`, bump `.0021`, roughness `.95`, sheen `.12`, sheen roughness `.95`.

The prohibited pattern is broader than exact token equality: do not recreate three large, similarly light pastel planes consisting of a pale cool-gray/green background, pink-beige light wood, and pale gray-green/baby-mint mat next to the unchanged dark-green notebook. A future proposal may reconsider one value only with materially different rendered evidence and explicit user approval; it may not restore the whole combination by claiming compliance with Google, Apple, OKLCH, or low-chroma principles.

## Version Contract

- Every perceptible palette or PBR revision MUST have a stable version identifier.
- V0 is the historical baseline; V1 is the rejected Warm Studio implementation; V2.0 is the approved walnut/blue-gray correction.
- A version's tokens, PBR parameters, rendered evidence, status, and user conclusion MUST remain recorded after supersession.
- Screenshot-driven tuning within the V2 direction increments V2.1, V2.2, and so on; it MUST NOT silently rewrite V2.0.

## Material Contract

- Wood shows broad directional flow, smaller grain, and restrained pores without plastic gloss.
- Cloth shows a fine soft weave without becoming a screen-scale pattern.
- Background has no added texture.
- Wood/cloth albedo detail modulates lightness and does not own a second chromatic palette.
- Mipmaps, filters, wrapping, anisotropy, texture sizes, UVs, and 16-texture total remain unchanged.

## Frozen Notebook Contract

- Cover colors: `#173f35`, `#0e2d27`.
- Kraft and paper fixed-coordinate samples: exactly as listed in `data-model.md`.
- Cover PBR: AO `0.3`, bump `0.0014`, roughness `0.96`; dark cover roughness `0.98`.
- Paper PBR: AO `0.12`, bump `0.0018`, roughness `0.98`; edge roughness `0.96`.
- Existing kraft/paper textures, material type, map sharing, geometry, UV scale, lighting, and exposure are unchanged.

## Behavioral Invariants

- One active WebGL Canvas.
- No new dependency, network texture, renderer, light, persisted state, event, or public interface.
- No geometry, camera, animation, hit-area, sticker-bound, notebook-opening, or resource-lifecycle change.
- Existing resource limit and disposal tests continue to pass.

## Visual Acceptance Matrix

| Viewport | Camera | Must Verify |
| --- | --- | --- |
| 1440 x 900 | Far | Background recedes; desk silhouette and warm material read; no texture shimmer |
| 1440 x 900 | Front | Desk/mat separate without saturated jump; notebook is first stable focal object |
| 1440 x 900 | Near | Wood grain and cloth weave are visible but quieter than notebook edges |
| 390 x 844, DPR 2 | Far | Large surfaces remain coherent and no pattern aliases |
| 390 x 844, DPR 2 | Front | Mat bumper, field, desk, and notebook boundaries remain distinct |
| 390 x 844, DPR 2 | Near | Notebook color matches baseline and supporting textures do not dominate |

Additional material review checks cover desk and mat under neutral and grazing presets. A grayscale inspection must preserve the notebook silhouette against the mat. Before/after notebook screenshots must use identical camera, lighting, exposure, viewport, and state.

## Failure and Escalation Contract

- If the old mint light cast makes the approved palette unacceptable, record the evidence and seek renewed approval; do not change lights or exposure under this plan.
- If the notebook appears materially different despite frozen parameters, stop and diagnose color multiplication/tone mapping before delivery.
- If avoiding moire requires UV, texture size, or geometry changes, treat it as a scope change.
- If DOM theme colors visibly conflict, record a separate follow-up; do not recolor Sticker Studio or shared UI in this task.
- If a proposed palette approaches the rejected Warm Studio tokens or recreates its pastel/lightness relationship, stop and surface the negative constraint before editing source.
- Product screenshots and user approval override source-space palette metrics when they conflict.
