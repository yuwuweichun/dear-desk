# Dear Desk audio assets

These sound effects were provided by the project owner on 2026-08-25 and
explicitly approved for use in this project. The original download pages,
authors, and license names were not supplied. Public redistribution rights
therefore remain unverified and must be documented or the assets replaced
before a public release.

The source files remain outside the repository in `/Users/song/Downloads`.
They were processed with FFmpeg into 48 kHz stereo MP3 files at a nominal
128 kbps. All outputs use `loudnorm=I=-24:TP=-2:LRA=7` for restrained SFX
level matching.

## Source files

| Intended use | Source filename | SHA-256 |
| --- | --- | --- |
| Notebook close | `book-closing.mp3` | `b40f7ec40b9e8dd1f4317fabc0d6a997ce06373bff9238bab36219c6f4374886` |
| Drawer open and close | `drawer-opening-amp-closing.mp3` | `80a5b67fd3b4f7e266e8b4214e6224e327af1de04dc56b951257aaa840c699c5` |
| Journal page turn | `page-flip-smaller-page.mp3` | `53fcf01b5606ec8aadaa55229d75e3f72c8d9f6e7aa7528f11f15c59bd307fc1` |
| Notebook open page flutter | `paper-crumpling-and-book-foley-parchment-crinkle-movement.mp3` | `9e269343ccb9f37550f4f3950bd2ac02f5729d5b9e5c1aa29bc211fac9e794d6` |

## Outputs

| File | Processing | SHA-256 |
| --- | --- | --- |
| `notebook-open.mp3` | Loudness match only | `6331683d97510ac05feacd39a049f333fb489c5fbbbd059f416b4747a5d8f369` |
| `notebook-close.mp3` | Loudness match only | `1a20aa709d3f8bff87786c7ead4b3d5e67cd670c575b9f8bf588b2dbe8b7b9d1` |
| `page-turn.mp3` | Loudness match only | `1bb7ed14178f36a5c1ff57351ec971466a23f8254bd95d31c0a4fd1b2f208b19` |
| `drawer-open.mp3` | Trim `0.44s..1.48s`, `atempo=2.3`, 10 ms fade-in, 40 ms fade-out | `b1eaf2ab4e50cc9805d2d39e489af878739bb0bb665b52bf7c193d5c4875fdea` |
| `drawer-close.mp3` | Trim `1.84s..3.42s`, `atempo=2`, then `atempo=1.65`, 10 ms fade-in, 40 ms fade-out | `8c0a01d65a059d580ac4f2aca24b1ae67a9e47c0dc72b9080e904dfa0fa387ba` |

The drawer split uses the source track's silent interval at approximately
`1.43s..1.90s`. The time compression keeps the audible motion close to the
existing 300 ms drawer animation while retaining a short natural tail.
