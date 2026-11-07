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
id is the only tie. The link unfurls with the site's one static preview image. Both are Phase 2 items.

## Phase 2: make the post better (decide with Phase 1's data)

1. **The link unfurls as the player's card.** Today every `/s/<code>` unfurls the static link preview. Render the card
   at the edge (a Worker route for `/s/*` that serves `index.html` with `og:image` pointing to an image of that day) so
   the post shows the day even when the player skipped Copy image. _Decide by:_ the share of posts that carry an image.
   If most players post text only, this is the highest-value fix.
2. **The phone's own share sheet.** On a phone, `navigator.share({ files: [card], text, url })` reaches WhatsApp,
   Telegram and Discord as well as X, in one press. The owner chose X-only for the season recap, so this needs their
   call. _Decide by:_ phone share of posts, and visits per post by channel (add `?via=` per channel).
3. **Streaks.** "Day 12 · 🔥 9" for a run of days played. It needs Herald to answer "days played this season" per
   player. The day ranks already exist, but a rank is not proof the player played that day. _Decide by:_ D7 retention of
   sharers against everyone else. If sharing tracks with retention, a streak gives a reason to share every day.
4. **A tall cut (1080 × 1350)** for stories, as the recap has.
5. **Credit the sharer.** Show the tally on You ("Your days brought 12 visits · 3 players"). The API exists
   (`GET /api/shares`). Rewarding play, never posting, keeps it on the right side of X's January 2026 rules.

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
