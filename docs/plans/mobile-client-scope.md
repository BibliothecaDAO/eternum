# Mobile client — scope and POC path (iOS + Android, one codebase, shared backend)

Written 2026-09-10 from a read of `apps/game`, `packages/*`, `apps/herald`, `apps/realms`, the git history of the two
earlier mobile attempts, and current platform facts (WKWebView, Android WebView, three.js r185/r186, Cartridge native
docs, store policy). Every claim below cites the file or source it came from. Nothing here has been run on a phone yet;
the first phase exists to change that.

Motto: **KISS, always. Systemic fixes over point patches. Success of systemic work is deletion.**

---

## 0. The answer in one paragraph

Ship the existing `apps/game` client inside a **Capacitor 8** shell, with a **mobile lane** inside the same codebase
(renderer profile, touch input, phone HUD layout). Do not start a second client. The reason the past attempt crashed
phones is no longer "three.js on mobile" in the abstract; it is a short, concrete list in §3 (raw RGBA textures on 81 of
107 models, a ~400 MB JS heap, a DPR cap that is still ~2.9 MPix, no adaptive lane, a reload loop on device loss) that
the codebase already has most of the machinery to fix. The data layer and transaction path port with almost no change
(§4). The one genuinely new piece of work is the phone HUD (§6). React Native + WebGPU is a rewrite for no gain unless
WebContent-process memory turns out to be the binding constraint after §2 measures it; that decision is deferred, not
made.

---

## 1. What was tried before, and why neither attempt is the base

**`client/apps/eternum-mobile`** (Apr 2025 → deleted 2026-08-25 in `30b1e582fcc`, "establish phase-one monorepo
layout"). A Vite + React + wouter + shadcn web client, Feature-Sliced Design, 8 routes, ~1.0 MB of source. It was "87.5%
text-based" with its own lighter three.js worldmap (~8 k lines under `src/shared/lib/three`, plain `WebGLRenderer`,
`pixelRatio = min(dpr, 2)`, OrbitControls, chunked loading). It synced **directly from Torii**
(`@dojoengine/torii-wasm`, `@bibliothecadao/torii`, `src/app/dojo/sync.ts`) and carried its own copy of Controller login
and session policies. `docs/plans/realms-phase-1-brief.md:126-131` records why it was deleted: a second copy of the
login work, and it cannot compile once `GameChain` replaced `Chain`. Both of its foundations are gone: Torii-direct sync
was replaced by Herald, and Controller session policies were replaced by the gameplay account.
`realms-phase-2-brief.md:571` parks its revival as `apps/mobile`. **Do not revive it**; its worldmap scene is the only
reusable idea (a small purpose-built scene) and even that is superseded by the content ladder in the main client.

**`client/apps/game-native`** (branch `ponderingdemocritus/rn-webgpu-mobile`, 2026-02-24, seven commits in one day,
never merged). Despite the branch name it contains **no WebGPU** — it is a bare React Native 0.84 text-first app
following `eternum-mobile/SCOPE.md` ("Text-First React Native Mobile Client", 4+1 bottom tabs: Command / Realms / Armies
/ Trade / More). Phase 0 declared "GO" after shimming `torii-wasm`, `controller-wasm` and `account-wasm` to empty
modules; the next commit (`48870b935c2`) replaced `DojoProvider` with a mock "to avoid crypto module crash" because
`@bibliothecadao/react` and `@bibliothecadao/dojo` pulled Node `crypto` under Hermes. **It never connected to live
data.** Its `SCOPE.md` UX thinking (thumb zone, action feed, neighbourhood view) is worth keeping for §6; its code is a
scaffold over mocks.

Other branches (`loaf-mobile`, `mobile-cleanup`, `push-mobile`, `origin/mobile-blitz-merge`, `origin/leet/mobile-dev`)
are iterations of `eternum-mobile` and inherit the same dead data layer.

**What changed since:** the client no longer talks to Torii at all (every `torii` reference in `apps/game` is a negative
source-assertion test). Herald streams plain JSON over one WebSocket (§4). This removes the single blocker that killed
the React Native path (WASM Torii client under Hermes) — and simultaneously removes most of the reason to want React
Native, because the sync runtime is now pure TypeScript that runs anywhere.

---

## 2. Platform facts that bound the design (2025–2026)

