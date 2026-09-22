# Deleted test groups

Base: `e22ec7c777f`; diet completion: `78f55d92911`, plus fixture-suite deletion `67cf6afb66b`. Includes initial
client-diet commit `116b671cdd9`. Each bullet is an old test title or parameterized test group. For narrowed/replaced
files, this lists titles removed or replaced, not a claim that their behavior lost coverage. See the handback for
retained boundary coverage.

## SQL mock duplicates of PostgreSQL history and wire conformance

### apps/herald/src/history-store.test.ts (file deleted)

- "restores points after restart, counts only new SQL rows and serves without more database reads"
- "does not publish a rolled-back points registration"
- "applies the story variant to both the history count and the bounded page"

### apps/herald/src/native/history.test.ts (file deleted)

- "retains one distinct history story per troop and economy action"

## cache implementation assertion; ordered-key behavior retained

### packages/core/src/managers/game-entity-keys.test.ts (group narrowed or replaced)

- "hashes the complete ordered key and reuses the result for equal keys"

## constants, configuration equality or duplicates

### apps/game/src/hooks/helpers/market-perf.test.ts (file deleted)

- "filters user orders from 5000 total offers"
- "computes best bid/ask across 57 resources with 2000 offers each"
- "pre-indexed approach is significantly faster"

### apps/game/src/lib/army-stamina/source-resolution.test.ts (file deleted)

- "reads the sole live native store source"

### apps/game/src/three/characters/benchmark/procedural-character-benchmark-config.test.ts (file deleted)

- "selects and normalizes the appearance used by the whole population"

### apps/game/src/three/characters/gym/procedural-character-smoke.test.ts (file deleted)

- "emits each smoke action at an explicit deterministic phase"

### apps/game/src/three/characters/melee/procedural-melee-weapon-catalog.test.ts (file deleted)

- "resolves every detailed loadout through the central cosmetic registry"

### apps/game/src/three/renderer-overlay-passes.test.ts (file deleted)

- "returns overlay passes in stable declared order"
- "returns an empty list when no overlays are configured"

## constants, configuration equality or source/export shape

### apps/game/src/audio/config/registry.test.ts (file deleted)

- "registers the newly normalized custom tracks with stable music ids"
- "registers the newly added monophonic mixtape tracks with stable music ids"
- "registers dedicated unit command cue ids"

### apps/game/src/audio/unit-command-audio.test.ts (file deleted)

- "resolves stable sound ids for each command intent"
- "maps worldmap action types to the correct command cues"
- "plays the resolved sound through the shared audio manager"

### apps/game/src/three/constants/army-constants.test.ts (file deleted)

- "uses an absolute models path so nested play routes do not fetch the HTML app shell"
- "gives every troop class and tier its own hull"
- "treats a missing model as land so a bare army never grounds like a hull"

### apps/game/src/three/managers/chest-point-label-policy.test.ts (file deleted)

- "keeps chest point-label icons aligned with the smaller map icon scale"

### apps/game/src/three/managers/point-label-texture-policy.test.ts (file deleted)

- "uses the WebGPU-compatible texture upload path for both backends"

### apps/game/src/three/renderer-parity-gates.test.ts (file deleted)

- "locks bloom into the required parity surfaces alongside environment ibl and tone mapping control"
- "treats only the still-optional post-fx as advisory"
- "treats required parity gaps as rollout blockers"

### apps/game/src/three/scenes/worldmap-chunk-policy.test.ts (file deleted)

- "derives worldmap policy from shared chunk config"
- "exposes projection and directional prefetch fields from one policy contract"
- "derives pinned neighborhood floor metadata for cache budgeting"

### apps/game/src/three/scenes/worldmap-zoom-hardening.test.ts (file deleted)

- "disables all hardening behavior when master flag is off"
- "enables hardening behavior without telemetry by default"
- "enables telemetry only when hardening is enabled"
- "clears pending refresh timeout and resets runtime flags"
- "does not call clearTimeout when no timer is pending"
- "flags sustained zero-terrain anomalies after threshold frames"
- "flags sustained partial-terrain collapse against a stable reference"
- "does not flag partial collapse when reference terrain is too small"
- "resets the offscreen counter when current chunk is visible"
- "triggers recovery only after sustained offscreen frames"
- "does not trigger offscreen recovery while current padded terrain bounds remain visible"
- "does not trigger terrain self-heal when terrain counts are stable but coarse bounds disagree"

### apps/game/src/three/shaders/shader-retirement.test.ts (file deleted)

- "removes dead points and path shader helpers once active renderers are ported"

### apps/game/src/three/terrain/terrain-biome-art-direction.test.ts (file deleted)

- "defines bounded runtime controls for every biome"
- "names five anchor biomes that span the art-direction families"
- "distinguishes closed-canopy forests from open and marine ground"

### apps/game/src/three/terrain/terrain-quality.test.ts (file deleted)

- "defines the bounded fidelity profiles used by terrain presentations"

### apps/game/src/three/three-webgpu-compat.test.ts (file deleted)

- "exposes the shared WebGPU API and isolated utility WebGL renderer"

### apps/game/src/three/webgpu-postprocess-policy.test.ts (file deleted)

- "reports the native webgpu lane as a postprocess graph once tone mapping parity is implemented"
- "treats forced webgl fallback as a full postprocess lane again"

### apps/game/src/ui/features/landing/context/navigation-config.debug-entry.test.ts (file deleted)

- "exposes the Three.js chunk debug view from development landing navigation"
- "selects the procedural crowd benchmark by route path"
- "selects the procedural FX gym by route path"
- "selects the procedural character gym by route path"
- "keeps the debug route active without relying on auth or play-route params"

### apps/game/src/ui/features/social/realtime-chat/ui/shared/emoji-picker.test.ts (file deleted)

- "should contain no duplicate emoji codepoints"
- "should have the expected category names"
- "should produce EMOJIS as all categories flattened"

### apps/game/src/ui/features/world/components/armies/army-warning-copy.test.ts (file deleted)

- "uses food wording in Eternum"
- "uses wheat wording in Blitz"
- "formats the mode-aware wheat/food requirement"
- "keeps fish visible when it is also missing"
- "prioritizes travel blocking stamina warnings"
- "reports explore blocking when only explore requirements are missing"
- "reports travel blocking when only travel requirements are missing"
- "blocks travel when the army cannot afford one travel food step"
- "keeps travel ready when only the explore food requirement is short"
- "keeps explore blocked when stamina is below the explore threshold and travel is already blocked"

### apps/game/src/ui/features/world/components/bottom-right-panel/tile-panel-title.test.ts (file deleted)

- "normalizes %s coordinates exactly once"

### apps/game/src/ui/features/world/latest-features.test.ts (file deleted)

- "stays capped to the 8 newest entries"
- "keeps optional metadata well-typed when present"

### apps/game/src/ui/utils/play-asset-manifest.test.ts (file deleted)

- "includes the shared HDR environment map in the dashboard fetch set"
- "prefetches the procedural ground arrays and their provenance manifest"
- "warms terrain while leaving entity models to the selected game's visible scene"
- "excludes audio, videos, cosmetics, and landing-only promo art from dashboard preloads"

## constants/configuration equality

### apps/game/src/three/terrain/terrain-page-builder.test.ts (group narrowed or replaced)

- "tracks the reviewed all-biome terrain and placement style"

### apps/game/src/three/terrain/terrain-prop-catalog.test.ts (group narrowed or replaced)

- "defines one near and far mesh for every approved archetype"
- "keeps flexible vegetation separate from rigid fixtures"
- "favors pioneer cover and deadwood at settlement regrowth edges"
- "keeps ground cover near-only and favors wetland species at water edges"

### apps/game/src/ui/features/military/utils/defense-slot-utils.test.ts (file deleted)

- "uses the contract slot identities"
- "unlocks the same prefix for a level %i realm or village"

## duplicates of wider command boundary tests

### packages/core/src/client/actions/actions.test.ts (group narrowed or replaced)

- "moveArmy dispatches the same explorer_travel call the manager does"

### packages/provider/src/bitcoin-mine.test.ts (file deleted)

- "encodes labor losslessly with one game scope"
- "claims a phase and mine list as one command"
- "closes before binding the phase"
- "rejects unsigned actions before queueing"

### packages/provider/src/ethereal-combat.test.ts (file deleted)

- "encodes %s through the season domain"

## duplicates or test utility implementation

### apps/game/src/three/cosmetics/**tests**/player-cosmetics-store.test.ts (file deleted)

- "has no selection for an unknown player"
- "tracks pending blitz loadout drafts by world"
- "applies army, structure, and global attachment selection without dropping prior state"
- "notifies selection subscribers and stops after disposal"
- "marks a successful pending loadout as the applied world loadout"

### apps/game/src/three/managers/army-manager.schedule-stamina.test.ts (file deleted)

- "recomputes stamina only when the armies tick advances"

### apps/game/src/three/scenes/worldmap-test-harness.test.ts (file deleted)

- "stays pending until resolved and then yields the resolved value"
- "tracks calls and resolves them in FIFO order"
- "throws when trying to resolve without pending calls"

### apps/game/src/three/utils/centralized-visibility-manager.registration-order.test.ts (file deleted)

- "unregisterChunk removes a key via O(1) Set.delete"
- "registerChunk preserves insertion order"
- "enforceChunkLimit evicts the oldest registered chunk (FIFO)"
- "duplicate registration does not create duplicate entries or break eviction"
- "hasChunk works correctly after registration order changes"
- "enforceChunkLimit evicts multiple oldest chunks when over capacity"
- "unregisterChunk on non-existent key is a no-op"

### apps/game/src/ui/features/cosmetics/model/use-cosmetic-loadout-store.test.ts (file deleted)

- "builds a slot-keyed draft payload that preserves token ids and cosmetic ids"
- "keeps the UI adapter in parity with the pending draft"
- "reports an invalid summary when the pending loadout exceeds the max"
- "returns the game-entry summary copy for a non-empty pending loadout"

## generated command variants and mocked own queue; real encoding retained

### packages/provider/src/player-commands.test.ts (group narrowed or replaced)

