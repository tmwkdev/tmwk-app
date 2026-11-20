# Beaver identity

The approved tmwk mascot is the mint-to-blue beaver with a purple paddle tail.
The artwork was prepared with the built-in imagegen tool from the approved concept,
then exported to platform formats with ImageMagick and macOS `iconutil`.
The image-edit prompts are recorded in [PROMPTS.md](PROMPTS.md).

| File              | Purpose                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `beaver.png`      | Transparent mascot master; used on the renderer's empty screen   |
| `icon-master.png` | Transparent app-icon master with the pearl rounded-square tile   |
| `icon.png`        | 1024 px icon for the Electron window and macOS Dock              |
| `favicon.png`     | 64 px renderer favicon                                           |
| `icon.icns`       | macOS icon family, 16–1024 px, ready for future `.app` packaging |
| `icon.ico`        | Windows icon family, 16–256 px, ready for future packaging       |

To regenerate the derived icons after replacing `icon-master.png`, run
`pnpm icons:generate` on macOS with ImageMagick installed (`brew install imagemagick`).
The generated assets are checked in; normal builds need neither tool.

The main process imports `icon.png` with electron-vite's `?asset` suffix from outside
the public directory. This copies it into `out/main/chunks`, which `release:local`
already publishes. The runtime Dock override is needed because the current local
launcher runs the pinned Electron binary, rather than a separately packaged `.app`.
Renderer imports similarly copy the mascot and favicon into `out/renderer/assets`.

The app uses the tmwk name and `dev.tmwk.app` application ID.
To preview the icon and empty screen, use `pnpm dev:isolated`. The daily-driver
release remains a user-operated `pnpm release:local` after merging.

## tmwk-app provenance and wiring

Copied read-only from [tmwkdev/grenada@10d408f44ae71657e4e384a4abcfcc015450fa3e](https://github.com/tmwkdev/grenada/tree/10d408f44ae71657e4e384a4abcfcc015450fa3e/apps/desktop/assets/brand). All six binary assets and PROMPTS.md match the source Git blob hashes; this README retains the source guide above and adds this note. No grenada code or repository was modified.

Here, `icon.png` supplies the default tmwk app-icon option, window, macOS runtime Dock and Windows tray. `favicon.png` is the main renderer favicon. `beaver.png` decorates the main view’s preparation and unavailable-host states; upstream NativeChatView has no empty-state slot. `icon-master.png`, `icon.icns` and `icon.ico` are retained for later packaging. The icon-generation command and application ID above describe grenada, not tmwk-app.

The existing `trayTemplate.png` and `trayTemplate@2x.png` supply the macOS menu bar. Orca’s icons remain untouched and selectable. B7b supplies the separate 16–24 px in-app mark, `logo-mark.svg`, for the titlebar, onboarding and Help menu; Orca’s `resources/logo.svg` remains untouched. No new artwork was invented as part of B7.

## Tray regeneration

`trayTemplate.png` is the monochrome 22×14 menu-bar template; `trayTemplate@2x.png` is the 44×28 Retina version. They retain the existing beaver silhouette on transparency. Regenerate with the standard library only:

```sh
python3 -I resources/tmwk-brand/make-tray-template.py resources/tmwk-brand/beaver.png resources/tmwk-brand
```