| Fact                                                                                                                                                                                                                                                                                                                     | Source                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| WKWebView has WebGL2 since iOS 15; **WebGPU only from iOS 26** (Safari 26.0, 2025-09-15; feature flags do not apply to WKWebView, it is on by default on iOS 26).                                                                                                                                                        | webkit.org/blog/17333, developer.apple.com/forums/thread/770862            |
| WKWebView WebContent process is killed at roughly **1.25–2 GB** (device dependent, not configurable); symptom is a blank page / `webViewWebContentProcessDidTerminate`, not a JS error. Separate silent **GPU-process kills** lose the WebGL context without `webglcontextlost` reliably firing; poll `isContextLost()`. | developer.apple.com/forums/thread/771787, dev.to/raxxostudios (2026-08-31) |
| `requestAnimationFrame` is capped at **60 Hz** in WKWebView (WebKit bug 294338, open).                                                                                                                                                                                                                                   | webkit.org                                                                 |
| No Wasm threads in either WebView (needs COOP/COEP on a custom-scheme document; Android WebView has no site isolation). Wasm SIMD fine.                                                                                                                                                                                  | capacitor#6182                                                             |
| KTX2/Basis transcodes to **ASTC** on iOS (Safari 12+) and ASTC/ETC2 on Android.                                                                                                                                                                                                                                          | MDN BCD                                                                    |
| Android WebView: no hard memory cap, LMK kills on spikes; **WebGPU in WebView is unverified** (sources conflict; Compatibility Mode from Chrome 146 claims WebView). Must be tested with `navigator.gpu` on target devices.                                                                                              | developer.android.com, blink-dev                                           |
| Capacitor 8 (2025-12): iOS 15+, Android minSdk 24, WKWebView / System WebView. Tauri 2 mobile is the same webview with a Rust host.                                                                                                                                                                                      | ionic.io/blog/announcing-capacitor-8                                       |
| `@react-three/native` says "DO NOT USE YET". `react-native-wgpu` runs three `three/webgpu` on Dawn but is WebGPU-only, RN ≥ 0.81 new-arch, no DOM.                                                                                                                                                                       | github.com/pmndrs/native, wcandillon                                       |
| Cartridge documents **Capacitor** as the path for wrapping an existing web app: `SessionProvider` + system browser (`SFSafariViewController`) + deep-link return. React Native guide needs a native Rust module; `controller.c` is early (39 commits).                                                                   | docs.cartridge.gg/controller/native/capacitor                              |
| App Store 3.1.1: "NFT ownership does not unlock features or functionality within the app". Google Play requires the blockchain declaration and forbids paid chances at NFTs of unknown value. Blob Arena (Dojo, Unity client) is live on both stores; no store presence for any Starknet web-tech game found.            | developer.apple.com guidelines, android-developers.googleblog 2023-07      |

Consequences: the mobile lane is **WebGL2-first**, single-threaded Wasm, DPR ≤ 1.0–1.5, and must survive both a
WebContent kill and a silent GPU-process kill. WebGPU is a bonus on iOS 26+ once measured, not a dependency.

---

## 3. Why the three.js client crashed phones — the verified list

The renderer is `WebGPURenderer` from `three/webgpu` in both lanes (`apps/game/src/three/webgpu-renderer-backend.ts:98`,
build modes `webgpu-auto` | `webgpu-force-webgl` at `renderer-build-mode.ts:1-5`). On any phone below iOS 26 it takes
three's WebGL2 backend, after a guaranteed 3.2 s WebGPU probe timeout (`:138`).

1. **Texture memory.** 107 GLBs under `public/models` (96 MB); **26 carry KTX2, 0 carry Draco** — 81 upload raw RGBA.
   Largest: `cosmetics/low-res/0x1011401.glb` 6.27 MB, `new-buildings-opt/chest_model.glb` 4.38 MB. Big PNGs
   (`textures/paper/worldmap-bg.png` 2.6 MB, `attack.png`/`defense.png` ~1.5 MB each) become 16–21 MB each resident. The
   loaders are already wired for DRACO (from `gstatic.com`, a third-party origin — `utils/utils.ts:18-19`), Meshopt and
   KTX2 with `detectSupport(renderer)` (`game-renderer.ts:173`), and `scripts/compress-models.mjs` exists (480 px / 768
   px hero, 80 MB budget). **Roughly three quarters of the library has never been run through it.** Order of magnitude
   at the close band: 150–350 MB texture + geometry residency before framebuffers.
