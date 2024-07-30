import useUIStore from "../../hooks/store/useUIStore";
import { Leva } from "leva";
import { BottomRightContainer } from "../containers/BottomRightContainer";
import BottomMiddleContainer from "../containers/BottomMiddleContainer";
import TopMiddleContainer from "../containers/TopMiddleContainer";
import LeftMiddleContainer from "../containers/LeftMiddleContainer";
import { LeftNavigationModule } from "../modules/navigation/LeftNavigationModule";
import { BottomNavigation } from "../modules/navigation/BottomNavigation";
import { TopMiddleNavigation } from "../modules/navigation/TopMiddleNavigation";
import { useEffect } from "react";

import { Tooltip } from "../elements/Tooltip";
import { BlankOverlayContainer } from "../containers/BlankOverlayContainer";
import { Onboarding } from "./Onboarding";
import { HooksComponent } from "../components/HooksComponent";
import { Transactions } from "../modules/transactions/Transactions";
import useRealmStore from "@/hooks/store/useRealmStore";
import RightMiddleContainer from "../containers/RightMiddleContainer";
import { RightNavigationModule } from "../modules/navigation/RightNavigationModule";
import { BattleContainer } from "../containers/BattleContainer";
import { Redirect } from "wouter";
import { BattleView } from "../modules/military/battle-view/BattleView";
import TopLeftContainer from "../containers/TopLeftContainer";
import { TopLeftNavigation } from "../modules/navigation/TopLeftNavigation";
import { ActionInfo } from "../components/worldmap/hexagon/ActionInfo";
import { ArmyInfoLabel } from "../components/worldmap/armies/ArmyInfoLabel";

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
    <div className="fixed antialiased top-0 left-0 z-0 w-screen h-screen  overflow-hidden ornate-borders pointer-events-none">
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
