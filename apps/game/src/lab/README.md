# Lab tools

A lab proof that starts its own client does it through `scripts/lib/dev-client.mjs`: `pnpm dev` on the proof's `--port`,
stopped whatever happens, or the server `--base-url` names. Proofs of pages that need no dev server take a base URL and
use `scripts/prove-run.mjs`.

`/lab/relic-chest`: the picked opening-only presentation, using `RewardTileModel`, `ChestTransitions` and
`ChestTileDetails`. Focus the chest or its held-open hover plate, Open, inspect the reveal/receipt, then Reset. The
local fixture still supplies the public pack row; its opening is delivered through the native story listener. Pack and
Lucky are fixture inputs, with no appearance/preview selector. `prove:relic-chest` starts the app, drives the visible
controls for Blitz and Frontier on WebGPU and WebGL2, saves evidence in a fresh directory and releases its
browser/server.

`/lab/relic-chest?mode=frontier` uses a 17-LORDS common-share reservation, the real Frontier calendar and the same chest
panel/model/caller. Advance to day rollover shows the expired zero reward; Open produces the recorded paid amount,
including zero. This is a local native-fact fixture, not a transaction.

App painting comparison: `/lab/kit/app-art` shows Season and Blitz Results beside their existing reference art. Follow
each page link to see the painting on its real component with local app fixtures. Run
`pnpm --dir apps/game prove:app-art --port 4199 --out <fresh-dir>` for comparison and page screenshots, loaded-image
assertions and browser errors; the command owns and closes its server and browser.

## Rooms

Open `/lab` in the dev environment: it opens on Kit → HUD sheet. The header's first row holds the six rooms and the two
switches; the second row holds the room's pages and, when a page has several, its views. `src/lab/rooms.ts` lists every
room, page and view; the header and the routes are drawn from it, and every page loads only when opened. A lane adds a
page by adding its entry there.

- **Game** (Blitz, Frontier, Eternum) writes `mode` into the address and opens the page again in that game. It is
  offered only on a page that draws more than one game, and a page that draws Frontier opens on Frontier.
- **Device** (Both, Desktop, Phone) writes `device`: on the HUD sheet and on HUD → In game.
- Changing pages unmounts the previous page and its renderer, and a page reopens where it was left. The Eternum Lab link
  exits to the game home page. `capture=1` keeps the page's full viewport and removes the header.

`lab-app.tsx` owns the header, boot state and viewport; pages own their controls and renderer lifecycles. App fixtures
restore their network and identity overrides when you leave them.

