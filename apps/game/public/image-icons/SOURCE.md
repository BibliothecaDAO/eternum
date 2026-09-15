# Game menu icons

The live menu icons are deterministic derivatives of semantic masters under
`apps/game/asset-sources/icons/menus/approved`. Their target filenames and consumer keys are declared in
`apps/game/asset-sources/icons/menus/manifest.json`.

From the repository root:

```sh
pnpm --dir apps/game icons:menus:build
pnpm --dir apps/game icons:menus:verify
pnpm --dir apps/game icons:menus:publish
```

Build and verification use `.context/icon-generation/build/menus`. Publishing first rebuilds and verifies the complete
set, then replaces only the nine manifest-owned files under `public/image-icons`. Do not edit those derived PNGs
directly.
