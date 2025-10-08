import { useSyncPlayerStructures } from "@/hooks/helpers/use-sync-player-structures";
import { LoadingScreen } from "@/ui/modules/loading-screen";
import { GameWinnerMessage, NotLoggedInMessage } from "@/ui/shared";
import { PlayOverlayManager } from "./play-overlay-manager";
import { Leva } from "leva";
import { lazy, Suspense } from "react";
import { env } from "../../../env";
import { AutomationManager } from "../features/infrastructure/automation/automation-manager";
import { StoryEventStream } from "../features/story-events";
import { BlitzSetHyperstructureShareholdersTo100 } from "../features/world/components/hyperstructures/blitz-hyperstructure-shareholder";
import { StoreManagers } from "../store-managers";

// Lazy load components
const SelectedArmy = lazy(() =>
  import("../features/world/components/actions/selected-worldmap-entity").then((module) => ({
    default: module.SelectedWorldmapEntity,
  })),
);

const ActionInfo = lazy(() =>
  import("../features/world/components/actions/action-info").then((module) => ({ default: module.ActionInfo })),
);

const ActionInstructions = lazy(() =>
  import("../features/world/components/actions/action-instructions").then((module) => ({
    default: module.ActionInstructions,
  })),
);

const WorldContextMenu = lazy(() =>
  import("../features/world/components/context-menu").then((module) => ({ default: module.WorldContextMenu })),
);

const TopCenterContainer = lazy(() => import("../shared/containers/top-center-container"));
const BottomRightContainer = lazy(() =>
  import("../shared/containers/bottom-right-container").then((module) => ({ default: module.BottomRightContainer })),
);
const LeftMiddleContainer = lazy(() => import("../shared/containers/left-middle-container"));
const RightMiddleContainer = lazy(() => import("../shared/containers/right-middle-container"));
const TopLeftContainer = lazy(() => import("../shared/containers/top-left-container"));
const Tooltip = lazy(() =>
  import("../design-system/molecules/tooltip").then((module) => ({ default: module.Tooltip })),
);
const TopMiddleNavigation = lazy(() =>
  import("../features/world/containers/top-navigation").then((module) => ({ default: module.TopNavigation })),
);
const BottomMiddleContainer = lazy(() =>
  import("../shared/containers/bottom-middle-container").then((module) => ({ default: module.BottomMiddleContainer })),
);
const LeftNavigationModule = lazy(() =>
  import("../features/world/containers/left-navigation-module").then((module) => ({
    default: module.LeftNavigationModule,
  })),
);
const RightNavigationModule = lazy(() =>
  import("../features/world/containers/right-navigation-module").then((module) => ({
    default: module.RightNavigationModule,
  })),
);
const TopLeftNavigation = lazy(() =>
  import("../features/world/containers/top-left-navigation/top-left-navigation").then((module) => ({
    default: module.TopLeftNavigation,
  })),
);
const MiniMapNavigation = lazy(() =>
  import("../features/world/containers/mini-map-navigation/mini-map-navigation").then((module) => ({
    default: module.MiniMapNavigation,
  })),
);

const RealmTransferManager = lazy(() =>
  import("../features/economy/resources").then((module) => ({
    default: module.RealmTransferManager,
  })),
);

export const World = ({ backgroundImage }: { backgroundImage: string }) => {
  return (
    <>
      <WorldEffects />

      {/* Main world layer */}
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
        }}
        onMouseMove={(e) => {
          e.stopPropagation();
        }}
        id="world"
        className="world-selector fixed antialiased top-0 left-0 z-0 w-screen h-screen overflow-hidden ornate-borders pointer-events-none"
      >
        <div className="vignette" />

        <Suspense fallback={<WorldSuspenseFallback backgroundImage={backgroundImage} />}>
          <RealmTransferManager zIndex={100} />
          <PlayOverlayManager backgroundImage={backgroundImage} />
          <WorldInteractiveLayers />

          <StoryEventStream />

          <Leva hidden={!env.VITE_PUBLIC_GRAPHICS_DEV} collapsed titleBar={{ position: { x: 0, y: 50 } }} />
          <Tooltip />
          <VersionDisplay />
          <div id="labelrenderer" className="absolute top-0 pointer-events-none z-10" />
        </Suspense>
      </div>
    </>
  );
};

const WorldEffects = () => (
  <>
    <StoreManagers />
    <StructureSynchronizer />
    <NotLoggedInMessage />
    <GameWinnerMessage />
    <BlitzSetHyperstructureShareholdersTo100 />
    <AutomationManager />
  </>
);

const StructureSynchronizer = () => {
  useSyncPlayerStructures();
  return null;
};

const WorldSuspenseFallback = ({ backgroundImage }: { backgroundImage: string }) => (
  <LoadingScreen backgroundImage={backgroundImage} />
);

const WorldInteractiveLayers = () => (
  <>
    <ActionInstructions />
    <ActionInfo />
    <WorldContextMenu />
    <WorldHud />
  </>
);

const WorldHud = () => (
  <div>
    <LeftMiddleContainer>
      <LeftNavigationModule />
    </LeftMiddleContainer>

    <TopCenterContainer>
      <TopMiddleNavigation />
    </TopCenterContainer>

    <BottomMiddleContainer>
      <SelectedArmy />
    </BottomMiddleContainer>

    <BottomRightContainer>
      <MiniMapNavigation />
    </BottomRightContainer>

    <RightMiddleContainer>
      <RightNavigationModule />
    </RightMiddleContainer>

    <TopLeftContainer>
      <TopLeftNavigation />
    </TopLeftContainer>
  </div>
);

const VersionDisplay = () => (
  <div className="absolute bottom-4 right-6 text-xs text-white/60 hover:text-white pointer-events-auto bg-white/20 rounded-lg p-1">
    <a target="_blank" href={"https://github.com/BibliothecaDAO/eternum"} rel="noopener noreferrer">
      {env.VITE_PUBLIC_GAME_VERSION}
    </a>
  </div>
);
