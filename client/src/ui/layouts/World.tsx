import { Leva } from "leva";
import useUIStore from "../../hooks/store/useUIStore";

import clsx from "clsx";
import { Redirect } from "wouter";
import { HooksComponent } from "../components/HooksComponent";
import { ActionInfo } from "../components/worldmap/armies/ActionInfo";
import { ArmyInfoLabel } from "../components/worldmap/armies/ArmyInfoLabel";
import { BlankOverlayContainer } from "../containers/BlankOverlayContainer";

import { BattleContainer } from "../containers/BattleContainer";
import BottomMiddleContainer from "../containers/BottomMiddleContainer";
import { BottomRightContainer } from "../containers/BottomRightContainer";
import LeftMiddleContainer from "../containers/LeftMiddleContainer";
import RightMiddleContainer from "../containers/RightMiddleContainer";
import TopLeftContainer from "../containers/TopLeftContainer";
import { Tooltip } from "../elements/Tooltip";
import { BattleView } from "../modules/military/battle-view/BattleView";
import { BottomNavigation } from "../modules/navigation/BottomNavigation";
import { LeftNavigationModule } from "../modules/navigation/LeftNavigationModule";
import { RightNavigationModule } from "../modules/navigation/RightNavigationModule";
import { TopMiddleNavigation } from "../modules/navigation/TopMiddleNavigation";
import { PlayerId } from "../modules/social/PlayerId";
import { EventStream } from "../modules/stream/EventStream";
import { Onboarding } from "./Onboarding";

export const World = () => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);

  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);

  const battleView = useUIStore((state) => state.battleView);

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
          "absolute bottom-0 left-0 z-20 w-full pointer-events-none flex items-center text-white justify-center text-3xl rounded-xl h-full bg-black duration-300 transition-opacity",
          isLoadingScreenEnabled ? "opacity-100" : "opacity-0",
        )}
      >
        <img src="/images/eternum-logo_animated.png" className=" invert scale-50" />
      </div>
      <BlankOverlayContainer open={showModal}>{modalContent}</BlankOverlayContainer>
      <BlankOverlayContainer open={showBlankOverlay}>
        <Onboarding />
      </BlankOverlayContainer>
      <HooksComponent />
      <ActionInfo />
      <ArmyInfoLabel />

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
