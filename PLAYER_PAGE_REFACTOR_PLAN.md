# Player Page Refactoring Plan

## Current Issues
- **554 lines** in a single component file
- Mixed concerns: account management, avatar, leaderboard, sharing, clipboard operations
- Difficult to test individual features
- Hard to maintain and reason about
- Duplicated logic between hooks (userName vs accountName)
- Multiple loading states not clearly separated

## Refactoring Strategy

### Phase 1: Extract Custom Hooks

#### 1.1 `useCartridgeUsername` Hook
**Location**: `src/hooks/use-cartridge-username.tsx`
**Purpose**: Consolidate the username loading logic from Cartridge controller
**Extracted from**: Lines 61-70
**Returns**:
```typescript
{
  username: string | undefined;
  isLoading: boolean;
  address: string | undefined;
}
```

#### 1.2 `usePlayerAccount` Hook
**Location**: `src/hooks/use-player-account.tsx`
**Purpose**: Unified player account information
**Combines**: Zustand account store + Cartridge username hook
**Returns**:
```typescript
{
  playerAddress: string | null;
  normalizedAddress: string | null;
  accountName: string | undefined;
  isAccountLoading: boolean;
}
```

#### 1.3 `useAvatarManagement` Hook
**Location**: `src/hooks/use-avatar-management.tsx`
**Purpose**: All avatar-related state and operations
**Extracted from**: Lines 72-78, 292-326
**Returns**:
```typescript
{
  // State
  avatarPrompt: string;
  setAvatarPrompt: (prompt: string) => void;
  showAvatarSection: boolean;
  setShowAvatarSection: (show: boolean) => void;

  // Data
  myAvatar: PlayerProfile | null;
  isLoadingAvatar: boolean;
  isLoadingAvatarOrAccount: boolean;
  currentAvatarUrl: string;
  hasCustomAvatar: boolean;

  // Actions
  handleGenerateAvatar: () => Promise<void>;
  handleDeleteAvatar: () => Promise<void>;
  generateAvatar: UseMutationResult;
  deleteAvatar: UseMutationResult;
}
```

#### 1.4 `usePlayerLeaderboard` Hook
**Location**: `src/hooks/use-player-leaderboard.tsx`
**Purpose**: All leaderboard data and derived state
**Extracted from**: Lines 80-108, 130-155
**Returns**:
```typescript
{
  // Raw data
  championEntry: LandingLeaderboardEntry | null;
  playerEntry: LandingLeaderboardEntry | null;

  // Loading/error states
  isLeaderboardFetching: boolean;
  isPlayerLoading: boolean;
  playerError: string | null;

  // Derived data
  highlightPlayer: BlitzHighlightPlayer | null;
  championLabel: string | null;
  statusMessage: string | null;

  // Fetch functions
  fetchLeaderboard: () => void;
  fetchPlayerEntry: (address: string) => void;

  // Timestamps for cooldown
  lastLeaderboardFetchAt: number | null;
  playerLastFetchAt: number | null;
}
```

#### 1.5 `useRefreshCooldown` Hook
**Location**: `src/hooks/use-refresh-cooldown.tsx`
**Purpose**: Refresh cooldown timer logic
**Extracted from**: Lines 89-91, 110-128, 169-182
**Parameters**: `timestamps: (number | null)[]`
**Returns**:
```typescript
{
  cooldownMs: number;
  isCooldownActive: boolean;
  refreshSecondsLeft: number;
}
```

#### 1.6 `useBlitzSharing` Hook
**Location**: `src/hooks/use-blitz-sharing.tsx`
**Purpose**: All sharing/export functionality
**Extracted from**: Lines 89-90, 159-167, 184-290
**Parameters**: `highlightPlayer: BlitzHighlightPlayer | null, cardRef: RefObject<HTMLDivElement>`
**Returns**:
```typescript
{
  shareMessage: string;
  isCopyingImage: boolean;
  handleShareOnX: () => void;
  handleCopyImage: () => Promise<void>;
  handleCopyMessage: () => Promise<void>;
}
```

### Phase 2: Extract UI Components

#### 2.1 `AvatarManagementSection` Component
**Location**: `src/ui/features/landing/components/avatar-management-section.tsx`
**Props**:
```typescript
{
  playerAddress: string | null;
  showSection: boolean;
  onToggleSection: (show: boolean) => void;
  avatarState: ReturnType<typeof useAvatarManagement>;
}
```
**Extracted from**: Lines 330-431

#### 2.2 `LeaderboardRefreshControls` Component
**Location**: `src/ui/features/landing/components/leaderboard-refresh-controls.tsx`
**Props**:
```typescript
{
  isRefreshing: boolean;
  isCooldownActive: boolean;
  refreshSecondsLeft: number;
  onRefresh: () => void;
}
```
**Extracted from**: Repeated pattern in lines 443-458, 466-481, 492-507

#### 2.3 `LeaderboardLoadingState` Component
**Location**: `src/ui/features/landing/components/leaderboard-loading-state.tsx`
**Props**: None (just skeleton UI)
**Extracted from**: Lines 433-437

#### 2.4 `LeaderboardErrorState` Component
**Location**: `src/ui/features/landing/components/leaderboard-error-state.tsx`
**Props**:
```typescript
{
  error: string;
  refreshControls: ReactNode;
}
```
**Extracted from**: Lines 438-460

