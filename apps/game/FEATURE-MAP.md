# Feature map — game client

What a player can do and how they get there, so a report or a screenshot can be reproduced. Update it in the change that
adds, moves or removes a feature. Local dev: `pnpm --dir apps/game dev --host 127.0.0.1 --port <port>`. In the dev
build, `/lab/app/<screen>/<page>` shows the shell pages over fixtures (`src/shell/lab/app-lab-fixtures.ts`).

Play's paths have a command: `pnpm --dir apps/game prove:play --base-url https://127.0.0.1:<port> --out <dir>` drives
Play against a running dev build. It opens each lab fixture and the live page signed out (once with the slots read
failing) at desktop and phone sizes, counts what is on the page, presses each row's verb and checks that it reached that
row's own game, lobby or results (`scripts/prove-play.mjs`, writing `play-proof.json` and screenshots into a new
directory per run, and exiting 1 unless every press arrived). The places beyond Play have their own:
`pnpm --dir apps/game prove:shell --base-url https://127.0.0.1:<port> --out <dir> [--state <file>]` presses each flow of
Season, You, Settings and What's new from a fresh Play at both sizes, as a new visitor or, given a saved signed-in
browser state, as a returning player, scrolling to and clicking each control through the browser. Signed out it also
measures the lab's fixture pages (Play, a running Blitz season, a claim, a sealed chest, a paid entry, You, Settings and
What's new) and holds every page it passes, lab or live, to its content starting within 64 px under the bar (or a
phone's top row), every word displaying at 14 px or more as drawn (an SVG's scale counted), and on desktop the body
starting at the window's left edge. It sets back what it changes (the alert level, music) to the value it read, however
the flow ends, and stops before anything outward (paying, leaving for the docs, signing out). It writes
`shell-proof-<persona>.json` and screenshots into a new directory per run, marks a flow stopped by a service that did
not answer as unavailable and any other stop as failed, and exits 1 unless every flow arrived
(`scripts/prove-shell.mjs`; the proofs share `scripts/prove-run.mjs`). Given `--watch /g/<chain>/<game>` and the saved
state of a player who holds realms in that live game, it drives the one path inside a match it covers instead: it
watches the game, opens the identity chip, presses its Play, and checks at both sizes that the doorway shows and goes,
the game is played rather than watched, the chip names the player, and the page never reloads
(`shell-proof-watch-to-play.json`). `apps/game/AGENTS.md` documents a spectator smoke test (agent-browser steps that
open the client, watch a running game and check the canvas). Inside a match,
`prove:play --game <chain>:<game> --profile <dir>` drives one game signed in (a browser profile signed in once through
the game's own sign-in, kept outside the repo): `--crate <col>,<row>` finds a crate next to the player's army by
pointer, opens it and reads it back from the log after a reload; `--until-end <minutes>` stays on the map until the game
ends and leaves through **Game finished** → **See the results**, checking the page logged no "No game client is active";
`--ended` presses **Results** on the ended game's doorway and on its map address, at desktop and phone
(`scripts/prove-play-game.mjs`, writing `game-proof.json` and screenshots into a new directory per run). The outpost
proof below drives the runtime lab; live actions still need an eligible player.

Inside a Frontier match, `pnpm --dir apps/game playtest [--player <email>]` plays it as a spectator or a signed-in
player and judges each step by what the page shows (`apps/game/AGENTS.md`).

## Shell (outside a game)

On a desktop, a bar across the top holds the lockup, Play and Season, and You at its right end; keys `1`–`3` open the
three places and `Esc` goes back (`shell/frame/tabs.tsx`, `shell/frame/desktop-keys.ts`). A full-screen step (sign-in, a
lobby) keeps the bar with the lockup alone. Every page's content starts at the top, under the bar; a painting is its
ground, never space above it. `Enter` presses the page's step button (the one marked as its step) when it is enabled,
nothing has focus that answers Enter itself, and no dialog is open. On a phone the places are a tab bar at the foot. The
app's notice (offline, an update ready, or Install, which only Play offers) sits in the desktop's top bar before You,
and on a phone just above the foot.

| Feature                                                                   | Route                                      | How to reach it                                                                                                                                                         |
| ------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Play: what to do now, then each mode's games                              | `/`                                        | Top bar **Play**, key `1` (see Play below)                                                                                                                              |
| Season: Frontier's board, Blitz's rating and its prize                    | `/season`                                  | Top bar **Season**, key `2`; a phone switches Frontier / Blitz                                                                                                          |
| A player's card and finished games                                        | `/p/:address`                              | A row of Frontier's board (Season or a result); **Back** returns to it                                                                                                  |
| You: your card, finished games, Settings, docs, news                      | `/profile`                                 | Top bar **You**, key `3` (signed out: **Sign in**)                                                                                                                      |
| Settings: account, payout wallet, notifications, music, devices, sign out | `/profile/settings`                        | You, **Settings**                                                                                                                                                       |
| How to play (docs.realms.world, a new tab)                                | —                                          | You, **How to play**                                                                                                                                                    |
| What's new: the Scroll's posts and the latest changes                     | `/scroll`, `/scroll/:post`                 | You, **What's new**; its footer holds the community and legal links                                                                                                     |
| Terms, privacy, credits                                                   | `/terms`, `/privacy`, `/credits`           | The footer of What's new                                                                                                                                                |
| Sign in (Discord or an emailed code)                                      | `/sign-in`                                 | You, **Sign in**; Play free; a lobby's **Sign in**                                                                                                                      |
| Blitz lobby: entry, payment, countdown, chat                              | `/blitz/:slot`, `/blitz/game-:chain-:game` | Play, **Join** on a slot, **Lobby** on a seat                                                                                                                           |
| Enter or watch a running Blitz                                            | `/g/:chain/:game/...`                      | Play, **Enter** (seated) or **Watch**                                                                                                                                   |
| A finished game's results and review                                      | `/results/:chainId-:gameId`                | Play, **Results**; a finished game on You or a player's page; in the game, **Game finished** → **See the results**; an ended game's doorway or map address, **Results** |
| Install the app (PWA)                                                     | —                                          | Play's notice, **Install**                                                                                                                                              |

### Season, You and Results

- **Season** shows Frontier's board (its first rows, yours lit or pinned under them) and Blitz's rating board. While a
  Blitz season runs, each paid rating place shows what it would take of the pool if the season ended now; the pool and
  its end stand at the board's title. Once it is over, your share and its **Claim** stand above the rows. The prize is
  read from your own paid games, so signed out the board shows the rating alone. A Frontier row opens that player.
- **You** lists your last 8 finished games in every mode; a row opens its Results, whose **Back** returns to the list
  (Results reached from Play or after a match have **Continue** instead).
- **Results** of a Blitz opens on your score card, the one the game's review shares (your place, points and what they
  came from), stacked on a phone so every word reads at full size; **Share** opens the review to share it. A sealed
  chest's **Open** is the page's gold button; **Continue** stands beside it in outline. A reader who did not play sees
  the game and the board.