- "routes %s with named ABI fields"
- "maps %s to compiled command variants"
- "covers every public player action"

## generated data / constants / configuration equality

### apps/game/build/client-data.test.ts (group narrowed or replaced)

- "preserves every balance value in %s while excluding deployment setup"
- "does not transform unrelated JSON or raw asset requests"

### config/deployer/clean/tests/config-loader.test.ts (group narrowed or replaced)

- "loads generated configs with neutral biome climate defaults"

### config/deployer/clean/tests/environment.test.ts (group narrowed or replaced)

- "resolves the Madara Blitz balance environment"

### config/deployer/clean/tests/native-preset.test.ts (group narrowed or replaced)

- "mine presets preserve the fragment ladder and give Eternum rifts one quarter of regular-fast output"
- "Eternum registers its configured bridge tokens and Blitz has no bridge"

### config/deployer/clean/tests/registrar-preset.test.ts (group narrowed or replaced)

- "keeps Blitz finalization immediate and Eternum grace unchanged"

### packages/core/src/client/native-models.test.ts (group narrowed or replaced)

- "uses schema scope for game rows and deployment identities"

### packages/core/src/data/realm-names.test.ts (file deleted)

- "matches canonical realm names for representative ids"

### packages/db/drizzle.config.test.ts (file deleted)

- "keeps TLS enabled by default"
- "allows plain local Postgres only when explicitly requested"

### apps/game/scripts/icons/menu-icon-pipeline.test.mjs (group narrowed or replaced)

- "maps each approved semantic icon to its stable public path"

## generated fixtures and duplicates of fact-store boundaries

### packages/core/src/client/native-world.test.ts (group narrowed or replaced)

- "folds the generated explorer fixture into typed facts and deletes it"
- "reads immutable config from native facts and rejects missing configuration"

## markup and copy

### apps/game/src/pwa/pwa-install-control.test.tsx (group narrowed or replaced)

- "shows Safari instructions without attempting a native prompt"
- "hides install controls inside the installed app"
- "falls back to browser instructions when a saved prompt expires"
- "provides Android, iPad desktop-mode, and Mac Safari instructions"

### apps/web/src/components/modules/realms/ownership-status-alert.test.tsx (file deleted)

- "renders the %s inventory state"
- "renders query failures as an explicit inventory error"
- "renders no alert for a ready inventory"

### apps/web/src/components/modules/realms/realm-card.test.tsx (file deleted)

- "settles on an unavailable image when on-chain metadata cannot be read"

## markup, copy or mocked UI collaborators

### apps/game/src/ui/components/world-countdown.test.tsx (file deleted)

- "advances and ends from the shared clock without a game timestamp poller"
- "transitions from upcoming to ongoing on the same clock"

### apps/game/src/ui/design-system/atoms/game-icons.test.tsx (file deleted)

- "resolves every icon to a published image"
- "keeps controls decorative unless an accessible name is supplied"
- "preserves direction independently of caller animations"

### apps/game/src/ui/design-system/molecules/tooltip.test.tsx (file deleted)

- "renders the hover tooltip on a fine pointer"
- "renders nothing on a coarse pointer, where a tap would leave it stuck"

### apps/game/src/ui/features/debug/atmosphere-lab-controls.test.tsx (file deleted)

- "offers all seven phases, a moon toggle, and edits the shared world preset"
- "keeps night and evening fill below daylight and preserves directional shading"

### apps/game/src/ui/features/event-feed/event-feed-ticker.test.tsx (file deleted)

- "shows a notice the moment it is raised and drops it after its ttl"
- "dismisses a notice by id"

### apps/game/src/ui/features/landing/components/mobile-bottom-nav.test.tsx (file deleted)

- "shows only game landing destinations"

### apps/game/src/ui/features/world/components/context-menu/context-menu.test.tsx (file deleted)

- "renders the store's menu at the pointer, drills into children, and closes on select or Escape"

### apps/game/src/ui/features/world/components/entities/collapsible-bubble.test.tsx (file deleted)

- "only toggles for the header's own keys, leaving nested action keys alone"

### apps/game/src/ui/features/world/containers/top-header/hud-header-layout.test.tsx (file deleted)

- "keeps portrait settings in the bounded status row and navigation in its own row"
- "retains the single-row desktop order"

### apps/game/src/ui/features/world/containers/top-header/map-view-controls.test.tsx (file deleted)

- "collapses the mobile layer picker into one descriptive toggle"
- "keeps both explicit layer choices in the desktop header"

### apps/game/src/ui/modules/boot-loader/contour-map.test.tsx (file deleted)

- "uses a distinct vignette gradient id per instance"

### apps/game/src/ui/modules/boot-loader/segmented-bracket-loader.test.tsx (file deleted)

- "clamps progress into the segment range"
- "renders the requested number of segments"
- "renders indeterminate segments without requiring progress"

### apps/game/src/ui/modules/loading-oroborus.test.tsx (file deleted)

- "renders nothing while the view is stable"

### apps/game/src/ui/shared/components/chunk-transition-indicator.test.tsx (file deleted)

- "stays hidden while no terrain transition is active"
- "surfaces active terrain work as a passive status without a fullscreen dimmer"

### apps/game/src/ui/shared/components/world-loading.test.tsx (file deleted)

- "shows the labeled loading item for %s"
- "does not show an empty panel for unlabeled %s loading state"

## mocked SQL checkpoint responses, replaced by PostgreSQL checkpoint/replay

### apps/herald/src/checkpoint-store.test.ts (group narrowed or replaced)

- "discards a stored checkpoint with quest and biome rows so startup replays history"
- "restores a checkpoint when its model set still matches"

## mocked own collaborators or copied implementation

### apps/game/src/three/game-renderer-gui-folders.test.ts (file deleted)

- "destroys tracked GUI folders during teardown"

### apps/game/src/three/game-renderer-memory-globals.test.ts (file deleted)

- "clears memory monitor globals during destroy"

### apps/game/src/three/game-renderer.test.ts (file deleted)

- "rejects with an error when isDestroyed is true before element is found"
- "rejects when isDestroyed becomes true mid-poll"
- "resolves normally when element exists and isDestroyed is false"
- "rejection is caught gracefully in the .then().catch() chain (no unhandled rejection)"
- "does not throw when this.renderer is undefined"
- "does not throw when this.renderer is null"
- "accesses renderer properties when this.renderer is defined"
- "re-captures base values from new config after rebuild"
- "without the reset, base values stay stale after rebuild (documents the bug)"

### apps/game/src/three/managers/army-attachment-state.test.ts (file deleted)

- "spawns attachments when a visible army gains a new signature and removes stale entries"
- "removes tracked attachments when an army no longer has any templates"
- "removes attachment state only when the army is tracked"

### apps/game/src/three/managers/army-attachment-transforms.test.ts (file deleted)

- "uses instance transforms for tracked armies and updates attachments"
- "falls back to world position and default scale when instance transforms are missing"
- "skips transform work for armies without tracked attachments"

### apps/game/src/three/managers/army-label-presentation.test.ts (file deleted)

- "repositions the active label above the current army position"
- "skips work when there is no active label"

### apps/game/src/three/managers/army-label-visibility.test.ts (file deleted)

- "toggles label visibility and refreshes only labels that become visible"
- "hides labels without calling reveal handlers"
- "removes only labels that are not retained"

### apps/game/src/three/managers/army-manager.allocation.test.ts (file deleted)

- "writes into the provided output vector and returns the same reference"
- "produces identical results regardless of which output vector is provided"
- "overwrites the output vector completely on each call"
- "callers that need independent vectors must clone or provide their own"

### apps/game/src/three/managers/army-manager.destroy-ordering.test.ts (file deleted)

- "calls unsubscribeVisibility before armyModel.dispose"
- "unsubscribeVisibility still runs even if armyModel.dispose throws"

### apps/game/src/three/managers/army-manager.lifecycle.test.ts (file deleted)

- "fully disposes the path renderer during destroy"
- "destroys tracked GUI folders during teardown"

### apps/game/src/three/managers/army-visible-set-reconciler.test.ts (file deleted)

- "removes stale armies, adds missing ones, force-refreshes tracked armies, and marks one presentation flush"
- "preserves attachment updates on no-op passes without marking buffers dirty"

### apps/game/src/three/managers/path-renderer.visibility.test.ts (file deleted)

- "uses the explicitly assigned visibility manager for culling"

### apps/game/src/three/managers/selected-hex-manager.test.ts (file deleted)

- "fills the hex in the hover manager's own blue, never the pink hover palette"
- "holds the hover look and the particle ring while a selection exists and releases both"

### apps/game/src/three/managers/structure-label-visibility.test.ts (file deleted)

- "toggles label visibility and refreshes only labels that become visible"
- "hides labels without calling reveal handlers"
- "removes only labels that are not retained"

### apps/game/src/three/managers/structure-visible-pass-cleanup.test.ts (file deleted)

- "removes stale attachments and both label surfaces, then returns the next visible set"
- "leaves state unchanged when nothing is retired"

### apps/game/src/three/managers/structure-visible-presentation.test.ts (file deleted)

- "updates the one persistent label, rotation, and attachments for the rendered structure"
- "removes attachments when the structure no longer resolves any templates"

### apps/game/src/three/perf/worldmap-render-diagnostics.wiring.test.ts (file deleted)

- "records duration metrics and reflects them in the snapshot"
- "records counter metrics and reflects them in the snapshot"
- "records upload byte metrics"
- "reset clears all recorded state"

### apps/game/src/three/renderer-animation-runtime.test.ts (file deleted)

- "preserves elapsed animation time at $targetFPS FPS on a $refreshRate Hz display"
- "stops the loop immediately when the renderer is destroyed"
- "waits for label runtime readiness before rendering"
- "throttles capped frames and carries forward the initialized frame time"
- "does not clear the failure circuit when a frame declines to render"
- "reports a thrown frame and always schedules the next tick"
- "preserves frame time and scheduling when the error reporter itself throws"
- "throttles repeated-frame-error reports without stopping frame attempts"
- "retains independent backoff state for alternating failure fingerprints"

### apps/game/src/three/renderer-dev-gui-runtime.test.ts (file deleted)