2. **JS heap.** Recorded **371–406 MB** steady on desktop, spectating a finished game with zero churn
   (`docs/plans/realms-client-brief.md:210,226,244`). On iOS that heap shares one ~1.25 GB budget with GPU allocations,
   DOM and Wasm.
3. **Instance-pool growth class.** `three/utils/instanced-matrix-attribute-pool.ts:6-12` records that the pool "grew by
   gigabytes of Float32Array backing stores while browsing the map". It is now capped at 64 MB — a fix for desktop, a
   large fixed charge on a phone. Fixed capacities allocate full size regardless of population: structures 1024
   (`structure-manager.ts:125`), armies 1024 per model with per-mesh morph `DataTexture` (`army-model.ts:208,578`),
   chests 1000, label quads 2048, markers 2048, FX pools 2048/1024/256.
4. **Resolution.** `RENDERER_PIXEL_RATIO_CAP = 1.25` (`render-profile.ts:34`) is ~2.9 MPix on a 2778×1284 panel, with
   **no antialiasing** to justify it (no `antialias` key, `fxaa: false`). Mobile guidance is 1.0 or resolution-scaled.
5. **No adaptive lane.** The old LOW/MID/HIGH tier ladder and its device detection were deleted
   (`render-profile.ts:52-66` purges the legacy keys). What remains is `quality: "balanced" | "high"` which changes
   exactly two numbers (`pixelRatio` 1.25→1.0, `shadowMapSize` 1024→512, `:76-86`). `animationCullDistance`,
   `animationFps`, `labelRenderDistance` have no live consumer. There is no FPS watchdog, no thermal or memory-pressure
   response, and terrain eviction refuses to drop below the pinned 5×5 chunk neighbourhood
   (`worldmap-terrain-cache-eviction.ts`, `limitedByPinning`).
6. **Failure handling makes it worse.** Device loss forces a **full page reload** into `webgpu-force-webgl`
   (`game-renderer.ts:195`) — on iOS an OOM → reload → OOM loop. The recoverable-frame path calls
   `renderer.setSize(window.innerWidth, window.innerHeight)` mid-frame (`webgpu-renderer-backend.ts:366`), a swapchain
   reallocation at the moment memory is scarce. `MemoryMonitor` reads `performance.memory`, which is **zero on Safari**
   (`utils/memory-monitor.ts:84-106`) — the one memory instrument does not work on the platform that crashes.
7. **Boot time.** Entry-ready is **10.5–12.1 s on desktop headless** (`renderer-lane-webgpu-revisit-codex-brief.md` item
   0). A 3–5× phone multiplier lands in watchdog territory before first frame; the dashboard also idle-prefetches every
   army/building/chest model, terrain textures, the HDR env map and ~120 PNGs (`ui/utils/play-asset-manifest.ts`) with
   no Save-Data guard.
8. **DOM labels.** `CSS2DRenderer` labels are real DOM nodes; the close band issued **507 compact-label draws**
   (`realms-client-brief.md:547`). Mobile Safari's compositor handles this far worse than desktop.
9. **Full-game snapshot.** One WebSocket per `game_id` delivers the whole game — 35 models / ~5,155 rows, receive 910
   ms + apply 373 ms on desktop for a 96-player match (`realms-client-brief.md`, Half three). The only lever is model
   subsetting (`snapshotModels`, `apps/game/src/sync/game-sync.ts:70-71`); there is no area scoping.

**What already helps:** a truthful WebGL2 fallback with backend telemetry (`webgpu-renderer-backend.ts:182,478-491`);
`?rendererMode=webgpu-force-webgl` as a tested one-flag lane; a hard DPR cap already in place; a source-test-enforced
content ladder that cut the far band from 318 draws / 13.4 M tri to **21 draws / 20 k tri**
(`worldmap-content-ladder.ts:35-66`) — a mobile row is a table edit; procedural characters and jolt-physics WASM are off
in production (`:68-71`; `jolt-ragdoll-world.ts` only reachable via the dynamic import at
`procedural-army-character-layer.ts:389`); post-processing fully disabled (`:135`); two mobile branches already threaded
through the backend factory (`PCFShadowMap`, `UnsignedByteType` output, 1.5× label cadence —
`webgpu-renderer-backend.ts:102-107`, `game-renderer-policy.ts:250-268`); disposal discipline in
`army-model.ts:2583-2648`; `StatsRecorder` and `frame-work-owner.ts` spike attribution; a real boot benchmark driving
real spectate URLs (`scripts/run-renderer-load-benchmark.mjs`).

