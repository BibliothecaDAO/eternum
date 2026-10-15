# Feature map — game client

What a player can do and how they get there, so a report or a screenshot can be reproduced. Update it in the change that
adds, moves or removes a feature. Local dev: `pnpm --dir apps/game dev --host 127.0.0.1 --port <port>`. In the dev
build, `/lab/app/<screen>/<page>` shows the shell pages over fixtures (`src/shell/lab/app-lab-fixtures.ts`).

Play's paths have a command: `pnpm --dir apps/game prove:play --base-url https://127.0.0.1:<port> --out <dir>` drives
Play against a running dev build. It opens each lab fixture and the live page signed out (once with the slots read
failing) at desktop and phone sizes, counts what is on the page, presses each row's verb and checks that it reached that
row's own game, lobby or results (`scripts/prove-play.mjs`, writing `play-proof.json` and screenshots into a new
directory per run, and exiting 1 unless every press arrived). `apps/game/AGENTS.md` documents a spectator smoke test
(agent-browser steps that open the client, watch a running game and check the canvas). The outpost proof below drives
the runtime lab; live actions still need an eligible player.

## Shell (outside a game)

On a desktop, keys `1`–`4` open the four places and `Esc` goes back (`shell/frame/desktop-keys.ts`). `Enter` presses the
page's step button (the one marked as its step) when it is enabled, nothing has focus that answers Enter itself, and no
dialog is open. On a phone the places are a tab bar at the foot.

| Feature                                        | Route                                                                        | How to reach it                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| Play: what to do now, then each mode's games   | `/`                                                                          | Rail **Play**, key `1` (see Play below)                |
| Season standings and Blitz ratings             | `/season`                                                                    | Rail **Season**, key `2`                               |
| Guides and news                                | `/learn`, `/scroll/:post`                                                    | Rail **Learn**, key `3`                                |
| Account, payout wallet, notifications, devices | `/profile`, `/profile/account`, `/profile/notifications`, `/profile/devices` | Rail **Profile**, key `4`                              |
| Sign in (Discord or an emailed code)           | `/sign-in`                                                                   | Rail **Sign in**; Play free; a lobby's **Sign in**     |
| A player's history                             | `/p/:address`                                                                | Click a name in the standings                          |
| Blitz lobby: entry, payment, countdown, chat   | `/blitz/:slot`, `/blitz/game-:chain-:game`                                   | Play, **Join** on a slot, **Lobby** on a seat          |
| Enter or watch a running Blitz                 | `/g/:chain/:game/...`                                                        | Play, **Enter** (seated) or **Watch**                  |
| A finished game's results and review           | `/results/:chainId-:gameId`                                                  | Play, **Results**; or Season or Profile, a played game |
| Install the app (PWA)                          | —                                                                            | The banner, **Install**                                |

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
- A Blitz lobby, signed out, asks to **Sign in** and returns to it. With no payout wallet, **Link wallet** opens Account
  on the wallet (`/profile/account?next=…`) and returns to the lobby once one is linked. The lobby's **Back** leads to
  Play. Sign-in from Profile or Account returns to the page it was asked from.
- Play's former addresses, shared publicly (`/blitz`, `/frontier`, `/eternum`, `/dominion`), lead to Play: a permanent
  redirect on a full load (`public/_redirects`), and Play in the app (`RETIRED_PLAY_PATHS` in `src/app.tsx`).

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
| Village                 | Map → select a discovered palisaded longhouse village. The gate standard shows ownership; local views use the same model.                                                       |
| Stragglers              | Frontier Map → select a discovered stranded company beside its broken cart.                                                                                                     |
| Shrine                  | Frontier Map → select a discovered sun arch. Its site card offers the attribute reward when eligible; use removes the site.                                                     |
| Well                    | Frontier Map → select a discovered stone well. Its site card offers stamina when eligible; use removes the site.                                                                |
| Ownership and placement | `/lab` → Building model → choose an outpost → Ownership where available → Place on selected tile → Focus selected tile. Biome and Fog controls exercise terrain and visibility. |

With the local client running, open `/lab?evidence=/absolute/capture/directory` and run
`scripts/outposts/prove-runtime.playwright.js` through the browser connection with the page as its argument (remove the
trailing statement semicolon when supplying it as an expression). The directory must exist. It drives the visible
controls, checks delivered model responses, captures the five models on grassland and a tropical-coast transition, and
checks red/green ownership on camp, village and stragglers. Save its returned verification JSON beside the 13 captures.
Each capture blanks its page immediately. Stop the client afterward and retain the evidence.

Asset gates: `pnpm --dir apps/game verify:assets scripts/outposts/outpost-assets.test.mjs`. For live inspection, open
`/g/<chainId>/<gameId>?spectate=true`, press Map, then select a discovered site's tile. If a Frontier origin reload
returns to the watched realm, press Map again. Available examples depend on the watched player's revealed tiles.
Spectators can inspect selection and presentation; capture and single-use rewards need an eligible player. The lab proof
does not establish those live actions.
