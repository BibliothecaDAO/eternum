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
pointer, reads the pack its panel names, opens it and reads the same relics back from the history **Log** opens after a
reload; `--until-end <minutes>` stays on the map until the game ends and leaves through **Game finished** → **See the
results**, checking the page logged no "No game client is active"; `--ended` presses **Results** on the ended game's
doorway and on its map address, at desktop and phone; `--at-rest --watch` opens the map and realm as a spectator, so a
live game the profile holds no seat in shows its HUD at both sizes (`scripts/prove-play-game.mjs`, writing
`game-proof.json` and screenshots into a new directory per run). The outpost proof below drives the runtime lab; live
actions still need an eligible player.

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
Both modes show the command sidebar HUD (`src/ui/layouts/world.tsx`): your structures, the selected one's panel and its
actions down the left, the events and the selected tile on the right. Below 1024 px wide the panels open from one tab
bar (Empire, Map, Log, Chat, Details), with the actions in a row above it (a rail on the left in landscape).

Before play opens, every action is shown but shut, with **Starts in …** under the actions; a map order or a way into a
workspace says the same instead of sending (`src/utils/can-issue-orders.ts`).

| Feature                                                                             | Where                                                          | How to reach it                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World map ↔ your realm's tiles                                                      | Header, **Local / World**                                      | Key `V` toggles                                                                                                                                                                                                                                                                                   |
| Back out one step                                                                   | —                                                              | `Esc` on the map: a pending order, an open view, then the selection                                                                                                                                                                                                                               |
| Cycle armies                                                                        | —                                                              | `Tab` on the map (cycles realms instead while Military is open)                                                                                                                                                                                                                                   |
| Cycle structures                                                                    | —                                                              | `Shift+Tab` on the map; `Tab` in the realm view                                                                                                                                                                                                                                                   |
| Clock, day phase, game end                                                          | Header centre                                                  | Always visible; at the end it becomes **Game finished**                                                                                                                                                                                                                                           |
| Leaderboard (phone: rank, name and points; what they did under the name)            | Header, your name chip                                         | Click the chip (a signed-out spectator gets a sign-in prompt; a signed-in spectator who owns realms in the game gets **Play**, which joins the account at the doorway)                                                                                                                            |
| Attention: realms under attack or with arrivals, then suggested actions             | Header, **Attention** (gold with a count when something waits) | Click it to fly to the next one; a suggestion opens **Suggested actions**, where each runs in one click                                                                                                                                                                                           |
| Settings: audio, graphics, alerts, shortcuts, leave                                 | Header, round button at the right                              | Click                                                                                                                                                                                                                                                                                             |
| Your structures, filter by kind                                                     | Left column, top (phone: **Empire** tab)                       | Click a row to fly to it; its level-up button and requirements sit on the row                                                                                                                                                                                                                     |
| Level up or provision a realm                                                       | Its row in the structure list                                  | Click the arrow (a pickaxe while it needs provisioning); hover **i** for the requirements                                                                                                                                                                                                         |
| The selected structure's resources, production and relics                           | Left column, the structure's panel                             | Select a structure you own                                                                                                                                                                                                                                                                        |
| Automatic production                                                                | The structure's panel, its switch at the top right             | Pick one                                                                                                                                                                                                                                                                                          |
| Build, Production, Military, Transfer (Eternum: Trade)                              | Left column, the action strip (phone: the row above the tabs)  | Click one; each opens a workspace over the map                                                                                                                                                                                                                                                    |
| The latest events, fading after 20 s                                                | Right column, top                                              | Click a row to fly to it                                                                                                                                                                                                                                                                          |
| Every event and battle (All / Mine / Combat)                                        | Right column, **Log** (phone: **Log** tab)                     | Click **Log**                                                                                                                                                                                                                                                                                     |
| Selected tile: owner, armies, building                                              | Right column, under the events (phone: **Details**)            | Click a hex                                                                                                                                                                                                                                                                                       |
| Minimap                                                                             | Bottom left (phone: **Map** tab)                               | Drag it to move the camera                                                                                                                                                                                                                                                                        |
| Chat                                                                                | Right column, bottom strip (phone: **Chat** tab)               | Click it or press `Enter`                                                                                                                                                                                                                                                                         |
| Orders on your own structure                                                        | —                                                              | Right-click it on the world map, with no army order pending                                                                                                                                                                                                                                       |
| Army orders: move, explore                                                          | —                                                              | Select an army (click it or `Tab`), right-click a reachable hex: the order goes at once, and the army stays selected. A left click on the hex only previews the path and its cost; on a touch screen, hold the hex (the map's hint)                                                               |
| Army order: attack                                                                  | —                                                              | Select an army, right-click an enemy on a reachable hex: nothing is sent yet; the attack forecast opens (for an expedition site, its tile card), and its **Attack** button sends it                                                                                                               |
| Army order: transfer troops and relics                                              | —                                                              | Select an army, right-click its own realm or another of your armies on a neighbouring hex (the tooltip reads **Troops / Resources**): **Transfer Troops & Relics** opens in the middle of the screen, as every full window does wherever it was opened from; a phone shows it as the bottom sheet |
| Blitz: a dormant spire and its Essence                                              | World map, the explored hex; Events                            | Explore with an army: one reveal in two hundred raises a spire without its portal or a name over it, and pays its finder's realm 1,000 Essence plus any active Exploration relic bonus, shown on the hex and in **Events**. Army size and tier do not change the base grant                       |
| Blitz: a relic crate's pack (War, Explore, Produce, Fortress; lucky = all level II) | World map, the crate's hex; tile panel                         | Click the crate: its panel names the pack and lists its three relics before **Open**; the opening's feed row and **Log** line name the pack and where its relics went (army relics to the army, realm relics to its home realm, listed on the realm's card)                                       |
| Standings (spectator)                                                               | Left column (phone: **Standings** tab)                         | `?spectate=true`                                                                                                                                                                                                                                                                                  |