- "wires scene switch, camera move, and camera view actions through the provided callbacks"
- "skips renderer controls when no renderer is available"
- "wires renderer settings and contact shadow opacity controls"

### apps/game/src/three/renderer-effects-bridge-runtime.test.ts (file deleted)

- "creates the effects runtime lazily and delegates setup, environment, and profile calls"
- "only forwards weather updates after the effects runtime exists"

### apps/game/src/three/renderer-runtime-assembly.test.ts (file deleted)

- "assembles the support registry and session runtime around shared runtime factories"

### apps/game/src/three/renderer-session-runtime.test.ts (file deleted)

- "creates the HUD scene through the provided factory"
- "initializes and forwards monitoring calls through the monitoring runtime"
- "starts route listeners and syncs the route through the route runtime"

### apps/game/src/three/renderer-support-runtime-registry.test.ts (file deleted)

- "creates the control bridge eagerly and lazily initializes the remaining runtimes"
- "reuses lazy runtimes after the first initialization"

### apps/game/src/three/scenes/hexagon-scene-stage0-lifecycle.test.ts (file deleted)

- "shouldTriggerLightningAtCycleProgress stores timeout handle in lightningTriggerTimeout"
- "cleanupLightning clears lightningTriggerTimeout and prevents callback from firing"
- "destroy disposes the ground mesh texture separately from material"

### apps/game/src/three/scenes/worldmap-chunk-finalize-runtime.test.ts (file deleted)

- "records rollback and skips follow-up work"
- "records stale drops and skips follow-up work"
- "records committed transitions and awaits follow-up work"

### apps/game/src/three/scenes/worldmap-chunk-orchestration-fixture.test.ts (file deleted)

- "keeps the previous chunk active until the prepared presentation is ready to commit"
- "rolls back to previous authority when tile sync fails"
- "suppresses stale transition commits and manager updates"

### apps/game/src/three/scenes/worldmap-chunk-presentation-runtime.test.ts (file deleted)

- "records phase durations through the wrapped presentation callbacks"
- "forwards chunk preparation completion to the owner callback"

### apps/game/src/three/scenes/worldmap-chunk-refresh-runtime.test.ts (file deleted)

- "increments and returns the next request token"
- "schedules a timer, updates runtime state, and clears timer state before running the callback"
- "resolves immediately when switched off"
- "resolves from the refresh completion path without scheduling polls"
- "releases pending waits when the scene switches off"
- "marks rerun requested and reschedules when a refresh is already running"
- "runs the refresh, records the applied token, and schedules a rerun when a newer request arrives during execution"

### apps/game/src/three/scenes/worldmap-critical-manager-catchup-runtime.test.ts (file deleted)

- "records each critical failure and schedules one recovery refresh"
- "does nothing when all critical managers succeed"
- "times out stalled critical manager work and recovers only the failed manager"
- "treats zero timeout as unbounded critical manager work"
- "labels slow sliced catch-up as convergence latency rather than blocking time"
- "labels a timed-out catch-up honestly"
- "stays silent when no console reporter is injected"
- "recovers rejected critical manager work without blocking successful managers"
- "waits for the bounded critical batch before invalidating failed managers"

### apps/game/src/three/scenes/worldmap-post-commit-manager-catchup-runtime.test.ts (file deleted)

- "appends tasks to the runtime queue"
- "schedules only one pending drain at a time"
- "marks deferred head tasks and reschedules draining"
- "runs drained tasks sequentially and reschedules if queue remains"
- "invokes onTaskSkipped (and skips runTask) when shouldRunTask is false"
- "clears queued work and cancels an animation frame handle"

### apps/game/src/three/scenes/worldmap-runtime-lifecycle.test.ts (file deleted)

- "clears switch-off transient state and returns reset primitives"
- "is idempotent with empty collections"
- "invalidates chunk transition ownership when switching off"

### apps/game/src/three/scenes/worldmap-scene-lifecycle-cleanup.test.ts (file deleted)

- "clearing followCameraTimeout prevents callback from firing"
- "is safe to clear followCameraTimeout when it is already null"
- "calling all cleanup functions and clearing maps prevents dangling callbacks"
- "no maxLifetimeTimeout callbacks fire after travel effects are cleaned up"
- "is safe to clean up travel effects when maps are empty"
- "calling switchOff cleanup twice does not throw"

### apps/game/src/three/scenes/worldmap-store-bridge.test.ts (file deleted)

- "registers each worldmap-facing store slice once"
- "continues disposing subscriptions after one unsubscribe throws"
- "skips store sync when the scene does not own interaction state"
- "stops sync after clearing selection for missing action-path ownership"
- "replays store state into the scene and clears selection when nothing is selected"

### apps/game/src/three/scenes/worldmap-terrain-commit-runtime.test.ts (file deleted)

- "records terrain-ready diagnostics and render duration"
- "applies terrain, records commit metrics, and emits presentation skew when phase timings exist"
- "skips presentation skew when no phase duration has been recorded"

## mocked own modules / collaborator wiring

### apps/game/src/game-entry/play-route-boot.test.tsx (file deleted)

- "resets play-route readiness without updating the store during render"
- "keeps one readiness generation while setup resolves and the entry overlay is dismissed"
- "keeps one readiness generation across scenes and coordinate changes in the same entry"
- "starts one new readiness generation for each chain, world, or entry-intent change"
- "waits for a gameplay account before bootstrapping player routes"
- "bootstraps spectator routes without a gameplay account"
- "bootstraps player routes once the gameplay account is resolved"
- "surfaces a gameplay account provisioning failure at once, with no grace timer"
- "asks an anonymous identity to sign in at once, and keeps waiting while a session restores its account"

### apps/game/src/game-entry/play-scene-handoff.test.tsx (file deleted)

- "completes entry only when the canonical boot phase is ready"
- "keeps map-first handoff behind ambient worldmap convergence"
- "repairs map-first routes without coordinates from synced player structures"

### apps/game/src/hooks/context/gameplay-account-sync.test.tsx (file deleted)

- "does not deploy an account or create a gameplay key for an unauthenticated spectator"
- "provisions and binds from the landing for a signed-in identity with no entered world"

### apps/game/src/hooks/store/use-story-events-history.test.tsx (file deleted)

- "merges live/history copies, preserves same-transaction stories, and isolates game scopes"
- "keeps old battles after hundreds of routine stories and recovers confirmed battles after stream eviction"
- "replays native combat by receipt identity without merging repeated participants"

### apps/game/src/hooks/use-leaderboard-activity.test.tsx (file deleted)

- "opens Players from cache, refreshes after confirmed heads and reconnects, and isolates games"
- "pauses automatic requests after failure until the player retries successfully"

### apps/game/src/hooks/use-notification-preferences.test.tsx (file deleted)

- "publishes only an owner/revision invalidation after the server acknowledges a save"
- "pauses a hidden tab immediately and fetches Off after another tab saves"
- "does not accept a stale %s response after invalidation"
- "keeps delivery paused when the invalidated preference cannot be refreshed"
- "ignores other owners and malformed signals, and removes the listener on unmount"
- "does not let an invalidated old account read replace the new account"
- "does not publish failed saves and reports failed cross-tab publication honestly"

### apps/game/src/hooks/use-player-world-registrations.test.ts (file deleted)

- "uses one disabled query per deployment when no player is connected"
- "deduplicates every game in one deployment onto one player-scoped directory request"
- "keeps separate deployment directories separate"
- "maps annotated directory rows back to the world/game identity"
- "surfaces one deployment query's loading state"
- "keeps the stable world/game key"

### apps/game/src/hooks/use-transaction-listener.test.tsx (file deleted)

- "adds breadcrumbs for submitted and completed transactions"
- "reports provider transaction failures and marks the tracked transaction as reverted"
- "passes submit failure classification through to transaction reporting without a hash"

### apps/game/src/hooks/use-transfer-automation-runner.test.tsx (file deleted)

- "plans later due transfers against successful debits from earlier transfers in the same pass"

### apps/game/src/hooks/use-world-availability.test.ts (file deleted)

- "resolves the chosen game's metadata from the Herald directory"
- "reads player registration from the same annotated directory request"
- "reads an Eternum player's settled state from the same directory request"
- "surfaces a Herald directory failure"
- "reports unavailable when the directory has no matching game"

### apps/game/src/hooks/use-world-preview-entry.test.ts (file deleted)

- "keys preview state by chain, world, and account"
- "disables preview entry outside development builds"
- "records preview entry state under an account and world scoped key"
- "promotes the pending loadout into the applied world slot for preview entry"

### apps/game/src/hooks/use-worlds-summary.test.ts (file deleted)

- "unions every directory world's games list"
- "drops a failing world's contribution instead of failing the whole list"
- "returns an empty array when every world has no games"
- "registers a single shared query without a polling interval"
- "exposes loading and error state from the underlying query"

### apps/game/src/init/game-renderer-session.lifecycle.test.ts (file deleted)

- "restores browser cleanup ownership when the session is disposed"
- "owns cleanup before scene initialization and refuses to start after cancellation"
- "releases the renderer and browser handlers when scene initialization fails"
- "runs the previous unload handler before destroying the renderer"

### apps/game/src/init/game-renderer.session.test.ts (file deleted)

- "keeps renderer cleanup inside the session instead of exposing it on window"

### apps/game/src/lib/army-stamina/movement-affordability.test.ts (file deleted)

- "allows movement when live native store stamina is sufficient"
- "rejects movement when live native store stamina is insufficient"
- "sums only finite movement stamina costs"

### apps/game/src/managers/game-worker-manager.test.ts (file deleted)

- "rejects pending path requests when the worker is terminated"
- "creates a fresh worker after termination before posting new updates"
- "clears retained worker state without creating an idle worker"
- "hydrates retained world state in one worker message"
- "does not create an idle worker to hydrate empty world state"
- "hydrates empty world state into an active worker to clear it"
- "resolves worker path results back into normalized positions"

### apps/game/src/observability/network-health-reporting.test.ts (file deleted)

- "records an explicit stream recovery without a health poll"

### apps/game/src/observability/observed-client-transaction.test.ts (file deleted)

