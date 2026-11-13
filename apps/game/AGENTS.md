# Agent Instructions for Game Client

## Patch notes

Players read what changed in What's new's patch notes, one file per release under `content/patch-notes/`, written by the
patch notes' editor at each release (that folder's `AGENTS.md`). A change does not add an entry of its own: say what a
player meets in its pull request, and the editor takes it from there.

## Design rules

What a player sees follows these five rules. Each says where the code holds it today and, plainly, where it does not
yet. A change that moves a surface away from a rule is refused in review like a bug; a change that closes a gap deletes
it from here.

1. **A side keeps its colour on every surface.** To a playing viewer their own things are green, an ally's blue and
   everyone else's red, nobody's included. Allies exist in Eternum only: there a tribe member is an ally, while in
   Blitz, Duel and Frontier every other player is an enemy, tribe or not (`arePlayersAllied`,
   `src/utils/entity-ownership.ts:39`). A watching viewer has no side: each player takes their seat's colour and
   nobody's things are grey (`watchedSide`, `src/utils/entity-ownership.ts:121`; `seatSide`, `src/tokens.ts:772`). The
   side comes from `sideOf` (`src/utils/entity-ownership.ts:57`), its colour from `SIDE_COLOURS` and `SIDE_HEX`
   (`src/tokens.ts:763`). Today the map's labels and plates, the stamina bars on plates
   (`src/three/map-plates/map-plates.css:75`), the minimap's borders and ownership marks
   (`src/ui/design-system/hex-marker.tsx:9`; the paintings inside keep their own colours) and army paths
   (`src/three/managers/army-path-colour.ts:9`) read it. The playtest's `--steps blitz-plates` and `frontier-plates`
   check the labels only. Not yet: the guard stamina bar off the map is coloured by the stamina left
   (`src/ui/features/military/components/guard-stamina-bar.tsx:11`), the battle screen's survival bars by the troops
   left, for both sides (`src/ui/features/military/battle/battle-lab/outcome-strip.tsx:20`), and portraits carry no side
   (`HudPortrait`, `src/ui/design-system/kit/hud-elements.tsx:2322`).
2. **Map models that stand still face the camera.** The map's camera never turns (`enableRotate: false`,
   `src/three/constants/rendering.ts:15`), so a model that stands on the map shows its front to the camera, from the
   south, and is authored with its front on +Z. Armies are outside this rule: they take their own heading
   (`src/three/managers/army-manager.ts:1204`). Today a structure's models are handed together to
   `resolveStructureRotationY` (`src/three/managers/structure-manager.ts:1495`), which gives zero yaw to any set holding
   a settlement (realm, village, camp, cleared site), a Frontier beast or a skin of one of them, and keeps the turn it
   was given otherwise (`src/three/structures/structure-orientation.ts:12`). A ruin or a rift drawn with its beast
   therefore faces the camera (`src/three/structures/structure-orientation.test.ts:49`). Chests take their own zero yaw
   (`src/three/managers/chest-manager.ts:589`). Not yet: a bank is turned 120° before the resolver is asked
   (`src/three/managers/structure-manager.ts:1483`), and every other set keeps the one-of-six turn drawn from its tile
   (`:1488`): hyperstructures, mines, and ruin and rift landmarks standing alone
   (`src/three/structures/structure-orientation.test.ts:60`). A zero yaw faces the camera only when the asset's front is
   on +Z: check it on a capture of the model.
3. **The player owns the camera and the input.** The camera moves only for a reason `CameraNavigation` names
   (`src/three/scenes/worldmap-camera-target.ts:20`): the map's first view, an address or a link, the minimap, a
   shortcut key, a HUD control that shows an army, a spire's view switch. A tap or a selection on the map and every
   order (explore, move, attack, build, deploy, claim) leave the camera where the player put it;
   `src/three/scenes/worldmap-camera-stays.test.tsx:205` holds it for Frontier's and Blitz's orders. One panel stands at
   a time: among Frontier's HUD surfaces, the map's selection card and the deploy order, opening one puts the others
   away (`useOnePanel`, `src/ui/features/frontier/hud/one-panel.ts:37`), and the playtest's `hud-layout` step fails a
   HUD part drawn over another. A notice over the map stands long enough to read, then goes by itself. An army's loss is
   one: its notice closes after 3 s, sooner by its × or a new pick on the map
   (`src/ui/features/frontier/army/army-lost.tsx:12`, `:20`). Pages outside a match, such as Results, are left by their
   own buttons (`src/shell/season-tab/results-page.tsx:192`). Not yet: Frontier's day turn. A summary that is shown
   covers the map and takes every press until Continue (`src/ui/features/frontier/rollover/day-end-screen.tsx:36`,
   `src/hooks/store/use-day-end-store.ts:115`), and the day's turn then brings the camera onto the realm's new site,
   with or without a summary (`src/ui/features/world/components/expeditions/expedition-rollover.tsx:75`). The playtest's
   `lab-day-*` and `lab-season-opens` steps below require both, so a change to it changes the summary's input, its
   dismissal, the camera's move and those steps together.