| Room   | Page                                    | Views and address                                                                                                   | Users                                                     |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Kit    | HUD sheet                               | Sheet `/lab/kit` (every HUD element in every state; Game and Device), Tokens `/lab/kit/tokens`                      | Owner; `hud:capture`, `hud:check`                         |
| Kit    | App sheet                               | Sheet `/lab/kit/app`, Shell kit `/lab/kit/shell`, Paintings `/lab/kit/app-art`                                      | Owner; `prove:app`, `prove:app-art`                       |
| Kit    | Icons                                   | Catalog `/lab/kit/icons`, Resources `/lab/kit/resource-icons`, Chest tiers `/lab/kit/reward-chests`                 | Owner; `icons:prove`                                      |
| Kit    | Words                                   | `/lab/kit/words`                                                                                                    | Owner                                                     |
| Kit    | Motion                                  | `/lab/motion`                                                                                                       | UI                                                        |
| HUD    | In game                                 | `/lab/hud` (`show`, `device`, `mode`): see HUD room below                                                           | Owner; `capture:hud-lab`, `prove:windows`, `prove:chat`   |
| HUD    | App pages                               | `/lab/app/:screen/*`                                                                                                | Owner; `prove:app`, `prove:shell`, `prove:play`           |
| Game   | Spire, Realm upgrade, Painted buildings | `/lab/game?scenario=spire`, `realm`, `painted-buildings`: the game itself on a lab chain                            | Owner; `playtest --steps lab-spire`                       |
| Game   | Day end                                 | `/lab/day-end`                                                                                                      | Owner; `prove:day-end`                                    |
| Game   | Game end                                | `/lab/endgame`                                                                                                      | `prove:endgame`                                           |
| Game   | Chest opening                           | `/lab/relic-chest`                                                                                                  | `prove:relic-chest`                                       |
| Game   | Map labels & sites                      | `/lab/map-labels`                                                                                                   | Owner; lanes                                              |
| Art    | Terrain                                 | Terrain & buildings `/lab/terrain`, Props `/lab/terrain-props`, Biome study `/lab/biome-study` (`approach`, `shot`) | Art; `verify:terrain:gallery`, `prove:biome-study`        |
| Art    | Models                                  | `/lab/models` and its families (`family=`)                                                                          | Art; owner                                                |
| Art    | Characters                              | `/lab/characters`                                                                                                   | Art; `capture:character-animation`, `smoke:character-gym` |
| Art    | Chests                                  | `/lab/rewards`                                                                                                      | Art                                                       |
| Art    | Effects                                 | `/lab/world-fx`                                                                                                     | Art                                                       |
| Art    | Bench                                   | Characters `/lab/character-benchmark`, World `/lab/world`, Chunks `/lab/chunks`, Terrain `/lab/terrain-benchmark`   | The runners below                                         |
| Data   | Balance & data                          | `/lab/data` (`view` live or balance, `mode`): see Balance & data below                                              | Owner; perf, rules                                        |
| Studio | Set                                     | `/lab/studio`: see Film studio below                                                                                | Reels; `prove:studio`                                     |
| Studio | Footage                                 | `/lab/footage`: the footage and marketing pages the showcase serves beside the lab                                  | Owner                                                     |

`pnpm --dir apps/game prove:lab-load --port <free> --out <fresh-dir>` opens every page twice and records what each
fetches (the client's own modules, every script, the bytes), when its last script arrived and whether it drew 3D.

### HUD room

HUD → In game lists every state and part the lab draws for the game switched to: Frontier's HUD as the game mounts it
(`/lab/kit/unified/frontier`, `frontier-army`), the Frontier HUD lab's states by moment (`/lab/kit/hud/<state>`), then
its parts; Blitz's HUD as mounted (`/lab/kit/unified/<view>`) and its parts (guidance, build order, building on a plot,
construction cards, deploy, panels, area D, windows, chat). The picked one (`show`) is drawn in a desktop frame (1440
× 900) and a phone frame (390 × 844) side by side, or one of them (`device`). Each frame is the state's own address with
`capture=1` at that size, so the phone's layout and CSS are the game's own; "open alone" opens it in the lab.

### Balance & data

Data → Balance & data reads perf's newest pull at `/live-data/analysis.md`: the output of `live-data.py all` (in
`evidence/perf/frontier-live-data-1`), which `showcase.sh` links from the newest analysis. Frontier shows Frontier's
tables, Blitz shows Blitz's, both the value ledger; a server without a pull says how to make one. On Frontier, the
second tab is next season's research balance study (`view=balance`, `part` storage, tree or beasts): storage, research
paths and beast labor with their options, played on the research panel; nothing sends a game command.
`scripts/frontier/prove-research-balance.playwright.js` drives it through the Playwright connection.

The in-game battle calculator stays in the player interface. Physics behavior is unchanged.

## Run and verify

From the repository root, start the real client:

```sh
pnpm --dir apps/game dev --host 127.0.0.1 --port 4179
```

The existing runners drive controls and write evidence. For example:

```sh
pnpm --dir apps/game smoke:renderer-debug --base-url https://127.0.0.1:4179 --scenarios baseline,dense,stress
pnpm --dir apps/game smoke:character-gym --base-url https://127.0.0.1:4179
pnpm --dir apps/game smoke:character-benchmark --base-url https://127.0.0.1:4179
pnpm --dir apps/game smoke:procedural-world-gym --base-url https://127.0.0.1:4179
```