**No mobile measurement of any kind exists in this repo.** That is the first thing to fix.

---

## 4. What ports for free: data, transactions, identity

**Backends the client talks to** (`apps/game/env.ts`): Herald (`VITE_PUBLIC_HERALD_URL`, WS + REST, **no auth, wildcard
CORS** — `apps/herald/src/http.ts:23-24`), game-chain Starknet RPC (`VITE_PUBLIC_NODE_URL`), identity server
(`VITE_PUBLIC_IDENTITY_ORIGIN`, SIWS + gameplay-account bind/rotate, served by `apps/realms/server`), public mainnet RPC
for SIWS verification, realtime-server chat (`VITE_PUBLIC_CHAT_URL`, raw WebSocket, not socket.io), launch-service
(factory only), Sentry. No Torii, no GraphQL, no gRPC-web, no analytics SDK. A mobile app points at exactly the same
URLs; nothing server-side changes for read paths.

**Sync runtime is pure TypeScript with injected edges.** `HeraldGameSyncTransport` parses JSON over a `WebSocket` behind
a `socketFactory` (`packages/core/src/sync/herald-game-sync-transport.ts:56-84,428-437`); the scheduler is an interface
with a `queueMicrotask` default and the rAF one lives in the app (`packages/core/src/sync/scheduler.ts`,
`apps/game/src/sync/recs-game-sync-store.ts:268-272`); storage is `StorageLike` (`gameplay-account.ts:10`); the store is
`GameSyncStore` with two implementations already (RECS in the app, in-memory in `packages/client`). Across all eight
package `src/` trees there are **three** browser hits, all guarded or trivial (`core/utils/entities.ts:133-141`,
`chain/endpoints.ts:20`, `identity/client.ts:32`). No Web Worker, IndexedDB or service worker on the sync path. No
package imports `three`.

