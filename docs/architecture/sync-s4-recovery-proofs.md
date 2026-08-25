# Sync S4 recovery proofs

S4 deletes compensating stores and fetches only after each recovery guarantee has a repeatable proof. Current entity
facts remain owned by RECS; `WorldSpatialProjection` is a rebuildable spatial index over that state, not a second truth
store.

| Recovery guarantee                                                         | Automated proof                                                                                                                                                                                           |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An offscreen deletion is absent when the camera later reaches that area.   | `WorldSpatialProjection > does not return an offscreen deletion when its bounds are queried later`                                                                                                        |
| An army that moves offscreen renders at its destination only.              | `WorldSpatialProjection > returns an offscreen army at its destination only after it moves`                                                                                                               |
| Connection loss during snapshot pagination converges on the next recovery. | `GameSyncRuntime recovery > reruns the same recovery after a connection loss during pagination`                                                                                                           |
| Switching games while updates are buffered applies no old-game state.      | `GameSyncRuntime recovery > rejects buffered updates from the previous game when the active game changes`                                                                                                 |
| Stale callbacks and writers from a destroyed generation are fenced.        | `GameSyncRuntime recovery > fences callbacks and late writers from a superseded generation`                                                                                                               |
| Event effects do not fire twice across recovery.                           | `GameSyncRuntime recovery > deduplicates event effects across recovery without snapshotting event rows`                                                                                                   |
| A snapshot larger than one page hydrates completely.                       | `GameSyncRuntime recovery > activates subscriptions before hydrating every snapshot page`                                                                                                                 |
| Pending movement expires without transaction confirmation.                 | `resolvePendingArmyMovementFallbackPlan > clears stale movement after visual handoff when resolution never arrives` and `> clears stale movement and requests refresh when fallback threshold is reached` |
| Camera movement performs zero Torii calls.                                 | `worldmap camera movement performs zero Torii fetches > syncs visible terrain from the in-memory projection` and `> has no remaining exact spatial query helper for camera-driven reads`                  |

The three live acceptance behaviors remain owner-attested playtest gates: mutate an offscreen entity and pan to it, kill
the connection for 30 seconds and restore it, and hard-reload during active play. The repeatable headless smoke remains
`pnpm --dir apps/game smoke:game-sync-headless`.
