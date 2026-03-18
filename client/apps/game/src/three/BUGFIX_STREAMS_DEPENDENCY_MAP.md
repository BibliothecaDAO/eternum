# Bugfix Streams Dependency Map

Status: Draft
Date: 2026-03-19
Scope: `client/apps/game/src/three`

## Stream Index

| Stream | Document | Stages | Priority |
| --- | --- | --- | --- |
| A | `CHUNKING_STREAMING_BUGFIX_PRD_TDD.md` | 6 stages (0-5) | Critical |
| B | `RENDERER_BACKEND_BUGFIX_PRD_TDD.md` | 3 stages (0-2) | Critical |
| C | `SCENE_LIFECYCLE_BUGFIX_PRD_TDD.md` | 4 stages (0-3) | Important |
| D | `PERFORMANCE_HOTPATH_BUGFIX_PRD_TDD.md` | 4 stages (0-3) | Important |
| E | `RENDERER_REVIEW_V2_BUGFIX_PRD_TDD.md` | 5 stages (0-4) | Important |

## Cross-Stream Dependencies

```
Stream A (Chunking)          Stream B (Renderer)        Stream C (Scene Lifecycle)   Stream D (Performance)      Stream E (Renderer Review V2)
─────────────────           ─────────────────          ──────────────────────────    ──────────────────────      ─────────────────────────────

A.0 Transition Safety ──┐   B.0 PostProcess Parity     C.0 HexagonScene Leaks       D.0 Hover Hex CPU Waste     E.0 initScene Destroy Guard
    │                   │       (independent)               (independent)                (independent)                (independent)
    │                   │
    ├── A.1 Switch Path │   B.1 HDR Memory Leak        C.1 Hexception Subscriptions  D.1 Path Rebuild Throttle   E.1 Composer Pass Removal
    │   (depends A.0)   │       (independent)               (independent)                (independent)                (depends B.0 weakly)
    │                   │
    ├── A.2 Prewarm Fix │   B.2 Renderer Lifecycle     C.2 Worldmap Timer Cleanup    D.2 Allocation Reduction     E.2 Renderer Resource Disposal
    │   (depends A.0)   │       (independent)               (depends C.0 weakly)         (independent)                (depends C.0 weakly)
    │                   │
    ├── A.3 Catch-Up    │                              C.3 Manager Cleanup Order     D.3 Visual Correctness       E.3 WebGPU Weather Diagnostics
    │   (depends A.0)   │                                   (independent)                (independent)                (independent)
    │                   │
    ├── A.4 Cache Evict │
    │   (independent)   │                                                                                          E.4 Test Quality Improvements
    │                   │                                                                                              (depends E.0-E.3 weakly)
    └── A.5 Registration│
        (independent)   │
```

## Inter-Stream Dependencies

| Dependency | Reason |
| --- | --- |
| A.2 → B.0 (weak) | Prewarm correctness fix touches terrain preparation. If WebGPU post-process setSize is wrong, the prepared terrain may render at wrong resolution. Fix B.0 first for cleaner validation. |
| C.2 → A.0 (weak) | Worldmap timer cleanup (C.2) interacts with chunk transition timeouts. If transition settling can hang (A.0 unfixed), timer cleanup may not prevent all post-destroy callbacks. |
| D.0 → C.0 (none) | Both touch hexagon-scene-adjacent code but modify different files (hover-hex-material vs hexagon-scene). Can be done in parallel. |
| E.1 → B.0 (weak) | Both touch post-processing runtime ownership. Landing B.0 first gives cleaner parity expectations before validating composer pass removal behavior. |
| E.2 → C.0 (weak) | Both are disposal/lifecycle fixes. C.0 handles scene-owned resources; E.2 handles renderer-owned/shared resources. They are independent but should be validated together for teardown coverage. |
| E.4 → E.0-E.3 (weak) | The test-quality cleanup should target the final runtime behavior, not intermediate scaffolding. Safer after the stream's code stages land. |

## Recommended Execution Order

### Wave 1 — Safety and Correctness (no behavioral change)

Execute in parallel:

