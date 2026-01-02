# Leaderboard Effects System

This system adds animated visual feedback to the leaderboard when player data changes, making it more engaging for spectators.

## Features

### 1. Point Gain Effects
- **Floating animations** that appear near player rows when points change
- **Color-coded by point category**:
  - **Amber (#fbbf24)**: Registered points
  - **Emerald (#10b981)**: Unregistered shareholder points (with ⚡ icon)
  - **Amber-500 (#f59e0b)**: Significant total gains (>100 points)
- **3-second duration** with smooth fade-out animation

### 2. Rank Change Effects
- **Directional arrows** showing rank improvements (↗) or drops (↘)
- **Color coding**:
  - **Green**: Rank improvements (lower rank number)
  - **Red**: Rank drops (higher rank number)
- **Multi-position changes** show the difference number

### 3. Mockup Mode
- **Toggle flag**: `ENABLE_LEADERBOARD_EFFECTS_MOCKUP` in `ui/constants.ts`
- **Simulated data**: Generates fake point deltas and rank changes on a timer
- **Visual indicator**: Purple "MOCKUP MODE" badge in top-right corner
- **Easy testing**: No need for live gameplay data to see effects

## Configuration

### Enable/Disable Mockup Mode

Edit `/src/ui/constants.ts`:

```typescript
// Set to true for mockup mode, false for real data mode
export const ENABLE_LEADERBOARD_EFFECTS_MOCKUP = true;
```

### Effect Timing

The effects system accepts these options in `useLeaderboardEffects()`:

```typescript
{
  effectDuration: 3000,    // How long effects last (ms)
  mockupInterval: 2000,    // How often to generate mock effects (ms)
}
```

## Architecture

### Core Files

- **`hooks/use-leaderboard-effects.ts`**: Main hook that handles state diffing, mock generation, and effect management
- **`components/leaderboard-effects.tsx`**: Visual effect components (FloatingPointDelta, RankChangeIndicator, etc.)
- **`player/player-list.tsx`**: Integration with existing leaderboard PlayerRow components

### Key Components

1. **useLeaderboardEffects Hook**
   - Detects changes between player data snapshots
   - Generates mock effects in mockup mode
   - Manages effect lifecycle and cleanup

2. **LeaderboardEffectsContainer**
   - Renders all active effects for a player
   - Positioned absolutely relative to player rows

3. **FloatingPointDelta**
   - Shows point changes with appropriate colors and icons
   - Animates from right side with `float-up-fade` animation

4. **RankChangeIndicator** 
   - Shows rank changes with directional arrows
   - Animates from left side with `bounce-fade` animation

### Performance Optimizations

- **React memoization** prevents unnecessary re-renders
- **Efficient state diffing** only processes actual changes
- **Automatic cleanup** removes expired effects every 500ms
- **Minimal DOM updates** with absolute positioning

## Usage

The system integrates automatically with the existing leaderboard. When players gain/lose points or change ranks, effects will appear automatically.

In mockup mode, effects are generated randomly every 2 seconds for demonstration purposes.

## Animation Details

### CSS Animations (in tailwind.config.js)

- **`floatUpFade`**: Point deltas float up and fade out from the right
- **`bounceFade`**: Rank changes bounce and fade from the left

### Visual Design

- **Subtle effects** that don't interfere with readability
- **Consistent color scheme** matching existing point type colors
- **Smooth animations** with appropriate timing curves
- **Clear visual hierarchy** with rank changes on left, point deltas on right

## Testing

1. **Enable mockup mode** in constants.ts
2. **Open leaderboard** in the Social panel
3. **Observe effects** appearing every 2 seconds on random players
4. **Toggle mockup mode off** to test with real data

## Future Enhancements

Potential improvements for the effects system:

- **Sound effects** for significant point gains
- **Particle effects** for major rank changes
- **Customizable colors** per point category
- **Effect intensity** based on magnitude of change
- **Player-specific effect preferences**