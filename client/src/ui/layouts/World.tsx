import { Leva } from "leva";
import { useEffect } from "react";
import useUIStore from "../../hooks/store/useUIStore";
import BottomMiddleContainer from "../containers/BottomMiddleContainer";
import { BottomRightContainer } from "../containers/BottomRightContainer";
import LeftMiddleContainer from "../containers/LeftMiddleContainer";
import TopMiddleContainer from "../containers/TopMiddleContainer";
import { BottomNavigation } from "../modules/navigation/BottomNavigation";
import { LeftNavigationModule } from "../modules/navigation/LeftNavigationModule";
import { TopMiddleNavigation } from "../modules/navigation/TopMiddleNavigation";

import useRealmStore from "@/hooks/store/useRealmStore";
import { Redirect } from "wouter";
import { HooksComponent } from "../components/HooksComponent";
import { ActionInfo } from "../components/worldmap/armies/ActionInfo";
import { ArmyInfoLabel } from "../components/worldmap/armies/ArmyInfoLabel";
import { BattleContainer } from "../containers/BattleContainer";
import { BlankOverlayContainer } from "../containers/BlankOverlayContainer";
import RightMiddleContainer from "../containers/RightMiddleContainer";
import TopLeftContainer from "../containers/TopLeftContainer";
import { Tooltip } from "../elements/Tooltip";
import { BattleView } from "../modules/military/battle-view/BattleView";
import { RightNavigationModule } from "../modules/navigation/RightNavigationModule";
import { TopLeftNavigation } from "../modules/navigation/TopLeftNavigation";
import { Transactions } from "../modules/transactions/Transactions";
import { Onboarding } from "./Onboarding";

export const World = () => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const setBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);

  const battleView = useUIStore((state) => state.battleView);

  useEffect(() => {
    if (realmEntityIds.length >= 1) {
      setBlankOverlay(false);
    } else {
      setBlankOverlay(true);
    }
  }, [realmEntityIds]);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
      }}
      className="fixed antialiased top-0 left-0 z-0 w-screen h-screen overflow-hidden ornate-borders pointer-events-none"
    >
      <BlankOverlayContainer open={showModal}>{modalContent}</BlankOverlayContainer>
      <BlankOverlayContainer open={showBlankOverlay}>
        <Onboarding />
      </BlankOverlayContainer>
      <HooksComponent />
      <ActionInfo />
      <ArmyInfoLabel />
      {battleView ? (
        <BattleContainer>
          <BattleView />
        </BattleContainer>
      ) : (
        <>
          <TopMiddleContainer>
            <TopMiddleNavigation />
          </TopMiddleContainer>

          <LeftMiddleContainer>
            <LeftNavigationModule />
          </LeftMiddleContainer>

          <BottomMiddleContainer>
            <BottomNavigation />
          </BottomMiddleContainer>

          <BottomRightContainer>
            <Transactions />
          </BottomRightContainer>

          <RightMiddleContainer>
            <RightNavigationModule />
          </RightMiddleContainer>
        </>
      )}

      <TopLeftContainer>
        <TopLeftNavigation />
      </TopLeftContainer>

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
