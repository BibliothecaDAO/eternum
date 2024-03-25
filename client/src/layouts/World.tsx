import { Background as BackgroundContainer } from "../containers/Background";
import { MainScene } from "../modules/scenes/MainScene";
import useUIStore from "../hooks/store/useUIStore";
import { Leva } from "leva";
import { BottomRightContainer } from "../containers/BottomRightContainer";
import ChatModule from "../modules/ChatModule";
import NetworkModule from "../modules/NetworkModule";
import BottomMiddleContainer from "../containers/BottomMiddleContainer";
import TopContainer from "../containers/TopContainer";
import NavigationModule from "../modules/NavigationModule";
import ContentContainer from "../containers/ContentContainer";
import RealmManagementModule from "../modules/RealmManagementModule";
import RealmResourcesComponent from "../components/cityview/realm/RealmResourcesComponent";
import { useEffect, useMemo } from "react";
import clsx from "clsx";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { useProgress } from "@react-three/drei";
import { NotificationsComponent } from "../components/notifications/NotificationsComponent";
import WorldMapMenuModule from "../modules/WorldMapMenuModule";
import { Tooltip } from "../elements/Tooltip";
import { BlankOverlayContainer } from "../containers/BlankOverlayContainer";
import { Onboarding } from "./Onboarding";
import { WorldPopups } from "../components/worldmap/WorldPopups";
import EpochCountdown from "../components/network/EpochCountdown";
import { HooksComponent } from "../components/HooksComponent";

export const World = () => {
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const setMouseCoords = useUIStore((state) => state.setMouseCoords);

  // only for dev
  // useEffect(() => {
  //   const printUuid = async () => {
  //     let nextUuid = await uuid();
  //     console.log({ nextUuid });
  //   };
  //   printUuid();
  // });
  const progress = useProgress((state) => state.progress);

  useEffect(() => {
    if (progress === 100) {
      setIsLoadingScreenEnabled(false);
    } else {
      setIsLoadingScreenEnabled(true);
    }
  }, [progress]);

  const [location] = useLocation();
  // location type
  const locationType = useMemo(() => {
    if (location === "/map" || location === "/") {
      return "map";
    } else {
      return "realm";
    }
  }, [location]);

  return (
    <div
      onMouseMove={(e) =>
        setMouseCoords({
          x: e.clientX,
          y: e.clientY,
        })
      }
      className="fixed antialiased top-0 left-0 z-0 w-screen h-screen p-2 overflow-hidden"
    >
      <WorldPopups />
      <BackgroundContainer className="border-2 border-[#E0AF65] rounded-xl relative">
        <div className="absolute top-0 left-0 z-10 w-full pointer-events-none rounded-xl h-44 bg-gradient-to-b from-black to-transparent opacity-90" />
        <div className="h-full w-full main-scene">
          <MainScene />
        </div>
        <div className="absolute bottom-0 left-0 z-10 w-full pointer-events-none rounded-xl h-44 bg-gradient-to-t from-black to-transparent opacity-90" />
        <div
          className={clsx(
            "absolute bottom-0 left-0 z-20 w-full pointer-events-none flex items-center text-white justify-center text-3xl rounded-xl h-full bg-black duration-300 transition-opacity",
            isLoadingScreenEnabled ? "opacity-100" : "opacity-0",
          )}
        >
          <img src="/images/eternum-logo_animated.png" className=" invert scale-50" />
        </div>
      </BackgroundContainer>
      <TopContainer>
        {/* <NetworkModule /> */}
        <div className="flex">
          <NavigationModule />
          <NotificationsComponent className="" />
        </div>
        <RealmResourcesComponent />
      </TopContainer>
      <ContentContainer>
        <Switch location={locationType}>
          <Route path="map">
            <WorldMapMenuModule />
          </Route>
          <Route path="realm">
            <RealmManagementModule />
          </Route>
        </Switch>
      </ContentContainer>
      <BottomMiddleContainer>{<></>}</BottomMiddleContainer>
      <BottomRightContainer>
        <ChatModule />
      </BottomRightContainer>
      <BlankOverlayContainer>
        <Onboarding />
      </BlankOverlayContainer>
      <Leva hidden={import.meta.env.PROD || import.meta.env.HIDE_THREEJS_MENU} />
      <Tooltip />
      <Redirect to="/map" />
      <div className="absolute bottom-4 right-6 text-white text-xs text-white/60">v0.4.0</div>
      <EpochCountdown />
      <HooksComponent />
    </div>
  );
};
