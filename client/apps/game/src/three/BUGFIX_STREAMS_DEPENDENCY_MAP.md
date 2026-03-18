# Bugfix Streams Dependency Map

Status: Draft
Date: 2026-03-18
Scope: `client/apps/game/src/three`

## Stream Index

| Stream | Document | Stages | Priority |
| --- | --- | --- | --- |
| A | `CHUNKING_STREAMING_BUGFIX_PRD_TDD.md` | 6 stages (0-5) | Critical |
| B | `RENDERER_BACKEND_BUGFIX_PRD_TDD.md` | 3 stages (0-2) | Critical |
| C | `SCENE_LIFECYCLE_BUGFIX_PRD_TDD.md` | 4 stages (0-3) | Important |
| D | `PERFORMANCE_HOTPATH_BUGFIX_PRD_TDD.md` | 4 stages (0-3) | Important |

## Cross-Stream Dependencies

```
Stream A (Chunking)          Stream B (Renderer)        Stream C (Scene Lifecycle)   Stream D (Performance)
─────────────────           ─────────────────          ──────────────────────────    ──────────────────────

A.0 Transition Safety ──┐   B.0 PostProcess Parity     C.0 HexagonScene Leaks       D.0 Hover Hex CPU Waste
    │                   │       (independent)               (independent)                (independent)
    │                   │
    ├── A.1 Switch Path │   B.1 HDR Memory Leak        C.1 Hexception Subscriptions  D.1 Path Rebuild Throttle
    │   (depends A.0)   │       (independent)               (independent)                (independent)
    │                   │
    ├── A.2 Prewarm Fix │   B.2 Renderer Lifecycle     C.2 Worldmap Timer Cleanup    D.2 Allocation Reduction
    │   (depends A.0)   │       (independent)               (depends C.0 weakly)         (independent)
    │                   │
    ├── A.3 Catch-Up    │                              C.3 Manager Cleanup Order     D.3 Visual Correctness
    │   (depends A.0)   │                                   (independent)                (independent)
    │                   │
    ├── A.4 Cache Evict │
    │   (independent)   │
    │                   │
    └── A.5 Registration│
        (independent)   │
```

## Inter-Stream Dependencies

| Dependency | Reason |
| --- | --- |
| A.2 → B.0 (weak) | Prewarm correctness fix touches terrain preparation. If WebGPU post-process setSize is wrong, the prepared terrain may render at wrong resolution. Fix B.0 first for cleaner validation. |
| C.2 → A.0 (weak) | Worldmap timer cleanup (C.2) interacts with chunk transition timeouts. If transition settling can hang (A.0 unfixed), timer cleanup may not prevent all post-destroy callbacks. |
| D.0 → C.0 (none) | Both touch hexagon-scene-adjacent code but modify different files (hover-hex-material vs hexagon-scene). Can be done in parallel. |

## Recommended Execution Order

### Wave 1 — Safety and Correctness (no behavioral change)

Execute in parallel:

| Task | Stream | Impact |
| --- | --- | --- |
| A.0 Transition Safety Guards | Chunking | Prevents infinite loops and stack overflows |
| B.0 PostProcess Signature Parity | Renderer | Fixes silent size/tonemapping mismatch |
| C.0 HexagonScene Lifecycle Leaks | Scene | Stops post-destroy callbacks and GPU leaks |
| D.0 Hover Hex CPU Waste | Performance | Recovers ~1M CPU ops/sec |

### Wave 2 — Critical Path and Memory Fixes

Execute in parallel (A.0 must be complete):

| Task | Stream | Impact |
| --- | --- | --- |
| A.1 Switch Path Redundancy | Chunking | Reduces chunk switch latency by removing double hydration wait |
| A.2 Prewarm Correctness | Chunking | Prevents stale terrain being cached and served |
| B.1 HDR Memory Leak | Renderer | Fixes GPU memory leak on error path |
| C.1 Hexception Subscriptions | Scene | Stops subscription accumulation |

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

### Wave 4 — Performance Polish

Execute in parallel:

| Task | Stream | Impact |
| --- | --- | --- |
| D.1 Path Rebuild Throttle | Performance | Reduces GC pressure during state changes |
| D.2 Allocation Reduction | Performance | Eliminates per-call Vector3 allocations and geometry leaks |
| D.3 Visual Correctness | Performance | Fixes thunderbolt flickering, FX color, sky darkening |

## Issue Count by Severity

| Severity | Count | Streams |
| --- | --- | --- |
| Critical (correctness/hang) | 7 | A (4), B (2), C (1) |
| Important (leak/perf) | 12 | A (3), B (2), C (6), D (1) |
| Medium (visual/polish) | 6 | C (1), D (5) |
| **Total** | **25** | |

## File Overlap Analysis

Files touched by multiple streams (coordination required):

| File | Streams | Stages |
| --- | --- | --- |
| `worldmap.tsx` | A, C | A.0-A.5, C.2 |
| `hexagon-scene.ts` | C, D (adjacent) | C.0, D.0 (different files but same scene) |

All other files are stream-exclusive — no merge conflicts expected when streams execute in parallel.

## Validation Strategy

After each wave completes:

1. Run full test suite: `pnpm --dir client/apps/game test`
2. Manual traversal test: sustained camera movement across 5+ chunk boundaries
3. Scene switch test: hexception → worldmap → hexception cycle 3 times
4. Memory snapshot: compare heap before/after 10-minute play session
5. Performance profile: confirm no new frame-time regressions
