import { Background as BackgroundContainer } from "../containers/Background";
import { MainScene } from "../modules/scenes/MainScene";
import useUIStore from "../../hooks/store/useUIStore";
import { Leva } from "leva";
import { BottomRightContainer } from "../containers/BottomRightContainer";
import BottomMiddleContainer from "../containers/BottomMiddleContainer";
import TopContainer from "../containers/TopContainer";
import TopMiddleContainer from "../containers/TopMiddleContainer";
import LeftMiddleContainer from "../containers/LeftMiddleContainer";
import { LeftNavigationModule } from "../modules/navigation/LeftNavigationModule";
import { BottomNavigation } from "../modules/navigation/BottomNavigation";
import { TopMiddleNavigation } from "../modules/navigation/TopMiddleNavigation";
import { useEffect } from "react";
import clsx from "clsx";
import { Redirect } from "wouter";
import { useProgress } from "@react-three/drei";
import { NotificationsComponent } from "../components/notifications/NotificationsComponent";
import { Tooltip } from "../elements/Tooltip";
import { BlankOverlayContainer } from "../containers/BlankOverlayContainer";
import { Onboarding } from "./Onboarding";
import { HooksComponent } from "../components/HooksComponent";
import { Transactions } from "../modules/transactions/Transactions";
import useRealmStore from "@/hooks/store/useRealmStore";
import TopLeftContainer from "../containers/TopLeftContainer";
import { QuestList } from "../components/hints/HintBox";

export const World = () => {
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  const progress = useProgress((state) => state.progress);

  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const setBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);
  const toggleModal = useUIStore((state) => state.toggleModal);

  useEffect(() => {
    if (realmEntityIds.length > 4) {
      setBlankOverlay(false);
    } else {
      setBlankOverlay(true);
    }
  }, [realmEntityIds]);

  useEffect(() => {
    if (progress === 100) {
      setIsLoadingScreenEnabled(false);
    } else {
      setIsLoadingScreenEnabled(true);
    }
  }, [progress]);

  return (
    <div className="fixed antialiased top-0 left-0 z-0 w-screen h-screen  overflow-hidden">
      <BlankOverlayContainer open={showModal}>{modalContent}</BlankOverlayContainer>
      <BlankOverlayContainer open={showBlankOverlay}>
        <Onboarding />
      </BlankOverlayContainer>
      <HooksComponent />

      <BackgroundContainer className=" rounded-xl relative">
        <div className="absolute top-0 left-0 z-10 w-full pointer-events-none rounded-xl h-12 bg-gradient-to-b from-black/20 to-transparent opacity-90" />
        <div className="h-full w-full main-scene">
          <MainScene />
        </div>
        <div className="absolute bottom-0 left-0 z-10 w-full pointer-events-none rounded-xl h-44 bg-gradient-to-t from-black/20 to-transparent opacity-90" />
        <div
          className={clsx(
            "absolute bottom-0 left-0 z-20 w-full pointer-events-none flex items-center text-white justify-center text-3xl rounded-xl h-full bg-black duration-300 transition-opacity",
            isLoadingScreenEnabled ? "opacity-100" : "opacity-0",
          )}
        >
          <img src="/images/eternum-logo_animated.png" className=" invert scale-50" />
        </div>
      </BackgroundContainer>

      {/* TOP */}
      <TopMiddleContainer>
        <TopMiddleNavigation />
      </TopMiddleContainer>
      {/* <TopLeftContainer>
        <QuestList />
      </TopLeftContainer> */}
      {/* LEFT */}
      <LeftMiddleContainer>
        <LeftNavigationModule />
      </LeftMiddleContainer>

      {/* BOTTOM */}
      <BottomMiddleContainer>
        <BottomNavigation />
      </BottomMiddleContainer>
      <BottomRightContainer>
        <Transactions />
      </BottomRightContainer>

      <Leva hidden={import.meta.env.PROD || import.meta.env.HIDE_THREEJS_MENU} />
      <Tooltip />
      <div className="absolute bottom-4 right-6 text-white text-xs text-white/60 hover:text-white">
        <a target="_blank" href="https://github.com/BibliothecaDAO/eternum">
          v0.5.0
        </a>
      </div>
    </div>
  );
};
