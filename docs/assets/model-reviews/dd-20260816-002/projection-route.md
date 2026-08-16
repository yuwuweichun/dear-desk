# Projection Route Decision

- Decision: `procedural-finish`; reference projection is not required.
- Reason: the desk must remain convincing under Dear Desk's `far`, `front`, and `near` cameras and live scene lighting. The reference contains strong warm key light and dark green fill, so projecting its lit pixels would bake one camera's illumination into the tabletop and drawer faces.
- Surface identity: the image shows natural longitudinal walnut variation rather than a unique decal, logo, paint seed, inscription, or non-repeatable graphic whose identity depends on exact pixel placement.
- Implementation route: preserve the existing deterministic, independent wood albedo/AO/height/roughness channels; align UV scale and direction per component; use reference-derived material evidence to bound colour and scalar PBR response.
- Limitation: procedural grain will match direction, frequency, contrast, and material response, but not the exact location of every strand in the concept image.
- Camera handling: use a named reference review camera for silhouette/framing comparison, without baking the source image into UVs.