**Transactions never open a wallet.** The client is a two-account split
(`apps/game/src/hooks/context/starknet-provider.tsx:16-27`, comment: "No session policies, no paymaster, no
game-transaction signing"): Controller / Ready / Braavos sign **one SIWS message on mainnet**; a locally generated stark
keypair (`packages/core/src/account/gameplay-account.ts:174-243`) is deployed as a player account, bound by the identity
server's binding authority, and signs every gameplay call via plain `Account.execute`
(`apps/game/src/account/gameplay-account-submit.ts:53-71`). Confirmation comes back on Herald's `tx` channel
(`game-sync-runtime.ts:95-120`). **This means Cartridge's `SessionProvider` / onchain session policies are not needed on
mobile at all** — the app only needs the SIWS sign-in once, in a system browser, and a way to hand the identity session
back to the WebView.

**Identity session is HTTP + cookie** (`packages/identity/src/client.ts:29-90`) with a Bearer fallback currently
restricted to loopback origins (`:31-32`). A native shell needs that Bearer path opened for the app's origin, because a
cookie set in `SFSafariViewController` is not shared with WKWebView.

**Spectating needs no account** (`apps/game/src/utils/spectator-session.ts`, `can-issue-orders.ts`). That is the
zero-friction POC entry point and the store-safe onboarding path.

**Game selection / deep links.** Routes carry the game **name**, not the id: `/enter/:chain/:world`,
`/play/:chain/:world/:scene?col&row&spectate&rendererMode` (`game-client-app.tsx:64-80`, `play-route.ts:71`). Name → id
resolves through the unauthenticated `GET /{chain}/games` (`profile-builder.ts:20-49`). `apps/realms` already launches
the game with `${VITE_PUBLIC_GAME_ORIGIN}/enter/${chain}/${gameName}` (`apps/realms/src/routes/play.tsx:42-45`) — that
URL shape is the Universal/App Link template.

---

## 5. The UI as it stands on a phone

The in-game HUD is a fixed desktop layout: 12 breakpoint utilities in `features/world` versus 142 in `factory-v2` and 77
in `landing`. The landing already has `MobileBottomNav` (`lg:hidden`, safe-area padding —
`landing/components/mobile-bottom-nav.tsx`) and a hamburger drawer; the play surface has **zero** safe-area handling
(`TopHeader` at `top-0 h-11`, columns at `top-[60px]` — under the Dynamic Island). Every large surface is a fixed
`w-[1320px]` popover (Logistics, Military, Construction, Market, Production, Battle Lab, Chest;
`left-command-sidebar.tsx:105` etc.), `w-[1400px]` social board, `w-[1100px]` Lordpedia.

Input: `three/managers/input-manager.ts:6` is `click | mousemove | contextmenu | dblclick | mousedown` — **no pointer or
touch listeners anywhere in `three/`**. Right-click executes worldmap actions (`worldmap.tsx:2460-2507`); `Escape` is
the exit from the Hexception scene (`game-renderer.ts:334-338`); army move preview is hover-driven
(`actions/action-info.tsx:20-40` reads `hoveredHex`). Custom wheel zoom disables `MapControls.enableZoom`
(`worldmap.tsx:8057`), so pinch does nothing — although MapControls' own one-finger pan works by accident. The body has
`touch-action: none` (`index.css:363`), which also kills touch scrolling in `overflow-y-auto` panels. 537 `hover:`
utilities, 66 `setTooltip()` sites, `react-beautiful-dnd` in one place (`military/components/structure-defence.tsx`).

Already touch-ready: the hex minimap (`hex-minimap.tsx:546-643`, pointer events + `touch-none`), the right column's
single-slot `RightColumnFocus` model (`right-hud-column.tsx:10-35`), portal popovers dismissed on `pointerdown`, chat
over plain WebSocket, `prefers-reduced-motion`, and the settings quality/shadow toggles.

Dead weight to delete on the way: `wouter` (zero imports, in `manualChunks.utils`), `react-draggable` (zero imports),
`public/gifs` 101 MB (referenced only by `apps/game-docs`), legacy `map/index.html` + `hex/index.html` prefetch entries,
the `generate-pwa-assets` script (its generator is not installed), the self-destroying `VitePWA` block with `icons: []`.

---

## 6. Decision: architecture

Three candidates were compared (research memo §"Three viable architectures"):

- **A. Capacitor 8 around `apps/game`** with a mobile lane inside the client. One codebase, Cartridge's documented
  native path, stores accept it, WebGPU arrives on iOS 26 for free. The crashes reproduce unless §3 is fixed — but §3
  must be fixed for mobile Safari anyway, and every item is inside code we own.
- **B. React Native + `react-native-wgpu`.** Native memory budget and 120 Hz, but WebGPU-only rendering (no WebGL
  fallback on Android), full UI rewrite in RN primitives, and the shared React hooks would need a second host. This is a
  second client; the Feb 2026 attempt shows the cost curve. Not a port.
- **C. Tauri 2** (same WebView, Rust host for sync + signing). Only pays off if the WebContent-process JS heap is the
  binding constraint after measurement, because it moves RECS ingestion out of the WebView at the cost of an IPC bridge
  we would write ourselves. Cartridge does not document it.

**Chosen: A, with C as the named escalation** if Phase 0 shows WebContent memory (not GPU memory) is what kills the
process on target devices. B is out unless a WebGPU-first renderer migration is independently on the roadmap.

**Single codebase means:** the mobile app is `apps/game` built with a `mobile` lane flag, plus a thin
`apps/game/native/` (or `apps/mobile/`) holding `capacitor.config.ts`, the iOS/Android projects, and the handful of
native plugins. All game UI stays React DOM + Tailwind; mobile-specific layout is responsive components inside the same
feature folders, selected by a single `isMobileLane()` source of truth (replacing the UA regex at `ui/config.tsx:26`
with `navigator.maxTouchPoints` + viewport + Capacitor platform). No forked feature code.

**What the mobile app renders:** the same three.js world, on the WebGL2 lane, behind the Phase 0 gate. The fallback if a
device fails the gate is not a second app: it is the same shell with the 3D scene withheld and the already-touch-ready
hex minimap + tile inspector as the spatial surface (a "command" view — the `game-native/SCOPE.md` UX). That fallback is
also the low-end-Android answer.

---

## 7. Phases, each with a gate

### Phase 0 — Measure, then fix the renderer lane (POC, 2–3 weeks)

**Day 0, no code:** open
`https://play.realms.party/play/madara/<live-game>/map?spectate=true&rendererMode=webgpu-force-webgl` in mobile Safari
on an iPhone 13-class device and in Chrome on a mid-range Android (Pixel 7a / Galaxy A54 class), plus one iOS 26 device
with `webgpu-auto`. Record: did it boot, entry-ready time, first WebContent kill, fps at the close band. This
establishes the baseline the rest of the phase is measured against; it is the "has this changed" question answered in an
afternoon.

**Do:**

- Run `compress:models` across the whole library (KTX2 for all 107 GLBs, Draco or Meshopt, 480/768 px), and downsize the
  standalone PNGs (`worldmap-bg`, `attack`, `defense`, `lightning-bolt`). Self-host the DRACO decoder (delete the
  `gstatic.com` dependency). Re-measure resident texture bytes.
- Add a **mobile render profile**: pinned `webgpu-force-webgl` (skip the 3.2 s probe), `pixelRatio` 1.0, `shadowMapSize`
  512 or shadows off, `UnsignedByteType` output (exists), a new `mobile` row in `worldmap-content-ladder.ts` (far-band
  icons at mid distance, labels capped), lower fixed capacities (structures / armies / labels / FX pools sized from the
  game preset, not 1024/2048 constants), and a lower `MAX_POOLED_BYTES`.
- Replace `IS_MOBILE` (UA regex) with the single `isMobileLane()` source of truth; it must catch iPadOS and desktop-mode
  iOS.
- **Instrument memory where it actually works:** a Capacitor/native hook reporting `os_proc_available_memory` and
  counting `webViewWebContentProcessDidTerminate`, plus a `isContextLost()` poll and draw-call floor for silent
  GPU-process kills. Ship the result into `StatsRecorder` and Sentry so phone sessions are attributable.
- Replace the device-loss **page reload** with in-place renderer recreation; remove `setSize` from the frame-error path.
- Add a Save-Data / `connection.effectiveType` guard to `prefetch-play-assets.ts`, and `snapshotModels` subsetting for
  the mobile lane (drop models the phone HUD never reads).
- Extend `run-renderer-load-benchmark.mjs` with a device-lab target (a phone over WebDriver / Playwright on device) so
  the numbers are repeatable, not anecdotal.

**Gate:** on the iPhone 13-class and mid-range Android devices, spectate a live 96-player game for 10 minutes across all
three zoom bands with **zero WebContent or GPU-process terminations**, entry-ready ≤ 20 s on Wi-Fi, close-band p95 frame
≤ 50 ms, peak WebContent memory ≤ 700 MB. Record the numbers in this brief. If the gate fails on memory with GPU
residency already compressed, that is the trigger for option C; if it fails on frame time, the fix is the content ladder
and capacities, still inside A.

### Phase 1 — Touch input (1–2 weeks, can overlap Phase 0)

**Do:** `InputManager` on pointer events with a long-press → `contextmenu` mapping and a tap/drag threshold; re-enable
`MapControls.enableZoom` for pinch on the mobile lane (keep the wheel path on desktop); replace the hover-driven move
preview with tap-to-target → preview → confirm (the `actionPaths` data already exists; only the trigger changes); an
on-screen back affordance replacing `Escape` for leaving Hexception; per-panel `touch-action: pan-y` opt-ins; safe-area
insets on `TopHeader` and `HUD_COLUMN_TOP`; tooltips become tap-to-show / tap-outside-to-dismiss on coarse pointers.

**Gate:** on a phone, a spectator can pan, pinch, tap a hex, open its details, enter and leave the local scene; a
signed-in player can move, explore and attack with an army using only touch. No action in the game requires a keyboard
or a right mouse button.

### Phase 2 — Phone HUD layout (3–5 weeks)

**Do:** one responsive HUD shell inside `features/world`: bottom tab bar reusing the `MobileBottomNav` pattern (Command
/ Realm / Military / Trade / More per `game-native/SCOPE.md`), each `w-[1320px]` popover becomes a full-screen sheet on
the mobile lane (same component, layout switched by container, not a fork), right-column single slot kept,
`react-beautiful-dnd` replaced by tap-to-select + reorder, a Blitz-first scope (Eternum season-pass flows hidden on
mobile — see §8 store policy). The `SettlementPlannerMap` in `game-entry-modal.tsx` (4,558 lines) needs its own touch
pass; it is the first thing a new Blitz player touches.

**Gate:** a new player on a phone completes the Blitz loop end to end — sign in, register, settle, build, train,
explore, attack, trade — without a desktop. Playtest with three external phone users; every blocked step is a listed
defect.

### Phase 3 — Capacitor shell, identity, push (1–2 weeks)

**Do:** Capacitor 8 project (iOS 16+, Android minSdk 26) pointing at the `mobile`-lane build; Universal Links / App
Links on `play.realms.party/enter/*` and `/play/*` plus an `eternum://` scheme; sign-in in the system browser
(`@capacitor/browser` → the `apps/realms` sign-in page → redirect back with a short-lived token that the identity server
issues for the app origin; extend the loopback-only Bearer fallback in `packages/identity/src/client.ts:31-32` to the
Capacitor origin); gameplay key in Keychain/Keystore via a `StorageLike` backed by a secure-storage plugin;
`webViewWebContentProcessDidTerminate` handler that restores the last route; Sentry Capacitor SDK; push notifications
(new on both ends: device-token registration on the identity server and a notifier fed by Herald's global events —
Herald has no push today).

**Gate:** TestFlight and Play internal-track builds install, deep-link into a game from a realms.world link, sign in
once and stay signed in across restarts, and receive one push for "army under attack".

### Phase 4 — Store readiness (1 week + review time)

**Do:** app bundle ships no game art (all from the CDN; `public` is 527 MB); Blitz-only listing (free to enter, no
in-app token purchase, no NFT-gated feature visible — the Eternum season-pass gate is exactly Apple 3.1.1's "NFT
ownership unlocks functionality"); Google Play financial-features declaration; the Cartridge preset authorised for the
app's custom scheme if Controller is used for sign-in; delete the self-destroying PWA block.

**Gate:** approved on both stores.

---

## 8. Non-goals and explicit deletions

- No second client, no React Native, no revival of `eternum-mobile` or `game-native`. Their branches stay as history.
- No Cartridge `SessionProvider` / onchain session policies on mobile — the gameplay account already is the session.
- No PWA install path as a substitute for the store apps (the PWA is self-destroying and has no icons); if a PWA is
  wanted later it is a manifest fix, not a project.
- No WebGPU dependency on mobile until a device-lab measurement shows it beating WebGL2 on iOS 26.
- Deletions that come with the work: `wouter`, `react-draggable`, `public/gifs` from this app's deploy, `map/index.html`
  and `hex/index.html`, the `generate-pwa-assets` script, the UA-regex `IS_MOBILE`, the `gstatic.com` DRACO origin, the
  reload-on-device-loss path, and `performance.memory`-only monitoring.

---

## 9. Open questions

- UNCONFIRMED: WebGPU availability inside Android System WebView on target devices (sources conflict). Phase 0 tests
  `navigator.gpu` and records the answer per device.
- UNCONFIRMED: whether the WebContent-process kill on the Phase 0 devices is driven by JS heap or GPU residency. The
  instrumentation in Phase 0 exists to answer this; it decides whether option C is ever needed.
- UNCONFIRMED: the identity server's willingness to issue an app-origin Bearer token (today loopback only) — a small
  server change in `apps/realms/server`, to be confirmed with whoever owns it.
- UNCONFIRMED: Apple's read of a Blitz-only listing whose leaderboards and prizes are on-chain. Blob Arena's listing
  omits any blockchain mention; we should decide the same before submission.
- Whether Herald should gain a per-model **or per-area** subscription for the mobile lane. Model subsetting is enough
  for Phase 0; area scoping is a Herald feature request only if phone heap stays the limiter after that.

---

## 10. POC in one week, concretely

1. Day 0: the no-code phone test in §7 Phase 0 on three devices; write the numbers into this brief.
2. Days 1–2: `compress:models` over the full library + self-hosted DRACO; re-test.
3. Days 2–4: mobile render profile (force-webgl, DPR 1.0, mobile ladder row, lowered capacities) behind
   `isMobileLane()`; in-place device-loss recovery; native memory + `isContextLost()` telemetry into `StatsRecorder`.
4. Day 5: re-run the 10-minute spectate on all three devices; pass/fail against the Phase 0 gate.

If it passes, Phases 1–2 are UI work with no architectural risk left. If it fails, the failure mode is measured and
names the next move (ladder/capacities vs option C) rather than guessed.
