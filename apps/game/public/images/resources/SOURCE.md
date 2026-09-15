# Resource icons

The semantic catalog and generation prompts live in `apps/game/asset-sources/icons/resources/manifest.json`; the shared
visual contract lives in `apps/game/asset-sources/icons/STYLE.md`. Approved master images use semantic filenames under
`apps/game/asset-sources/icons/resources/approved/`.

From the repository root:

```sh
pnpm --dir apps/game icons:prompts:pilot
pnpm --dir apps/game icons:build:pilot
pnpm --dir apps/game icons:verify:pilot
pnpm --dir apps/game icons:contact-sheet:pilot
```

The pilot commands write only to `.context/icon-generation`. After the complete catalog is approved, stage it with
`pnpm --dir apps/game icons:build`, run `pnpm --dir apps/game icons:verify`, inspect the full contact sheet, and publish
the already-verified deterministic output with:

```sh
pnpm --dir apps/game icons:publish
```

Publishing preserves the numeric `public/images/resources/<id>.png` paths used by the client. Never edit those numeric
files directly; change the semantic master and rebuild instead.
