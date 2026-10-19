# Lab tools

App painting comparison: `/lab/kit/app-art` shows Season and Blitz Results beside their existing reference art. Follow
each page link to see the painting on its real component with local app fixtures. Run
`pnpm --dir apps/game prove:app-art --port 4199 --out <fresh-dir>` for comparison and page screenshots, loaded-image
assertions and browser errors; the command owns and closes its server and browser.

Open `/lab` in the dev environment. The Tool selector groups 14 tools by their users' work. Switching tools unmounts the
previous view and remembers its full URL for the next visit. The Eternum Lab link exits to the game home page.
`capture=1` keeps the tool's full viewport and removes the shared header.

`lab-app.tsx` owns the lab's route table, lazy imports, boot state and viewport. Tool views own their controls and
renderer lifecycles. This replaces the independent app routes, repeated boot setup and graphics-only navigation. App
fixtures restore their network and identity overrides when you leave them.

## Feature map

The users and routes below were inventoried before the tools were moved. Terrain and model review keep their URLs; the
former `/debug` tools now live under `/lab`. Their runners and links use the new routes.

| Tool                | Route                      | Users and workflow                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terrain & buildings | `/lab`                     | Art: terrain gallery, material/biome inspection, gallery verification and captures                                                                                                                                                                                                                                                                                                                                                  |
| Models & motion     | `/lab/models`              | Art: model review, animation inspection and captures                                                                                                                                                                                                                                                                                                                                                                                |
| Rewards             | `/lab/rewards`             | Art: reward and chest review with capture controls                                                                                                                                                                                                                                                                                                                                                                                  |
| Terrain props       | `/lab/terrain-props`       | Art: biome prop and material review                                                                                                                                                                                                                                                                                                                                                                                                 |
| Endgame mist        | `/lab/endgame`             | World: production end trigger, orb event, spared realm and busy-map cost proof                                                                                                                                                                                                                                                                                                                                                      |
| World FX            | `/lab/world-fx`            | Art: world effects and capture controls                                                                                                                                                                                                                                                                                                                                                                                             |
| Character review    | `/lab/characters`          | Character art and animation: frame inspector, smoke checks and animation captures                                                                                                                                                                                                                                                                                                                                                   |
| Character benchmark | `/lab/character-benchmark` | Performance: character benchmark smoke and performance runners                                                                                                                                                                                                                                                                                                                                                                      |
| World integration   | `/lab/world`               | Performance and character integration: world gym smoke runner                                                                                                                                                                                                                                                                                                                                                                       |
| Chunk fixtures      | `/lab/chunks`              | Renderer: baseline, dense and stress fixtures, renderer smoke runner                                                                                                                                                                                                                                                                                                                                                                |
| Terrain benchmark   | `/lab/terrain-benchmark`   | Performance: terrain benchmark runner                                                                                                                                                                                                                                                                                                                                                                                               |
| Map labels          | `/lab/map-labels`          | UI: map plates on the real terrain and models (`zoom`, `hover`, `select`, `focus`, `game=frontier`)                                                                                                                                                                                                                                                                                                                                 |
| Motion primitives   | `/lab/motion`              | UI: motion intensity, reduced motion and site-clear demo                                                                                                                                                                                                                                                                                                                                                                            |
| UI kit & HUD        | `/lab/kit/*`               | UI: the HUD's style sheet (its tokens, the type scale and every element in every state, mode and device); `/lab/kit/shell` the shell kit's component states (Button, Field, Switch · Kbd, IconLine, Pill, ViewSwitch joined and split, SectionLabel, Panel, StateCard, Title, Figure, Portrait, PaintedCard, ClockChip, ListRow · SettingRow, Confirm), `/lab/kit/hud/:state` fixtures and `/lab/kit/icons` production icon catalog |
| Design tokens       | `/lab/kit/tokens`          | UI: every `src/tokens.ts` value drawn from the file: the shell's and the HUD's palettes, faces, type scale, spacing, radii, title shadows, each surface's finish (shadows, gradients, button, sheet, card, chip, plate), widths. How to restyle the shell: the comment at the top of `tokens.ts`                                                                                                                                    |
| App fixtures        | `/lab/app/:screen/*`       | UI: game, lobby, profile and account states; a post, the legal pages, `sign-in/:step` (start, code, name, name-refused), `doorway/:state` (map, sign-in, waiting, preparing) and an unknown path                                                                                                                                                                                                                                    |

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

In Terrain & buildings (`/lab`), **World mode** compares Blitz (shipped lighting, new ordinary edge mist) with Frontier
(Ember lighting, darker mist). Both use the production `ProceduralTerrain` and `WorldAtmosphereController`; biomes,
props and ground textures remain shipped. The existing Time, Weather, Exploration and quality controls still apply. This
selector belongs to the dev lab; live games select their presentation from the synced game mode.

```sh
pnpm --dir apps/game verify:terrain:gallery --base-url 'https://127.0.0.1:4194/?gameMode=blitz' --scenes all-biomes,fog-reveal --ground-modes textured --timing-policy informational --artifact-dir <fresh-blitz-directory>
pnpm --dir apps/game verify:terrain:gallery --base-url 'https://127.0.0.1:4194/?gameMode=frontier' --scenes all-biomes,fog-reveal --ground-modes textured --timing-policy informational --artifact-dir <fresh-frontier-directory>
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

- `gameMode=frontier` spares the central fixture realm and uses production Frontier lighting. Blitz spares no hex.
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