The day end has its proof: the game's rollover turns the day on the lab's clock (the ordinary turn, both clocks at once,
the block clock past the black's longest hold, a later arrival) on a desktop and a phone, a still at each beat, what the
rollover did to the map and in which phase, Space's skip, Continue, a drag on the map on the new day, and no page or
console error (a refused GPU frame is only a console line):

```sh
pnpm --dir apps/game prove:day-end --port 4199 --out <fresh-dir>
```

The HUD's style sheet has its own capture: every `/lab/kit` element (or those named, by the name in its header) as its
own PNG in a new run directory, with the proof record beside them:

```sh
pnpm hud:capture <evidence-dir> https://127.0.0.1:4179 "Button" "Ring badge"
```

`--page <path>` captures another lab page's sheet elements the same way (`/lab/kit` by default). Each capture also
checks that no ring badge is drawn over another badge or a neighbouring ring; the run is incomplete when one is.

Art keeps `verify:terrain:gallery` and `capture:character-animation`. Performance keeps `benchmark:terrain` and
`benchmark:procedural-characters`. The runner sources document their capture, output and scenario options. Use one
rendering page at a time and close it after collecting evidence.

The route and cleanup tests cover every tool URL, nested fixture routes, query restoration, capture layout and
restoration of real network/identity behavior:

```sh
pnpm --dir apps/game test src/lab/lab-app.test.tsx src/shell/lab/app-lab.test.tsx
```

## Release atmosphere comparison

In Art → Terrain (`/lab/terrain`), the lab's **Game** switch compares Blitz (shipped lighting, new ordinary edge mist)
with Frontier (Ember lighting, darker mist). Both use the production `ProceduralTerrain` and
`WorldAtmosphereController`; biomes, props and ground textures remain shipped. The existing Time, Weather, Exploration
and quality controls still apply. This switch belongs to the dev lab; live games select their presentation from the
synced game mode.

```sh
pnpm --dir apps/game verify:terrain:gallery --base-url 'https://127.0.0.1:4194/?mode=blitz' --scenes all-biomes,fog-reveal --ground-modes textured --timing-policy informational --artifact-dir <fresh-blitz-directory>
pnpm --dir apps/game verify:terrain:gallery --base-url 'https://127.0.0.1:4194/?mode=frontier' --scenes all-biomes,fog-reveal --ground-modes textured --timing-policy informational --artifact-dir <fresh-frontier-directory>
```

Both renderer backends are checked by default. Each capture records the requested world mode and the actual terrain
snapshot; the gate rejects a mode mismatch. These runs verify presentation and reveal coverage; they do not establish
performance on a live world. Live proof uses the existing `playtest` command after the dev stack is available.

## Production realms

Open **Models & motion → Realm ladder**, or `/lab/models?family=realms`. Age, normal/wonder, entity, Order and ownership
controls exercise the same `SettlementModel` used by the world map. All ages compares the ladder at true scale; Close,
Gameplay and Far use distances 6, 20 and 45. The default is Gameplay; field of view and pitch come from the world-map
camera profile, along +Z. Drag to orbit and scroll to zoom. The entity picker exposes both city and kingdom designs and
all seven imperial crowns. The separate sculpt is a study, not a runtime option.

`/lab/terrain-benchmark?realms=1` adds 48 production realm placements (24 normal, 24 wonder) to the existing terrain
trace. The checkbox is also available in the benchmark UI. Its fingerprint ends in `:realms48`; compare identical
fingerprints for regression claims. The terrain-only trace remains unchanged.

`apps/game/scripts/realms/prove-realm-series.playwright.js` drives the visible realm controls and captures the models,
heraldry and aura animation. Run its function with the connected browser and a fresh evidence directory; all pages are
closed when it finishes. Live proof uses the client's existing `playtest` command after dev is available.

### Realm revision comparison

Preserve the previous `settlement.glb`, `city.glb`, `kingdom.glb` and `empire.glb` outside the checkout, then link that
directory at `apps/game/public/.context/realm-review` (ignored). Open
`/lab/models?family=realms&reference=/.context/realm-review&comparison=pair&level=1&distance=6`. **Revision** switches
Before / After / Before–After; **Age** chooses the matching file in the reference directory. The two versions use the
same scale, lighting, Order and ownership. Reference comparison is for normal realms; the wonder picker continues to use
the delivered series. Old assets stay in review evidence, never in production.

Pass `reference: "/.context/realm-review"` alongside `baseUrl` and `output` to the retained
`prove-realm-series.playwright.js` driver to capture city, kingdom and empire before/after pairs at distances 6 and 20.
The driver closes its page on success or failure.

## Facets icons

The Facets catalog at `/lab/kit/icons` uses production artwork and the shared renderer. It includes size, family and
search controls, action buttons, all nine soldier portraits and interactive hex minimap badges. Run
`pnpm icons:prove <evidence-dir> https://127.0.0.1:<port>` to exercise it alongside the HUD and shell fixtures.

## T1 Knight production review

`/lab/models?family=knight&source=comparison&tier=1&compare=0&detail=crowd` shows the previous default GLB beside the
production Knight, at a common inspection height. Choose **Skin detail → Near** to inspect the near export; only the
selected LOD is requested. **Current character runtime** shows the production model alone; **Move** and **Run** inspect
its procedural motion. Orbit and RTS scale share the environment and lighting. The terrain lab's **Army model →
knight1** uses the actual map scale and automatic camera-distance LOD through the production character layer.

## Endgame production smoke fixture

`/lab/endgame` exercises the production **Fractured veil** with offline native facts. **End game** changes the fixture's
GameRegistry settled fact; the production SpireManager and shared timeline render the event. **Reset map** restores a
live fixture. **Inspect orb** focuses a source and **Whole map** restores the camera. **See the results** immediately
skips to a labelled Results fixture; **Escape** or **Skip** goes straight to the frozen map. The real Results route is
covered by its component test and remains accessible immediately in production.

The nine-second sequence materialises in place (0–0.8 s), contracts the existing orb into a singularity (1–2 s), bursts
at 2 s, spreads the fractured mist (2–7.5 s), then settles and holds (7.5–9 s). The spire never changes its hex's
terrain. Orb origins use the model's authored spherical-core transform. There is one production end path; the old global
frost, variation selector, alternate material library and timeline seeking are deleted.

- `mode=frontier` spares the central fixture realm and uses production Frontier lighting. Blitz spares no hex.
- `spires=materialise` (default) supplies no native spires. Production chooses two actual empty Tile rows on opposite
  sides of the observed map. `spires=awaken` supplies discovered dormant spires. Both have identical terrain.
- `busy=1` uses 1,008 hexes, 25 realms and 50 armies; the smaller fixture uses 320 hexes, 5 realms and 10 armies.
- `rendererMode=webgpu-force-webgl` selects WebGL. Default is WebGPU.

Start and exercise the app with one command (the port must be free):

```sh
flock /tmp/eternum-lanes-heavy.lock pnpm --dir apps/game prove:endgame --port 4199 --mode gallery --out <fresh-output-directory>
flock /tmp/eternum-lanes-heavy.lock pnpm --dir apps/game prove:endgame --port 4199 --mode cost --iterations 3 --out <fresh-output-directory>
```

The runner owns its server and browser/profile. It drives visible controls, records full-map and orb videos plus stage
frames, and stops what it starts. Gallery covers both entrances in both worlds; `--spires awaken|materialise` narrows
it. For a client already served by you, pass `--base-url https://127.0.0.1:4199`. The separate showcase on 4198 is
rebuilt manually.

Cost mode asserts a 1920×1080 drawing buffer, distinct sites, hardware backend and load; it records raw live, active and
frozen frame intervals and draw snapshots. Frame intervals include refresh pacing; submission cost measures CPU work,
not GPU duration. This fixture is not a live match or a phone profile.

For an entry stall, add `--trace` to cost mode to retain a browser timeline and CPU profile beside the raw intervals.
Tracing runs are diagnostic evidence; compare ordinary runs for the frame budget.

## HUD sheet · Map context, 3D

At `/lab/kit`, scroll to **Map context → 3D map overlays → Open 3D comparison**. Five visible tabs compare Today with
Blitz, Frontier and Eternum on four shipped terrain strips: hex states, paths/order anchors, ownership/minimap colours,
strategic markers and sites/fog. Close the comparison to release its renderer. Unopened sections allocate no world. The
query records `chapter=hexes|routes|ownership|strategic|sites`; `rendererMode=webgpu-force-webgl` selects WebGL.

The 3D scope consumes the HUD sheet's `HUD_SHEET` ownership and `HUD_MODES` accents in `src/tokens.ts`. The DOM half
(bubbles, deploy picker, order line and plates) belongs to the same section. No production scene uses `MAP_SHEET` yet.
The [inventory](sheet-map/inventory.md) records colours, widths, alpha and motion, including absent and inert states.

Start the client, drive the section and five tabs and retain both backend captures with one command (free port):

```sh
pnpm --dir apps/game prove:map-context --port 4199 --out <fresh-evidence-directory>
```

The runner stops its own server and browser, and never removes evidence. For a server already owned by you, pass
`--base-url https://127.0.0.1:4199`. It drives visible controls, checks specimen counts and native terrain, and records
screenshots and a JSON transcript. It uses the existing isolated browser driver when the shared browser is occupied.
`inventory.mjs <fresh-json-path>` records the 20 source files' hex-literal colour counts and hashes.

## Film studio

`/lab/studio` is a set for shooting the reels with the game's own renderer: the terrain lab's land, light and weather, a
realm, a Hyperstructure foundation, two armies facing each other and an explorer on the edge of the fog. Every moment
plays through the production code: the tower through `HyperstructureModel.setConstructionAt`, the attack through the
world map's combat bridge (`WorldmapCombatPresentation.replayIndexed`, as a confirmed battle replays), the fall through
the map's defeat (the knight's ragdoll, else the model removed under the skull), the explore through the terrain's
shroud reveal and the army model's own march, the tiers through the realm models, the lightning through the weather
runtime. Every army is drawn as the world map's army manager draws it (`studio/armies.ts`): the shipped `ArmyModel` and
its troop-and-tier table at the map's scale (`ARMY_MODEL_SCALE`), handed to the articulated figure only where the map
hands it (`shouldPresentArmyProcedurally`, the T1 knight). A take stands only its own subjects on the set; Reset stands
them all. The set lives in `src/lab/studio/`; nothing in it ships to players.

