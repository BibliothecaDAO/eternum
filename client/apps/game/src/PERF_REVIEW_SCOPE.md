## Scope

- Target area: `client/apps/game/src` with focus on React UI + realtime WebGL integration.
- Hot paths analyzed: frame loop, input/hover, minimap, chat, labels, instanced animation updates.
- Evidence sources: code review of `three/*`, `ui/*`, `hooks/*`, and existing `three/PERF_AUDIT.md`.

## Hot Path Map

- Per-frame loop: `three/game-renderer.ts` -> `WorldmapScene.update()` / `HexceptionScene.update()` + HUD render.
- Per-frame data updates in Three: `three/managers/instanced-model.tsx`, `three/managers/instanced-biome.tsx`,
  `three/managers/army-manager.ts`, CSS2D label renderer.
- UI driven by camera changes: `three/scenes/worldmap.tsx` updates `useUIStore` ->
  `ui/features/world/components/bottom-right-panel/hex-minimap.tsx`.
- Frequent input handlers: `three/scenes/hexagon-scene.ts` mousemove, tooltip mousemove listeners.
- Chat list computation: `ui/features/social/chat/chat.tsx` (filter/sort/group users/messages).

## Issues And Fix Plan

### 1) Chat unread total is O(u\*n)

- Location: `ui/features/social/chat/chat.tsx:500`
- Issue: `Object.entries(unreadMessages)` reduces and each entry scans all users with
  `[...onlineUsers, ...offlineUsers].some(...)`. This becomes O(u\*n) per unread update (u = unread map size, n = total
  users).
- Why it hurts: On active chat sessions with large user lists, unread updates become long tasks and cause UI jank.
- Fix plan:
  - Build a `Set` of user IDs once per user list update and do `set.has(userId)` in the reduce.
  - Optional: Track unread totals incrementally inside the chat store to avoid repeated scans.
- Expected impact: Reduce unread computation to O(u) and remove repeated allocations.
- Risk: Must update the `Set` when online/offline lists change to avoid stale counts.

### 2) Message sorting and grouping are O(m log m) per update

- Location: `ui/features/social/chat/chat.tsx:233-251`
- Issue: Each new message re-sorts the entire filtered list and re-groups by sender.
- Why it hurts: At large histories (1k-10k+ messages), every incoming message triggers expensive re-sorts and
  allocations.
- Fix plan:
  - Maintain sorted order in the store: append if timestamps are monotonic or binary-insert on out-of-order messages.
  - Virtualize message rendering to avoid large DOM updates.
  - Cap history in memory where appropriate (e.g., last 1-2k messages).
- Expected impact: Reduce per-message work to O(log m) or O(1) for common cases; lower GC churn.
- Risk: Additional store complexity; must handle late messages correctly.

### 3) Multiple user lists are sorted repeatedly per update

- Location: `ui/features/social/chat/chat.tsx:557-616`
- Issue: online/offline users are filtered and sorted multiple times for different sections.
- Why it hurts: O(n log n) sorts repeated several times per update, causing CPU spikes when user presence changes or
  unread counts update.
- Fix plan:
  - Compute a single ranked list by priority (pinned, unread, alpha) once.
  - Partition the ranked list into sections without re-sorting.
- Expected impact: Reduce repeated sort/alloc work.
- Risk: Ordering logic must preserve existing UX.

### 4) Camera -> UI store updates run ~30 fps and fan out to React

- Location: `three/scenes/worldmap.tsx:203-219`, `three/scenes/worldmap.tsx:3692-3702`
- Issue: `useUIStore.setState` updates `cameraTargetHex`/`cameraDistance` at ~30 fps while panning/zooming, invalidating
  React subscribers.
- Why it hurts: Triggers frequent React renders and secondary work like minimap calculations.
- Fix plan:
  - Move camera updates to a lightweight store or a direct subscription used only by minimap.
  - Update only when minimap is visible.
  - Increase thresholds (delta distance/hex change) to reduce update rate.
- Expected impact: Reduce UI re-render pressure during camera movement.
- Risk: Minimap may lag if throttling is too aggressive.

### 5) Minimap index build is O(t) and visible tile scan is O(v)

