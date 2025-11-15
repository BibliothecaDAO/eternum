Current Situation

- Every place that needs Torii data imports @dojoengine/torii-wasm directly, instantiates a client, and runs queries on
  the main thread. When streams fire (e.g., onEntityUpdated) or when chunks are fetched (getMapFromToriiExact), the work
  hits React’s main thread immediately.
- Each UI hook (army detail, transfer dialog, quest modal, etc.) repeats similar queries, so we do redundant WASM
  deserialization and state merges without any shared cache.
- Bootstrap (initialSync) awaits large serial queries (banks → spectator realm → config → address names → guilds → map),
  partially because everything runs synchronously in JS.

Worker-Based Torii Access Layer

1. Dedicated Worker - Create torii-client.worker.ts that imports @dojoengine/ torii-wasm, initializes the Torii client
   once, and keeps the setEntities/mergeDeep logic inside the worker. - Expose a typed API via Comlink (or postMessage
   manually) with methods like init(config), subscribeEntities(clause), fetchStructures(ids), fetchMapChunk(bounds),
   fetchBanks(), etc. - The worker owns the canonical cache of decoded models (entities, map tiles, armies, structures).
   It can use the same setEntities helper but without blocking the UI thread. - The worker owns the canonical cache of
   decoded models (entities, map tiles, armies, structures). It can use the same setEntities helper but without blocking
   the UI thread.
2. Main-Thread Gateway - Replace direct imports of @dojoengine/torii-wasm with a thin toriiClientProxy.ts that
   instantiates the worker (one per tab) and exposes async functions returning promises. - Provide selectors (e.g.,
   useToriiSelector((state) => state.structures[id])) that talk to the proxy; the proxy resolves from the worker cache
   so repeated queries hit memory, not Torii.
3. Streaming Without Jank - The worker listens to onEntityUpdated/onEventMessageUpdated, batches/merges them, and sends
   diff summaries to the main thread (e.g., { component: 'Structure', updatedIds: [...] }). - React stores (Zustand
   slices) receive small messages (IDs

- derived metadata) instead of whole entity objects, dramatically reducing GC and re-render pressure.

4.  Parallel Bootstrap - Because the worker hides Torii/WASM latency, initialSync can request banks, spectator realms,
    config, address names, guilds, and soon as data arrives, while the UI just awaits aggregated promises. - Map chunk
    fetches (getMapFromToriiExact) move off the MapControls handler: the main thread requests chunk (r,c), the worker
    streams the result back, and Three.js updates happen when the data is ready, instead of blocking the camera event.
5.  Data Shapes & Caching - The worker can maintain normalized maps keyed by hashed entity IDs; the proxy exposes
    helpers like getStructure(id) returning a lightweight DTO. Hooks such as useStructureEntityDetail subscribe to these
    DTOs (e.g., via useSyncExternalStore), so repeated panels reuse the same underlying data. player revisits a region,
    the worker responds immediately without hitting Torii again.

Benefits

- Main-thread relief: All expensive WASM parsing, queue batching, and setEntities work moves off the UI thread. React,
  Three.js, and input handling stay responsive even when Torii floods updates or when a chunk fetch returns thousands of
  tiles.
- Deterministic data flow: Only the worker touches Torii/WASM; UI components talk to a clear async API, which makes
  testing and memoizing significantly easier.
- Shared cache & dedupe: Army panels, transfer modals, and overlays reuse the same worker-managed entities, so we stop
  refetching the merging, Promise.all at bootstrap becomes safe and straightforward, shrinking the “world loading”
  window.
- Better DX: The worker isolates Torii/WASM reloads, reducing HMR flakiness (hot updates no longer blow away WASM state
  on the main thread).

Implementation Outline

1. Build torii-client.worker.ts: - Accept init payload (torii URL, manifest, etc.). - Instantiate Torii client, wrap
   setEntities, keep caches (structures, armies, mapChunks, etc.). - Implement RPC handlers for subscribe, fetch,
   clearCache, etc. - Implement RPC handlers for subscribe, fetch, clearCache, etc.
2. Add toriiClientProxy.ts: - Uses Comlink (or a custom RPC shim) to talk to the worker. - Provides typed functions and
   subscription helpers (e.g., subscribe('structures', cb)).
3. Update bootstrap & hooks: - bootstrapGame awaits toriiProxy.init() then kicks off parallel fetches. - Hooks replace
   direct Torii imports with proxy calls/selectors. - Zustand slices subscribe to worker notifications instead of
   rewriting large arrays per poll.
4. Gradually migrate features: - Start with map chunking + entity stream. - Move expensive panels (army/structure
   detail) next. - Finally, port remaining Torii touches (transfer modals, quest screens, etc.).

This architecture decouples heavy Torii/WASM operations from React, keeps data consistent, and sets the foundation for
future optimizations (e.g., SharedArrayBuffers for massive map data, prioritized tasks, better offline caching).
