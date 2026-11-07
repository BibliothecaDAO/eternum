# Frontier day share: the daily ritual, and how we know what it brings

Written 2026-11-07. This is item 4.1 (with 4.3's attribution) of [the content strategy](./content-strategy.md). Phase 1
is built: the sections below say what each part does and how it is proven. Phases 2 and 3 are proposals, each with the
evidence that should decide it.

## The idea

Frontier is already a daily game: a new map each day, one day-done card when it ends. Wordle spread once players could
post the day's shape without spoiling it. Frontier spoils nothing, since every realm's map is its own, so the post can
be a flex: the day, the rank and its move, and the day as a line of marks in the order it happened.

```
Frontier · Day 12 · #7 ▲2
🧭 31 · 🚩 4 · 🎁 1
🏛️🌀🌀💀🐺👹
https://play.realms.party/s/K7QM2XPA
```

The emoji line carries the drama: a rift, a lost army, then a beast. The card image carries the painted version for
anyone who pastes it. The link is the player's own for that day, which is what lets us count what posts bring.

## Phase 1 (built)

| Part           | What                                                                                                                                   | Proof                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Share your day | A button on the day-done card, shown only when the day's totals are whole                                                              | `rollover/day-done.test.tsx` (prod's recorded day 2) |
| The card       | 1200 × 675: lockup, day, player, rank and move, trail (18 marks, then +N), six totals, host, "Free to play"                            | `/lab/kit/hud/day-share`, `day-share-quiet`          |
| The post       | `dayPostText`: the day and rank line, three totals, the trail as emoji; the link after it                                              | `rollover/day-share.test.ts`                         |
| The steps      | The recap's Copy image → Post on X, now one component both use (`shell/share/share-steps.tsx`)                                         | `season-recap.test.tsx`                              |
| The link       | `/s/<code>`, one per player and day, made as the sheet opens so Post opens X within the press                                          | `identity.test.ts` "shared links"                    |
| The landing    | "Ashwalker shared Day 12 of Frontier", Frontier's pitch, Start your adventure; records the visit                                       | `shell/share/shared-link-page.test.tsx`              |
| The funnel     | links → posted → visits (others' browsers) → joined (account made after a visit on that browser) → activated (a site cleared, 14 days) | `identity.test.ts`; `GET /api/operator/shares`       |

Every number in the funnel comes from facts D1 already has (browser ids, account creation times) or Herald's season
board. Sign-up writes nothing of its own; any read settles it (`apps/realms/README.md`, Shared links).

**Known limits.** A friend who opens the link in X's in-app browser and signs up in Safari is not counted: the browser
id is the only tie. Phase 1 links unfurled with the site's one static preview image; Phase 2 item 1 fixes that.

## Phase 2: make the post better (decide the rest with Phase 1's data)

1. **The link unfurls as the player's card (built).** The identity Worker takes `/s/*` and serves the page with the
   link's title, pitch, address and card in its unfurl tags. The share sheet uploads the card it drew as a JPEG (about
   80 KB) once the link exists and the player's name is read. The card is kept in R2 and served at
   `/api/shares/<code>/card`. Proof: `identity.test.ts` "shared links" (upload rules, the served card, the page's tags
   before and after the card, a link that leads nowhere), `day-done.test.tsx` (the upload), and the JPEG captured from
   the lab in Chromium. _Limit:_ a post made in the second or two before the upload lands unfurls with the game's
   preview, and X holds that for as long as it caches the card.
2. **The phone's own share sheet (built, owner's call on 7 November 2026; the recap stays X only).** A phone whose share
   sheet takes image files gets **Share** above the two X steps. It hands over the tall card's PNG, the post's line and
   the link, to whichever app the player picks. The image is made before the press, as a phone opens its sheet only
   within the press. Each link names its channel (`?via=x` or `?via=system`). The landing hands it to identity with the
   visit (migration 0033), and the operator's report counts visits by channel (`channels`). Proof: `day-done.test.tsx`
   (closing the sheet records nothing; a share records the post with the card, line and `?via=system` link),
   `shared-link-page.test.tsx`, `identity.test.ts` "shared links" (visits counted by channel, an unknown one as none,
   never the sharer's own), and in Chromium with the share sheet stood in for: a 1080 × 1350 PNG of the tall card, its
   line and its link. _Read:_ visits per post by channel tells whether the sheet's apps travel further than X.
3. **Streaks.** "Day 12 · 🔥 9" for a run of days played. It needs Herald to answer "days played this season" per
   player. The day ranks already exist, but a rank is not proof the player played that day. _Decide by:_ D7 retention of
   sharers against everyone else. If sharing tracks with retention, a streak gives a reason to share every day.
4. **A tall cut (1080 × 1350) (built).** A phone's sheet draws the tall cut, as the recap's does, and Copy image copies
   it. The link still unfurls as the wide cut, which the phone's sheet draws out of sight for the upload. Both cuts'
   sizes are one table, `CARD_CUTS` (`utils/card-image.ts`), which the recap reads too. Proof: `day-done.test.tsx` (a
   phone's tall card and the wide upload, a desktop's single wide card) and the phone sheet captured in Chromium.
5. **Credit the sharer (built).** "Your shared days" on You, once a day was shared: days posted, opened by friends,
   friends who joined and those who cleared a site (`GET /api/shares`). It credits players brought, never posting, which
   keeps it on the right side of X's January 2026 rules. Proof: `shell/profile/shared-days-panel.test.tsx`; lab:
   `/lab/app/shared-days/profile`.

## Phase 3: from the player's day to the game's channels

- **Moment feed.** The same trail marks score days for the curation queue (content strategy 4.4): a wild chest (1/10,000
  tiles), a top-10 climb of 5+ places, a day with 12+ clears.
- **Weekly dispatch.** The operator report's top days and top sharers feed the weekly post (4.5).
- **Blitz.** The same sheet, steps and link kind for a Blitz result (`SHARE_KINDS` gains `blitz-result`; the store,
  funnel and report need no change).

## How to read the numbers

`GET /api/operator/shares` with the operator token. Per day: `links` (sheets opened), `posted`, `visits`, `joined`,
`activated`. Divide each count by the one before it to read the funnel. Watch `posted ÷ links` (does the card make
people post?), `visits ÷ posted` (does the post travel?) and `activated ÷ joined` (do these players stay?).
`unsettledJoins` above zero means a season board did not answer on that read.
