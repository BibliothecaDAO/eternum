// Landing V2 - Witcher-inspired unified landing page
// Main layout
export { LandingLayoutV2 } from "./landing-layout";

// Context
export { LandingProvider, useBackgroundChange, useLandingContext } from "./context/landing-context";

// Components
export { DynamicBackground } from "./components/background/dynamic-background";
export { HeroTitle } from "./components/hero-title";
export { LandingHeader } from "./components/landing-header";
export { LandingSettings } from "./components/landing-settings";
export { LandingSidebar } from "./components/landing-sidebar";
export { MobileBottomNav } from "./components/mobile-bottom-nav";

// Game selector
export { EmptyStateCard } from "./components/game-selector/empty-state-card";
export { GameCard, type GameInfo } from "./components/game-selector/game-card";
export { GameCarousel } from "./components/game-selector/game-carousel";
export { InlineGameSelector } from "./components/game-selector/inline-game-selector";
export { HexGameMap, type WorldSelection } from "./components/game-selector/hex-game-map";

// Views
export { PlayView } from "./views/play-view";
export { ProfileView } from "./views/profile-view";
export { MarketsView } from "./views/markets-view";
export { LeaderboardView } from "./views/leaderboard-view";

// Hooks
export { useBackgroundTransition } from "./hooks/use-background-transition";
export { useGameSelector } from "./hooks/use-game-selector";
export { useWorldGames } from "./hooks/use-world-games";
