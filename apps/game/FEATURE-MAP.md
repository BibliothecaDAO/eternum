# Feature map — game client

What a player can do and how they get there, so a report or a screenshot can be reproduced. Update it in the change that
adds, moves or removes a feature. Local dev: `pnpm --dir apps/game dev --host 127.0.0.1 --port <port>`. In the dev
build, `/lab/app/<screen>/<page>` shows the shell pages over fixtures (`src/shell/lab/app-lab-fixtures.ts`).

Play's paths have a command: `pnpm --dir apps/game prove:play --base-url https://127.0.0.1:<port> --out <dir>` drives
Play against a running dev build. It opens each lab fixture and the live page signed out (once with the slots read
failing) at desktop and phone sizes, counts what is on the page, presses each row's verb and checks that it reached that
row's own game, lobby or results (`scripts/prove-play.mjs`, writing `play-proof.json` and screenshots into a new
directory per run, and exiting 1 unless every press arrived). `apps/game/AGENTS.md` documents a spectator smoke test
(agent-browser steps that open the client, watch a running game and check the canvas). No command drives the paths
inside a match yet.

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
  player's structure, clears them. They follow captures (to the structure's new owner), new and fallen armies, moves, a
  Frontier realm's daily site and the layer switch (`src/three/scenes/worldmap-ownership-rings.ts`).
