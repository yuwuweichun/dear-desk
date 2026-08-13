# Data Model: Visual Material Roles

This feature changes no domain entity, store shape, IndexedDB schema, serialized value, or state transition. The following are compile-time/runtime visual configuration concepts used to make the implementation and tests precise.

## ScenePalette

**Owner**: `src/scene/models/material-library.ts`

| Field | Type | Selected Value | Runtime Consumer | Validation |
| --- | --- | --- | --- | --- |
| `background` | hex sRGB string | `#dce4e0` | Scene background and fog | Exact token test |
| `wood` | hex sRGB string | `#ad927c` | Main tabletop material | Must be explicitly assigned |
| `woodDark` | hex sRGB string | `#705e50` | Aprons, supports, bridge | Exact token/material test |
| `woodPanel` | hex sRGB string | `#bca28b` | Support inset panels | Exact token/material test |
| `mint` | hex sRGB string | `#78958a` | Recessed mat field | Existing key retained for compatibility |
| `mintDark` | hex sRGB string | `#526f65` | Mat bumper and binding | Existing key retained for compatibility |
| `mintSoft` | hex sRGB string | unchanged/no new role | None | Must not gain a consumer in this task |
| `notebookCover` | hex sRGB string | `#173f35` | Notebook cover | Exact frozen invariant |
| `notebookCoverDark` | hex sRGB string | `#0e2d27` | Notebook joints/dark cover | Exact frozen invariant |

All other existing palette fields remain unchanged.

## SurfaceProfile

**Existing families**: `wood`, `cloth`, `kraft`, `paper`

**Fields**:

| Field | Type | Meaning |
| --- | --- | --- |
| `albedo` | RGB byte tuple | Neutral luminance modulation for wood/cloth; frozen chromatic sampling for kraft/paper |
| `ao` | byte | Ambient-occlusion channel |
| `height` | byte | Bump-height channel |
| `roughness` | byte | Roughness modulation channel |

**Validation rules**:

- The same `(family, x, y, size)` input must always return the same sample.
- Wood and cloth albedo channels must remain near-neutral; channel spread should express no independent hue and must be locked at representative coordinates.
- Wood retains directional macro/meso/micro variation and pores.
- Cloth retains warp, weft, twill, and interstice variation.
- Kraft samples at size 16 must remain exactly:
  - `(0,0)`: albedo `[230,225,206]`, AO `242`, height `124`, roughness `242`
  - `(5,7)`: albedo `[232,226,207]`, AO `243`, height `131`, roughness `242`
  - `(8,12)`: albedo `[232,226,207]`, AO `243`, height `131`, roughness `241`
- Paper samples at the same coordinates must remain exactly `[255,251,231]/246/130/237`, `[255,251,231]/247/128/238`, and `[255,251,231]/248/129/240`.

## MaterialRoleBinding

| Material | Texture Family | Palette Role | PBR State |
| --- | --- | --- | --- |
| `walnut` | `wood` | `wood` | Tuned only within approved wood envelope |
| `walnutDark` | shared `wood` | `woodDark` | Tuned only within approved wood envelope |
| `walnutPanel` | shared `wood` | `woodPanel` | Tuned only within approved wood envelope |
| `cloth` | `cloth` | `mint` | Tuned only within approved cloth envelope |
| `clothDark` | shared `cloth` | `mintDark` | Tuned only within approved cloth envelope |
| `notebookCover` | `kraft` | `notebookCover` | Frozen: AO `0.3`, bump `0.0014`, roughness `0.96` |
| `notebookCoverDark` | shared `kraft` | `notebookCoverDark` | Frozen: roughness `0.98`, all shared maps unchanged |
| `paper` | `paper` | `paper` | Frozen: AO `0.12`, bump `0.0018`, roughness `0.98` |
| `paperEdge` | shared `paper` | `paperEdge` | Frozen: roughness `0.96`, all shared maps unchanged |

## Lifecycle

```text
createModelMaterialLibrary()
  -> generate 4 families x 4 channels = 16 DataTextures
  -> construct shared materials and bind semantic palette roles
  -> model factories borrow materials without ownership
  -> model geometry disposes independently
  -> material library disposes every material and texture once
```

No new lifecycle or state transition is introduced.
