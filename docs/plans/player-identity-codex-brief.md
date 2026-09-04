# Player identity — who owns that, at a glance — Codex brief

Motto: **KISS, always. Systemic fixes over point patches. Success of systemic work is deletion.**

Context: a spectator must be able to tell who owns a realm or an army without selecting it, at normal and at the capped
zoom, in a 96-player game. The client has one centralized color system, `three/systems/player-colors.ts`, and it is the
wrong shape for that job. Findings, all verified on `client-scale-96p` (2026-09-03):

- **Identity is arrival order.** `getEnemyProfile` hands each new address `nextEnemyIndex++` on first sight
  (`player-colors.ts:263-264`, `:383-386`). The same player gets a different hue per client and per reload.
- **Ally and agent collapse to one color each**, `__ALLY__` blue and `__AGENT__` gold (`:295`, `:321`), and in the scene
  ally is a constant anyway: `army-manager.ts:3068` and `structure-manager.ts:557` hard-code `isAlly: false`. The only
  guild-based ally computation is a React hook, `use-structure-entity-detail.ts:51`. The ALLY palette entry is dead code
  in 3D.
- **Capacity is 48.** 16 hues (`:118-136`) × 3 lightness variants (`:141`); `patternIndex` has zero consumers. Players
  49–96 exactly duplicate players 1–48, and the tier-3 hues sit 15° apart.
- **The spectator is the worst case.** With no account, `isMine` and `isAlly` are false for everyone, so every player is
  an "enemy" colored by discovery order.
- **The minimap has no identity.** `hex-minimap.tsx:111-118` paints every structure cyan and every army orange.
- **Ownership text hard-codes relationship colors.** `label-components.ts:251-257` picks `#d9f99d` / `#bae6fd` /
  `#fecdd3` for mine / ally / enemy; `label-config.ts:176-179` routes mine/ally/agent to fixed `LABEL_STYLES`.
- **What is already right:** one atlas label renderer owned by `WorldmapScene` (record "label-system remake"), one
  content ladder as the single zoom gate (`worldmap-content-ladder.ts`, near / mid / far rows; the far band is parked so
  the capped zoom is the mid band), player names from the `players` slice (`Player { address, name }`,
  `packages/types/src/types/common.ts:774`), guilds from the `guilds` slice, and the ruling from run item 10 that
  ownership is tint and only the selection is emphasised.

**The principle (StarCraft II and Europa Universalis).** Two questions, two channels: _who is this_ is a stable identity
per player, redundant across color, sigil and name; _what are they to me_ is a relationship, drawn as outline or ring,
never by replacing the identity. Color alone cannot carry 96 players; the combination can.

**Fixture.** The current real game, `bltz-clash-538` (herald game 13, 84 players), as defined in
`boot-to-playable-codex-brief.md`. 84 real names is the identity test; the finished 96-bot worlds are not needed.

---

## 0. Capture kit — three anchors, three distances, one game

The URL pins col and row (`/map?col=&row=`); nothing pins camera distance, so identity captures are not repeatable yet.

**Do:** a dev-only hook under `?dev`, `getWorldmapRenderDiagnostics()`'s sibling, that sets the worldmap view
`{ col, row, distance }` through the existing zoom runtime (`WORLDMAP_CAMERA_ZOOM` range, band boundaries unchanged).
Pick three anchors on the fixture and write them into this brief: the densest realm cluster, the busiest army front, and
the spectator's default entry. Distances 10, 25 and 45, matching the label-remake captures. Each capture records game
id, confirmed block, viewport, DPR, `renderer_mode`, and the number of distinct owner addresses in the frustum.

**Gate:** the recipe reproduces the nine captures headlessly; before-images for every later item come from it.

## 1. One identity resolver — deterministic, address-keyed, relationship separate

**Fix:** `three/systems/player-identity.ts` replaces `player-colors.ts`, which is deleted.

- `resolvePlayerIdentity(address) → { primary, secondary, sigil, shortName }`, deterministic from the address alone: a
  hash selects the hue from a designed palette (≥ 24 well-spaced hues × 2 lightness, no hue inside the terrain greens
  and water blues), the sigil from a glyph set of about 16 simple heraldic shapes, the short name from the `players`
  slice. Cache by address; there is no counter and no order dependency. Bandits and unowned structures keep one fixed
  neutral identity.
- `resolveRelationship(address, viewer) → "self" | "guild" | "other" | "neutral"`, viewer = the account address or
  `null` for a spectator. Guild comes from the `Guild` / `GuildMember` components (the rule at
  `use-structure-entity-detail.ts:51` moves here and that hook becomes a consumer). Relationship never changes the
  identity colors; it only selects the ring or outline treatment.
- The agent channel: `isDaydreamsAgent` is produced at `packages/core/src/systems/utils.ts:41`. Keep it only if a live
  row on the fixture proves agents exist; otherwise delete the channel with the rest (wired or deleted). State which in
  the record.

