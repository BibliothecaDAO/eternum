# Patch notes

What players read in What's new and on the docs site's changelog: one file per release, `<date>.md`, written once per
release by the patch notes' editor (the docs owner), never appended to with a change as it lands.

- **Who writes.** Only the editor. A change does not add itself here: at each release the editor reads what merged since
  the last one, keeps what a player meets, and reads every number from its preset (`config/source/<mode>/`) or contract
  before writing it.
- **Nothing missed.** Before writing, list everything that changed since the live release:
  `node apps/game/scripts/patch-notes-checklist.mjs --since <live commit> > checklist.md` from the repository root
  (`--base-preset <mode>=<composed JSON>` where live ran another preset). Map every item to a line of the note or a
  reason it is left out, and put that table in the release's report.
- **The file.** Named for its day (`2026-10-29.md`); front matter `title` and a one-line `summary`. Then the modes in
  this order, each only if it changed: `## All modes`, `## Frontier`, `## Blitz`, `## Eternum`. Under a mode, `### New`,
  `### Balance`, `### Fixes`, in that order. Each change is one list item:
  `- {icon} **Name**: The line that says it whole.`, and a number that moved ends with `` `old → new` ``. The icon is an
  `IconMeaning` (`asset-sources/facets/semantic-map.json`).
- **After editing,** run `node scripts/generate-patch-notes.mjs` from `apps/game`. It refuses an unknown mode, kind or
  icon, a mode or kind out of order, and anything but list items under a kind; CI refuses a generated copy its files no
  longer render to.