- **Takes:** Hyperstructure rising, Battle up close, Exploration, Realm through its tiers, Wide establisher. Each resets
  the set and plays its camera path with its cues on time, so every take replays the same. `?take=<name>` plays one when
  the set is up; `[data-take]` on the page reads `idle` again when it ends.
- **Camera:** drag pans, right-drag orbits, the wheel zooms; W/A/S/D move, Q/E turn, R/F tilt, Z/X zoom; Lens sets the
  field of view. Mark key adds the current view to a path, Play runs it, Copy the path puts it on the clipboard as JSON.
- **Clean frame:** H, or `clean=1&capture=1`, hides the lab's header and the panel.
- **Light:** the lab's Game switch (Blitz or Frontier light, `mode=frontier`), time of day, weather, world speed (0.25×
  to 2×). A take runs on the world's clock, camera included: at 0.25× it plays every moment, four times as long, as slow
  motion.
- **Script:** `window.__studio` makes the panel's calls: `take(name)` and `path({keys, cues})` return a promise that
  settles when they end; `trigger(name, args)` plays `rise` (`{progress}`), `attack`, `defeat`, `explore`, `realm`
  (`{level}`) or `strike`; `pose(partial)` reads or moves the camera (`{target, distance, tilt, turn, fov}`, tilt 0
  looks straight down, turn 0 looks north); `places()`, `troops({attacker, defender})`, `time({scale, fixedStep})`,
  `light(name)`, `weather(name)`, `clean(on)`, `reset()`, `status()`.

Start the client, drive the camera with the keys and mouse, replay a path and roll the takes, with one recording, stills
and a transcript of every check, in a new directory (the port must be free):

```sh
pnpm --dir apps/game prove:studio --port 4199 --out <fresh-evidence-directory>
```

`--base-url https://127.0.0.1:<port>` drives a client already served by you; `--size 1080x1920` films vertical;
`--game frontier` uses Frontier's light; `--takes battle,explore` rolls only those.
