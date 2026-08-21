# Third-party notices

Dear Desk uses [`animal-island-ui`](https://github.com/guokaigdg/animal-island-ui) version 1.5.1 for general-purpose interface controls.

- Copyright: guokaigdg and contributors
- License: CC BY-NC 4.0
- License text: <https://creativecommons.org/licenses/by-nc/4.0/>
- Use in Dear Desk: non-commercial only, as confirmed for task `DD-20260810-002`

Dear Desk's project-specific UI adapter and theme remain separate from the upstream package. Other bundled third-party assets retain the notices stored alongside their source files.

Dear Desk uses [`page-flip`](https://github.com/Nodlik/StPageFlip) version 2.0.7 for the journal's isolated DOM page-fold rendering.

- Copyright: 2020 Nodlik
- License: MIT
- License text: included in the installed package as `node_modules/page-flip/LICENSE`
- Use in Dear Desk: button-triggered rendering of temporary, noninteractive page snapshots; business state and the real React pages remain outside the library

Dear Desk adds its own lifecycle adapter to stop the upstream render loop and release temporary browser resources when a page turn unmounts. That adapter is project code and does not modify the upstream package.