**Consumers migrate in the same commit**, no adapter shims: `army-manager.ts:2824` (`getArmyColorProfile`),
`worldmap.tsx:1375` and `:1389` (strategic markers), `label-config.ts:176` (`getPlayerOwnershipStyle`; the MINE / ALLY /
ENEMY / DAYDREAMS `LABEL_STYLES` die), `label-components.ts:214-257` (`createOwnerDisplayElement` drops its hard-coded
hexes), and the two hard-coded `isAlly: false` sites, which stop existing because relationship is resolved, not carried
on the record.

**Gate:** `player-identity.test.ts`: the same address yields the same identity in a fresh instance; two arrival orders
yield identical identities; the 84 fixture addresses yield a collision report for color alone and for the color+sigil
pair (the pair must have zero collisions at 84, document the math at 96); a `null` viewer keeps every identity and
returns `other` for everyone. `player-identity.source.test.ts`: exactly one resolver module, no `nextEnemyIndex`, no
consumer derives a color from `isMine` / `isAlly`, `player-colors.ts` gone.

## 2. Scene channels — redundant by design, through the ladder

Identity must read from geometry and from text, and the ladder must thin the text, not the identity.

**Fix:**

- Realm: the flag / gate shield accent and the name plate carry the identity color; the plate carries the sigil glyph
  before the name. Army: the marker and standard carry the identity color; the plate carries sigil + tier glyph. The
  atlas draws sigils on the canvas it already paints text on (`compact-entity-label-atlas.ts:232`, `fillText`), as
  glyphs or short paths; no second texture, no new renderer.
- Relationship: self keeps the selection treatment from item 10; guild gets a thin ring in one fixed guild color; other
  gets nothing; neutral is the fixed bandit identity. Rings sit around the identity, never over it.
- Ladder rows (`worldmap-content-ladder.ts`): near = sigil + name plate for everyone; mid = sigil + tier glyph for every
  army, sigil + name only for priority entities (selected, hovered, under attack, top 10, own and guild); far stays
  parked. Priority is the one existing `textLabels: "priority"` tier; do not add a second priority system.

**Gate:** the nine captures before and after; at distance 25 on the army front, every army in frame resolves to an owner
by sigil + color without hovering (the reviewer checks ten at random against the hover card); the ladder table has a
source test; the label lifecycle suites stay green.

## 3. Minimap and React — the same identity everywhere

**Fix:** `hex-minimap.tsx` fills structures and armies with the identity primary, looked up by `occupier_id` through the
`structures` / `armies` slices (the tile carries no owner), with the sigil where the hex is large enough. The identity
chip, the leaderboard rows and the hover card show the same swatch + sigil through one hook,
`usePlayerIdentity(address)`, that calls the resolver; React never recomputes a color.

**Gate:** one capture showing chip, leaderboard row, minimap hex and world plate agreeing for one address; the minimap
test covers the lookup miss (unknown occupier → neutral, loud in dev).

## 4. Spectator legend — conditional on item 2's evidence

After item 2, count on the distance-25 captures how many owner pairs remain ambiguous (same hue family and similar sigil
weight). If three or more pairs collide in one frame, add a legend: a panel (no scene anchor, so a panel is legitimate
under the blitz scene-native ruling) listing players with swatch, sigil, name and realm count; search; click spotlights
that player for five seconds by dimming everyone else. Propose the spot in the record before building; the owner rules.
If the captures show no ambiguity, skip it and say so.

## Validation

- Focused suites: identity, labels (`entity-label-view-model`, `label-factory`, `label-owner-name`,
  `label-components.incoming-troops`), army and structure label lifecycles, ladder, minimap; full `apps/game` suite via
  `pnpm test`; typecheck, `pnpm run format`, `pnpm run knip`.
- Visual evidence is required for items 2–4: the capture kit's nine images before and after, plus the item-3 agreement
  capture. Unit tests alone do not close a visual item.
- Records appended to this brief per item, one commit per item, explicit paths only.

## Non-goals

Procedural-character heraldry tuning (parked with the characters), Blender or new asset generation, un-parking the far
band, a separate strategic map mode, changing what selection emphasises (item 10's ruling stands).

## Decisions and risks

- **Address hash versus registration rank.** Rank among the game's registered players spaces colors perfectly but
  reshuffles whenever the set changes, wrong for Eternum and fragile in Blitz. Address hash is stable across games,
  clients and reloads, at the cost of random color collisions above the palette size, which the sigil absorbs. Decision:
  address hash. A Blitz player is always the same color and sigil, in every game.
- Sigil art is content, not a pipeline: about 16 simple shapes as paths drawn on the atlas canvas. Name the count and
  show the sheet in the item-2 record.
- Palette design is taste until the captures judge it; iterate on the nine images, not on opinion.
- Guilds may be sparse or absent in Blitz; relationship then collapses to self / other, which is fine.
