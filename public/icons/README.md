# App icons

Generate these PNGs (e.g. with [pwa-asset-generator](https://github.com/elegantapp/pwa-asset-generator))
from `public/favicon.svg` and drop them here. They are referenced by the PWA manifest.

Required:
- `icon-192.png`         192×192
- `icon-512.png`         512×512
- `icon-512-maskable.png` 512×512 (safe-zone padded, `purpose: maskable`)
- `../apple-touch-icon.png` 180×180

Quick one-liner:

```bash
npx pwa-asset-generator public/favicon.svg public/icons \
  --background "#0b1120" --padding "12%" --icon-only --type png
```