| Task | Stream | Impact |
| --- | --- | --- |
| A.0 Transition Safety Guards | Chunking | Prevents infinite loops and stack overflows |
| B.0 PostProcess Signature Parity | Renderer | Fixes silent size/tonemapping mismatch |
| C.0 HexagonScene Lifecycle Leaks | Scene | Stops post-destroy callbacks and GPU leaks |
| D.0 Hover Hex CPU Waste | Performance | Recovers ~1M CPU ops/sec |
| E.0 initScene Destroy Guard | Renderer Review V2 | Prevents dead renderer instances from reattaching canvas/listeners after teardown |

### Wave 2 — Critical Path and Memory Fixes

Execute in parallel (A.0 must be complete):

| Task | Stream | Impact |
| --- | --- | --- |
| A.1 Switch Path Redundancy | Chunking | Reduces chunk switch latency by removing double hydration wait |
| A.2 Prewarm Correctness | Chunking | Prevents stale terrain being cached and served |
| B.1 HDR Memory Leak | Renderer | Fixes GPU memory leak on error path |
| C.1 Hexception Subscriptions | Scene | Stops subscription accumulation |
| E.1 Composer Pass Removal | Renderer Review V2 | Restores library-managed post-process pass cleanup |
| E.2 Renderer Resource Disposal | Renderer Review V2 | Releases CSS2D/contact-shadow resources during destroy |

### Wave 3 — Throughput and Cleanup

Execute in parallel:

| Task | Stream | Impact |
| --- | --- | --- |
| A.3 Catch-Up Queue | Chunking | Reduces O(N) rescheduling latency under rapid traversal |
| A.4 Cache Eviction | Chunking | Eliminates wasted iterations on all-pinned caches |
| A.5 Registration Order | Chunking | O(1) chunk unregister instead of O(n) |
| B.2 Renderer Lifecycle | Renderer | Promise leak and null guard fixes |
| C.2 Worldmap Timer Cleanup | Scene | Prevents post-destroy timer callbacks |
| C.3 Manager Cleanup Order | Scene | Safer disposal ordering |
| E.3 WebGPU Weather Diagnostics | Renderer Review V2 | Adds visibility when WebGPU drops weather color grading |

### Wave 4 — Performance Polish and Test Quality

Execute in parallel:

| Task | Stream | Impact |
| --- | --- | --- |
| D.1 Path Rebuild Throttle | Performance | Reduces GC pressure during state changes |
| D.2 Allocation Reduction | Performance | Eliminates per-call Vector3 allocations and geometry leaks |
| D.3 Visual Correctness | Performance | Fixes thunderbolt flickering, FX color, sky darkening |
| E.4 Test Quality Improvements | Renderer Review V2 | Replaces weak source-scanning/no-op tests with behavioral coverage |

## Issue Count by Severity

| Severity | Count | Streams |
| --- | --- | --- |
| Critical (correctness/hang) | 7 | A (4), B (2), C (1) |
| Important (leak/perf) | 16 | A (3), B (2), C (6), D (1), E (4) |
| Medium (visual/polish) | 8 | C (1), D (5), E (2) |
| **Total** | **31** | |

## File Overlap Analysis

Files touched by multiple streams (coordination required):

| File | Streams | Stages |
| --- | --- | --- |
| `worldmap.tsx` | A, C | A.0-A.5, C.2 |
| `game-renderer.ts` | B, E | B.2, E.0, E.2 |
| `hexagon-scene.ts` | C, D (adjacent) | C.0, D.0 (different files but same scene) |
| `webgpu-postprocess-runtime.ts` | B, E | B.0, E.3 |

All other files are stream-exclusive — no merge conflicts expected when streams execute in parallel.

## Validation Strategy

After each wave completes:

1. Run full test suite: `pnpm --dir client/apps/game test`
2. Manual traversal test: sustained camera movement across 5+ chunk boundaries
3. Scene switch test: hexception → worldmap → hexception cycle 3 times
4. Memory snapshot: compare heap before/after 10-minute play session
5. Performance profile: confirm no new frame-time regressions
6. Renderer teardown check: mount/unmount cycle confirms no stale canvas, label nodes, or shared contact-shadow retention
7. Priority test audit: confirm Stream E Stage 4 files no longer depend on `readFileSync` source scans or pure no-op assertions
