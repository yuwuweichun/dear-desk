# Implementation Plan: Refine Desk Color and Material System

**Feature Directory**: `specs/003-refine-desk-color-material-system` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Change Record**: `docs/changes/2026-08-13-003-refine-desk-color-material-system.md`

**Input**: Feature specification from `specs/003-refine-desk-color-material-system/spec.md`

## Summary

Refactor the scene background, desk wood, and desk-mat cloth into a restrained “Warm Studio” hierarchy while preserving the notebook and paper appearance exactly. The implementation will keep the current material library and 16-texture budget, make palette tokens the single owner of surface base color, reduce procedural albedo to neutral luminance modulation, and tune only the existing wood/cloth PBR parameters. No geometry, lighting, camera, interaction, state, persistence, dependency, or Canvas ownership changes are planned.

## Technical Context

**Language/Version**: TypeScript 6.0.3, React 19.2.8, Node.js 22+

**Primary Dependencies**: Three.js 0.185.1, `@react-three/fiber` 9.7.0, Vite 8.2.0; no new dependency

**Storage**: N/A; visual constants and generated runtime textures only, with no persisted state change

**Testing**: Vitest 4.1.10, ESLint 10.8.0, TypeScript/Vite production build, document reference checker, ego-browser visual validation

**Target Platform**: Modern desktop and mobile browsers with WebGL; supported validation viewports 1440 x 900 and 390 x 844 at product DPR limits

**Project Type**: Single-page web application with one active WebGL Canvas

**Performance Goals**: Preserve the fixed scene budget of at most 45 draw calls, 80,000 triangles, 16 textures, one shadow-casting light, and DPR 1-1.5; introduce no new texture generation or runtime fetch

**Constraints**: Notebook and paper appearance unchanged; existing light rig/exposure unchanged; deterministic offline PBR maps; no geometry, UV, interaction, camera, persistence, DOM-theme, or second-Canvas changes

**Scale/Scope**: One palette/material library, two procedural surface families (`wood`, `cloth`), two consuming model factories, one focused test file, and required current-fact documentation

## Constitution Check

*GATE: Passed before Phase 0 and passed again after Phase 1.*

| Gate | Pre-Research | Post-Design |
| --- | --- | --- |
| Change record and approval | `DD-20260813-003` exists and is `待确认`; planning is authorized, implementation is not | Plan remains design-only; no business source, dependency, config, or persisted data was modified |
| MVP alignment | Refines the approved bright, tactile desk visual and does not add a non-goal | Scope remains a minimal vertical visual slice and preserves all product behavior |
| State/rendering ownership | Existing single R3F Canvas and shared runtime material library remain | Contract explicitly forbids new persisted state, renderer, texture family, or Canvas |
| Verification | Focused material tests, full `npm run check`, and ego-browser desktop/mobile checks required | Quickstart defines exact automated and six product-camera checks plus material review views |
| Documentation | Product current fact must be updated after implementation; architecture change not expected | Existing architecture HTML incorrectly says 12 textures while source/tests use 16; `$bun-html-docs` is installed and was explicitly provided by the user, so implementation closeout can correct and verify the HTML through the required workflow |
| Rollback | Palette, wood/cloth samplers, and PBR parameters can be reverted independently | No data rollback or migration is needed |
| Renewed approval | Required for lights, exposure, geometry, UV, coral, DOM theme, notebook/paper, public APIs, persistence, or new textures | No design artifact adds any of those changes |

There are no constitution violations requiring complexity justification. `$bun-html-docs` was absent from the session's initially injected Available skills list and declares `allow_implicit_invocation: false`, but the user subsequently invoked it explicitly and supplied its valid `SKILL.md` path. The required content and shell references have now been read, so the implementation closeout may correct the existing architecture HTML fact conflict and must use the skill's direct-file ego-browser verification workflow.

## Project Structure

### Documentation (This Feature)

```text
specs/003-refine-desk-color-material-system/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── visual-material-contract.md
```

### Source Code (Repository Root)

```text
src/
├── app/
│   └── App.tsx
├── scene/
│   ├── DeskScene.tsx
│   ├── ModelReviewScene.tsx
│   └── models/
│       ├── material-library.ts
│       ├── create-desk-model.ts
│       ├── create-desk-mat-model.ts
│       ├── create-notebook-model.ts
│       ├── model-factories.test.ts
│       └── model-specs.ts
└── styles.css

docs/
├── product/mvp.md
├── architecture/system-overview.html
└── changes/2026-08-13-003-refine-desk-color-material-system.md
```

**Structure Decision**: Keep the existing single-app layout. `material-library.ts` remains the sole owner of runtime scene color, generated texture, and PBR values. Model factories continue to consume shared materials without taking color ownership. `DeskScene.tsx`, `SceneEnvironment.tsx`, model geometry/spec files, `styles.css`, and the unimported legacy `src/scene/scene-visuals.ts` stay unchanged unless a separately approved scope change is raised.

## Design

### Palette Roles

