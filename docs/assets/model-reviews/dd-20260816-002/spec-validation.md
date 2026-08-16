# Sculpt Spec Validation

- Spec: `desk-sculpt-spec.json`
- Schema version: `2.1`
- Components: `17`
- Materials: `4`
- Repetition systems: `3`
- Detail inventory: `16 / 10` required details, all mapped to component local features or material local overrides.
- Fresh reference-PBR confidence: walnut top/frame/drawers `0.784`; aged brass `0.786`; all exceed `0.7`.
- Normal validation: `PASS`.
- Strict-quality validation: `PASS`.
- Important correction before pass: `analyze_texture.py` misclassified both verified crops as `painted-metal`; direct evidence identified dielectric wood and conductive aged brass, so the discrete labels were rejected and the valid palette/map evidence was wired with explicit limitations.