#### 2.5 `LeaderboardEmptyState` Component
**Location**: `src/ui/features/landing/components/leaderboard-empty-state.tsx`
**Props**:
```typescript
{
  statusMessage: string;
  refreshControls: ReactNode;
}
```
**Extracted from**: Lines 461-484

#### 2.6 `BlitzHighlightCard` Component
**Location**: `src/ui/features/landing/components/blitz-highlight-card-container.tsx`
**Props**:
```typescript
{
  highlightPlayer: BlitzHighlightPlayer | null;
  championLabel: string | null;
  cardRef: RefObject<HTMLDivElement>;
}
```
**Extracted from**: Lines 512-527

#### 2.7 `BlitzShareActions` Component
**Location**: `src/ui/features/landing/components/blitz-share-actions.tsx`
**Props**:
```typescript
{
  highlightPlayer: BlitzHighlightPlayer | null;
  isCopyingImage: boolean;
  onCopyImage: () => Promise<void>;
  onShareOnX: () => void;
  onCopyMessage: () => Promise<void>;
}
```
**Extracted from**: Lines 529-560

### Phase 3: Final Component Structure

#### Main Component: `LandingPlayer`
**Final size**: ~100-150 lines
**Responsibilities**:
- Compose all hooks
- Render layout container
- Conditionally render UI states
- Pass data/handlers to child components

**Structure**:
```typescript
export const LandingPlayer = () => {
  // Hook composition
  const account = usePlayerAccount();
  const avatar = useAvatarManagement(account.playerAddress, account.accountName);
  const leaderboard = usePlayerLeaderboard(account.normalizedAddress);
  const cooldown = useRefreshCooldown([
    leaderboard.lastLeaderboardFetchAt,
    leaderboard.playerLastFetchAt
  ]);
  const sharing = useBlitzSharing(leaderboard.highlightPlayer, cardRef);

  const cardRef = useRef<HTMLDivElement>(null);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    if (cooldown.isCooldownActive) return;
    leaderboard.fetchLeaderboard();
    if (account.playerAddress) {
      leaderboard.fetchPlayerEntry(account.playerAddress);
    }
  }, [leaderboard, account.playerAddress, cooldown.isCooldownActive]);

  // Render logic
  return (
    <section className="...">
      <AvatarManagementSection
        playerAddress={account.playerAddress}
        avatarState={avatar}
      />

      {leaderboard.isPlayerLoading && <LeaderboardLoadingState />}

      {leaderboard.playerError && (
        <LeaderboardErrorState
          error={leaderboard.playerError}
          refreshControls={<LeaderboardRefreshControls {...} />}
        />
      )}

      {leaderboard.statusMessage && (
        <LeaderboardEmptyState
          statusMessage={leaderboard.statusMessage}
          refreshControls={<LeaderboardRefreshControls {...} />}
        />
      )}

      {leaderboard.highlightPlayer && (
        <>
          <BlitzHighlightCard
            highlightPlayer={leaderboard.highlightPlayer}
            championLabel={leaderboard.championLabel}
            cardRef={cardRef}
          />
          <BlitzShareActions {...sharing} />
        </>
      )}
    </section>
  );
};
```

### Phase 4: Utility Functions

Keep these at module level in player.tsx or move to utils:
- `getDisplayName` (lines 26-33)
- `toHighlightPlayer` (lines 35-52)

Consider moving to: `src/ui/features/landing/lib/player-utils.ts`

## Benefits

### Maintainability
- Each hook has a single responsibility
- Easy to locate and fix bugs
- Clear separation of concerns

### Testability
- Hooks can be tested independently
- Mock data injection is straightforward
- Component logic is minimal

### Reusability
- `useCartridgeUsername` can be used anywhere
- `useRefreshCooldown` is generic
- Avatar management logic centralized

### Performance
- Easier to identify re-render issues
- Can optimize individual hooks with useMemo/useCallback
- Component tree is shallower

### Developer Experience
- Smaller files are easier to read
- Easier to onboard new developers
- Better IDE performance

## Implementation Order

1. **Create `useCartridgeUsername` hook** - Most isolated, no dependencies on other refactors
2. **Create `usePlayerAccount` hook** - Depends on #1
3. **Create `useAvatarManagement` hook** - Depends on #2
4. **Create `usePlayerLeaderboard` hook** - Independent
5. **Create `useRefreshCooldown` hook** - Independent, generic
6. **Create `useBlitzSharing` hook** - Independent
7. **Extract UI components** - Can be done in parallel
8. **Refactor main component** - Final integration

## Testing Strategy

### Hook Tests
Each hook should have:
- Unit tests with mocked dependencies
- Tests for loading states
- Tests for error handling
- Tests for callbacks/actions

### Component Tests
- Visual regression tests
- Interaction tests (button clicks, etc.)
- Loading/error/empty state snapshots

### Integration Tests
- Full page flow from loading → data → actions
- Refresh cooldown behavior
- Share/export functionality

## Migration Risk Assessment

**Low Risk**:
- Extracting pure hooks (cooldown, username)
- Creating new component files

**Medium Risk**:
- Refactoring main component (lots of conditional rendering)
- Dependency between hooks (account → avatar)

**Mitigation**:
- Create new files alongside existing
- Add comprehensive tests before refactor
- Feature flag to switch between old/new implementations
- Incremental rollout

## Cleanup Tasks

After refactoring:
- Remove unused imports from player.tsx
- Update any components that import from player.tsx
- Add JSDoc comments to new hooks
- Update component documentation
- Remove duplicate username loading logic (userName vs accountName)