### Action windows

Full workspaces open in the centre of the desktop; on a phone they use the shared sheet placement. A headed window can
be dragged while open. Closing and reopening it, or replacing it with a different window, starts at its normal placement
again. Re-aiming the same open window at another tile preserves its current drag. Positions are not saved between
openings (`src/ui/design-system/molecules/popover.tsx`).

### Connected match proofs

Use a running client and a private browser profile signed in through the normal sign-in flow:

```sh
pnpm --dir apps/game prove:play --base-url <url> --game <chain>:<game> --profile <private-profile> --tasks boot --out <fresh-dir>
```

The **boot** task enters the game and opens Chat at desktop and phone sizes. It requires the rendered map and Chat, and
fails on page or console errors. It is a signed-in game proof, separate from the signed-out Play/shell fixtures. The
same runner's `blitz-farm,blitz-army,blitz-explore,blitz-transfer,blitz-standings` tasks play a seated Blitz player's
orders through the HUD, and `gate-build,gate-production` check that nothing acts before play opens
(`scripts/game-tasks.mjs`).

For a seated Blitz player with at least two armies able to act:

```sh
pnpm --dir apps/game playtest --base-url <url> --player <email> --chain-id <chain> --game-id <game> --steps blitz-burst --out <fresh-dir>
```

