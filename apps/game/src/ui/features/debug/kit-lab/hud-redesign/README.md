# HUD comparison

Open `/lab/kit/hud/redesign?variant=rails&count=3`. The tool compares the production arena HUD views against the classic
reference on one live terrain renderer. Switching preserves the camera and lighting. `capture=1` hides lab controls for
a 1440×900 or 390×844 evidence frame.

The game entry is `ui/layouts/world.tsx` → `ArenaHud` → `ArenaHudView`. The fixture adapter supplies readings and
preview callbacks to the same views. There is no separate A row, resource panel, command button or minimap renderer.
`CurrentHudReference` retains the classic layout with origin's production components and Facets art; it is a reference
reconstruction, not a second playable game. Historical classic and War room captures remain the pixel references.

| Feature            | Reach it                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Comparison         | Current HUD / A; one canvas stays mounted                                                                             |
| Structures         | 3, 25 or 220; painted category chips with counts; search; select a row                                                |
| Categories         | Realm, village, camp, hyperstructure, mine, bank, bitcoin mine, rift, ruin, stragglers; only owned categories appear  |
| Upgrade            | Level beside the name; the available level-up action is separate from row selection                                   |
| Grouping           | Rows / Upgrade groups; expand Other structures                                                                        |
| Realm              | Automation dropdown in the name/type header; named production circles with held amounts                               |
| Resource detail    | Hover or tap a circle; building count, supply and production details stay there                                       |
| Commands           | Separate floating Build, Production, Military and Transfer bubbles; Trade follows the command mask                    |
| Transfer           | Pack donkey; Move alone uses boots                                                                                    |
| Settings           | Painted wheel in the top bar, beside VP and the clock                                                                 |
| Right column       | One next step, events, then the active scene’s selected tile; click a local building then tap its summary for details |
| Naming / placement | Three naming pairs and centered/right dock remain review choices                                                      |
| Minimap            | Native terrain hexes, shared Facets hex badges, internal ownership shape and small external value                     |
| Crowding           | The icon lab and HUD share the 4×3 sector grouping; click a sector to inspect it, Overview returns                    |
| Phone              | Map / Holdings; search and production remain in Holdings                                                              |
| Troop paintings    | Military preview shows the production TroopChip and resource token for all nine type/tier pairs                       |

## Shared production components

`ArenaHudView`, `HudHeaderLayout`, `IdentityChipView`, `GameClockView`, `MapViewControls`, `SettingsButton`,
`StructureListColumnView`, `StructureStatusRowView`, `StructureRealmActionsView`, `EmpireCockpitView`,
`AutomationPresetSwitchView`, `ResourceToken`, `HudChatTrigger`, `NextSuggestionView`, `HudEventsView`,
`FeedRowLineView`, `SelectedTileSummaryView`, `StructureActionsPanelView` and `PaintedMinimapView` own the presentation.
Production wrappers retain native facts, command guards, navigation and order handlers. `HexMinimapView` remains the
terrain renderer. `HexMarker` and `MarkerClusters` are shared with `/lab/kit/icons`, including the value presentation.
The production semantic icon renderer also covers game popovers and army resource icons.

The production HUD and lab A therefore share rendering code. Lab facts are deterministic; the lab does not authenticate,
model an economy or send commands. Its sheets preview callbacks. The 220 list does not imply 220 visible world models;
the map fixture has three structures and two illustrative armies. Live game verification is separate from this proof.

## Paintings

The production `Icon`, `iconUrl`, resource meanings and `HexMarker` own all artwork. Both Current and A now use the
Facets art shipped on origin; the old gilded kit and study exports stay deleted. Current compares the classic layout,
while the historical screenshots preserve its previous art. Coal, Copper, Production and Transfer now have dedicated
paintings. All nine troop portraits resolve through the real resource and troop meanings. No HUD art provider or
placeholder mapping remains. Category chips cover every structure type using the production semantic catalog.

## Proof

```sh
pnpm --dir apps/game dev --host 127.0.0.1 --port 4192
pnpm --dir apps/game prepare:hud-proof
```

Run the emitted `evidence/hud/lab-proof-driver.js` with the Playwright browser tool's filename input. It drives the
visible controls, captures desktop and phone states, checks category counts/search, automation detail, Settings, nine
troop portraits, Trade's mask, floating bubble containment, native hexes and shared badges. It compares icon-lab markers
and grouping and leaves screenshots in a new timestamped directory. Save the returned object as `proof.json` there. It
navigates away from each WebGL page after capture and on failure.

For a live signed-out Watch proof, extend that same command with `--watch <chain-id>:<game-id>`. Run the emitted
`evidence/hud/live-proof-driver.js` with the same browser tool and save its returned object as `proof.json` in its
reported directory. It opens an isolated browser context on port 4192, using the dev stack configured for that client.
It captures 1440×900 and 390×844 map, Settings and Log states, plus phone Holdings, through visible controls. Assertions
cover spectator identity, native HUD/minimap, no command buttons or order sends, no horizontal overflow, Chat clearance,
and standings below the phone header. It closes the isolated context on every exit. These are visual/interaction checks;
the client `playtest` command owns performance runs.

In a live spectator game, Settings and Log are in the header; on phone, Holdings opens the standings and Map restores
the map. Owned resources, automation and command bubbles require a seated player and are not covered by Watch proof.

The coverage gate uses the clipped union of visible frame rectangles over 1,296,000 pixels. Empty dock/header gaps,
shadows and lab controls do not count; each floating command's full button rectangle does count, conservatively.
Historical rectangles live in `review.mjs`; actual lab rectangles are measured from the DOM. Report run counts and
ranges across fixtures, not performance timings. A noticed unit is a title, row, token, control or reading with at least
12 vertical and 3 horizontal pixels surviving clipping. Counts describe visible readings, not usability scores.

This change replaces the duplicate A presentation, old column/compact layout paths, attention strip, oversized marker
chips and shared command panel. Its cost is view boundaries, fixture facts, production icon mappings and retained proof.

## Seated player proof

The connected tasks live in `scripts/game-tasks.mjs`, executed by the shared `game-task-proof.mjs` used by
`prove:play --game`. Run `--tasks hud-holdings,hud-upgrade,hud-local,hud-automation,hud-commands,hud-minimap,blitz-farm`
with the seated player's private browser profile and the current game. `hud-level-up` performs one available level-up
when a subsequent unavailable level is needed for the upgrade inspection. Each task captures the view before input, each
input's result, and its end-state check. Mutations must change their native reading; a refused send is a failure. The
same asynchronous task executor can be bundled for the browser tool; the transport only maps browser commands. No
separate HUD player steps exist in the lab proof.

On the minimap, open a populated sector and **drag** its terrain to move the camera; Overview restores grouping.
Occupancy comes from the native tile type, including spires, dormant spires, reserved hyperstructures, chests, shrines
and wells with no entity ID. Crowded sectors count these as sites, not armies. Their badges use the shared semantic
renderer, so the lab and game keep the same occupancy presentation.
