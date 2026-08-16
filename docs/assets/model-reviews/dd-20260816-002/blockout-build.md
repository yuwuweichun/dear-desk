# Blockout Build Evidence

- Generated baseline: `generated/desk-blockout.ts` from the strict `2.1` sculpt spec.
- Product factory: `src/scene/models/create-desk-model.ts` now uses the approved `warm-paper-atelier-desk` hierarchy and keeps stage visibility controlled by `ModelBuildPass`.
- `blockout` visible parts: one `12 × 8 × 0.58` rounded tabletop, one front apron mass, and four separated tapered leg masses.
- Exact blockout changes from the replaced island desk:
  - model identity changed from `animal-island-desk` / `single-top-panel-support-island` to `warm-paper-atelier-desk` / `three-drawer-tapered-leg-writing-desk`;
  - removed the two `1.05 × 2.9 × 5.3` side panels from the model hierarchy;
  - restored four rounded-square legs at `x = ±5.08`, `z = ±3.08`, with `topRadius = 0.36`, `bottomRadius = 0.22`, and `height = 2.96`;
  - kept the product tabletop footprint and centre height unchanged, while changing the plan radius from the island model's `0.72` to the reference-bounded `0.52`;
  - front apron remains `11.36 × 0.86 × 0.24` and overlaps the leg tops, preserving an open knee-space silhouette.
- Build verification: `npm run build` passed after the blockout source change.
- Not yet visually proven: reference-camera framing, apparent leg height, rear-leg separation, and plan-radius match. These require the blocked browser capture step.