- "reports submit failures"
- "reports confirmation failures after submission"
- "adds breadcrumbs for successful transactions without reporting failures"
- "resolves gameplay transactions from the active Herald channel"

### apps/game/src/observability/transaction-failure-reporting.test.ts (file deleted)

- "captures submitted failures with sanitized context and deduplicates repeated failures"
- "skips wallet rejections by default while still leaving a breadcrumb"
- "tags provider disconnects separately from no-hash submission timeouts"

### apps/game/src/pwa/local-story-notifications.test.ts (file deleted)

- "dispatches an eligible new confirmed event and groups mirrored copies"
- "never dispatches history, unknown confirmation, provisional events, spectators, off or unrelated activity"
- "drops pending work when %s changes before delivery"

### apps/game/src/pwa/push-foreground-lifecycle.test.ts (file deleted)

- "refreshes foreground presence immediately, on lifecycle changes, and before the lease expires"
- "does nothing where service workers are unavailable"

### apps/game/src/pwa/push-notification-client.test.ts (file deleted)

- "requests permission in the click gesture and activates only after authenticated registration"
- "revokes setup if the account changes during server registration"
- "persists local revocation before a failing network call and retries it after logout"
- "never creates a subscription after permission denial"
- "sends a test only for the active account's acknowledged registration"
- "reports visible gameplay for any active push device"
- "does not revoke a new account when an earlier reconciliation finishes late"
- "does not report a failed detach for an older worker with no push subscription"
- "enables the worker before opting the server registration into game alerts"
- "requires a compatible worker before upgrading a preview subscription"
- "requires foreground-aware worker support before enabling direct-message alerts"
- "registers DM consent only after worker activation and foreground synchronization"
- "waits for foreground synchronization before and after automatic registration"
- "recovers interrupted automatic setup after reopen (server acknowledged: %s)"
- "revokes locally on %s while automatic recovery holds the network lock"
- "does not activate a registration disabled while its server write is stalled"
- "does not unsubscribe a replacement when queued cleanup resumes"

### apps/game/src/pwa/pwa-update-prompt.test.tsx (file deleted)

- "keeps the update action disabled until pending transactions finish and surfaces activation failure"

### apps/game/src/runtime/world/selection.profile.test.ts (file deleted)

- "replaces a stale Blitz profile before bootstrap: %j"
- "resolves a first-time Eternum entry from the same directory"
- "rejects an unknown explicit world before fetching another deployment"
- "does not enter a saved game when its directory is unavailable"
- "rejects a saved game that no longer exists in the current world"

### apps/game/src/runtime/world/selection.test.ts (file deleted)

- "persists the selected chain even when it matches the resolved chain"
- "persists fallback chain when selection chain is omitted"
- "records selection milestones and durations around profile building and persistence"

### apps/game/src/services/blitz/blitz-hyperstructure-creation.test.ts (file deleted)

- "submits one action through the shared client with contract coordinates"
- "blocks duplicate submissions until the reserved tile clears"
- "clears the local pending indicator when submission is rejected"
- "blocks orders before marking a tile pending or submitting"

### apps/game/src/services/identity/player-profiles.test.ts (file deleted)

- "asks once per address, keys answers by normalized address, and wakes listeners when they land"
- "keeps a failed batch asked and wakes nobody, so a derive never loops on a dead identity server"

### apps/game/src/services/leaderboard/player-activity-breakdown-service.test.ts (file deleted)

- "reads Herald's prepared aggregate with one scoped request"

### apps/game/src/services/review/game-review-service.test.ts (file deleted)

- "builds the exact L3 result and transaction stats without a SQL reader"
- "preserves both layers at one coordinate and fingerprints layer identity"
- "refuses a review until history covers the frozen snapshot block"

### apps/game/src/services/settlement.test.ts (file deleted)

- "loads the selected game's preset and submits through its authenticated actor"
- "keeps the entry stream alive until the submitted settlement is applied"
- "reports a terminal gameplay rejection delivered after submission"
- "rejects a missing transaction identity before closing the stream"
- "reports admission authentication failure and closes the entry stream"
- "preserves a terminal rejection and closes the entry stream"
- "never substitutes another game when its directory row is missing"

### apps/game/src/three/characters/procedural-army-character-layer.test.ts (file deleted)

- "lazy-loads one shared runtime and drives a promoted live-army actor"
- "keeps hidden interaction proxies selectable after the legacy mesh is replaced"
- "applies bounded presentation separation and emits contact reactions without moving authoritative anchors"
- "hands defeated actors to a bounded-lived ragdoll presentation"
- "queries the intended actor and consumes its latest arrow impact for directional defeat"
- "keeps an expected ranged target hittable until its authoritative defeat receives the arrow"
- "presents the ranged family as a longbow archer outside its crossbow tier"
- "recreates the actor when an army changes between mounted and foot families"
- "promotes water movement to a procedural combat ship and restores the land actor at shore"
- "keeps a tier-three Sky Dragon landed at rest and flies it for authoritative movement"
- "spreads ambient actor creation across frames while fallbacks remain available"
- "leaves the legacy fallback active when the shared runtime fails to load"
- "disposes a runtime that finishes loading after its scene layer was destroyed"

### apps/game/src/three/characters/procedural-character-renderer-runtime.test.ts (file deleted)

- "returns both initialized owners with the requested pixel and physics policy"
- "disposes a loaded character runtime when renderer initialization fails"
- "disposes an initialized renderer when character loading fails"

### apps/game/src/three/cosmetics/**tests**/asset-cache.test.ts (file deleted)

- "loads gltf and texture assets and records the handle"
- "releases pooled materials and textures when clearing the cache"
- "disposes an in-flight asset that completes after renderer teardown"

### apps/game/src/three/cosmetics/**tests**/ownership.test.ts (file deleted)

- "maps a known ownership attr to an eligible army cosmetic"
- "maps a known ownership attr to an eligible attachment"
- "ignores unknown attrs safely"
- "normalizes duplicate attrs deterministically"

### apps/game/src/three/cosmetics/**tests**/resolver.test.ts (file deleted)

- "returns base army cosmetic when no selection present"
- "falls back to default structure cosmetic"
- "rejects incompatible selected skins and falls back"
- "rejects selected cosmetics that are not ownership-eligible"
- "merges per-army attachments when compatible"
- "lets target-local attachments replace global attachments in the same slot"
- "uses admitted attributes without a local inventory snapshot"
- "does not authorize protected attachments from local inventory"

### apps/game/src/three/debug/terrain-lab-interaction.test.ts (file deleted)

- "switches Ethereal presentation with the committed page and restores world presentation"
- "does not switch presentation for stale asynchronous Ethereal preparation"
- "preserves existing fixture reveals during initial and default configuration"
- "replays a preview by cancelling only the previously owned sweep"
- "cancels a pending preview when buildings are removed without replaying it"
- "uses the production queue after one covered frame from entry edge %i"
- "cancels a pending reveal when lab configuration changes"
- "discards stale asynchronous preview work after reconfiguration"
- "keeps a model detached and placement atomic until its pipelines are ready"
- "shares pending preparation across repeated placement requests"
- "does not attach a model when the lab closes during compilation"
- "reports a preparation failure and allows a fresh retry"

### apps/game/src/three/game-renderer-runtime-assembly.test.ts (file deleted)

- "builds support runtime factories around the current game renderer state"

### apps/game/src/three/game-renderer.backend.test.ts (file deleted)

- "initializes renderer state from a backend factory"
- "boots the configured WebGPU renderer through the shared runtime"
- "propagates resize through the backend surface"
- "uses the backend-owned frame pipeline during animate"
- "reboots once after native device loss without reusing the scene on a new backend"
- "does not reload for a fallback loss or after destruction"
- "keeps the lost renderer paused if navigation fails, without looping"

### apps/game/src/three/game-renderer.lifecycle.test.ts (file deleted)

- "cleans timers, listeners, scenes, and DOM resources on destroy"
- "is idempotent and skips cleanup work after the first destroy call"
- "cancels transition cleanup during destroy"
- "skips all setup when destroyed during backend initialization wait"
- "does not append a canvas after destroy during backend wait"
- "does not register cleanup intervals after destroy during backend wait"
- "starts runtime listeners without dev GUI setup when graphics dev is disabled"

### apps/game/src/three/game-renderer.runtime.test.ts (file deleted)

- "models cancellable fade-out completion"
- "boots and renders the active scene through the backend"
- "keeps rendering and camera controls active after %s freezes"
- "reports a repeated frame failure once while rendering and scheduling continue"
- "reports first, repeated, and post-fallback device losses before recovery eligibility is applied"
- "switches scenes through the shared scene manager"
- "propagates resize through the backend"
- "destroys backend, transition manager, and scenes"
- "destroys an in-flight scene candidate without revealing or switching it off afterward"
- "does not carry a frame sample through teardown or a queued final animation tick"

### apps/game/src/three/managers/army-instance-presentation.test.ts (file deleted)

- "uses the live moving position when an army is already interpolating"
- "falls back to the first path hex before the current hex when resolving world position"
- "re-resolves army cosmetics and produces a cosmetic assignment when a custom skin exists"
- "clears cosmetic assignment when only fallback data is available"

### apps/game/src/three/managers/army-manager.guild-owner.test.ts (file deleted)

- "recolours tracked ships immediately on a guild change without an army update"

### apps/game/src/three/managers/army-manager.stamina-sync.test.ts (file deleted)

- "recomputes passive stamina from live explorer troops when available"
- "uses live native stamina even when a presentation cache was previously newer"
- "projects labels from the tick that triggered the refresh"

### apps/game/src/three/managers/army-manager.structure-owner.test.ts (file deleted)

- "updates all dependent owners and label colours synchronously without an army update"

### apps/game/src/three/managers/army-model.activeInstances-fallback.test.ts (file deleted)