- **Settings** opens the payout wallet directly when a page sent you to link one (`/profile/settings?next=…`) and
  returns you there once it is linked.
- **The Blitz lobby** counts down to one moment: entry closing while the slot takes players, then the games' start (the
  lobby's title names the start time).

### Play

- **Now** leads with the one gold step, first match wins: **Enter** a Blitz seat, **Resume** the Frontier day,
  **Results** of a game of yours not yet opened on this device (any mode, looked up in your last 8 finished games),
  **Lobby** of a seat whose game is still being prepared, **Play** (signed out **Play free**, which opens sign-in and
  then the season), **Join** a Blitz, **Watch** one, Eternum's opening. Everything else under way follows, each with its
  own verb.
- **Next and done** shows one mode at a time behind its switch, opening on the first with something to do; a dot marks a
  mode holding something of yours. Blitz: slots to **Join**, a refund to **Take refund**, a seat's **Lobby**,
  **Results**. Eternum: when it opens.
- A read that fails (Blitz's slots, your results) says so with **Try again**; the games that answered stay usable.
- A Blitz lobby, signed out, asks to **Sign in** and returns to it. With no payout wallet, **Link wallet** opens
  Settings on the wallet (`/profile/settings?next=…`) and returns to the lobby once one is linked. The lobby's **Back**
  leads to Play. Sign-in from You or Settings returns to the page it was asked from.
- Play's former addresses, shared publicly (`/blitz`, `/frontier`, `/eternum`, `/dominion`), lead to Play: a permanent
  redirect on a full load (`public/_redirects`), and Play in the app (`RETIRED_PLAY_PATHS` in `src/app.tsx`).

## Blitz and Eternum in a match (`/g/:chain/:game/map` or `/hex`)

A match opens from the lobby (**Your game**) or from home (**Enter**). Add `?spectate=true` to watch a running game.
Both modes show War room (`src/ui/features/world/war-room/war-room-hud.tsx`). Below 1024 px wide the same cards stack:
Next up and the selected realm above one tab bar (Realm, Map, Events, Chat, Details), one sheet at a time. The map and
realm routes are `/g/:chain/:game/map` and `/g/:chain/:game/hex`.

| Feature                                                                                  | Where                                             | How to reach it                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| World map ↔ your realm's tiles                                                           | Header, **Local / World**                         | Key `V` toggles                                                                                                                                                                                        |
| Back out one step                                                                        | —                                                 | `Esc` on the map: a pending order, an open view, then the selection                                                                                                                                    |
| Cycle armies                                                                             | —                                                 | `Tab` on the map (cycles realms instead while Military is open)                                                                                                                                        |
| Cycle structures                                                                         | —                                                 | `Shift+Tab` on the map; `Tab` in the realm view                                                                                                                                                        |
| Clock, day phase, game end                                                               | Header centre                                     | Always visible; at the end it becomes **Game finished**                                                                                                                                                |
| Leaderboard (phone: rank, name and points; what they did under the name)                 | Header, your name chip                            | Click the chip (a signed-out spectator gets a sign-in prompt; a signed-in spectator who owns realms in the game gets **Play**, which joins the account at the doorway)                                 |
| Settings: audio, graphics, alerts, shortcuts, leave                                      | Header, round button at the right                 | Click                                                                                                                                                                                                  |
| Your structures, filter by kind                                                          | Left column, top (phone: **Realm** tab)           | Click a row to fly to it and open its card                                                                                                                                                             |
| Level up or provision the selected realm, and its costs                                  | Realm card, under the name                        | Click **Provision** or **Level up to …**                                                                                                                                                               |
| Build, Production, Military, Transfer (Eternum: Trade)                                   | Realm card, the orders                            | Click one; each opens a workspace over the map                                                                                                                                                         |
| Automatic production (Smart, Custom, Idle)                                               | Realm card, **Automatic production**              | Pick from the list                                                                                                                                                                                     |
| The selected realm's stocks and rates, all resources                                     | Realm card, **Stocks**                            | **All resources** shows every stock held                                                                                                                                                               |
| Relics: use one                                                                          | Realm card, under the stocks                      | Click a relic                                                                                                                                                                                          |
| Pin a realm to the top, rename it                                                        | Realm card, star and pencil beside the name       | Click                                                                                                                                                                                                  |
| What to do next: level up any of your realms, attacks, arrivals, suggestions             | Right column, **Next up** (phone: above the tabs) | Click its button; **1 of N ›** shows the next one                                                                                                                                                      |
| The three latest events: battles, your realms' news, your caravans, this session's sends | Right column, **Events**                          | Click a row to fly to it                                                                                                                                                                               |
| Every event and battle (All / Mine / Combat)                                             | Right column, **Events**, **All** (phone: tab)    | Click **All**                                                                                                                                                                                          |
| Selected tile: owner, armies, building                                                   | Right column, under Events (phone: **Details**)   | Click a hex                                                                                                                                                                                            |
| Minimap                                                                                  | Bottom left (phone: **Map** tab)                  | Drag it to move the camera                                                                                                                                                                             |
| Chat                                                                                     | Right column, bottom strip (phone: **Chat** tab)  | Click it or press `Enter`                                                                                                                                                                              |
| Orders on your own structure                                                             | —                                                 | Right-click it on the world map, with no army order pending                                                                                                                                            |
| Army orders: move, explore                                                               | —                                                 | Select an army (click it or `Tab`), right-click a reachable hex: the order goes at once. A left click on the hex only previews the path and its cost; on a touch screen, hold the hex (the map's hint) |
| Army order: attack                                                                       | —                                                 | Select an army, right-click an enemy on a reachable hex: nothing is sent yet; the attack forecast opens (for an expedition site, its tile card), and its **Attack** button sends it                    |
| Standings (spectator)                                                                    | Left column (phone: **Standings** tab)            | `?spectate=true`                                                                                                                                                                                       |

## Frontier in a match

Frontier has its own HUD (`src/ui/features/frontier/frontier-hud.tsx`): a strip at the top, a place bar at the foot, and
one sheet at a time.

| Feature                                                     | Where                                       | How to reach it                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| The realm's stores, the day's clock and what tomorrow lasts | Strip, top                                  | Always visible; tap the stores for **Production**                                                  |
| The map, your realm, research                               | Place bar, **Map**, **Realm**, **Research** | Tap; Realm shows a dot while a store is full or fills within the hour; a spectator has no Research |
| Chat                                                        | Place bar, **Chat**                         | Tap, or `Enter` on a desktop (docks beside the map)                                                |
| Today, Season, Production, Realms, Guide, Settings, Exit    | Place bar, **Menu**                         | Tap, then a row                                                                                    |
| LORDS purse: withdraw, your realms                          | Under the strip                             | Tap the purse                                                                                      |
| Order an army: explore or move                              | Map, dock or army                           | Pick the army in the dock (or tap it), tap a tile beside it, `Enter`                               |
| Queue an army's next order                                  | Map                                         | While its order is on its way, tap another tile (below)                                            |
| Build on a plot                                             | Realm view, an open plot                    | Tap the plot; the build sheet also links Research                                                  |
| Visit another realm                                         | Menu, **Season**                            | Tap a player, **Visit**; **Leave** returns home                                                    |

- **The next order.** After an order the army stays selected. A tile tapped for it while that order is on its way
  becomes its next order: the order bar shows **Next order · Queued** with **Cancel**. When the first order applies, the
  next one runs from where the army then stands, if the tile is still within its reach (else a toast says it is out of
  reach). One at a time: a later tap replaces it. **Cancel** or `Esc` drops it; so does a refused order, or leaving the
  map. A tap on your own army or realm still selects it. It is the acting page's own feedback, never a game fact; each
  step (queued, run, dropped and why) is in the army trace (`worldmap-next-order.ts`).

## Behaviour that differs from its label

These are current defects, listed so nobody maps them as intended navigation.

- `Esc` in the realm view is listed in Settings as "Return to world view from local view". It closes an open navigation
  view or clears building mode; `V` is what returns to the world (`three/scenes/hexception.tsx`).

## In a match: world map

Watch a running Blitz from Play (**Watch**) to reach the map without signing in; a seated player uses **Enter**.

- **Ownership rings**: select (click or tap) a hex holding a player's structure, theirs or yours, and the hover's pink
  ring lights every hex where that player holds a structure or has an army out. Selecting another hex, or one with no
  player's structure, clears them. They read only the selected hex, and follow captures (to the structure's new owner),
  new and fallen armies, moves and the layer switch (`src/three/scenes/worldmap-ownership-rings.ts`).
- **A selected structure that moves takes the selection with it**: when a Frontier realm is raised on its next day's
  site, the selected hex, its ring, the tile panel and the ownership rings move there together
  (`src/three/scenes/worldmap-selection-follow.ts`).

## Outposts

| Feature                 | How to reach it                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camp                    | Map → select a discovered canvas camp. Its standard and roof edging show ownership.                                                                                             |
| Village                 | Map → select a discovered Canvas & Thatch village. The yard standard and tent edging show ownership; local views use the same model.                                            |
| Stragglers              | Frontier Map → select a discovered stranded company beside its broken cart.                                                                                                     |
| Shrine                  | Frontier Map → select a discovered sun arch. Its site card offers the attribute reward when eligible; use removes the site.                                                     |
| Well                    | Frontier Map → select a discovered stone well. Its site card offers stamina when eligible; use removes the site.                                                                |
| Ownership and placement | `/lab` → Building model → choose an outpost → Ownership where available → Place on selected tile → Focus selected tile. Biome and Fog controls exercise terrain and visibility. |

With the local client running, open `/lab?evidence=/absolute/capture/directory` and run
`scripts/outposts/prove-runtime.playwright.js` through the browser connection with the page as its argument (remove the
trailing statement semicolon when supplying it as an expression). The directory must exist. It drives the visible
controls, checks delivered model responses, captures the six models on grassland and a tropical-coast transition, and
checks red/green ownership on camp, village and stragglers. Save its returned verification JSON beside the 15 captures.
Each capture blanks its page immediately. Stop the client afterward and retain the evidence.

Asset gates: `pnpm --dir apps/game verify:assets scripts/outposts/outpost-assets.test.mjs`. For live inspection, open
`/g/<chainId>/<gameId>?spectate=true`, press Map, then select a discovered site's tile. Available examples depend on the
watched player's revealed tiles. Spectators can inspect selection and presentation; capture and single-use rewards need
an eligible player. The lab proof does not establish those live actions.

- Ruin: Frontier Map → a discovered fallen realm; its beast still follows the same depth table. In `/lab`, choose **Ruin
  · Fallen realm** and place it on the selected tile. Add `&asset=ruin` to the runtime proof URL to capture only the
  ruin on grassland and the tropical-coast transition. The collision gate covers its four runtime beasts.

### Blitz rules a player meets

- **Entry closes five minutes before the start.** At the close the slot splits into games of up to 24 and the launch
  service seats every player, aiming to finish inside those five minutes; that target is unmeasured for large slots
  (`BLITZ_SLOT_PREPARATION_SECONDS`, `packages/value-ledger/src/blitz-slots.ts`). A game opens at its scheduled time
  once its whole roster is seated; until then its seats show **Lobby** (Preparing). If seating overruns, the game opens
  when its last seat lands and ends at its scheduled end: the start and end never move.
- **Starting forces.** Each of a player's three realms starts with 1,000 T1 troops garrisoned and 1,000 in reserve, one
  realm Knights, one Crossbowmen, one Paladins, in an order drawn per player. No army stands on the map at the start;
  the player creates one from the reserve.
- **Merging armies.** Select an army, then an adjacent army or realm of yours: the transfer panel moves troops between
  them, across realms too. Both sides must hold the same troop type and tier.

## World atmosphere

On the world map, unexplored ground uses moving edge mist through the existing directional reveal path. Frontier adds
darker mist and Ember lighting; Blitz retains the shipped day/night lighting. Ground biomes, relief, textures and props
are unchanged. The realm scene retains its shipped lighting.

For an auth-free comparison, open `/lab` → **World mode** → **Blitz** or **Frontier**, then select a scene and use
Exploration or Time. The lab calls the production terrain and atmosphere constructors. See `src/lab/README.md` for the
gallery proof command; live game selection comes only from the game's synced mode.