The **blitz-burst** step list cycles armies with Tab and orders reachable hexes by right-click, back to back. Its
verdicts match each click to the send's answer, Herald status and rendered army movement. It uses the shared playtest
runner, which retains transcripts and screenshots and closes what it starts;
[client instructions](AGENTS.md#playtest-the-one-command-that-proves-client-work) describe sign-in, renderer selection,
timing bounds and evidence. The proofs need a live game and eligible player; they do not create accounts or make a
signed-out fixture count as a played match.

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

## Facets icons

`/lab/kit/icons` shows every production icon at 24, 32 or 64 px. Filter by family, search a meaning, hide labels, press
Production or Transfer, and open a grouped minimap sector. The nine troop portraits distinguish type and tier; hex
badges repeat ownership with colour and shape and retain level or strength values.

`pnpm icons:prove <evidence-dir> https://127.0.0.1:<port>` drives the catalog, HUD and shell fixtures at desktop and
phone sizes against the running client. It uses the same proof recorder as Play and Shell, saves screenshots and
requested icon URLs, and exits nonzero on missing paintings, overflow or failed interactions. HTML images decode in
place; each SVG image URL is resolved and decoded through an image loader, with decoded dimensions or the failure kept
in the record. Append `--missing-svg` for the negative control: it replaces one minimap artwork URL with a missing file
and must exit nonzero with that SVG marked unloaded. Live game proof still requires the shared free Blitz.
`pnpm icons:check` validates all meanings, 58 resources, reviewed masters and exports; `pnpm icons:build` exports the
paintings (optional painting IDs export only those masters). `pnpm icons:measure <new-dir>` records individual-image and
comparison-atlas byte counts after the client build. `pnpm icons:review <new-dir> <baseline-evidence-dir>` makes contact
sheets.

Device-limit recovery: game entry on a ninth device explains the eight-device limit after a refused join and a
chain-local device count. Open `/profile/settings#devices` on an already signed-in device, remove a device with the
existing confirmation, then press **Try again** at the original doorway. The link opens separately so the game entry
remains available. Both `/g/:chain/:game` and its play routes use the same recovery. A ninth device cannot submit a
revocation itself.

## Construction model thumbnails

In a match, select a realm → Build: desktop cards, compact cards, and empty-plot choices show the current building
model. Action buttons and resource costs retain Facets icons. `/lab/kit/construction` exercises the real responsive
cards with local counts and one example of each model; Build changes the preview count without sending a transaction.

Against the running client, `pnpm --dir apps/game prove:construction https://127.0.0.1:<port> <evidence-dir>` checks
desktop and phone cards, decodes every image, presses Build, and saves screenshots and a JSON result using the shared
proof runner. `pnpm --dir apps/game render:building-thumbnails https://127.0.0.1:<port> <evidence-dir>` regenerates the
transparent PNGs from the current compressed GLBs through the game's loader. Source/image hashes are recorded in
`asset-sources/building-thumbnails.json`; the construction thumbnail test checks them against the files and checks every
building's thumbnail against the scene's model selection.

## Realm models

`/lab` → **Models & motion** → **Realm ladder** shows the production settlement, city, kingdom and empire at true scale.
City and kingdom have warm upper glass; empire has four lower oak shutters and six upper warm windows. The treatment is
baked into the three production models; there is no window-treatment selector. Settlement and wonders keep their own
materials. Choose **Age**, **Series**, **Order**, **Ownership** and **Distance**; drag to orbit and scroll to zoom. With
an external reference directory in the URL, **Revision** offers Before, After and the pair. See
[src/lab/README.md](src/lab/README.md#realm-revision-comparison) for the retained capture driver and reference setup.

### T1 Knight

Land T1 Knights use the new sword-and-shield model in every game mode. Near/mid skin detail follows camera distance; the
far map keeps army icons. `/lab/models?family=knight&source=comparison&tier=1&compare=0&detail=crowd` compares the
previous model and the production model. Skin detail selects Near or Mid; Idle, Move and Run exercise both skins. The
terrain lab's Army model → knight1 previews the same production actor at its map scale.

Live proof: `pnpm --dir apps/game playtest --port 4195 --steps knight-blitz-spectator --iterations 1` enters a running
Blitz as a spectator and checks visible Knight representations and mesh budgets before and after zooming close.
`--steps knight-spectator` exercises Frontier. A view without a T1 Knight is reported blocked, never passed.

## Realm level icons

`/lab/kit/icons#realm-levels` compares all four realm levels with the current GLB renders and the previous paintings.
Use **Shipped / By level** to switch the portraits and hex badges, and **24 / 32 / 64 px** to inspect the delivered
sizes. Each level shows all four ownership cues and its value badge.
`pnpm icons:prove <evidence-dir> https://127.0.0.1:<port> --catalog` drives those controls and decodes both HTML and SVG
artwork at desktop and phone sizes.

The production entity portrait and castle upgrade use `realmMeaning(level)`; the native minimap selects
`realmMarkerMeaning(level)` in `minimap-markers.ts`. Category-only realm symbols remain generic. The four reference
renders use the shipped GLBs named in `realm-model-references.json`, with source and render hashes.

`/lab/kit/icons#hex-fill` compares the previous realm emblem inset with the production fill at the minimap's default
19.6 px tile size and at 30 px, for every level and ownership cue. The fill follows each painting's silhouette; the rim,
ownership shape and level pip stay the same.
`pnpm icons:prove <new-evidence-dir> https://127.0.0.1:4193 --minimap-url '<live-spectator-map-url>'` checks decoded
realm art, rim clearance and level pips in the real minimap at its current camera zoom, then captures the map and
minimap.