> **Rejected after implementation**: The values in this table describe the first approved implementation, not an accepted final palette. They are retained as negative history and must not be restored as a set. See `research.md` and `contracts/visual-material-contract.md` for the rejection evidence and reuse gate.

| Role | Selected Value | Consumer | Intent |
| --- | --- | --- | --- |
| Background / fog | `#DCE4E0` | Product and model-review scene background | Cool near-neutral, highest lightness, lowest emphasis |
| Wood top | `#AD927C` | `materials.walnut` | Low-chroma warm structural surface |
| Wood frame | `#705E50` | `materials.walnutDark` | Recessed structural depth, still lighter than notebook |
| Wood panel | `#BCA28B` | `materials.walnutPanel` | Quiet raised/inset variation |
| Mat field | `#78958A` | `materials.cloth` | Medium-light gray green, cooler than wood |
| Mat bumper | `#526F65` | `materials.clothDark` | Frames the field without matching the notebook |
| Notebook | `#173F35` / `#0E2D27` | Notebook cover and joints | Unchanged primary focal object |

Existing paper, coral, stitch, shadow, and neutral tokens remain unchanged. `mintSoft` has no runtime consumer and will not be assigned a new visual responsibility in this task. Renaming public-looking token keys is optional internal churn and is excluded; current keys can retain compatibility while their documented role changes from saturated mint to gray-green cloth.

### Versioning Rule

- V0: historical saturated baseline.
- V1: rejected Warm Studio values in the table above; retained only as negative history.
- V2.0: approved correction using background `#D5DAD8`, wood `#927054` / `#5F4939` / `#AA8768`, and mat `#73858A` / `#4C5E63`.
- Any perceptible follow-up adjustment MUST create V2.1, V2.2, and so on, preserving prior exact tokens, PBR values, screenshots, and user conclusions in the change record.

### Color Ownership

1. Retain one generated albedo map per surface family.
2. Change only `wood` and `cloth` albedo samples from baked chromatic RGB to near-white neutral RGB modulation.
3. Explicitly set `walnut.color` to `SCENE_PALETTE.wood`; existing clones receive `woodDark` and `woodPanel`.
4. Keep `cloth` and `clothDark` token-driven, now multiplying neutral rather than saturated cloth albedo.
5. Leave `kraft` and `paper` sampling and all notebook/paper material construction byte-for-byte unchanged.

This resolves the current mixed ownership where wood top is baked into the map and cloth is both baked and tinted. The exact neutral base and variation amplitudes are implementation parameters, but fixed-coordinate tests must make them deterministic and ensure the texture acts as luminance detail rather than a second color source.

### Texture and PBR Envelope

| Surface | Albedo Detail | PBR Envelope |
| --- | --- | --- |
| Wood | Preserve directional macro/meso/micro grain and pores; macro 6-10, meso 3-6, micro 1-2 sRGB levels; neutral channels | AO `0.12-0.18`; bump `0.0018-0.0025`; roughness `0.78-0.84`; clearcoat `0-0.08`; clearcoat roughness `0.75-0.90` |
| Cloth | Preserve warp/weft/twill; macro 3-5, yarn 1-3, weave 1-2 sRGB levels; neutral channels | AO `0.12-0.20`; bump `0.0016-0.0024`; roughness `0.93-0.97`; sheen `0.08-0.14`; sheen roughness at least `0.95` |

Mipmaps, trilinear minification, linear magnification, repeat wrapping, anisotropy, texture size, texture family/channel names, and UV scales remain unchanged. Micro contrast stays weakest to avoid shimmer and moire at far/mobile views.

### Real Call Chain and Planned Files

```text
src/app/App.tsx
  -> DeskScene
     -> createModelMaterialLibrary()
        -> createTextureSet(wood | cloth | kraft | paper)
        -> shared ModelMaterialLibrary
     -> createDeskModel(materials)
     -> createDeskMatModel(materials)
     -> createNotebookModel(materials)
```

- Modify `src/scene/models/material-library.ts` for selected tokens, neutral wood/cloth albedo ownership, and bounded wood/cloth PBR tuning.
- Modify `src/scene/models/model-factories.test.ts` to lock role tokens, fixed wood/cloth samples, exact notebook/kraft/paper invariants, material mappings, deterministic channels, resource counts, and disposal.
- Update `docs/product/mvp.md` after implementation so current visual facts match the shipped palette/materials.
- Use `$bun-html-docs` to correct the stale 12-texture statements in `docs/architecture/system-overview.html`, preserving its existing document shell and verifying the local file at desktop/mobile sizes.
- Update this change record with actual differences, verification, and any deviation.
- Do not change `src/scene/DeskScene.tsx`, `SceneEnvironment.tsx`, geometry/model specs, `styles.css`, or interaction/state code under the approved plan.

## Phase Outputs

- Phase 0 research: [research.md](./research.md)
- Phase 1 data design: [data-model.md](./data-model.md)
- Phase 1 visual contract: [contracts/visual-material-contract.md](./contracts/visual-material-contract.md)
- Phase 1 validation guide: [quickstart.md](./quickstart.md)

## Complexity Tracking

No constitution violations or new abstractions are proposed.