4. **The bar is a shipped commercial strategy game.** Art, models, icons, screens, video and onboarding are judged side
   by side with what ships today and with the games this one stands beside (Age of Empires, Heroes of Might and Magic,
   Civilization), at the sizes a player meets them: icons at HUD size, screens on a desktop and a phone. A change that
   loses to what ships does not land. New art follows the lore, and a screen speaks through pictures (icons, paintings,
   background art), never words alone. This is a review standard, not a check; the lab's painting comparison draws a
   painting on its real component beside the art it replaces (`src/lab/README.md:18`). Icon delivery follows
   `scripts/icons/AGENTS.md`.
5. **Validate in the lab, then wire into the game.** A new screen, model, icon or flow is built and judged in the lab
   (`/lab`, `src/lab/README.md`) before the game uses it. A lab page mounts the production components on real assets,
   with real or recorded game data or representative native-fact fixtures, never a lab-only copy, as the chest opening
   does (`src/lab/README.md:7`). A choice between options is made on a lab page that shows each option as stills,
   desktop and phone, beside what ships; only the option picked is wired into the game. Stills compare options; motion
   and interaction are proven by their temporal captures (`docs/architecture/animation-evaluation.md:103`, from the
   repository root) and by the playtest.

## CRITICAL Git Rules for Parallel Agents CRITICAL

Multiple agents may work on different files in the same worktree simultaneously. You MUST follow these rules:

### Committing

ONLY commit files YOU changed in THIS session ALWAYS include fixes #<number> or closes #<number> in the commit message
when there is a related issue or PR NEVER use git add -A or git add . - these sweep up changes from other agents ALWAYS
use git add <specific-file-paths> listing only files you modified Before committing, run git status and verify you are
only staging YOUR files Track which files you created/modified/deleted during the session

### Forbidden Git Operations

These commands can destroy other agents' work:

git reset --hard - destroys uncommitted changes git checkout . - destroys uncommitted changes git clean -fd - deletes
untracked files git stash - stashes ALL changes including other agents' work git add -A / git add . - stages other
agents' uncommitted work git commit --no-verify - bypasses required checks and is never allowed

### Safe Workflow

```bash
# 1. Check status first
git status

# 2. Add ONLY your specific files
git add packages/ai/src/providers/transform-messages.ts
git add packages/ai/CHANGELOG.md

# 3. Commit
git commit -m "fix(ai): description"

# 4. Push (pull --rebase if needed, but NEVER reset/checkout)
git pull --rebase && git push
```

### If Rebase Conflicts Occur

Resolve conflicts in YOUR files only If conflict is in a file you didn't modify, abort and ask the user NEVER force push

## Playtest: the one command that proves client work

| Rule                                                                                                                                           | Enforcement                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An already-playing lab scenario supplies its linked wallet when onboarding is outside its proof; missing-wallet scenarios retain wallet setup. | `src/lab/game/lab-chain-wallet.test.tsx` renders the real connection window, including its portal, for both fixture states.                             |
| Playing lab scenarios seed discovery facts before an action and preserve native payout units.                                                  | `src/lab/game/ruin-fight-scenario.test.ts` checks the discovered relic, clear receipt, unchanged LORDS and awarded army slot.                           |
| Ruin availability and daily-limit copy use the preset entitlement and pinned release through `ruinLimit`.                                      | `packages/core/src/utils/ruins.test.ts` exercises actual presets and two relic clears across reconnect; the ruin browser step rejects daily-limit copy. |

`pnpm --dir apps/game playtest --port <your port>` builds the client as players get it (`vite build` into its own
`.context/playtest-builds/<run>` directory), serves it with `vite preview` on that port, plays the newest live game of
its steps' mode (Frontier by default) in a browser on the machine's GPU (Vulkan; headless Chrome would otherwise render
on SwiftShader), and releases everything it started. Run it from a stopped client and reuse it; extend its steps in
`scripts/client-playtest/steps.mjs` rather than writing another runner. The build needs `VITE_PUBLIC_L2_RPC_URL` in
`apps/game/.env.local`, as the dev server does.

- **What it owns.** One owner holds the build, the preview, each browser with its DevTools connection and temporary
  profile, and releases them last-acquired first, each awaited, on every exit. A port already in use fails the start
  before anything is built; the server holding it is never driven or stopped. The client counts as served only once its
  own preview announced the port, still runs, and answers. A preview that dies cancels the run.
- **Cancelling.** SIGINT or SIGTERM stops a client build in progress at once, otherwise cancels at the next checkpoint,
  and unwinds through the same path as a normal end: the current step is kept with what it attempted and the error, the
  run's transcript and `summary.json` are written, and everything is released.
- **The page's size.** 1920 by 1080 unless `--viewport <width>x<height>` asks for another (`390x844` plays a phone, with
  a phone's touch: under 1024 wide `(pointer: coarse)` matches, as `capture:hud-lab` and every `runProof` proof shoot
  their phone sizes). On the map, the `hud-layout` step reads every part the HUD draws and judges it as the lab's layout
  check does (`scripts/client-playtest/hud-layout.mjs`): each part whole on the page, none over another, none with
  content past its edge, every control reachable where it is in view (a row scrolled out of its panel is not seen, so
  not tested), at most seven parts in each region, and on a desktop the minimap.
