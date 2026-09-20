# Game UI icons

The pipeline-owned UI icons are deterministic derivatives of semantic masters under
`apps/game/asset-sources/icons/menus/approved`. Their target filenames and consumer keys are declared in
`apps/game/asset-sources/icons/menus/manifest.json`.

From the repository root:

```sh
pnpm --dir apps/game icons:menus:build
pnpm --dir apps/game icons:menus:verify
pnpm --dir apps/game icons:menus:publish
```

Build and verification use `.context/icon-generation/build/menus`. Publishing first rebuilds and verifies the complete
set, then replaces only the manifest-owned files under `public/image-icons`. Do not edit those derived PNGs directly.

The `ui-*` family replaces line icons in the client through `src/ui/design-system/atoms/game-icons.ts`. Directional
controls reuse a semantic master with a CSS rotation. Existing game images are reused for equivalent concepts.

New masters were generated using the built-in image generation tool. The subject for each icon is recorded in the
manifest. The shared prompt asks for one centered medieval-fantasy raster cutout with broad low-poly planes, restrained
hand-painted material texture, warm upper-left light, cool lower-right fill, dark umber edges, and a genuinely
transparent background. No scenery, ground, cast shadow, text, particles, or extra objects; the silhouette must read at
16 and 24 pixels.
