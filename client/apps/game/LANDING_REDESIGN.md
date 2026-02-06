# Landing Page Redesign - Witcher-Inspired UI

## Status: ✅ COMPLETE

All phases of the redesign have been implemented.

## Overview

Redesigned the Eternum landing and play pages into a unified, atmospheric experience inspired by The Witcher game UI.
The goal is a simple, cinematic landing that allows quick game access while maintaining account, cosmetics, and other
features.

## Design Reference

Based on The Witcher UI with:

- Full-bleed atmospheric artwork as background
- Large stylized title typography
- Minimal icon-only left sidebar
- Simple top navigation
- Game/realm selector panel with arrow navigation
- Dark, cinematic color palette

## Information Architecture

```
Desktop Layout:
┌──────────────────────────────────────────────────────────────────────────────┐
│  [Logo]              PLAY    PROFILE    MARKETS    LEADERBOARD    [Wallet]   │
├─────┬────────────────────────────────────────────────────────────────────────┤
│ 🏠  │                                                                        │
│ 🏆  │                         ETERNUM                                        │
│ 👤  │           "Forge your destiny in eternal conflict"                     │
│ ⚙️  │                                                                        │
│     │    ┌────────────────────────────────────┐                              │
│     │    │  ◀  BLITZ SEASON 3  ▶             │   [DYNAMIC BACKGROUND]       │
│     │    │  Realm: Ironhold       Active ●   │                              │
│     │    │  Lords: 12,345                    │                              │
│     │    │  Troops: 8 armies                 │                              │
│     │    │         [ ENTER WORLD ]           │                              │
│     │    └────────────────────────────────────┘                              │
│     │              ●  ○  ○  (game pagination)                                │
└─────┴────────────────────────────────────────────────────────────────────────┘

Mobile Layout:
┌──────────────────────────────────────────────────────────────────────────────┐
│  [Logo]                                                          [Wallet]   │
├──────────────────────────────────────────────────────────────────────────────┤
│                         [MAIN CONTENT AREA]                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│     🏠          🏆          👤          🛒          ⚙️                        │
│    Play     Leaderboard   Profile    Markets    Settings                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Routes & Views

| Route                    | View            | Background       | Description                           |
| ------------------------ | --------------- | ---------------- | ------------------------------------- |
| `/`                      | PlayView        | Dynamic per game | Game selector carousel + Enter button |
| `/` (no games)           | PlayView        | `01.png`         | "Join Season" CTA                     |
| `/profile`               | ProfileView     | `05.png`         | Stats tab (default)                   |
| `/profile?tab=cosmetics` | ProfileView     | `05.png`         | Cosmetics sub-tab                     |
| `/profile?tab=wallet`    | ProfileView     | `05.png`         | Wallet sub-tab                        |
| `/markets`               | MarketsView     | `04.png`         | Existing markets                      |
| `/leaderboard`           | LeaderboardView | `07.png`         | Existing leaderboard                  |

## File Structure

```
client/apps/game/src/ui/features/landing-v2/
├── index.ts                           # Exports
├── landing-layout.tsx                 # Main layout wrapper
├── context/
│   └── landing-context.tsx            # Background state context
├── components/
│   ├── landing-sidebar.tsx            # Icon-only left navigation (desktop)
│   ├── landing-header.tsx             # Top nav with logo + wallet
│   ├── landing-settings.tsx           # Settings modal for landing
│   ├── mobile-bottom-nav.tsx          # Bottom tab bar (mobile)
│   ├── hero-title.tsx                 # Large ETERNUM typography
│   ├── game-selector/
│   │   ├── game-card.tsx              # Realm/game info panel
│   │   ├── game-carousel.tsx          # Arrow nav + pagination
│   │   └── empty-state-card.tsx       # Join season CTA
│   └── background/
│       └── dynamic-background.tsx     # Background with crossfade
├── views/
│   ├── play-view.tsx                  # Default home with game selector
│   ├── profile-view.tsx               # Profile with sub-tabs
│   ├── markets-view.tsx               # Markets wrapper
│   └── leaderboard-view.tsx           # Leaderboard wrapper
└── hooks/
    ├── use-game-selector.ts           # Game selection state
    ├── use-world-games.ts             # Real world data hook
    └── use-background-transition.ts   # Background swap logic
```

## Implementation Phases

### Phase 1: Layout ✅

- LandingLayoutV2 with full-bleed background
- LandingHeader with top nav and hover animations
- LandingSidebar (icon-only, desktop) with transitions
- MobileBottomNav (bottom tab bar, mobile) with safe area
- HeroTitle component with glow effects

### Phase 2: Game Selector ✅

- GameCard component with hover effects
- GameCarousel with navigation and pagination
- Background swap on selection via context
- EmptyStateCard (Join Season CTA)
- Enter World button with scale animations

### Phase 3: View Migration ✅

- ProfileView with sub-tabs (Stats, Cosmetics, Wallet)
- MarketsView wrapper with providers
- LeaderboardView wrapper

### Phase 4: Route Consolidation ✅

- app.tsx using new landing layout
- Routes: `/`, `/profile`, `/markets`, `/leaderboard`, `/play/*`
- Real world data integration via useWorldGames hook

### Phase 5: Polish & Integration ✅

- Hover/focus animations on all interactive elements
- Background change context for game selection
- Settings modal with audio controls
- Mobile-responsive design with safe area support
- Smooth transitions and glow effects

## How to Run

```bash
# Use Node.js 22+
nvm use 22

# Install dependencies
pnpm install

# Build packages
pnpm build:packages

# Start dev server
pnpm dev
```

The app will be available at https://localhost:5173/

## Key Features

### Dynamic Backgrounds

- Full-bleed cover images that change per route
- Smooth crossfade transitions between backgrounds
- Background changes when cycling through games in carousel

### Navigation

- Desktop: Icon-only sidebar with tooltips
- Mobile: Bottom tab bar with safe area support
- Top header with nav links and wallet connect

### Game Selector

- Carousel with arrow navigation
- Pagination dots for multiple games
- Real data from stored world profiles
- Empty state with "Join Season" CTA

### Settings

- Audio controls (master, music, SFX volumes)
- Mute toggle
- Now playing track display
- Fullscreen toggle

### Animations

- Hover scale effects on buttons
- Active indicator bars with glow
- Fade-in animations for hero content
- Settings gear rotation on hover

## Key Decisions

| Decision     | Choice                   | Rationale                                 |
| ------------ | ------------------------ | ----------------------------------------- |
| Background   | Dynamic artwork per game | More immersive, uses existing assets      |
| Empty state  | Join Season CTA          | Clear onboarding path for new users       |
| Cosmetics    | Inside Profile tab       | Reduces nav complexity                    |
| Mobile nav   | Bottom tab bar           | Mobile-native UX pattern                  |
| Game loading | Full page transition     | Clean separation between landing and game |
| State mgmt   | React Context            | Simple background state sharing           |

## Assets Used

### Backgrounds

- `/images/covers/blitz/01.png` - Default/Play
- `/images/covers/blitz/04.png` - Markets
- `/images/covers/blitz/05.png` - Profile
- `/images/covers/blitz/07.png` - Leaderboard

### Logos

- `/assets/icons/eternum-new-logo.svg` - Sidebar logo

## Changelog

| Date       | Change                                            |
| ---------- | ------------------------------------------------- |
| 2026-02-05 | Initial plan created                              |
| 2026-02-05 | Phase 1-4 completed: Layout, game selector, views |
| 2026-02-05 | Phase 5 completed: Polish, animations, settings   |
| 2026-02-05 | Full implementation complete                      |