- **As a spectator** (default), from a fresh browser profile (cold cache): enter on the map (a Frontier session opens
  there, the realm one press away), the HUD's layout, map idle, pan (WASD), zoom out and in, the season (its board
  drawn, then closed: from a desktop's Season place, in the rail; from a phone's Menu), the Feed's first story that is a
  link (a phone's from its Log, put away again if the story leaves it open; the map on its place, that tile selected,
  the page never loaded again), visits to the board's second and third realms in turn (each by Visit, its realm, then
  the map on it, in the same page, that realm selected and the camera on it), the realm and back to the map, then a
  minute of watching.
- **As a player** (`--player <email>`), entering through the Frontier card's Resume or Play on the home page with the
  browser's own click, and past a new day's summary (Continue): enter on the map, select the army with the most stamina,
  open and close production, the next order's life (below), explore twice (tap a tile beside the army, then tap it
  again; on a desktop, right-click the tile whose hover offers Explore), then the next order dropped by leaving the map.
  Orders use the map's default zoom; the army must be deployed. The next order is a phone's: on a desktop an order goes
  from the map at once, so its steps are blocked there; play them with `--viewport 390x844`.
- **Saved player state.** Pass `--storage-state /private/player-storage.json` with `--player` to restore and renew an
  existing dev identity. If that state is signed out, the run refuses before sending an email code.
- **Saved passkeys.** Pass `--passkeys /private/passkeys.json` with `--player` to put that device's saved passkeys
  (DevTools' virtual authenticator credentials, as the default wallet's dev test keeps them) on the run's page, so the
  player's Realms wallet confirms without a person; the file is written back at the end with its sign counts and is
  never copied into the evidence. A passkey works only on the origin it was made on (`--base-url`).
- **This checkout at a deployed origin.** `--client-at-origin` with `--base-url <origin>` builds this checkout and has
  its files answer for that origin in the run's page only (DevTools interception from a worker thread, service workers
  bypassed): a navigation gets its `index.html`, every file the build holds is served, and `/api`, other origins and
  anything the build lacks go to the deployed origin. What is bound to the origin (a passkey, host-only cookies) works
  as for a player, while the deployed client stays as it is. The transcript's `clientAtOrigin.served` counts the files
  served from the build.
- **Signing in.** Each player keeps a profile under `.context/playtest-profiles/<email>`; agent-browser is handed it on
  every command (it relaunches on a temporary profile for a command that omits it). Each run opens the home page first:
  a signed-in player's bar shows them and the run goes on at once; a signed-out one presses Connect and signs in as a
  player does: the email, Send code, then the code. The runner reads no mail: it prints
  `{"signInCode": {"email", "writeTo"}}` on stderr and waits up to 10 minutes for the code from the sign-in mail in that
  file, which it deletes once read. An account that asks to claim a name is refused: a run never sets up an account.
- **The next order's life**, each step with the army's first order held in flight at the network (DevTools pauses its
  `starknet_addInvokeTransaction` send while the step acts, then lets it reach the node or, for refused, answers it as
  the node refusing the transaction, a JSON-RPC validation failure, without it reaching the node): a tile tapped beside
  the first runs once the first applies (run), a second tap replaces it (replaced), Cancel and Escape drop it, a refused
  first order drops it (refused), and leaving the map drops it (deselect).
- **The game.** Each step list names its game's mode (Frontier, or Blitz for `--steps blitz-orders`): the newest live
  game of that mode, or `--chain-id`/`--game-id` (refused if it is not a listed game of that mode). Before the first
  step the run asserts the route is in that game, and refuses to send any order elsewhere.

Every step checks what a player would then see and is judged completed, blocked (the game refused, for a reason a player
meets too: a short cost, no army) or failed:

- scenes: the route's scene, the scene the renderer last drew and the lit place agree (a reloaded page must stay on the
  scene, else the control is pressed again);
- pan: the view changed past the animated floor that map-idle records;
- zoom: the camera distance grew from where it was, then shrank;
- sheets: Menu or Production opened, then closed;
- army: the readiest army's button is pressed;
- explore: Explore was offered and pressed, the client's record has a hash, an applied outcome and its rendered marker,
  and the explored tile visibly changed between a screenshot before Enter and one after;