- "clearInstanceSlot removes index from activeInstances when owner is known"
- "clearInstanceSlot removes stale model memberships when owner is known"
- "updateInstance prunes inactive renderable memberships for the live slot"
- "clearInstanceSlot removes index from activeInstances in fallback path"
- "getModelDrawCount returns 0 after all slots cleared via fallback"
- "fallback clearInstanceSlot zeroes matrix AND removes from activeInstances"
- "setVisibleSlots sets mesh.count to 0 after fallback clear removes all active"
- "bumps the new model's mesh.count when updateInstance switches an entity to an already-loaded model"
- "collectDrawnSlotOwners returns only slots within mesh.count, paired with their owner"
- "isEntityDrawn reflects whether the entity's slot is active and within count"
- "releaseEntity purges a leaked slot when matrixIndex was detached but the slot still draws (death ghost)"

### apps/game/src/three/managers/army-model.animation-visibility.test.ts (file deleted)

- "skips animation work when the active instances are offscreen"
- "keeps animating visible instances"
- "does not upload a visible morph texture when its weights are unchanged"

### apps/game/src/three/managers/army-model.cosmetic-cleanup.test.ts (file deleted)

- "clearCosmeticForEntity removes slot from cosmetic activeInstances"
- "rapid remove-then-add does not leak old cosmetic activeInstances"
- "cosmetic mesh.count is 0 after all cosmetic entities removed"
- "clearInstanceSlot fallback also cleans cosmetic activeInstances"

### apps/game/src/three/managers/army-model.movement-slot-source-of-truth.test.ts (file deleted)

- "ignores a stale caller-supplied slot and keeps driving the entity's live slot"
- "adopts the supplied slot when the entity has no live slot yet"
- "clears instanceData.matrixIndex even when the freed slot is already pooled"
- "returns the new slot on a real move, the current slot on a no-op, and undefined for an unknown entity"
- "returns the entity's current instanceData.matrixIndex, or undefined when unslotted"

### apps/game/src/three/managers/army-model.ship-selection.test.ts (file deleted)

- "sails the army's own class and tier on ocean and deep ocean"
- "keeps the land model everywhere else"
- "loads ship geometry bow-first for movement, including straight west"

### apps/game/src/three/managers/army-model.spline-rebind.test.ts (file deleted)

- "renders the moving army at its new slot and leaves no ghost at the old slot"
- "keeps advancing the new slot's transform along the spline after compaction (not frozen)"
- "fully tears down a moving entity that has lost its instance slot (no stranded descent)"

### apps/game/src/three/managers/army-model.visibility.test.ts (file deleted)

- "restores draw count when a model finishes loading after visible slots were already resolved"
- "preserves a promoted entity's live transform while its instanced representation is hidden"

### apps/game/src/three/managers/chest-manager.preparation.test.ts (file deleted)

- "defers chest preparation until its chunk stage and shares it across overlapping requests"
- "does not refresh or start another load after destruction during preparation"
- "retries failed preparation without treating the failed chunk as committed"

### apps/game/src/three/managers/chest-manager.terrain-placement.test.ts (file deleted)

- "moves a placed chest onto terrain that arrives later, and only when its height changed"

### apps/game/src/three/managers/highlight-hex-manager.lifecycle.test.ts (file deleted)

- "routes descriptors into layered render buckets"
- "uses stock materials for owned highlight visuals"
- "keeps layered scene ownership stable across repeated updates and clears"
- "caps oversized descriptor sets and exposes debug counts for diagnostics"
- "retunes active highlight layers when the camera view changes"
- "removes its owned scene objects on dispose"

### apps/game/src/three/managers/interactive-hex-manager.pick-plane.test.ts (file deleted)

- "projects picks onto the ground plane instead of the elevated interaction surface"

### apps/game/src/three/managers/interactive-hex-manager.resolve.test.ts (file deleted)

- "resolves a boundary pick to the nearest visible hex instead of dropping it"
- "does not drift one neighbor when multiple adjacent hexes are interactive"
- "marks the instance matrix dirty when clearHexes empties the mesh"
- "marks the instance matrix dirty in %s"

### apps/game/src/three/managers/interactive-hex-manager.surface.test.ts (file deleted)

- "lays every band on the sampled ground plus a small lift"

### apps/game/src/three/managers/reserved-hyperstructure-manager.test.ts (file deleted)

- "ignores ordinary structure churn"
- "rebuilds when a reserved site appears, moves, or is claimed"
- "re-places the sites when their terrain arrives, and only when a height changed"

### apps/game/src/three/managers/spire-manager.test.ts (file deleted)

- "grounds an already loaded spire and its label when its terrain page arrives"
- "does not request an asset when the game has no spires"
- "uses the current layer when loading finishes and reuses the model on return"
- "does not attach a model after the scene is destroyed during loading"

### apps/game/src/three/managers/structure-manager.chunk-prewarm.test.ts (file deleted)

- "requests only visible realm levels, required wonders, and the procedural hyperstructure kit"
- "loads a newly needed level even when another level is already cached"
- "disposes a prepared model if its scene is destroyed during compilation"
- "loads visible chunk structure models before the visible update path runs"
- "attaches a loaded structure model to the scene in the current band's visibility"
- "loads visible chunk cosmetic models before the visible update path runs"
- "dedupes concurrent prewarm requests for the same chunk assets"

### apps/game/src/three/managers/structure-manager.content-ladder.test.ts (file deleted)

- "far band hides every model group and drops every near/mid label"
- "mid band keeps text only for priority structures and re-evaluates when the scene pushes new facts"
- "near band restores every model group, attachment and text label"
- "creates a compact label through the same gate the visible pass uses"
- "moves already bound mines and realms with labels and attachments when terrain arrives, without rebinding"
- "commits a full refresh in several frame-budget slices under the full-refresh owner"
- "stops a full refresh at the next slice once the pass is superseded"
- "keeps a targeted refresh as one task"

### apps/game/src/three/managers/structure-manager.lifecycle.test.ts (file deleted)

- "retains structures in the presentation overlap while crossing a chunk boundary"
- "serves repeated resolves from the cache and counts hits and misses"
- "rebuilds a record after its component row changes"
- "drops the cached record when a battle direction changes"
- "animates a visible reserved site becoming an entity, but never an initial completed snapshot"
- "resolves only the changed entity and runs no bounds query for a batch touching one of N"
- "removes a structure that leaves the window and skips the pass for changes outside it"
- "runs exactly one bounds query per chunk change"
- "runs a single visible-structure rebuild during chunk switches"
- "cleans subscriptions, timers, labels, models, and caches"
- "is idempotent and skips duplicate cleanup on repeated destroy"
- "stops an async visible-structure refresh from mutating after destroy"
- "drops a stale visible-structure pass when chunk bounds change during preload"
- "discards an older visible refresh when a newer pass supersedes it"
- "rejects an old structure pass when a newer manager token arrives during preload"
- "owns an ordinary entity update as a targeted diff rather than a full rebuild"
- "routes a structure component refresh to only that entity"
- "refreshes the label but skips the visible pass for a component change outside the window"
- "prunes a tracked label when an address-name update finds that its structure vanished"
- "mutates only entering and leaving structure slots and ignores a superseded commit"
- "retires a partially rendered realm before the next pass (upgrade=%s)"
- "clears an instanced model bucket after its last visible structure leaves"
- "ignores an invalid free-slot hint at index %s without scanning the slot array"
- "resolves a committed targeted refresh while a sustained follow-up burst is still pending"
- "re-queues targeted deltas after a non-committing pass"
- "records deltas received while chunk authority is uncommitted"
- "upgrades a partially failed delta to a full refresh before retrying"
- "queues targeted refreshes without invalidating the in-flight pass"

### apps/game/src/three/perf/renderer-startup-telemetry.test.ts (file deleted)

- "records startup timings into diagnostics and the boot timeline"
- "ignores non-finite and negative timings"

### apps/game/src/three/renderer-backend-runtime.test.ts (file deleted)

- "initializes the selected WebGPU renderer and records its resolved backend"

### apps/game/src/three/renderer-control-bridge-runtime.test.ts (file deleted)

- "forwards the current control and contact-shadow state into the dev gui runtime"
- "keeps renderer startup alive when dev gui setup fails"

### apps/game/src/three/renderer-destroy-runtime.test.ts (file deleted)

- "cleans subscriptions, timers, scenes, listeners, and support runtimes"
- "falls back to controls disposal when no interaction runtime is present"

### apps/game/src/three/renderer-display-runtime.test.ts (file deleted)

- "keeps a single visual pixel-ratio policy"
- "resizes using the renderer container when available"

### apps/game/src/three/renderer-effects-runtime.test.ts (file deleted)

- "applies the one visual profile through the backend and every scene"
- "reports unsupported environment ownership explicitly"
- "uses backend-neutral tone mapping names"

### apps/game/src/three/renderer-foundation-runtime.test.ts (file deleted)

- "creates the interaction and label runtimes and exposes the interaction primitives"
- "warns when label runtime initialization fails"

### apps/game/src/three/renderer-frame-runtime.test.ts (file deleted)

- "updates the hud before bailing when no scene is active"
- "keeps updating a preparing scene without drawing it, then resumes presentation when ready"
- "renders the world map frame through the backend-owned pipeline"
- "does not publish a rendered-frame observation when the backend throws"
- "keeps inspection rendering while pausing animations in %s"

### apps/game/src/three/renderer-interaction-runtime.test.ts (file deleted)

- "blocks native touch tracking even between scenes and releases the old surface guard"
- "configures shared camera, picking primitives, and control change wiring"
- "removes document listeners and disposes controls once"

### apps/game/src/three/renderer-label-runtime.test.ts (file deleted)

- "rejects label-container polling when disposal happens before the element appears"
- "creates the CSS2D renderer once the label container is ready"
- "invokes browser frame polling through the window receiver"
- "tracks dirty label cadence independently from GameRenderer"
- "resizes, renders, and clears the label container during disposal"

### apps/game/src/three/renderer-monitoring-runtime.test.ts (file deleted)

- "sets up stats recorder and optional memory monitoring together"
- "captures, starts, stops, and exports stats through the recorder"
- "updates the memory display and schedules the next poll"
- "cleans recorder, DOM, timeout, and debug globals during dispose"

### apps/game/src/three/renderer-scene-bootstrap.test.ts (file deleted)

- "assembles the concrete game scenes through the shared registry helper"
- "boots scene effects and applies the initial camera and visual profile"

### apps/game/src/three/renderer-scene-orchestration.test.ts (file deleted)

