# Feature Specification: Refine Desk Color and Material System

**Feature Directory**: `specs/003-refine-desk-color-material-system`
**Created**: 2026-08-13
**Status**: Draft for plan review
**Change Record**: `docs/changes/2026-08-13-003-refine-desk-color-material-system.md`

## User Scenarios & Testing

### User Story 1 - See the notebook as the primary focus (Priority: P1)

When the user arrives at the desk, the unchanged dark-green notebook is visually dominant over the background, desk, and desk mat without relying on new decoration or animation.

**Independent Test**: Open the desk at far, front, and near camera presets on desktop and mobile and compare the visual hierarchy.

**Acceptance Scenarios**:

1. **Given** the desk scene is open, **When** any supported camera preset is shown, **Then** the background recedes, the desk and mat read as supporting surfaces, and the notebook remains the primary dark focal object.
2. **Given** the refactor is applied, **When** notebook material tokens and sampled kraft texture values are compared with the baseline, **Then** the notebook cover colors and texture behavior are unchanged.

### User Story 2 - Read desk and mat as distinct, coherent materials (Priority: P2)

The user can distinguish a warm natural wood desk from a quieter woven desk mat, while both belong to one restrained palette.

**Independent Test**: Inspect the tabletop and mat at near and far presets for material identity, edge separation, and texture stability.

**Acceptance Scenarios**:

1. **Given** the near view, **When** the tabletop and mat are inspected, **Then** multi-scale wood grain and woven cloth structure are visible without looking glossy or noisy.
2. **Given** the far view or a mobile viewport, **When** the camera is stationary or transitioning, **Then** texture detail does not produce obvious shimmer, moire, or high-frequency distraction.

### User Story 3 - Preserve all existing behavior (Priority: P3)

The user can continue using the desk, notebook, and stickers exactly as before because the change is visual-only.

**Independent Test**: Run existing automated checks and basic desk interactions after the visual refactor.

**Acceptance Scenarios**:

1. **Given** the new palette and textures, **When** the user changes camera preset, opens the notebook, or interacts with desk stickers, **Then** geometry, hit areas, state, animation, and persistence behavior are unchanged.
2. **Given** materials are created and disposed, **When** existing resource tests run, **Then** texture count, draw-call budget, material separation, and disposal guarantees still pass.

## Requirements

### Functional Requirements

- **FR-001**: The scene MUST use a restrained cool-neutral background that visually recedes behind the desk.
- **FR-002**: The desk MUST use a low-chroma warm natural-wood palette with recognizable multi-scale grain.
- **FR-003**: The desk mat MUST use a medium-light, low-to-medium-chroma gray-green palette with recognizable woven structure.
- **FR-004**: The notebook cover colors `#173f35` and `#0e2d27`, its kraft texture sampling, and its material parameters MUST remain unchanged.
- **FR-005**: Large surfaces MUST not compete through high saturation; chroma emphasis MUST remain limited to the unchanged notebook and small existing accent details.
- **FR-006**: Surface separation MUST be conveyed through coordinated lightness, chroma, roughness, and texture rather than outlines or new geometry.
- **FR-007**: Wood and cloth textures MUST remain deterministic, locally generated, mipmapped, and independent of external assets or network access.
- **FR-008**: The implementation MUST retain the existing single WebGL Canvas, model geometry, UVs, camera, lighting, hit areas, animations, state ownership, and persistence contracts.
- **FR-009**: Automated tests MUST lock the selected palette, preserve notebook material invariants, and retain texture/resource budget guarantees.
- **FR-010**: Visual validation MUST cover far, front, and near presets at desktop and mobile viewport sizes with ego-browser.

### Visual Logic

- Use role-based color assignment: background as canvas, desk as warm structural surface, mat as cooler work surface, notebook as focal object, coral as sparse accent.
- Prefer a lightness hierarchy that survives reduced saturation and common display variation.
- Avoid adjacent large surfaces with similar hue and saturation unless their lightness and material response clearly separate them.
- Keep texture contrast subordinate to object recognition: macro variation establishes material, meso detail adds tactility, micro detail must not dominate at distance.
- Apply platform guidance as principles, not as a literal Material Design or Apple UI skin: restrained semantic color roles, consistent surfaces, sufficient contrast, and deference to content.
- The rejected Warm Studio combination documented in `research.md` and `contracts/visual-material-contract.md` MUST NOT be restored by default, including visually equivalent pale cool-gray/green background + pink-beige light wood + pale gray-green mat combinations.
- Rendered product evidence and explicit user acceptance MUST take precedence over source-space color metrics when they disagree.

## Scope Boundaries

### In Scope

- Scene background palette.
- Desk wood palette, procedural albedo, and proportionate PBR tuning.
- Desk mat palette, procedural albedo, and proportionate PBR tuning.
- Tests and current-fact documentation directly affected by those changes.

### Out of Scope

- Notebook and paper appearance.
- Geometry, layout, camera, lighting redesign, animation, interaction, and persistence.
- DOM UI theming, user-selectable themes, external texture assets, and additional renderers.

## Success Criteria

- **SC-001**: Across all six required viewport/preset combinations, reviewers identify the notebook as the primary focal object and no large supporting surface is more visually saturated than it.
- **SC-002**: Wood and cloth remain visually distinguishable at near view and stable at far/mobile views without obvious moire or shimmer.
- **SC-003**: Notebook palette, kraft samples, and notebook material parameters match the pre-change baseline through automated assertions.
- **SC-004**: Existing targeted model tests and `npm run check` pass without increasing texture or draw-call budgets.
- **SC-005**: No source changes occur outside the material/palette path, directly affected tests, and required documentation unless a newly discovered scope change is separately approved.

## Assumptions

- The user delegates exact supporting-surface color selection to the design plan, subject to approval before implementation.
- Existing coral details remain sparse accents and are not recolored unless validation demonstrates a blocking contrast problem; such a change requires renewed approval.
- No accessibility claim is made from numeric text contrast ratios because this is a non-text 3D scene; visual validation instead checks object boundary and focal hierarchy across supported viewports.
