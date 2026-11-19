# tmwk brand assets

tmwk's own art (Own in [fork-ownership.md](../../docs/tmwk/fork-ownership.md)). The plan for wiring it in is B7 in [brand-plan.md](../../docs/tmwk/brand-plan.md).

| File                    | Purpose                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `trayTemplate.png`      | macOS menu-bar template, 22×14: the beaver's silhouette in black on transparency |
| `trayTemplate@2x.png`   | The same at 44×28 for Retina                                                     |
| `make-tray-template.py` | Regenerates both from the beaver master, with the standard library only          |

The source is `tmwkdev/grenada@10d408f:apps/desktop/assets/brand/beaver.png`. To regenerate:

```sh
python3 -I resources/tmwk-brand/make-tray-template.py <path/to/beaver.png> resources/tmwk-brand
```

The rest of the grenada set (`beaver.png`, `icon-master.png`, `icon.png`, `favicon.png`, `icon.icns`, `icon.ico`, `PROMPTS.md`) comes over in B7.