- "creates the scene registry, assigns it, and boots scene effects through the bridge"

### apps/game/src/three/scenes/warp-travel.test.ts (file deleted)

- "bootstraps scene ownership during construction for constructor-time scene dependencies"
- "runs shared initial activation and marks the runtime initialized"
- "reruns shared activation on resume without the initial-only hook"
- "does not run completion effects after setup ownership is superseded"
- "fails closed when the initial refresh fails"
- "still reports and continues when the resume refresh fails"
- "disposes shared subscriptions and detaches labels symmetrically"
- "reuses one lifecycle adapter across setup and switch-off cycles"

### apps/game/src/three/scenes/worldmap-army-deployment.test.ts (file deleted)

- "resolves only create-army actions in normalized map coordinates"
- "suppresses spawn actions and tooltips for %s"
- "uses the existing tooltip and clears only its own text"

### apps/game/src/three/scenes/worldmap-chunk-preparation-runtime.test.ts (file deleted)

- "builds the presentation runtime once and passes its callbacks into warp-travel preparation"

### apps/game/src/three/scenes/worldmap-interaction-adapter.test.tsx (file deleted)

- "routes structure entry through store selection and navigation"
- "routes owned-hex selection through store updates and click audio"
- "routes owned-structure context menus through the adapter boundary"

### apps/game/src/three/utils/hex-geometry-pool-debug-hooks.test.ts (file deleted)

- "installs hex-geometry debug hooks in DEV mode"
- "skips hex-geometry debug hooks outside DEV mode"

### apps/game/src/three/utils/utils.gltf-texture-support.test.ts (file deleted)

- "installs one local Basis transcoder and detects renderer support"

### apps/game/src/ui/debug/renderer-debug-control.test.tsx (file deleted)

- "shows the requested and active lanes with the exact fallback reason"
- "preserves the anonymous spectator route and enables logs in both reload links"

### apps/game/src/ui/design-system/molecules/popover.test.tsx (file deleted)

- "keeps a tall map picker within a 1600 by 900 viewport even near the bottom edge"
- "sits beside a right-column anchor, tops aligned and clamped, and hangs below when the left has no room"
- "collapses every anchor to a bottom sheet on a compact viewport held upright"
- "collapses every anchor to a right drawer under the header on a compact viewport held sideways"
- "keeps the anchored placement from Tailwind's lg breakpoint up"
- "anchors the panel on the body without a scrim"
- "keeps at most one popover open"
- "toggles from its own trigger and closes on Escape"
- "closes on a pointer-down outside and stays open for one inside"
- "reanchors map clicks without unmounting content, dismisses other map hits, and preserves Escape"
- "dismisses map clicks by default and forwards a store surface's map policy"
- "renders a store surface through the same panel and closes it on Escape"
- "drags a framed surface by its header and leaves buttons in the header clickable"
- "every free desk opens where the last one was left"
- "a surface and an element popover are exclusive of each other"
- "a store-free panel hangs from a viewport edge and asks its owner to close on Escape"
- "ignores remembered desktop offsets and header drags in %s"
- "keeps the current form above the keyboard and preserves it across rotation"
- "returns keyboard focus to the opening button on Escape"
- "lets a workspace trigger handle its own pointer click without outside dismissal"
- "updates the trigger exemption when switching between store surfaces"

### apps/game/src/ui/features/cosmetics/model/use-cosmetic-loadout-store.hook.test.tsx (file deleted)

- "does not trigger an infinite render loop for object selectors"

### apps/game/src/ui/features/debug/graphics-lab-view.test.tsx (file deleted)

- "switches tools in one shell, unmounts the old scene and remembers each setup"
- "keeps capture views free of lab chrome"
- "returns retired tool URLs to terrain"

### apps/game/src/ui/features/debug/procedural-terrain-debug-view.test.tsx (file deleted)

- "updates live metrics without rewriting dropdown selections, and still updates the building count"

### apps/game/src/ui/features/economy/resources/resource-transfer-popover.test.tsx (file deleted)

- "opens one transfer form per trigger, even for the same resource shown twice"
- "runs the before-open hook only when opening"

### apps/game/src/ui/features/economy/trading/compact-order-book.test.tsx (file deleted)

- "starts in Buy mode with the asks and a buy form"
- "switches to the bids and a sell form in Sell mode"
- "shows the three best offers until See all, then the whole side"
- "prefills the price with the best offer of the current mode until the player types one"
- "keeps the offers behind the header in landscape until tapped"
- "leaves the desktop book as two columns without a toggle"

### apps/game/src/ui/features/economy/trading/market-modal.test.tsx (file deleted)

- "shows the resource list beside the trade view on desktop"
- "opens on the trade view for the selected resource without the list in %s"
- "shows the structure's balance and the best prices for the selected resource on a phone"
- "swaps the trade view for the resource list when the player taps Change"
- "selects the picked resource and returns to the trade view"
- "keeps the open tab across a resource change"
- "keeps the AMM Pools tab open when changing resources in %s"

### apps/game/src/ui/features/event-feed/quick-feed.test.tsx (file deleted)

- "shows at most five fresh rows newest first with ticks, keeps pinned headlines on top and counts unread"
- "turns connection changes into feed notices and pins a red offline row with retry"

### apps/game/src/ui/features/landing/components/playtest-slots.test.tsx (file deleted)

- "offers sign-in before registering and never submits an anonymous registration"
- "registers once and replaces the action with the identity's registration state"
- "shows the frozen assignment only to its registrant and never offers a closed registration"
- "reports registration failure and permits an explicit retry"

### apps/game/src/ui/features/landing/components/realm-number-picker.test.tsx (file deleted)

- "replaces the preview when the selected realm changes"
- "clears stale metadata and skips the lookup for an invalid number"

### apps/game/src/ui/features/military/battle/hooks/use-attack-target.test.tsx (file deleted)

- "updates troops, stamina, and stealable resources while the preview remains mounted"

### apps/game/src/ui/features/military/battle/quick-attack-preview.test.tsx (file deleted)

- "labels the ethereal +10% preview and submits the selected combatants"
- "disables unguarded structure claims when stamina is below the required threshold"
- "still allows structure claims once stamina reaches the required threshold"
- "blocks unguarded structure claims from range two"

### apps/game/src/ui/features/military/battle/raid-container.test.tsx (file deleted)

- "refreshes attacker stamina when the armies tick advances without a refetch"

### apps/game/src/ui/features/military/chest/relic-crate-openings.test.tsx (file deleted)

- "turns a crate opening into one feed row at the hex and keeps the relics for the tile panel"

### apps/game/src/ui/features/military/components/army-deployment-picker.test.tsx (file deleted)

- "shows troop tiles including blocked empty stock, an editable count and capped increments"
- "keeps an empty stockpile's blocker separate from usage and Deploy visible but disabled"
- "names contract guard slot %i as display slot %i"
- "does not render for %s"

### apps/game/src/ui/features/military/components/guard-dismissal.test.tsx (file deleted)

- "requires confirmation and submits the contract slot without changing the guard locally"
- "has no dismissal for a %s guard"
- "disables dismissal while recruitment is pending"
- "reports rejection, keeps the picker open and permits an explicit retry"
- "does not submit twice while the first dismissal is pending"

### apps/game/src/ui/features/military/components/unified-army-creation-modal/use-army-creation.test.tsx (file deleted)

- "keeps troop selection and count when reanchoring, then uses the existing explorer call"
- "does not switch to guards when the explorer cap is reached"
- "uses the preset guard slot and keeps an unavailable slot blocked"
- "recruits into the highest unlocked slot at level %i"
- "shows the starting guard in Delta at level zero"
- "opens with every count at zero and keeps Deploy blocked until the player picks a count"
- "updates availability from the live resource row and explains provisioning first"

### apps/game/src/ui/features/military/utils/guard-stamina.test.ts (file deleted)

- "recomputes stamina from the current tick even when boost fields are missing"

### apps/game/src/ui/features/settlement/construction/compact-building-card.test.tsx (file deleted)

- "shows costs and a disabled reason without hiding existing-building management"
- "requires a deliberate second action to destroy and supports cancelling"
- "disables a pending build and only offers map placement when available"

### apps/game/src/ui/features/settlement/construction/construction-buildability.test.ts (file deleted)

- "allows a locally valid construction request"
- "rejects non-production structures before submission"
- "rejects center-tile construction"
- "rejects occupied tiles"
- "rejects out-of-radius tiles"
- "rejects missing costs and insufficient resources"
- "rejects insufficient capacity and population"
- "uses native population instead of stale realm input"
- "rejects resource producers not supported by the structure resource set"
- "rejects labor-mode locks and mode exclusions"

### apps/game/src/ui/features/settlement/construction/plot-construction-picker.test.tsx (file deleted)

- "builds from one tile click and exposes blocked costs and reasons before clicking"
- "switches the shared cost preference"
- "closes when order permission or ownership is lost"
- "sorts buildable tiles before blocked tiles within each group"
- "does not offer the Simple cost switch in Blitz"

### apps/game/src/ui/features/settlement/construction/realm-build-actions.test.ts (file deleted)

- "re-checks affordability before submitting"
- "uses the next authoritative-empty tile after an occupancy race"
- "serializes four quick clicks per realm and resolves each slot when its turn starts"

### apps/game/src/ui/features/settlement/construction/select-preview-building.production-badge.test.tsx (file deleted)

- "uses the structural building count for the visible production badge total"
- "builds straight onto a free tile from the world view and keeps the panel open"
- "arms the placement preview and closes the panel from the local view"
- "does not submit a second build while the first tap is pending"

### apps/game/src/ui/features/settlement/construction/use-plot-construction.test.tsx (file deleted)

- "rechecks affordability at submit and explains a changed balance inline"
- "prevents submission when %s changes"
- "submits the selected plot once and closes on success"
- "uses resource construction costs in Blitz despite a stored Simple selection"

### apps/game/src/ui/features/settlement/production/automation-preset-switch.test.tsx (file deleted)

- "creates only the selected realm and writes the same preset the sliders use"
- "disables writes in spectator mode"

### apps/game/src/ui/features/settlement/production/inline-production.test.tsx (file deleted)