- Location: `ui/features/world/components/bottom-right-panel/hex-minimap.tsx:135-176` and `:382-425`
- Issue: `buildCenteredIndex` allocates points and bounds for every tile; visible tile filtering runs every view update.
- Why it hurts: Large tile sets create heavy CPU and GC load during panning/zooming.
- Fix plan:
  - Cache points/bounds in typed arrays or memoize per tile id; avoid rebuilding when tile data is unchanged.
  - Move minimap rendering to canvas/WebGL to avoid heavy SVG DOM updates.
  - Gate updates when minimap is hidden.
- Expected impact: Lower per-frame CPU and DOM overhead.
- Risk: Canvas-based rendering reduces DOM accessibility and requires new draw pipeline.

### 6) Tooltip mousemove handler does layout reads + writes

- Location: `ui/design-system/molecules/base-three-tooltip.tsx:27-88`
- Issue: Every mousemove does `offsetHeight` read then writes `style.left/top`, plus state updates for `isAboveMouse`
  and `canShow`.
- Why it hurts: Potential layout thrash and unnecessary React re-renders.
- Fix plan:
  - Cache tooltip height on mount/resize.
  - Move positioning to `requestAnimationFrame` and use `transform: translate3d`.
  - Only call `setIsAboveMouse`/`setCanShow` when the value changes.
- Expected impact: Less layout thrash and reduced render frequency on pointer move.
- Risk: Must keep tooltip position accurate on resize/scroll.

### 7) Per-card 100ms polling interval in cosmetic viewer

- Location: `ui/features/landing/cosmetics/components/cosmetic-model-viewer.tsx:254-260`
- Issue: `setInterval` checks for animation start even when idle; a grid of cards scales this into many timers.
- Why it hurts: Idle CPU wakeups and unnecessary work, especially on low-end devices.
- Fix plan:
  - Start/stop RAF in an effect keyed to `shouldAnimate` instead of polling.
  - Consider a shared RAF scheduler for all viewer instances.
  - Remove `preserveDrawingBuffer` unless required.
- Expected impact: Reduced idle CPU and smoother scrolling in cosmetics grids.
- Risk: Must ensure hover/auto-rotate transitions still start animation promptly.

### 8) CSS2D label rendering is heavy at high label counts

- Location: `three/game-renderer.ts:949-965`
- Issue: CSS2DRenderer updates DOM for both world and HUD; scale with label count.
- Why it hurts: DOM layout/paint costs can dominate main thread during dense scenes.
- Fix plan:
  - Render labels only when camera/labels are dirty.
  - Decimate label updates when zoomed out.
  - Consider sprite/instanced labels for dense scenes.
- Expected impact: Lower CPU time and smoother camera motion.
- Risk: Label lag or slight staleness if throttled too hard.

### 9) Instanced animation updates scale with instance counts

- Location: `three/managers/instanced-model.tsx:398`, `three/managers/instanced-biome.tsx:386`
- Issue: O(n) per update for animated instances with morph texture updates.
- Why it hurts: Large battles or dense chunks can push frame time beyond budget.
- Fix plan:
  - Increase bucket stride and interval at higher instance counts.
  - Gate animations by visibility/distance.
  - Add stronger animation LOD tiers for large counts.
- Expected impact: Stable frame time at high instance counts.
- Risk: Animation popping or reduced fidelity at lower tiers.

## Proposed Fix Order

1. Chat unread total (O(u\*n)) and message sorting (O(m log m)) fixes.
2. Camera -> UI store decoupling for minimap.
3. Tooltip layout/paint reduction.
4. Cosmetic viewer interval removal.
5. Minimap rendering improvements.
6. CSS2D label update gating + instanced animation LODs.

## Validation Plan

- React DevTools Profiler: measure commit times for chat updates and minimap pan.
- Chrome Performance: verify no long tasks during camera pan or chat bursts.
- Memory panel: watch allocations during minimap movement and chat updates.
- Add `performance.mark/measure` around chat sorts, minimap visible tile calculation, CSS2D label renders, and instanced
  animation updates.

## Assumptions

- Chat user lists and message histories can reach hundreds to thousands of items.
- Minimap tile counts can be in the thousands at wide zoom levels.
- Label counts can exceed 100-300 in busy scenes.
