# Material Evidence Review

## Walnut-like wood

- Verified crop: `pbr-crops/walnut.png`, freshly extracted from the main tabletop in the supplied reference.
- `extract_pbr_evidence.py` result: `confidence = 0.784`, above the blocking `0.7` threshold.
- Extracted palette: `#532F18`, `#3E2614`, `#6D3D1E`, `#10120C`, `#945528`.
- Independent evidence maps: albedo, roughness, height, normal, and AO under `pbr-evidence/walnut/`.
- Agent classification: dielectric walnut-like wood (`metalness = 0`), satin/semi-matte, with longitudinal low-amplitude grain.
- Tool limitation: `analyze_texture.py` labelled the crop `painted-metal`; this conflicts with direct image evidence and the visible continuous wood grain. That discrete finish label is rejected. The extracted palette/maps remain inference evidence, not exact inverse rendering.

## Aged-brass knobs

- Verified crop: `pbr-crops/aged-brass.png`, freshly extracted from the knob close-up embedded in the supplied reference. The previous task's unrelated brass-nameplate crop was explicitly rejected and not reused.
- `extract_pbr_evidence.py` result: `confidence = 0.786`, above the blocking `0.7` threshold.
- Extracted palette: `#492A11`, `#371F0C`, `#1F1104`, `#6D471E`, `#B0814B`.
- Independent evidence maps: albedo, roughness, height, normal, and AO under `pbr-evidence/aged-brass/`.
- Agent classification: opaque aged brass, conductive metal response with a polished upper-left crown and rougher/tarnished rim.
- Tool limitation: the square crop contains some surrounding drawer wood, and `analyze_texture.py` labelled it `painted-metal`. The finish label is rejected; use the crown/rim contrast as local material evidence and verify under the grazing-light render.

## Routing decision

- Use the extracted results to bound base colour, roughness variation, relief scale, cavity response, and the need for separate PBR channels.
- Do not load these evidence maps as runtime textures. Dear Desk keeps deterministic shared 1024px material channels and live palette colours; the evidence maps are review artifacts used to tune that procedural implementation.
- Reorient the procedural wood grain by component: tabletop and drawers along local width; legs along local vertical axis.
