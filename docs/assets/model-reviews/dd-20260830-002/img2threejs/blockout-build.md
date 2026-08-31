# Blockout build evidence

The current blockout is implemented by the project-native `createStudyRoomShellModel` factory rather than overwriting the existing scene with a generic generated file. It creates one floor plane, four inward-facing wall surfaces (the west wall is four panels around the opening), a six-rail window frame, four glass panes, four instanced baseboards, named runtime nodes, a collider, resource metrics, and idempotent disposal. The factory is mounted as a sibling of the existing desk models in `DeskContents`; no existing model is reparented or transformed.
