# Quickstart: Validate Desk Color and Materials

## Prerequisites

- Node.js 22+
- Existing project dependencies installed
- User approval recorded in `docs/changes/2026-08-13-003-refine-desk-color-material-system.md` before any implementation
- ego-browser available for product and material visual checks

## 1. Review the Contract

Read:

- `specs/003-refine-desk-color-material-system/data-model.md`
- `specs/003-refine-desk-color-material-system/contracts/visual-material-contract.md`

Confirm the implementation diff is limited to the approved material library, focused tests, product current-fact documentation, and the change record. Any light, exposure, geometry, UV, DOM theme, notebook/paper, state, or dependency change requires renewed approval.

## 2. Run Focused Automated Tests

```bash
npm test -- --run src/scene/models/model-factories.test.ts
```

Expected outcomes:

- Selected background, wood, and cloth role tokens pass exact assertions.
- Wood and cloth fixed-coordinate neutral-albedo samples pass and remain deterministic.
- Kraft/paper samples and notebook/paper material parameters match the frozen baseline.
- Texture family/channel count remains 16; material mapping, budget, and disposal tests pass.

## 3. Run the Full Gate

```bash
npm run check
git diff --check
```

Expected outcomes: lint, all Vitest tests, TypeScript/Vite build, document references, and whitespace checks pass.

## 4. Start the Product for Visual Validation

```bash
npm run dev -- --host 127.0.0.1
```

Use the printed free port. With ego-browser, reuse the task space for this goal and keep the local task space open after verification. Validate the product scene at 1440 x 900 and 390 x 844/DPR 2, cycling far, front, and near camera presets.

For each of the six combinations, check the acceptance matrix in the visual contract. Capture or retain evidence for:

- focal order and grayscale silhouette;
- background/desk/mat separation;
- wood and cloth identity;
- far/mobile shimmer or moire;
- notebook effective appearance under identical camera/light/state;
- single Canvas, intact controls, and no horizontal overflow.

## 5. Review Materials in Isolation

Using the same dev server and ego-browser task space, open the existing development review routes for `desk` and `mat`. Exercise their supported neutral and grazing light/view parameters as exposed by `ModelReviewScene`.

Expected outcomes:

- Wood macro flow reads without strong gloss or noisy pores.
- Cloth weave reads close-up without screen-scale aliasing at distance.
- No new map, renderer, or shadow light appears.

Product-scene screenshots are authoritative for final palette judgment because the review scene uses different exposure and framing.

## 6. Reopen and Recheck

Reload the product page and confirm the same palette and material output returns. This is a determinism check, not a persistence migration test; no stored data should change.

## 7. Documentation Closeout

- Compare the actual Git diff against `plan.md` line by line.
- Update `docs/product/mvp.md` with the shipped current visual facts.
- Update the change record with actual files, deviations, tests, browser evidence, and status `待验收`.
- Run `node scripts/check-doc-references.mjs` again.
- Invoke the user-supplied `$bun-html-docs` skill before correcting the two stale 12-texture statements in `docs/architecture/system-overview.html`. Preserve the existing shell rather than scaffolding over it, then open the file directly with ego-browser and verify its search, navigation, Wiki, copy, focus, overflow, and 1440 x 900 / 390 x 844 layouts.
