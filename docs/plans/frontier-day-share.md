# Frontier day share: the daily post, and how we know what it brings

Written 2026-11-07, corrected 2026-11-09 after review. Each part below says what it does and how it is proven.

## The idea

Frontier is already a daily game: a new map each day, one day-done card when it ends. Every realm's map is its own, so a
post spoils nothing and can be a flex: the day, the rank and its move, and the day as a line of marks in the order it
happened.

```
Frontier · Day 12 · #7 ▲2
🧭 31 · 🚩 4 · 🎁 1
🏛️🌀🌀💀🐺👹
https://play.realms.party/s/K7QM2XPA?via=x
```

The card image carries the painted version. The link is the player's own for that day, which is what lets us count what
posts bring.

## What is built

| Part             | What                                                                                                                      | Proof                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Share your day   | A button on the day-done card, shown only when the day's totals are whole                                                 | `rollover/day-done.test.tsx` (prod's recorded day 2)                       |
| The sheet        | In the HUD's modal layer and controls; a desktop draws the wide cut (1200 × 675), a phone the tall cut (1080 × 1350)      | `day-done.test.tsx`; `pnpm hud:check`                                      |
| The card         | Lockup, day, player, rank and move, trail (18 marks, then +N), six totals, host, "Free to play"                           | `/lab/kit/hud/day-share`, `day-share-quiet`                                |
| The post         | `dayPostText`: the day and rank line, three totals, the trail as emoji; the link after it                                 | `rollover/day-share.test.ts`                                               |
| The steps        | Copy image → Post on X; one hook (`share-steps.tsx`), drawn in the HUD's buttons here and the app's in the season's recap | `season-recap.test.tsx`, `day-done.test.tsx`                               |
| A phone's Share  | Where the share sheet takes images, Share above the two steps: the tall card's PNG, the line and the link, to any app     | `day-done.test.tsx`, `rollover/day-share-sheet.test.tsx`                   |
| The link         | `/s/<code>`, one per account and day, made as the sheet opens, read and cached under the signed-in account only           | `identity.test.ts` "shared links"; `day-share-sheet.test.tsx`              |
| The unfurl       | The Worker serves `/s/*` with the link's title, pitch, address and, once published, its card                              | `identity.test.ts` "shared links"                                          |
| Publication      | The card is made on the device as the sheet opens and published only on the press of Post on X or Share                   | `day-share-sheet.test.tsx`, `day-done.test.tsx`                            |
| The landing      | "Ashwalker shared Day 12 of Frontier", Frontier's pitch, Start your adventure; records the visit with the link's tag      | `shell/share/shared-link-page.test.tsx`                                    |
| The funnel       | links → posted → visits (others' browsers) → joined (account made after a visit on that browser) → activated              | `identity.test.ts`; `GET /api/operator/shares`                             |
| Your shared days | On You once a day was posted: days posted, opened by friends, friends who joined, those who cleared a site                | `shell/profile/shared-days-panel.test.tsx`; `/lab/app/shared-days/profile` |

**Activated** means the friend stands on the season board of the game the link was shared from with a site cleared. The
season is the window: a clear there counts however late a read finds it, and a clear in another game never does. A join
is dated by the friend's account creation, never by when a read first settled it.

**Visits by tag** (`firstVisitsByTag`) count first visits from others' browsers by the link's `?via=` tag. A tag names
the button that made the link (`x`: Post on X; `system`: the phone's Share, whatever app the player then picked), not
the app that carried it, and a copied link keeps whatever tag it had. Posts are not counted per tag, so these are
visits, not a rate per post.

## What a shared day exposes

- **To anyone holding the link** (an unlisted code, not an access control): the sharer's current public name and the
  day, in the page's title, the landing and the visit's answer ("A player" for a sharer who never chose a name).
- **Once published, to anyone holding the link and to crawlers:** the card's pixels: name, portrait, day, closing rank
  and its move, up to 18 fight and find marks with a count of the rest, and six totals (reveals, sites cleared, chests,
  Essence, Labor, LORDS earned). An unchosen name is drawn as `Lord <suffix>` from the address, as everywhere in the
  game. The browser drew it, so it is not a server-verified record. It keeps the name and portrait it was drawn with
  until the player publishes again.
- **Never:** map positions, email, wallet address, keys or event times.
- **Kept by identity:** each link's code, owner, game and day, when it was posted, and each browser's first visit with
  its tag. The sharer sees aggregate counts, never who visited. The operator sees per-day aggregates and the top sharers
  by public name.
- **Removal:** a card is served while its link exists. There is no delete control; an account's links cascade with it,
  and the card is then refused whatever R2 holds. A served card carries a one-day public cache.

## Known limits

- A friend who opens the link in X's in-app browser and signs up in Safari is not counted: the browser id is the only
  tie. A shared browser can tie a friend to the wrong link, or to none.
- A post read by X before the card's upload lands unfurls with the game's preview, and X keeps that for as long as it
  caches the card. The upload starts on the press, from an image already made, to keep that window short.
- A join whose season board never answers again (its shard gone) stays joined, never activated, and is counted in
  `unsettledJoins` on each report.

## How to read the numbers

`GET /api/operator/shares` with the operator token. Per day: `links` (sheets opened by a signed-in player), `posted`,
`visits`, `joined`, `activated`. Divide each count by the one before it to read the funnel: `posted ÷ links` (does the
card make people post?), `visits ÷ posted` (does the post travel?) and `activated ÷ joined` (do these players play?).
