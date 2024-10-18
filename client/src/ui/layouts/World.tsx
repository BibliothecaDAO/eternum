import clsx from "clsx";
import { Leva } from "leva";
import { lazy, Suspense } from "react";
import { Redirect } from "wouter";
import useUIStore from "../../hooks/store/useUIStore";

import { useStructureEntityId } from "@/hooks/helpers/useStructureEntityId";
import { useFetchBlockchainData } from "@/hooks/store/useBlockchainStore";
import { useSubscriptionToHyperstructureEvents } from "@/hooks/store/useLeaderBoardStore";

// Lazy load components
const ActionInfo = lazy(() =>
  import("../components/worldmap/armies/ActionInfo").then((module) => ({ default: module.ActionInfo })),
);
const ArmyInfoLabel = lazy(() =>
  import("../components/worldmap/armies/ArmyInfoLabel").then((module) => ({ default: module.ArmyInfoLabel })),
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
const BottomMiddleContainer = lazy(() => import("../containers/BottomMiddleContainer"));
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
const BottomNavigation = lazy(() =>
  import("../modules/navigation/BottomNavigation").then((module) => ({ default: module.BottomNavigation })),
);
const LeftNavigationModule = lazy(() =>
  import("../modules/navigation/LeftNavigationModule").then((module) => ({ default: module.LeftNavigationModule })),
);
const RightNavigationModule = lazy(() =>
  import("../modules/navigation/RightNavigationModule").then((module) => ({ default: module.RightNavigationModule })),
);
const TopMiddleNavigation = lazy(() =>
  import("../modules/navigation/TopMiddleNavigation").then((module) => ({ default: module.TopMiddleNavigation })),
);
const PlayerId = lazy(() => import("../modules/social/PlayerId").then((module) => ({ default: module.PlayerId })));
const EventStream = lazy(() =>
  import("../modules/stream/EventStream").then((module) => ({ default: module.EventStream })),
);
const Onboarding = lazy(() => import("./Onboarding").then((module) => ({ default: module.Onboarding })));

export const World = () => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);

  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);

  const battleView = useUIStore((state) => state.battleView);

  // Setup hooks
  useFetchBlockchainData();
  useSubscriptionToHyperstructureEvents();
  useStructureEntityId();

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
      className="fixed antialiased top-0 left-0 z-0 w-screen h-screen overflow-hidden ornate-borders pointer-events-none"
    >
      <div className="vignette" />
      <div
        className={clsx(
          "absolute bottom-0 left-0 z-20 w-full pointer-events-none flex items-center text-white justify-center text-3xl rounded-xl h-full bg-brown duration-300 transition-opacity",
          isLoadingScreenEnabled ? "opacity-100" : "opacity-0",
        )}
      >
        <img src="/images/eternum-logo_animated.png" className=" invert scale-50" />
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <BlankOverlayContainer open={showModal}>{modalContent}</BlankOverlayContainer>
        <BlankOverlayContainer open={showBlankOverlay}>
          <Onboarding />
        </BlankOverlayContainer>
        <ActionInfo />
        <ArmyInfoLabel />
        <StructureInfoLabel />

        <BattleContainer>
          <BattleView />
        </BattleContainer>

        <div className={`${battleView ? "opacity-0 pointer-events-none" : ""}`}>
          <LeftMiddleContainer>
            <LeftNavigationModule />
          </LeftMiddleContainer>

          <BottomMiddleContainer>
            <BottomNavigation />
          </BottomMiddleContainer>

          <BottomRightContainer>
            <EventStream />
          </BottomRightContainer>

          <RightMiddleContainer>
            <RightNavigationModule />
          </RightMiddleContainer>

          <TopLeftContainer>
            <TopMiddleNavigation />
          </TopLeftContainer>
        </div>

        <PlayerId />

        <Redirect to="/" />
        <Leva
          hidden={import.meta.env.PROD || import.meta.env.HIDE_THREEJS_MENU}
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
  <div className="absolute bottom-4 right-6 text-xs text-white/60 hover:text-white">
    <a target="_blank" href={"https://github.com/BibliothecaDAO/eternum"} rel="noopener noreferrer">
      {import.meta.env.VITE_PUBLIC_GAME_VERSION}
    </a>
  </div>
);
