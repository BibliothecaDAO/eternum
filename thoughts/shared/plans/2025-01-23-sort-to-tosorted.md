# Implementation Plan: Replace .sort() with .toSorted()

**Issue:** #4076 **Branch:** `ponderingdemocritus/issue-4076-impl` **Created:** 2025-01-23

## Summary

Replace all 164 occurrences of `.sort()` across 106 files with `.toSorted()` to prevent array mutation bugs and broken
memoization in React.

## Problem

`.sort()` mutates arrays in place, causing:

- Stale closure bugs in React
- Broken `useMemo`/`useCallback` memoization
- Hard-to-debug re-render issues
- Unpredictable behavior when sorting props/state

## Scope Analysis

### Total Occurrences by Area

| Area                           | Files | Occurrences |
| ------------------------------ | ----- | ----------- |
| `client/apps/game/`            | 63    | ~110        |
| `client/apps/landing/`         | 11    | ~20         |
| `client/apps/eternum-mobile/`  | 7     | ~10         |
| `client/apps/game-docs/`       | 4     | ~9          |
| `client/apps/realtime-server/` | 2     | ~2          |
| `packages/core/`               | 2     | ~3          |
| `packages/react/`              | 1     | ~1          |
| `packages/torii/`              | 2     | ~2          |
| `scripts/`                     | 1     | ~1          |

### Pattern Categories

1. **Spread-then-sort (26 occurrences)** - Already safe but verbose:

   ```typescript
   // Current - works but verbose
   const sorted = [...arr].sort((a, b) => a - b);

   // Replace with
   const sorted = arr.toSorted((a, b) => a - b);
   ```

2. **In-place mutation (majority)** - Bug-prone:

   ```typescript
   // Current - mutates original array!
   items.sort((a, b) => a.name.localeCompare(b.name));

   // Replace with
   const sorted = items.toSorted((a, b) => a.name.localeCompare(b.name));
   ```

3. **Mutation for side effect** - Rare, intentional mutation:

   ```typescript
   // Current - sorts array for ordering only
   participants.sort();

   // Replace with reassignment
   const sortedParticipants = participants.toSorted();
   ```

---

## Implementation Phases

### Phase 1: High-Impact Game Client Files

**Target:** `client/apps/game/src/ui/features/`

Key files (4+ occurrences):

- `bridge/bridge.tsx` (4)
- `world-selector/world-selector-modal.tsx` (4)
- `landing/sections/markets/use-market-stats.ts` (4)
- `social/realtime-chat/model/store.ts` (6)
- `progression/onboarding/blitz/factory/FactoryGamesList.tsx` (3)
- `economy/resources/inventory-resources.tsx` (3)
- `economy/transfers/transfer-automation-panel.tsx` (3)
- `military/components/transfer-troops-container.tsx` (3)

**Files:** ~35 **Occurrences:** ~70

### Phase 2: Remaining Game Client

**Target:** `client/apps/game/src/` (excluding ui/features)

Key areas:

- `three/managers/` (army-manager, path-renderer, etc.)
- `pm/hooks/markets/`
- `hooks/`
- `utils/`
- `audio/`

**Files:** ~15 **Occurrences:** ~25

### Phase 3: Landing & Mobile Apps

**Target:** `client/apps/landing/`, `client/apps/eternum-mobile/`

Landing key files:

- `hooks/services/index.ts` (2)
- `components/modules/trait-filter-ui.tsx` (3)
- `components/modules/chest-opening/chest-selection-modal.tsx` (3)

Mobile key files:

- `widgets/hex-entity-details-drawer/ui/army-entity-detail.tsx` (2)

**Files:** ~18 **Occurrences:** ~30

### Phase 4: Packages & Supporting Code

**Target:** `packages/`, `client/apps/game-docs/`, `client/apps/realtime-server/`, `scripts/`

Package files:

- `packages/core/src/managers/leaderboard-manager.ts` (2)
- `packages/core/src/managers/army-action-manager.ts` (1)
- `packages/react/src/hooks/helpers/use-structures.ts` (1)
- `packages/torii/src/queries/sql/*.ts` (2)

**Files:** ~10 **Occurrences:** ~15

### Phase 5: ESLint Rule & Verification

Add ESLint rule to prevent future `.sort()` usage:

**File:** `client/apps/game/eslint.config.js` (and other app configs)

```javascript
// Add to rules section
rules: {
  // ... existing rules
  "no-restricted-syntax": [
    "error",
    {
      selector: "CallExpression[callee.property.name='sort']",
      message: "Use .toSorted() instead of .sort() to avoid array mutation. See issue #4076."
    }
  ],
}
```

---

## Transformation Patterns

### Pattern A: Spread-then-sort to toSorted

```typescript
// Before
const sorted = [...items].sort((a, b) => a.value - b.value);

// After
const sorted = items.toSorted((a, b) => a.value - b.value);
```

### Pattern B: In-place sort to toSorted with reassignment

```typescript
// Before
myArray.sort((a, b) => a - b);
// myArray is now mutated

// After
const sortedArray = myArray.toSorted((a, b) => a - b);
// Use sortedArray instead
```

### Pattern C: Sort in return statement

```typescript
// Before
return items.sort((a, b) => a.name.localeCompare(b.name));

// After
return items.toSorted((a, b) => a.name.localeCompare(b.name));
```

### Pattern D: Chained operations

```typescript
// Before
return items.filter((x) => x.active).sort((a, b) => a.priority - b.priority);

// After
return items.filter((x) => x.active).toSorted((a, b) => a.priority - b.priority);
```

---

## Testing Strategy

1. **Lint verification:**

   ```bash
   pnpm --dir client/apps/game lint
   pnpm --dir client/apps/landing lint
   pnpm --dir client/apps/eternum-mobile lint
   ```

2. **Type checking:**

   ```bash
   pnpm --dir client/apps/game tsc --noEmit
   ```

3. **Build verification:**

   ```bash
   pnpm build
   ```

4. **Manual verification:** Spot-check UI components that display sorted data (leaderboards, markets, resource lists)

---

## Browser Support

`.toSorted()` is supported in:

- Chrome 110+ (March 2023)
- Safari 16+ (September 2022)
- Firefox 115+ (July 2023)
- Node.js 20+

Given the game client targets modern browsers, this is safe to use.

---

## Risk Assessment

| Risk                         | Likelihood | Impact | Mitigation                           |
| ---------------------------- | ---------- | ------ | ------------------------------------ |
| Behavioral regression        | Low        | Medium | Preserve exact sort comparison logic |
| Variable reassignment issues | Low        | Low    | Review mutation patterns carefully   |
| Build failures               | Very Low   | Low    | TypeScript will catch type errors    |

---

## Acceptance Criteria

- [ ] Phase 1: Replace .sort() in high-impact game client files (~70 occurrences)
- [ ] Phase 2: Replace .sort() in remaining game client (~25 occurrences)
- [ ] Phase 3: Replace .sort() in landing & mobile apps (~30 occurrences)
- [ ] Phase 4: Replace .sort() in packages & supporting code (~15 occurrences)
- [ ] Phase 5: Add ESLint rule to all app configs
- [ ] All lint checks pass
- [ ] Build succeeds
- [ ] No behavioral regressions in sorting logic

---

## Notes

- Some files use spread-then-sort (`[...arr].sort()`) which is already safe but verbose; simplify to `toSorted()`
- Pay attention to files where sorted result is used for side effects (e.g., `participants.sort()` at line 85 in
  store.ts)
- The `store.ts` file has 6 occurrences - careful review needed for Zustand state mutations
