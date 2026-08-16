# Warm Paper Atelier Desk — Image Analysis

Reference: `docs/assets/concepts/warm-paper-atelier-desk.png`

## 1. Identification and classification

- Observed target: one freestanding wooden writing desk shown from an elevated front three-quarter view.
- Broad class: furnishing; compound hard-surface object.
- `primaryDomain`: `object`.
- Classification confidence: `0.99`.
- Intended reconstruction: stylized real-time browser prop, built as a procedural, named Three.js assembly.

## 2. Overall form and silhouette

- Bounding form: a shallow elongated cuboid tabletop over an open four-leg support volume.
- Approximate object-space proportion: tabletop width : depth : total height is about `3 : 1.35 : 1` in the visible perspective.
- Symmetry: approximately bilateral across the desk's width centreline; the centre drawer is wider than the two matching side drawers.
- Shape language: geometric with controlled large-radius plan corners and smaller edge bevels.
- Silhouette-critical observations: thick tabletop, continuously rounded plan corners, open knee space, four separated legs, and a shallow drawer band directly below the front edge.

## 3. Macro → meso → micro decomposition

### Macro assemblies

1. Tabletop assembly.
2. Front carcass/drawer-band assembly.
3. Four-leg support assembly.

### Meso parts

- Tabletop: one continuous thick rounded plate with a visible lower edge band.
- Carcass: front apron, rear/side support rails inferred from furniture continuity, and three independent drawer boxes/faces.
- Drawers: narrow left drawer, wide centre drawer, narrow right drawer.
- Supports: front-left, rear-left, front-right, and rear-right legs with a mild downward taper.
- Hardware: one centred knob on each drawer, each reading as a short base/stem plus a rounded crown.

### Micro feature groups

- Longitudinal wood-grain bands on tabletop and drawer faces.
- Narrow recessed gaps around all three drawer faces.
- Tiered tabletop edge highlight produced by the plan radius plus a smaller profile bevel.
- Local low-roughness edge response on drawer faces and tabletop.
- Aged-brass value variation on the three knobs.
- Soft contact darkening where legs and apron meet and below the drawer band.

## 4. Spatial relationships

- `<tabletop, overlaps-and-rests-on, carcass>`; continuous embedded furniture joint.
- `<front-apron, attached-below, tabletop>`; shallow overlap/socket joint.
- `<drawers, inset-within, front-apron>`; independent slide sockets with small perimeter gaps.
- `<knobs, attached-to, drawer-faces>`; centred embed joint with a short stem.
- `<legs, attached-below, carcass-corners>`; embedded furniture joint with a small overlap into the apron volume.
- `<rear-apron, connects, rear-leg-pair>` and `<side-aprons, connect, front-and-rear-leg-pairs>` are structural inferences; the reference does not fully expose these parts.

## 5. Materials and surface response

### Walnut-like wood

- Observable base-colour family: warm medium-to-dark brown with lower-value frame recesses.
- Metalness: `0` (dielectric).
- Finish: satin / semi-matte; broad highlights, not mirror reflections.
- Roughness inference: approximately `0.55–0.75`, with lower roughness at rounded edges.
- Relief: low-amplitude elongated grain; no deep carved displacement is visible.
- Opacity: opaque.

### Brass-like knobs

- Observable base-colour family: muted yellow-gold to brown-gold.
- Metalness inference: high (`0.75–1.0`) because highlights are tight and colour-bearing.
- Roughness inference: approximately `0.28–0.5`; the inset close-up shows worn/aged variation rather than a uniform polished sphere.
- Opacity: opaque.

## 6. Colour and finish

- Tabletop: warm orange-brown, medium value, moderate saturation, subtle longitudinal variation.
- Frame/legs: slightly lower-value brown than the tabletop.
- Drawer faces: close to tabletop hue with locally darker recessed borders.
- Knobs: medium-value muted gold with darker brown-gold sides.
- The reference contains strong warm key light and deep green fill/shadow; these are lighting observations, not albedo values.

## 7. Identity-defining features

1. One thick, continuously rounded rectangular tabletop with a broad front edge.
2. Three-drawer rhythm: narrow / wide / narrow.
3. Three centred circular brass knobs.
4. Four open, individually readable legs with mild downward taper.
5. Drawer faces with their own rounded profiles and narrow dark perimeter gaps.
6. Long, low-amplitude wood grain aligned with the tabletop width.
7. Warm walnut-and-aged-brass material contrast.
8. Clear open knee space below the shallow drawer band.

## 8. Uncertainty and single-image limits

- Hidden: tabletop underside, rear apron, rear drawer construction, drawer interiors, leg rear faces, and exact joinery.
- Partly occluded: rear-left and rear-right legs.
- Undetermined: physical dimensions, exact drawer depth, whether the tabletop edge is one continuous moulded profile or two joined boards.
- Inference policy: hidden structural surfaces will use simple continuous furniture joints and the same wood material; they will not be claimed as reference-exact.
- Additional views would improve hidden-region confidence but are not required for a stylized browser prop because the major silhouette and visible identity features are sufficiently covered.

## Suitability conclusion

`pass` for a stylized procedural real-time prop. The image has one unambiguous target, a strong silhouette, visible major materials, close-up evidence for a knob and tabletop corner, and geometry that can be represented with rounded extrusions, tapered profiles, sockets, and instancing. Exact hidden geometry and manufacturing dimensions remain out of scope.