- "renders resource %s through compact existing controls"
- "explains unavailable labor"
- "omits controls for %s"

### apps/game/src/ui/features/settlement/production/production-modal.lazy.test.tsx (file deleted)

- "loads production on opening, keeps the loading frame closable, and forwards selection"

### apps/game/src/ui/features/settlement/production/production-popup-shell.test.tsx (file deleted)

- "renders Production through the surface frame at panel size"
- "invokes the provided onClose from the frame"
- "closes the surface when no onClose is provided"

### apps/game/src/ui/features/settlement/production/use-production-bonuses.test.tsx (file deleted)

- "uses neutral bonuses without a bonus row"
- "uses each recorded percentage through its inclusive end tick"

### apps/game/src/ui/features/social/player/player-list.focus.test.tsx (file deleted)

- "waits for the own row, highlights it and scrolls once without opening a profile"

### apps/game/src/ui/features/social/realtime-chat/ui/realtime-chat-shell.test.tsx (file deleted)

- "starts in Global, switches to the current Game, and discards stale game tabs"
- "keeps Global available without game registration and preserves direct-message tabs"

### apps/game/src/ui/features/world/components/actions/attack-info.test.tsx (file deleted)

- "reacts to armies tick updates from the timestamp store"

### apps/game/src/ui/features/world/components/actions/bitcoin-mining-action-panel.test.tsx (file deleted)

- "contributes from an owned realm without owning a mine"
- "allows a non-owner to close, bind and settle a mine in order"
- "reuses a bound root on a retry and reports the rejection"
- "continues a partially claimed backlog before reporting success"

### apps/game/src/ui/features/world/components/actions/unoccupied-tile-quadrants.test.tsx (file deleted)

- "renders three distinct biome bonus cards with clear battle states"
- "puts plain-tile coordinates and re-sync in the biome header with the bonuses"
- "keeps troop bonuses visible when the biome header is clicked"

### apps/game/src/ui/features/world/components/bottom-right-panel/hex-minimap.test.tsx (file deleted)

- "keeps camera following alive after effect remounts without rebuilding unchanged tiles"

### apps/game/src/ui/features/world/components/entities/banner/incoming-caravans.test.tsx (file deleted)

- "counts only future caravans for the selected structure and uses the next arrival"
- "hides the line for other owners, zero incoming, and after the final arrival"

### apps/game/src/ui/features/world/components/entities/banner/structure-ownership-transfer.test.tsx (file deleted)

- "confirms the recipient before submitting ownership without changing the store"
- "does not offer transfer for %s"
- "rejects recipient %s"
- "rechecks authoritative ownership before submitting"
- "keeps a rejected transfer available for explicit retry"
- "submits only once while the first transfer is pending"

### apps/game/src/ui/features/world/components/entities/compact-entity-inventory.test.ts (file deleted)

- "uses the provided currentDefaultTick when projecting balances"
- "filters inventory items into resource and relic groups"
- "filters usable relics to compatible inactive relics"
- "excludes active compatible relics from usable relic filters"
- "counts total, resource, relic, and active relic item groups without treating active relics as usable"
- "marks relics compatible with the selected recipient type"
- "counts inactive compatible relics as usable"

### apps/game/src/ui/features/world/components/entities/hooks/use-army-entity-detail.stamina-sync.test.tsx (file deleted)

- "derives stamina from the current ExplorerTroops row"
- "follows a same-tick spend in place without a new snapshot or remount"

### apps/game/src/ui/features/world/components/entities/structure-production-summary.test.ts (file deleted)

- "counts active and total production buildings from shared production data"
- "ignores labor and buildings without produced resources"

### apps/game/src/ui/features/world/components/hyperstructures/hyperstructure-construction.test.tsx (file deleted)

- "starts construction only for the synchronized owner"
- "contributes exact fractional units from the selected owned source"
- "blocks contributions above inventory, malformed amounts and unsynchronized inventory"
- "honors public, private and same-guild contribution access"
- "limits contributions to the remaining requirement after another player's contribution"
- "does not silently spend from another structure when the selected source is captured"
- "changes access through the authenticated command and keeps failed state authoritative"
- "removes construction controls once the synchronized stage is complete"

### apps/game/src/ui/features/world/components/hyperstructures/leaderboard.test.tsx (file deleted)

- "updates points without manual refresh"

### apps/game/src/ui/features/world/containers/compact-hud.test.tsx (file deleted)

- "keeps all five navigation targets stable before a tile is selected"
- "docks to the right edge as a column and a vertical rail in landscape, with the sheet filling the column"
- "offers the structure actions in a row above the tab bar in portrait, only for an owned structure"
- "docks the structure actions as their own rail on the left edge in landscape"
- "opens the build workspace and the market from the structure actions, replacing any open sheet"
- "opens one sheet at a time and closes it when the active tab is tapped again"
- "hosts the standings for a spectator"
- "counts unread events on the Log tab and opens the log panel instead of the sheet"
- "opens the chat window from the Chat tab and lifts the shell above other surfaces"
- "keeps the sheet closed on a new selection so the map stays free for the next tap"
- "keeps an open sheet on its tab as the selection changes or clears"
- "follows the selected building hex over the selected world hex"
- "explains how to inspect a tile before a selection exists"
- "closes from the visible close control or Escape and restores focus to its tab"
- "dismisses the sheet when panning the world canvas, but allows interaction within the minimap"
- "replaces sheets with action popovers and does not resurrect them when the popover closes"
- "makes room for workspace %s without stacking the Empire sheet"
- "dismisses the sheet while renaming a structure"
- "switches exclusively between workspaces and highlights Production and Trade"

### apps/game/src/ui/features/world/containers/hud-chat-window.test.tsx (file deleted)

- "shows the last message with the unread count, opens on Enter and closes on Escape or a map click"
- "asks a signed-out viewer to sign in and ignores Enter"
- "shows unavailable game chat without fetching forbidden history"
- "uses the shared channel granted by the server instead of the current game"

### apps/game/src/ui/features/world/containers/left-facets/suggestions-panel.test.tsx (file deleted)

- "mounts and closes in StrictMode when smooth scrolling returns a promise"

### apps/game/src/ui/features/world/containers/left-facets/use-suggestion-actions.test.tsx (file deleted)

- "runs %s without changing map, realm or building selection"

### apps/game/src/ui/features/world/containers/right-hud-column.test.tsx (file deleted)

- "stacks feed, details under it, the chat strip at the bottom; chat keeps the details, the log replaces them"

### apps/game/src/ui/features/world/containers/top-header/attention-pill.test.tsx (file deleted)

- "counts distinct attention targets and suggestions, then cycles without submitting orders"
- "hides personal attention for a spectator"

### apps/game/src/ui/features/world/containers/top-header/game-clock.test.tsx (file deleted)

- "merges the countdown with the phase icon, time left in the day and six segments"
- "retains urgency and the finished review entry"
- "stacks a concise mobile countdown while preserving its full accessible label"

### apps/game/src/ui/layouts/play-route-bootstrap-error-screen.test.tsx (file deleted)

- "reports the bootstrap failure without presenting a sign-in flow"

### apps/game/src/ui/layouts/play-route-reconnect-screen.test.tsx (file deleted)

- "signs in on the route itself and keeps the dashboard as the other way out"
- "shows the provisioning failure without presenting a bootstrap action"

### apps/game/src/ui/modules/entity-details/hooks/use-blitz-realm-provision.test.tsx (file deleted)

- "allows provisioning only for blitz realms after the main phase starts"
- "blocks provisioning before main start"
- "allows provisioning before main start when dev mode is on (sandbox)"
- "uses StructureBuildings as the primary provisioned signal"
- "falls back to Building rows when StructureBuildings is not available"
- "submits the provision call and clears once the labor building appears"
- "settles once the authoritative stream publishes the provisioned building"
- "releases the spinner when submission never returns a transaction hash"
- "stops loading and unlocks after sync timeout so provision can be retried"
- "waits for the authoritative stream after an already-provisioned response"

### apps/game/src/ui/modules/entity-details/hooks/use-realm-actions.test.tsx (file deleted)

- "does not keep realm actions pending while waiting for confirmation"
- "clears pending state when submission does not return a transaction hash"

### apps/game/src/ui/modules/identity/identity-login.test.tsx (file deleted)

- "connects and signs with the selected wallet in one click"
- "allows another wallet after a signature rejection"
- "allows another wallet after connection fails"
- "replaces an existing connection before signing with another wallet"
- "refuses the gameplay chain before requesting an identity signature"
- "keeps wallet choices available after verification fails"
- "does not open competing wallet requests while one is pending"

### apps/game/src/ui/modules/identity/landing-identity-chip.test.tsx (file deleted)

- "opens the sign-in popover for a request and does not redirect while anonymous"
- "replays the requested route with its state once the session lands, then closes the popover"
- "shows the session name once signed in"
- "ends the identity session before disconnecting the wallet and closing the popover"
- "keeps the session and wallet connected when identity sign-out fails"
- "clears the signed-out session when wallet disconnect fails"

### apps/game/src/ui/modules/settings/notification-device-settings.test.tsx (file deleted)

- "requests permission in the enabling gesture before worker IO and wires test delivery"
- "does not enable after denied permission"
- "does not retarget permission approval after an account switch"
- "does not ask for permission on unsupported or anonymous surfaces"
- "shows unknown status after a worker read failure and recovers after explicit enablement"

### apps/game/src/ui/modules/settings/notification-settings.test.tsx (file deleted)

- "keeps the acknowledged level while saving and surfaces conflicts without claiming success"
- "keeps anonymous choices local and loads account preferences without uploading defaults"
- "discards stale account responses and refreshes on focus and reconnect"
- "suppresses settings and permission prompts for spectators"

### apps/game/src/ui/modules/settings/push-notification-settings.test.tsx (file deleted)

- "labels the test-only milestone and enables on an explicit click"
- "offers background notifications when direct-message delivery is available by itself"
- "offers existing devices an explicit DM upgrade and hides it after consent"
- "keeps an existing device removable when server sending is disabled"
- "shows expired registration errors without hiding the cleanup action"
- "keeps local removal available when configuration cannot load offline"
- "does not let a stale focus refresh restore the device after disablement"
- "requires explicit consent to upgrade an existing test-only registration"

