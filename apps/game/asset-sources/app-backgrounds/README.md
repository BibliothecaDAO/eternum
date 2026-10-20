# App backgrounds

Two page backgrounds, 18 October 2026. The metadata-stripped 1536 × 1024 masters and exact prompts live here. Existing
landscape source prompts were not present in the repository; the compositions were inferred from the paintings in
`public/images/landscapes`, their SOURCE.md, and the material/light vocabulary in `../facets/style.txt`. The icon
prompt's square composition and transparent background do not apply to landscapes.

- `season-citadel`: Season's long competition, matching winter-fortress's fortress scale, slate clouds and mist, with
  dark-plains' warm stone light. Wired to both Season layouts' page frames.
- `blitz-aftermath`: Blitz Results, matching blitz-spires' obsidian spire, round orb and rare violet light, after the
  battle. Wired only to Blitz Results; other ages and the Blitz lobby retain their existing paintings.

Delivery follows the landscape pipeline: metadata stripped, WebP quality 78, widths 800 and 1536, never enlarged.
`delivery.json` records source/prompt/output hashes and byte sizes. Each delivery is capped at 300 KB.

```sh
pnpm --dir apps/game build:app-backgrounds
pnpm --dir apps/game check:app-backgrounds
```

Compare the ungraded paintings with their existing references at `/lab/kit/app-art`, then follow each page link to the
production component over the app's fixtures. Run `pnpm --dir apps/game prove:app-art --port 4199 --out <fresh-dir>` to
capture that path. No unused variants are delivered.

For the redesigned app sheet, use the same Painting keys in its existing AppFrame slots: Season's `winter-fortress`
becomes `season-citadel`; Blitz Results' `blitz-spires` becomes `blitz-aftermath` (sealed and opened). Play and Lobby,
mode cards, board headers and other ages retain their current paintings. No frame, grade or layout change is needed.