- next order: the order bar showed it queued while the first order was in flight, the army trace shows its steps in the
  expected sequence (queued, then run or dropped for the step's reason), the expected orders were sent with a hash and
  confirmed, and one that ran is the tile last queued; a queued tap that never left fails.

```bash
pnpm --dir apps/game playtest --port 4174 --iterations 3
pnpm --dir apps/game playtest --port 4174 --player <email>
pnpm --dir apps/game playtest --base-url https://127.0.0.1:4174 --iterations 1   # a client you already serve
```

Options: `--channel web|play|app-store` (default web: the app the client is played in, launched as that app launches the
site, `src/runtime/distribution-channel.ts`: `play` opens the run's page with `?channel=play`, `app-store` appends
`RealmsApp/ios` to the browser's user agent before any page opens and fails the run unless the booted page carries it
with no service worker registered), `--renderer-modes webgpu-auto,webgpu-force-webgl` (default both), `--iterations`
(default 3), `--cpu-throttle 4` (Chrome's CPU slowdown of this machine; not a measured laptop), `--gpu low-power` (the
page on the machine's integrated GPU, a phone's class of GPU: the one device `vulkaninfo --summary` calls integrated,
refused when there is none or more than one; the browser is launched seeing only that GPU through Mesa's Vulkan device
selection, and a run that drew on another fails), `--network 20,40` (Chrome shapes the page's link to that many Mbit/s
and that round trip in ms, so a load is timed as a player's connection serves it), `--chain-id` and `--game-id`,
`--steps ownership-rings` (the map unselected, the player's realm selected with its owner's holdings ringed, held and
panned, then cleared: the rings' frame cost; each phase checks the selection and ring count the page reports in
`window.__eternumMapSelection`, and fails on a build that does not report them), `--steps blitz-orders` (a seated player
in a Blitz game, entered by its card's **Enter**: the world map, Tab to select the readiest army, then orders by
right-click on a tile whose hover tooltip offers Move or Explore, each held at the network while the selection is read:
the army stays selected through an order's confirmation and is offered orders from its new tile, the tile panel's
selected hex on that tile, a second order goes without selecting it again, a refused one leaves it selected where it
stood, and one deselected with Escape while its order is in flight is not selected again; the army's id, hex and order
count come from the same report), `--steps blitz-burst` (a seated Blitz player's orders as fast as keys allow: each army
Tab lands on gets a tile whose tooltip offers Move or Explore, then every army is taken with Tab and ordered with a
right-click back to back through DevTools input, nothing held; each order is timed from the click the client recorded to
its send's answer, Herald's status and its army moving (a move) or its reveal rendered (an explore, which may leave the
army in place), from `__armyMovementLatencyTraceEntries`; needs two armies that can act), `--steps blitz-spectator` (the
spectator's map steps in a Blitz game: the world map, idle, pan, zoom, a minute of watching; the matched frame-time run
for Blitz), `--steps blitz-plates` (the map's labels in a Blitz game as a spectator sees them, opened with the dev
overlays so the page reports its world: read at the map's zoom, the farthest and the closest, the tiles round the centre
hovered one by one, and at each zoom a click at each label in view, with the label layer shown then hidden, failing on
any label not drawn in its side's colour (the page's own green, blue and red; to a spectator, each player's seat colour,
one per seat, no two alike, nobody's grey), any label that takes a pointer, a click at a token or an open plate that
selects another tile than the same click with the labels hidden, any label whose foot reaches below its thing's model
top or whose span is not over its thing, as the renderer places the thing, any token, plate or order line over or within
4px of another, or an opened plate that does not cover the token read for its thing before the hover;
`--steps blitz-plates-player` takes the readiest army with Tab first, so each hovered tile shows its order line;
`--steps frontier-plates` and `frontier-plates-player` the same in a Frontier game, entered on its map),
`--steps still-map` (a Frontier spectator's map with nothing pressed, its frames recorded for 6 s at the default view
and again at the closest, the camera distance read and required to be the closest, into `<step>-frames/` with
`<step>-changes.png`, each pixel's share of frame pairs it changed in: what a still view shimmers with, to compare two
builds on the same view; `--steps blitz-still-map` the same in a Blitz game; `--steps still-map-frozen-sun` and
`--steps blitz-still-map-frozen-sun` first tick the dev tools' Override Time to hold the sun, and open the page with the
dev overlays on, as the plate lists do), `--steps lab-spire` (no live game: the lab's spire game,
`/lab/game?scenario=spire`, the game's own route, scenes, HUD and client on a fixture held in the tab, whose player's
signed commands are recorded in `window.__labChain` and answered as the contract applies them; the spire's army picked
from the dock, which must show its own panel, not the spire's card, and offer **Spire**; Spire pressed for the spire's
card, its depths, costs and commitment read, then Enter on Ethereal II: the EnterDepth command signed for that army, and
the army two regions below, shown in Ethereal II; play it at `--viewport 390x844` too), `--steps lab-layers` (the same
game: the view switch's list, World and each Ethereal layer, a phone's with Realm; Ethereal II and World each at the
camera's same spot, then the realm from Ethereal II and back), `--steps lab-merge-loses-xp`,
`--steps lab-merge-keeps-tapped` and `--steps lab-after-battle` (the same game with two of the realm's armies merged
through **Transfer troops**, under with and without lost XP (the target always survives; lost XP must be confirmed once
more), or with the owner's army after its fight standing on the camp it cleared: each army's tile, found under its
token, hovered with nothing selected must open that army's plate, and an emptied tile none), `--steps lab-reinforce`
(`/lab/game?scenario=reinforce`, the army beside home: the realm selected from its tile, the army right-clicked for
**Reinforce** (at a phone's width a finger taps the realm and holds the army, through DevTools' touch input), Max and
Reinforce sent; the chain's RecruitExplorer answer must leave the army at 1,918, no knights and 160 wheat at home),
`--steps lab-visit` (`/lab/game?scenario=visit`, the painted Kingdom's game with a neighbour's Kingdom on the Season
board, built in another order: Visit from the board, Leave, and Visit and Leave again, each arrival failing on another
realm drawn, a building laid out without its model attached, shown and loaded, or a HUD panel past the screen's edge;
each board swept point by point, each hovered then tapped, a visit failing on a building's card that names another
building than its hover or offers more than its close, an open plot's card, or any command signed, and home failing on
such a card or on no open plot opening Build), `--steps lab-reenter` (`/lab/game?scenario=from-home`, the spire's game
opened on the home page: entered by its card's Resume, left by Back and then by the HUD's way out (a phone's Menu, Exit;
a desktop Back again, as its Leave game loads the page afresh), and entered by Resume each time: each leave failing
short of the home page or with the game's label layer still mounted, each return on the map's labels or plates read on
entry missing; play it at `--viewport 390x844` too), `--steps lab-hud-devices` (`/lab/game?scenario=sites`, the map's
share of the page on a device: at rest, the army picked, its panel, a site's card, Chat and the Menu, each read by
hit-testing a grid 8 px apart for where the map's canvas is the first thing a press reaches and which HUD part takes
each other point, with the share above a phone's keyboard; run it at each device's size with `--viewport`),
`--steps lab-ruin-fight` (`/lab/game?scenario=ruin-fight`, the owner's army beside the ruin before its fight: the army
picked from the HUD must bring the camera onto it; then, on a phone with the ruin first panned under where its card
opens, the ruin's card opened from the map (a right-click, a tap) and **Attack** pressed must leave the camera where it
was, the card carries no daily-limit rule, the chain's BattleGuard answered, the ruin gone, the army at 4,011 and no
cash chest; then the Feed, opened from its place, must tell the attack and the clear it won as one row, the clear's;
play it at `--viewport 390x844` too), `--steps lab-hover-zoom` (the army after its fight, with nothing selected and the
dev overlays on, at each wheel step from the closest zoom to the farthest: each army's token must stand over its own
model, and the pointer on its model at its feet, middle and top must open its plate; `--steps lab-hover-zoom-pair` the
same with the realm's two armies side by side, the merge game's), `--steps lab-high-ground`
(`/lab/game?scenario=high-ground`, the spire's game on snow, bare rock and tundra, with the dev overlays on: the army
picked, every tile it is lit on must lie above the highest ground under it), `--steps lab-day-turn`,
`--steps lab-day-later`, `--steps lab-day-turn-slow` and `--steps lab-day-later-short` (the same game on Frontier's day
2 ending, `/lab/game?scenario=day-turn` in the session or `scenario=day-later` before it opened, over prod's recorded
history of that day, the map opened where the realm stood on day 2: the summary's totals must be the recorded player's
own day 2 (slow: history answers only after the moment went on, and the summary opens then; short: a page of stories
late in day 2 leaves its start unread, and the card shows dashes and says why), and Continue must bring the camera onto
the realm's day-3 site), `--steps lab-day-later-quiet` and `--steps lab-day-later-played-on` (day 2 not played, or the
player already played on in day 3 on another device: no summary, and the day's end still brings the camera onto the
day-3 site), `--steps lab-season-opens` (a player in the season 30 s before its first day, their realm founded but on no
site yet: the map must draw with no error, then day 1's turn must play, with no summary, and leave the camera on the
realm's first site), `--steps lab-day-turn-asleep` (the owner's phone, at `--viewport 390x844`: a minute before day 2
ends the tab's window is minimized and the page frozen, its WebGL context lost and Herald's stream silent with its
socket open, then brought back past the end; on WebGL the page must boot again and the map draw, its middle band no more
than half black past what it was, the loss's two error lines its outcome; on WebGPU, whose device this machine keeps,
the silent stream must be dropped and resumed; then the summary and Continue as above), `--steps realm-load` (a
spectator's realm view as first met: the map held still, the first press of Realm, the realm held still, back to the
map, Realm again, and the realm's address loaded again; each step reports its downloads by kind with their bytes on the
wire, the GPU work its frames asked for (pipelines and shaders compiled, bytes uploaded), long frames, the frames where
the drawn scene changed and the scene marks `scene:<name>:requested` and `scene:<name>:presentable`; the boot reports
the same as `bootWindow`), `--steps lab-realm-load` (the same on the lab's built Kingdom,
`/lab/game?scenario=painted-buildings`, reopened on its realm with `&scene=hex`), `--steps lab-devcon-art` (all regular
and golden Devcon model tiers on the map, HUD and local keep; `/lab/game?scenario=devcon-0` through `devcon-3`, and
`devcon-golden-0` through `devcon-golden-3`), `--steps lab-devcon-season` (regular, golden and ordinary Season homes
outside the streamed scope; `/lab/game?scenario=devcon-season`), `--steps blitz-realm-load` (the same on the newest live
Blitz game), `--steps entry` (the game entered from a fresh profile, then the same address loaded again from the HTTP
cache, each followed by 10 s still on the map read for what keeps running: frame callbacks, repeating timers and timers
of 100 ms or more by the code that scheduled them, elements restyled by script, running CSS animations, canvases,
full-screen layers a player cannot see, the boot shell and the GPU memory held, and the first seconds of play from one
continuous frame record from the drop of the doorway (frames over 33 ms and the worst frame in the 5 s after it, the
time to the first second of frames at or under 20 ms, each counting the frame that crosses its end; a record whose
frames do not reach from the drop through the window is refused as incomplete, and the record is kept in the transcript
beside its judgment, `doorwayFrames`); the reload's entry milestones are kept), `--steps lab-entry` (the same on the
lab's built Kingdom, needing no live game), `--steps map-frames` (the spectator's map only: entered, idle, pan, zoom),
`--model-override <dir>` (the models under `<dir>`, at their path below `public/models`, served in place of the deployed
ones whatever their content hash, a spectator's or a lab game's only;
`node scripts/client-playtest/heavier-models.mjs --triangles 4|16 --textures 2 --out <dir> <model>…` writes such copies
with each triangle split into four and each KTX2 texture at twice its size), `--profile-steps <step,…>` (a `.cpuprofile`
of each named step, and of the boot for `boot`; profiled steps' timings are not comparable with unprofiled ones),
`--out <root>` (default `.context/playtest`), `--trace` (a Chrome trace of each run's boot, from before the game page
opens to the world being interactive), Paths are taken from where the command is run.

`--steps actions` and `--steps lab-actions` (click to result: a player's actions, each timed from its press to the frame
that draws its result, in a live Frontier game with `--player`, or in the lab's game, `/lab/game?scenario=actions`,
whose chain answers each command 300 ms after it is sent: on the map, explore and move, each on a tile beside the army
aimed from where the army stands on screen (its token, as the map places it, lowered to its tile; a phone taps the tile
twice, and picks the army again from its dock when a tap selects something else); in the realm, level up (the keep's
Castle sheet, Upgrade) and build (the outermost open plot above the castle, Build); `--steps lab-actions-merge`, two
armies merged from the transfer card (pressed, then confirmed), `--steps lab-actions-transfer`, 500 troops sent from the
same card to the other army, `--steps lab-actions-spire`, Enter on Ethereal II from the spire's card;
`--steps lab-actions-fight`, the ruin beside the army attacked from its card; `--steps lab-actions-fight-lost`, the same
attack costing the army its life (`scenario=fight-lost`): the panel must show "Your army is lost", then close by itself
with no army left selected; `--steps lab-actions-sites`, a Shrine and a Well beside the army used;
`--steps lab-actions-deploy`, a new army from the dock's Deploy (Max, then Deploy); `--steps lab-actions-research`, the
Shrine researched from Research (`scenario=research`); and `--steps lab-actions-claim`, a Realm's labor claimed from
Realms (a desktop's purse, a phone's Menu: Claim; `scenario=claim`, whose value relay the tab answers as the relay does:
the grant's facts first, then the reply naming their transaction); on `scenario=upkeep` (an army short of stamina with
XP to spend), `--steps lab-actions-army` spends a skill point on Battle, `--steps lab-actions-demolish` deletes a
first-ring building, and `--steps lab-no-lords` opens the army panel and checks that LORDS controls are absent.
`--steps lab-actions-settle` is a season entered by a player not yet settled (`scenario=settle`, which opens on the home
page: the run's first step is the Frontier card's Play, timed through the doorway's SettleSeason to the game on the
founded realm, and the boot is waited for after it). Each step declares the game command it sends (`sends`) and fails in
the lab when its press sent another; `src/lab/game/action-coverage.test.ts` fails a command of the catalog Frontier
enables that no step sends and `UNMEASURED_COMMANDS` does not name with its reason. Each names its exact result: the
renderer's mark once the frame drawing it was rendered (`presented:<result>`, `src/three/presented-results.ts`: the
explored tile's ground, once half its fog has swept away, the army's walk, the deployed army drawn, the merged army
leaving the map, that building on that plot or leaving it, that Shrine or Well leaving its tile, that chest's opening
started; or, for a scene drawn under a cover, once the paint without the cover: the game uncovered as its doorway
leaves), or a page condition: the Castle sheet naming exactly the next level, each army a fight or transfer changed
showing exactly the count the chain answered, the Shrine's node researched, the Realms sheet listing the home claimed
today, the army's panel reading its stamina and the skill point spent; another target's result is not the action's. Each
is cut where the client records its way: handled (the press to the command), sent (signed and answered by the RPC),
confirmed (the chain and Herald, to the pre-confirmed diff), applied (the diff's facts in the store) and drawn (to the
result); a claim, which the relay signs, has no sent segment, and its confirmed runs from the request. A step completes
only with every mark reached and every frame from the press to the result observed. `--capture-results` also records the
page's frames and fails a step unless, in its result's region of the screen, the pixels that show it appear at its mark
(not a frame before, not absent three frames after, counting the page's own frames, so a slow frame is one frame; the
screen at a moment is the last frame sent by then); an explore names its tile's ground as its target instead, which must
read explored (its mean grey past half the way from its fog to its last look) within that window, whatever changed round
it; a chest names its body where the map drew it (a phone's from the selected hex the page reports,
`window.__eternumMapSelection.hexOnScreen`), which must start to change (its grey 16 levels from before) in the window,
as the chest sinks away seconds later; a season's entry names the screen's lower third, below the doorway's steps, which
turns from the doorway's painting to the map; a demolished building's proof is open (the Build sheet's ghost fills its
plot next, and the proof reads the plot's last look), so a capture run fails it. A result's place past the screen's edge
fails the step. The frames around it are kept. Each run writes `click-to-result.md`, each action's segments and total as
median (min–max) over its quiet runs), `--compare <summary.json>` (fails when boot regresses, when an action the
baseline timed has no timed run or a renderer mode it timed is missing, or when an action's press-to-result median is
past the slowest run of that baseline by more than a frame; actions the baseline never timed are listed as new;
`scripts/client-playtest/baselines/` keeps the lab's, one per step list and device, measured on the lanes' machine),
`--headed`.

Each invocation writes to a new directory, `<root>/<time>-<role>`, and never into an existing one:

- `summary.json`: the source it was built from (commit, branch, changed files), the client it served, the game, the
  gate, boot metrics from clean boots and completed steps' metrics from runs on a quiet machine (run count, median, min,
  max) with each step's verdict counts, and every record left out of those populations with its reasons. A failed start
  or a cancel writes it too, with the stage and the reason.
- `<role>-<mode>-<run>-transcript.json`: the game entered, the boot's milestones and every request with its span, the
  cache state, each step's numbers (frame intervals, long animation frames with their scripts, input-to-paint latency,
  every press with its time, draw calls, retained heap, each Herald message to the frame after it), what it saw and its
  verdict, the vertices each frame drew, its script time in frame callbacks and its GPU time from first submit to the
  GPU's work done (headless Chrome holds frames to 60 Hz, so these, not the interval, show a frame's cost under 16.7
  ms), the WebGPU memory held at each step's end (textures and buffers, from their creation to their destroy), the
  client's own action timelines, every JSON-RPC POST to a node (by host: the shard's, the L2's) and each CORS preflight
  sent before one, with whether its connection was reused and how it was answered (HTTP status, the node's JSON-RPC
  error), the machine's load average sampled every 5 s, and the raw probe data (the boot's included).
- `<role>-<mode>-<run>-NN-<step>.png` after every step (plus `-before.png` where a step compares views),
  `<role>-<mode>-<run>-failed.png` where a run stopped, `<role>-<mode>-<run>-console.log`, and `client.log` (the build
  and the preview).

The gate fails (exit 1) on no run played, a failed start or a cancel, a run that did not boot cleanly or threw, a step
not played or failed, entry or world-interactive over 30 s, browser errors (only the lines naming the one transaction a
step had refused are kept apart, as `provokedErrors`), a WebGPU fallback without a reason, or a maximum sampled load
average over 12 (the machine is shared: such a run is not evidence). A blocked step and a page reload during a step are
warnings, the reload with its cost.

## Browser Testing with `agent-browser` Skill

Use this runbook when validating spectator/game flow in a real browser session.

### Login-First Workflow

Use this workflow before capturing screenshots or validating account-specific game UI:

1. Start the game client with a supported Node runtime. The local shell may pick Node 21.x, which Vite rejects; prefer
   Node 20.19+ or 22.12+. The committed `.env` points the dev server at the live lab stack; no env setup is needed.

```bash
npx -y node@20.19.0 $(which pnpm) --dir /path/to/repo/apps/game dev --host 127.0.0.1 --port 4174
```

When debugging Three.js, world-map rendering, or graphics state, enable the graphics debug mode by opening the app with
`?dev` once (the browser keeps it; `?dev=0` clears it). No build setting turns it on.

If `npx` reports duplicate workspace names from the monorepo, run the command from `/tmp` and pass the absolute `pnpm`
path as shown above.

2. Open a headed browser on the app shell (the home page) with a persistent profile. If the player is already logged in,
   continue immediately. If no wallet/account is visible, ask the user to log in themselves. Do not ask for credentials.

   A test account on dev signs in with an emailed code once, then never again: every code spends the email quota real
   players' codes share. After the first sign-in, enter a game once, then save the browser's state with Playwright's
   `context.storageState({ path })` to a file outside the repository, and restore it in every new browser with
   `context.setStorageState(path)` before opening the app (save it again at the end of a session, so its 30-day cookie
   renews). The state holds the dev session cookie, host-only on the dev host so it never reaches production, and the
   device key (`realms:device-key`), so the restored browser is the same signed-in device and no code is sent.

```bash
mkdir -p .context/agent-browser-login-profile
npx -y agent-browser --session game-check \
  --profile "$PWD/.context/agent-browser-login-profile" \
  --headed open https://127.0.0.1:4174/ --ignore-https-errors
```

3. Check whether the UI shows the user's wallet/account, for example `RASCHEL0...`, and local storage has a real
   `eternum_account_store.state.accountName`. If both are already present, do not wait for the user; proceed to the live
   game.

4. Prefer a game under `Your games` on the home page with an `Enter game` button. This is a live, playable game where
   the logged-in account is registered. Use spectate or review only if the user explicitly asks for it or no playable
   registered game exists.

5. For requests about UI "in the game" or "current live game", enter the live match first and use in-game controls. Do
   not use shell routes such as `/results` unless the user explicitly asks for the results page.

6. Known in-game controls:
   - In-game leaderboard: top-right social/leaderboard icon opens the `Leaderboard` popup.
   - Production window: selected realm left panel `PRODUCTION` card, then `MODIFY`.
   - Army view: press `Tab` to cycle/select a player army through the world-map shortcut logic.

### Prerequisites

1. Install workspace deps from repo root:

```bash
pnpm install --frozen-lockfile
```

2. Ensure workspace packages consumed by `apps/game` are built:

```bash
pnpm run build:packages
```

3. Start game client on a fixed port:

```bash
# If local node is already >=20.19
pnpm --dir apps/game dev --host 127.0.0.1 --port 4173

# If local node is older (common in CI/agents), force a compatible runtime:
npx -y node@20.19.0 $(which pnpm) --dir apps/game dev --host 127.0.0.1 --port 4173
```

### Spectator Smoke Test (Autonomous)

Run these commands in a separate shell while dev server is running:

```bash
# Open local client
npx -y agent-browser --session spectator-check --headed open https://127.0.0.1:4173 --ignore-https-errors

# Inspect and enter spectate flow
npx -y agent-browser --session spectator-check snapshot -i
npx -y agent-browser --session spectator-check find text "Spectate" click
npx -y agent-browser --session spectator-check wait 2500

# Assertions
npx -y agent-browser --session spectator-check get url
npx -y agent-browser --session spectator-check eval "Boolean(document.getElementById('main-canvas'))"
npx -y agent-browser --session spectator-check get count "text=Unable to Start"
npx -y agent-browser --session spectator-check console
npx -y agent-browser --session spectator-check errors
```

Expected pass signals:

1. URL contains `/g/` and `spectate=true`.
2. `main-canvas` exists (`true`).
3. `Unable to Start` count is `0`.

Known environment caveat:

1. In headless virtualized environments, `THREE.WebGLRenderer` may fail with `Error creating WebGL context`.
2. When this happens, capture screenshot + console/errors logs and treat the run as infra-blocked, not app-pass.

### Artifacts

Capture a full-page screenshot and copy to workspace artifacts:

```bash
npx -y agent-browser --session spectator-check screenshot --full
mkdir -p .context/spectator-browser
cp ~/.agent-browser/tmp/screenshots/<latest-file>.png .context/spectator-browser/spectator-map-full.png
```

Optionally collect console diagnostics:

```bash
npx -y agent-browser --session spectator-check console
npx -y agent-browser --session spectator-check errors
```

## Painted icon contract

Use `Icon` with an `IconMeaning`, `SvgIcon` inside SVG, and `iconUrl` only for texture or DOM APIs. Resource, troop,
Order and building inputs resolve through the central meaning helpers. Action buttons derive their icon from the action
ID. Do not choose an unrelated action's art: Transfer is the Ivory pack donkey (`transfer`), distinct from the Donkey
resource (`donkey`); Move is the boot, Production the anvil, and Settings the wheel. Do not add icon paths or
independent icon components.

Construction card artwork uses `BuildingThumbnail`: a render of the current building GLB, not a semantic icon. Its
source and image hashes live in `asset-sources/building-thumbnails.json`; regenerate after a model changes with
`scripts/render-building-thumbnails.mjs`. Actions and resource costs on those cards still use `Icon`.

| Rule                                           | Enforcement                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| Named artwork, no arbitrary image path         | `IconMeaning`, the renderer's props and `scripts/catalog-guards.mjs` |
| Distinct Transfer/Move and Production/Settings | `scripts/icons/validate.test.mjs` reproduces both rejected mappings  |
| Every resource and reviewed painting exists    | `pnpm icons:check`, client build and client CI                       |

`--steps stale-release --viewport 390x844` holds a real signed Move at the network and writes
`<step>-release-ready.json` in the run's evidence directory. It deploys an army and explores if necessary before that
marker; take the first game snapshot after preparation. On a quiescent dev game, apply the reviewed compatible release,
take the second snapshot, then create `<step>-release-applied.json`. The step releases the original invoke, captures its
refusal and UI, observes submission attempts for ten seconds, and writes `<step>-release-observed.json` with nonce
before/after and actual fees from included receipts (a validation refusal has no inclusion fee). It retains no signature
or account address in those measurements and never fabricates an RPC reply or applies a release. Use a fresh evidence
directory for each run; the handshake expires after three minutes.

A founded free home's daily source is self-serve at game entry → Choose a daily claim → Add this daily claim. The picker
uses the same ticket and linked-wallet holdings as founding. The home keeps its traits, and Herald's `CampaignHome` or
`SettledRealm` update enables the normal claim.

`--steps home-claim --player <saved test identity> --storage-state <private state file>` opens Realm Labor, claims once,
and checks today's claimed mark. It leaves the sheet screenshot and text; use the confirmed snapshot to verify exact
Labor/Essence and the day's receipt.

`--steps home-recovery` first records the existing entry picker's offered source and continues with the free home. On
the map it writes `<step>-registration-ready.json`; after operator registration and the third snapshot, write
`<step>-registered.json`. It then claims through Realm Labor and verifies today's claimed mark. This rehearsal uses a
source-less dev home with a held ticket and leaves the source attachment to the operator.
