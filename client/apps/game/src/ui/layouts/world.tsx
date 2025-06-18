import { useSyncPlayerStructures } from "@/hooks/helpers/use-sync-player-structures";
import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingOroborus } from "@/ui/modules/loading-oroborus";
import { LoadingScreen } from "@/ui/modules/loading-screen";
import { NotLoggedInMessage, SeasonWinnerMessage } from "@/ui/shared";
import { Leva } from "leva";
import { useGameSettingsMetadata, useMiniGames } from "metagame-sdk";
import { lazy, Suspense, useEffect, useMemo } from "react";
import { env } from "../../../env";
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

const BlankOverlayContainer = lazy(() =>
  import("../containers/blank-overlay-container").then((module) => ({ default: module.BlankOverlayContainer })),
);
const EntitiesInfoLabel = lazy(() =>
  import("../features/world/components/entities/entities-label").then((module) => ({
    default: module.EntitiesLabel,
  })),
);
const TopCenterContainer = lazy(() => import("../containers/top-center-container"));
const BottomRightContainer = lazy(() =>
  import("../containers/bottom-right-container").then((module) => ({ default: module.BottomRightContainer })),
);
const LeftMiddleContainer = lazy(() => import("../containers/left-middle-container"));
const RightMiddleContainer = lazy(() => import("../containers/right-middle-container"));
const TopLeftContainer = lazy(() => import("../containers/top-left-container"));
const Tooltip = lazy(() => import("../elements/tooltip").then((module) => ({ default: module.Tooltip })));
const TopMiddleNavigation = lazy(() =>
  import("../features/world/containers/top-navigation").then((module) => ({ default: module.TopNavigation })),
);
const BottomMiddleContainer = lazy(() =>
  import("../containers/bottom-middle-container").then((module) => ({ default: module.BottomMiddleContainer })),
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
  import("../features/world/containers/top-left-navigation").then((module) => ({ default: module.TopLeftNavigation })),
);
const Onboarding = lazy(() => import("./onboarding").then((module) => ({ default: module.Onboarding })));

const MiniMapNavigation = lazy(() =>
  import("../features/world/containers/mini-map-navigation").then((module) => ({ default: module.MiniMapNavigation })),
);

const RealmTransferManager = lazy(() =>
  import("../features/economy/resources/realm-transfer-manager").then((module) => ({
    default: module.RealmTransferManager,
  })),
);

const StructureSynchronizerManager = () => {
  useSyncPlayerStructures();
  return null;
};

// Modal component to prevent unnecessary World re-renders
const ModalOverlay = () => {
  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);

  return (
    <Suspense fallback={null}>
      <BlankOverlayContainer zIndex={120} open={showModal}>
        {modalContent}
      </BlankOverlayContainer>
    </Suspense>
  );
};

// Blank overlay component for onboarding
const OnboardingOverlay = ({ backgroundImage }: { backgroundImage: string }) => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);

  return (
    <Suspense fallback={null}>
      <BlankOverlayContainer zIndex={110} open={showBlankOverlay}>
        <Onboarding backgroundImage={backgroundImage} />
      </BlankOverlayContainer>
    </Suspense>
  );
};

export const World = ({ backgroundImage }: { backgroundImage: string }) => {
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);
  const minigameStore = useMinigameStore.getState();

  const { data: minigames } = useMiniGames({});

  const minigameAddresses = useMemo(() => minigames?.map((m) => m.contract_address) ?? [], [minigames]);

  const { data: settingsMetadata } = useGameSettingsMetadata({
    gameAddresses: minigameAddresses,
  });

  useEffect(() => {
    if (minigames) {
      minigameStore.setMinigames(minigames);
    }

    if (settingsMetadata) {
      minigameStore.setSettingsMetadata(settingsMetadata);
    }
  }, [minigames, settingsMetadata, minigameStore]);

  return (
    <>
      <StoreManagers />
      <StructureSynchronizerManager />
      <NotLoggedInMessage />
      <SeasonWinnerMessage />

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

        <Suspense fallback={<LoadingScreen backgroundImage={backgroundImage} />}>
          <RealmTransferManager zIndex={100} />

          {/* Extracted modal components */}
          <ModalOverlay />
          <OnboardingOverlay backgroundImage={backgroundImage} />

          <ActionInstructions />
          <ActionInfo />
          <EntitiesInfoLabel />

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

          <LoadingOroborus loading={isLoadingScreenEnabled} />

          {/* todo: put this somewhere else maybe ? */}
          {/* <Redirect to="/" /> */}
          <Leva hidden={!env.VITE_PUBLIC_GRAPHICS_DEV} collapsed titleBar={{ position: { x: 0, y: 50 } }} />
          <Tooltip />
          <VersionDisplay />
          <div id="labelrenderer" className="absolute top-0 pointer-events-none z-10" />
        </Suspense>
      </div>
    </>
  );
};

const VersionDisplay = () => (
  <div className="absolute bottom-4 right-6 text-xs text-white/60 hover:text-white pointer-events-auto bg-white/20 rounded-lg p-1">
    <a target="_blank" href={"https://github.com/BibliothecaDAO/eternum"} rel="noopener noreferrer">
      {env.VITE_PUBLIC_GAME_VERSION}
    </a>
  </div>
);
