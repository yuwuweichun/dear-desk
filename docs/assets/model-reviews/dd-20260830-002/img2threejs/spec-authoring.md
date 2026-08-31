# Room spec authoring evidence

- `room-sculpt-spec.json` was rewritten from the generator placeholder after the local state gate reported `spec-authoring`.
- World-space anchors: interior `23 x 17.5 x 10.2`, floor top `-5.025`, wall top `5.175`, desk leg bottom `-5.02`, delta `0.005`.
- The spec names the four macro systems (room root, floor, walls, west window), five independent material systems, two repetition systems, seven view evidence IDs, and three critical review targets.
- The west wall is recorded as a geometric four-pane opening. Runtime implementation uses explicit inward normals and `THREE.FrontSide`; the image-derived PBR maps are documented as procedural inference rather than exact texture acquisition.
- `validate_sculpt_spec.py --strict-quality` passed before business source implementation.
