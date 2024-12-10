import { Leva } from "leva";
import { lazy, Suspense } from "react";
import { Redirect } from "wouter";
import useUIStore from "../../hooks/store/useUIStore";

import { useStructureEntityId } from "@/hooks/helpers/useStructureEntityId";
import { useFetchBlockchainData } from "@/hooks/store/useBlockchainStore";
import { useHyperstructureData } from "@/hooks/store/useLeaderBoardStore";
import { useStartingTutorial } from "@/hooks/use-starting-tutorial";
import { env } from "../../../env";
import { IS_MOBILE } from "../config";
import { LoadingScreen } from "../modules/LoadingScreen";
import { LoadingOroborus } from "../modules/loading-oroborus";
// Lazy load components

const SelectedArmy = lazy(() =>
  import("../components/worldmap/armies/SelectedArmy").then((module) => ({ default: module.SelectedArmy })),
);

const ActionInfo = lazy(() =>
  import("../components/worldmap/armies/ActionInfo").then((module) => ({ default: module.ActionInfo })),
);

const ActionInstructions = lazy(() =>
  import("../components/worldmap/armies/ActionInstructions").then((module) => ({ default: module.ActionInstructions })),
);

const ArmyInfoLabel = lazy(() =>
  import("../components/worldmap/armies/ArmyInfoLabel").then((module) => ({ default: module.ArmyInfoLabel })),
);

const BattleInfoLabel = lazy(() =>
  import("../components/worldmap/battles/BattleLabel").then((module) => ({ default: module.BattleInfoLabel })),
);

const BlankOverlayContainer = lazy(() =>
  import("../containers/BlankOverlayContainer").then((module) => ({ default: module.BlankOverlayContainer })),
);
const StructureInfoLabel = lazy(() =>
  import("../components/worldmap/structures/StructureLabel").then((module) => ({ default: module.StructureInfoLabel })),
);
const BattleContainer = lazy(() =>
  import("../containers/BattleContainer").then((module) => ({ default: module.BattleContainer })),
);
const TopCenterContainer = lazy(() => import("../containers/TopCenterContainer"));
const BottomRightContainer = lazy(() =>
  import("../containers/BottomRightContainer").then((module) => ({ default: module.BottomRightContainer })),
);
const LeftMiddleContainer = lazy(() => import("../containers/LeftMiddleContainer"));
const RightMiddleContainer = lazy(() => import("../containers/RightMiddleContainer"));
const TopLeftContainer = lazy(() => import("../containers/TopLeftContainer"));
const Tooltip = lazy(() => import("../elements/Tooltip").then((module) => ({ default: module.Tooltip })));
const BattleView = lazy(() =>
  import("../modules/military/battle-view/BattleView").then((module) => ({ default: module.BattleView })),
);
const TopMiddleNavigation = lazy(() =>
  import("../modules/navigation/TopNavigation").then((module) => ({ default: module.TopMiddleNavigation })),
);
const BottomMiddleContainer = lazy(() =>
  import("../containers/BottomMiddleContainer").then((module) => ({ default: module.BottomMiddleContainer })),
);
const LeftNavigationModule = lazy(() =>
  import("../modules/navigation/LeftNavigationModule").then((module) => ({ default: module.LeftNavigationModule })),
);
const RightNavigationModule = lazy(() =>
  import("../modules/navigation/RightNavigationModule").then((module) => ({ default: module.RightNavigationModule })),
);
const TopLeftNavigation = lazy(() =>
  import("../modules/navigation/TopLeftNavigation").then((module) => ({ default: module.TopLeftNavigation })),
);
const EventStream = lazy(() =>
  import("../modules/stream/EventStream").then((module) => ({ default: module.EventStream })),
);
const Onboarding = lazy(() => import("./Onboarding").then((module) => ({ default: module.Onboarding })));
const OrientationOverlay = lazy(() =>
  import("../components/overlays/OrientationOverlay").then((module) => ({ default: module.OrientationOverlay })),
);

const MiniMapNavigation = lazy(() =>
  import("../modules/navigation/MiniMapNavigation").then((module) => ({ default: module.MiniMapNavigation })),
);

export const World = ({ backgroundImage }: { backgroundImage: string }) => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);

  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);

  const battleView = useUIStore((state) => state.battleView);

  // Setup hooks
  useFetchBlockchainData();
  useHyperstructureData();
  useStructureEntityId();
  useStartingTutorial();

  return (
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
        {IS_MOBILE && <OrientationOverlay />}
        <LoadingOroborus loading={isLoadingScreenEnabled} />
        <BlankOverlayContainer open={showModal}>{modalContent}</BlankOverlayContainer>
        <BlankOverlayContainer open={showBlankOverlay}>
          <Onboarding backgroundImage={backgroundImage} />
        </BlankOverlayContainer>
        <ActionInstructions />
        {!IS_MOBILE && (
          <>
            <ActionInfo />
            <ArmyInfoLabel />
            <StructureInfoLabel />
            <BattleInfoLabel />
          </>
        )}

        <BattleContainer>
          <BattleView />
        </BattleContainer>

        <div className={`${battleView ? "opacity-0 pointer-events-none" : ""}`}>
          <LeftMiddleContainer>
            <LeftNavigationModule />
          </LeftMiddleContainer>

          <TopCenterContainer>
            <TopMiddleNavigation />
          </TopCenterContainer>

          <BottomMiddleContainer>
            <SelectedArmy />
          </BottomMiddleContainer>

          {!IS_MOBILE && (
            <>
              <BottomRightContainer>
                <MiniMapNavigation />
              </BottomRightContainer>
              <RightMiddleContainer>
                <RightNavigationModule />
              </RightMiddleContainer>
            </>
          )}

          <TopLeftContainer>
            <TopLeftNavigation />
          </TopLeftContainer>
        </div>

        <Redirect to="/" />
        <Leva
          hidden={!env.VITE_PUBLIC_DEV || env.VITE_PUBLIC_HIDE_THREEJS_MENU}
          collapsed
          titleBar={{ position: { x: 0, y: 50 } }}
        />
        <Tooltip />
        <VersionDisplay />
        <div id="labelrenderer" className="absolute top-0 pointer-events-none z-10" />
      </Suspense>
    </div>
  );
};

const VersionDisplay = () => (
  <div className="absolute bottom-4 right-6 text-xs text-white/60 hover:text-white pointer-events-auto bg-white/20 rounded-lg p-1">
    <a target="_blank" href={"https://github.com/BibliothecaDAO/eternum"} rel="noopener noreferrer">
      {env.VITE_PUBLIC_GAME_VERSION}
    </a>
  </div>
);