### apps/game/src/ui/modules/settings/settings.test.tsx (file deleted)

- "shows the profile, wires the controls, lists bound keys and uses gold selected states"
- "shows Spectating with no sign out for an explicit spectator"
- "renames the identity account from the profile header and shows the server's refusal"

### apps/game/src/ui/shared/components/block-timestamp-poller.test.tsx (file deleted)

- "refreshes the block timestamp store every second"

### apps/game/src/ui/shared/components/game-cycle-effects.test.tsx (file deleted)

- "keeps the gong on army-tick changes without sounding on mount or within a tick"
- "writes atmospheric progress and respects debug overrides"
- "advances the atmosphere from block time without a clock pill and resumes after a debug override"

### apps/game/src/ui/shared/components/transaction-audio-cues.test.tsx (file deleted)

- "shows explicit uncertainty guidance for no-hash submit timeouts"
- "surfaces the classified Cairo reason on reverts"
- "prefers the raw receipt revert reason over the regex-salvaged message"

### apps/game/src/utils/explorer-stamina.test.ts (file deleted)

- "reads the updated tick from live troop stamina"
- "returns live native store troops when no pending movement exists"
- "projects stamina from the selected live source"

### packages/core/src/client/game-client.test.ts (group narrowed or replaced)

- "selects the game before the session starts and applies config after the snapshot"

### packages/core/src/managers/config-manager.biome-climate.test.ts (file deleted)

- "uses configured biome climate when predicting undiscovered terrain"
- "falls back to neutral climate when config has not loaded"
- "treats zero climate values from config as neutral"

### packages/core/src/managers/tile-manager.test.ts (file deleted)

- "submits the requested coordinate without maintaining a parallel occupancy record"
- "releases a coordinate immediately when submission fails"

## mocked own store and heartbeat

### apps/game/src/pwa/notification-worker.test.ts (group narrowed or replaced)

- "serializes racing tabs and only displays the winning durable claim"
- "claims visible activity without trusting focus, so a later hide cannot turn a duplicate into an OS alert"
- "reports a visible game client without relying on its focus flag"
- "keeps local alerts during the push-test preview but rejects a different game"
- "rejects invalid payloads and owner changes before touching delivery storage"
- "focuses the matching game without navigation and opens entry only when none matches"
- "disabling delivery closes only that account's displayed notifications"
- "receives server push with no page clients, preserves its collapse tag and routes its click through normal entry"
- "rejects server push and clicks for a %s registration"
- "focuses an existing game when a direct-message notification is opened"
- "rejects expired or account-mismatched server envelopes"
- "keeps an already-sent automatic push user-visible without a local claim swallowing it"
- "does not deliver or open automatic alerts on a test-only device"
- "keeps local delivery for other chains and worlds even when automatic push owns one source"
- "keeps local delivery during incomplete automatic setup"
- "closes only the revoked registration's notifications and ignores stale revocation"

### apps/launch-service/src/worker.test.ts (group narrowed or replaced)

- "interrupts execution and requeues when the worker loses its lease"

## mocked provider internals, replaced by public submission flows

### packages/provider/src/execute-and-check-transaction.l2-gas.test.ts (group narrowed or replaced)

- "sets a zero tip on fee estimation and submission"
- "uses configured fixed bounds without estimating"
- "reads the explorer id after scoped game calldata"
- "caps l2 gas max_amount at the current v3 mainnet limit"
- "submits without waiting when waitForConfirmation is false"
- "serializes all native actions per player until the stream barrier without blocking another player"
- "releases a native command barrier and reports a stalled Herald before the next command"
- "emits readable submission failures for object-shaped errors"
- "aborts the submit when the fee estimate proves a deterministic revert"
- "prefers nested revert reason over generic short rpc messages"
- "extracts hex-annotated starknet nested reasons before generic rpc text"
- "extracts the innermost RPC failure reason frame"
- "does not surface protocol error codes when no readable reason is available"
- "falls back for wrapped generic string errors without serializing quotes"
- "emits revert payloads with transaction hash after submission"
- "resolves each player's ticket independently when a batch includes a rejection"
- "keeps ticket identity when a submission completes after its timeout"
- "marks asynchronous post-timeout confirmation failures as background confirmation"
- "times out stuck submissions before a transaction hash so the queue can drain later actions"
- "classifies destroyed provider connections before a transaction hash"
- "emits a late submitted and pending event when a timed-out submission later returns a hash"
- "waits for a registered pre-submit guard before calling execute"
- "uses default v3 execution details when fee estimation stalls before submission"
- "reuses cached explore resource bounds on subsequent submissions"
- "does not reuse cached explore resource bounds across distinct explore payloads"
- "refreshes cached explore resource bounds after a nonce retry"
- "invalidates cached explore resource bounds after a fee-related submit failure"

## repeated normalization per asset, replaced by one real image-processing boundary

### apps/game/scripts/icons/menu-icon-pipeline.test.mjs (group narrowed or replaced)

- "rebuilds the published menu set from approved masters"

## source or asset file reads

### apps/game/src/game-route.test.tsx (file deleted)

- "keeps a restoring account on the game route instead of redirecting home"
- "renders the on-route sign-in screen when no account is coming"
- "reports a spectator bootstrap failure without asking the viewer to sign in"
- "shows automatic gameplay-account restoration as restoring"
- "keys the ready app by the active boot token so route rebootstrap remounts GameProvider"
- "mounts the ready world once after the first readiness generation starts"

### apps/game/src/three/characters/boat/quaternius-pirate-ship-assets.test.ts (file deleted)

- "ships the audited single-material static combat vessel"
- "keeps exact CC0 provenance beside the optimized runtime GLB"

### apps/game/src/three/characters/horse/quaternius-horse-assets.test.ts (file deleted)

- "declares its appearance-facing asset and rig identity"
- "ships the audited 50-joint skin and every required procedural control bone"
- "keeps the authored clips as gym references and flat-color material roles"
- "keeps CC0 provenance beside the runtime asset"

### apps/game/src/three/characters/procedural-character-avatar.test.ts (file deleted)

- "keeps the rendered supporting landmark on the floor across multiple walking strides"
- "poses both feet from the current pose independently of previously rendered poses"

### apps/game/src/three/characters/quaternius-character-assets.test.ts (file deleted)

- "maps each visible upgrade tier to a distinct CC0 character"
- "ships $label as a skinned, clip-free runtime GLB"
- "keeps asset license and provenance beside the runtime files"
- "shares immutable GPU assets while isolating each actor's skeleton and materials"
- "disposes its templates once and rejects late actor creation"
- "selects appearance independently from tier while reusing one rig adapter"
- "rejects ambiguous duplicate asset ids"

### apps/game/src/three/characters/ships/ship-sail-ownership.test.ts (file deleted)

- "ships every sail with class artwork and ownership tint, leaving hull materials unmarked"

### apps/game/src/three/managers/fx-manager.test.ts (file deleted)

- "does not skip FX creation when texture is still loading"
- "can register and play a dynamic icon fx type"
- "removes the unused batched shader path from the active FX manager implementation"
- "sets colorSpace to SRGBColorSpace on texture immediately (before async load callback)"
- "shares built-in textures between managers until the final owner is destroyed"

### apps/game/src/three/terrain/creatures/biome-creature-assets.test.ts (file deleted)

- "keeps the penguin's supporting foot on the ground throughout its waddle"
- "contains all 16 LOD2 species"
- `${entry.id}: intact, articulated, finite and seekable`
- "centers %s at swimming depth without casting a surface shadow"

### apps/game/src/three/three-typing-policy.test.ts (file deleted)

- "keeps the Three.js ambient types aligned with the runtime package version"
- "keeps a dedicated WebGPU typing guard script"
- "does not mask the WebGPU renderer surface behind any-typed ambient declarations"

### apps/game/src/three/utils/labels/label-components.incoming-troops.test.ts (file deleted)

- "defines icon-first incoming troop helpers without zoom-specific display rules"
- "inserts incoming troop rows before productions instead of appending them after"

### apps/game/src/ui/features/world/components/actions/chest-tile-details.test.tsx (file deleted)

- "builds the crate panel from the structure tile chrome with contents read from config"
- "offers Open only while one of the player's armies stands next to the crate"
- "lists the relics once the crate is opened and drops the Open action"
- "has no crate modal left: opening happens from the map or the tile panel"
- "classifies the live chest row by occupier type rather than its immovable-occupier flag"

## source/generated files or constants

### apps/web/src/lib/public-routes.test.ts (file deleted)

- "exposes %s from the unified web app"

### apps/web/src/lib/theme.test.ts (file deleted)

- "uses the realms-world-site font stack"
- "defines the realms-world-site atmosphere tokens"
- "gives outline buttons an etched panel treatment"
- "uses brass accents instead of white edge highlights"
- "maps semantic borders onto the realm gold palette"
- "uses flat backgrounds instead of gradients"
- "points marketplace CTAs at market.realms.world"
- "keeps the dashboard title inline instead of inside a framed panel"
- "keeps homepage spacing tight and consistent"
- "uses the shared page title treatment on primary portal screens"
- "defines a shared card title utility"
- "tokenizes heading tracking values"
- "uses shared page shell primitives on outlier pages"
- "uses shared components for the veLords header and stat cards"
- "uses shared prose heading classes in markdown"
- "uses one dark surface value across header, sidebar, and panels"
- "keeps gold limited to structural text roles"
- "uses the cleaned sidebar destination map"

### packages/chain/src/game-chains.test.ts (file deleted)

- "matches the Madara node configuration"

## conditionally skipped live-fixture integration suite

### config/deployer/clean/tests/native-preset.integration.test.ts (file deleted)

- "deployer Eternum preset registers tokens and executes a deposit and withdrawal"

## orphaned fixture helpers / duplicate encoder and signing boundaries

### deploy/athanor/randomness/native-intent.test.ts (file deleted)

- "fixture commands use the shared compiled ABI encoder, including nested options"
- "fixture intents use the configured signer rather than a fixed test key"
