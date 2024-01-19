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
import { useFetchBlockchainData } from "../hooks/store/useBlockchainStore";
import { useEffect, useMemo } from "react";
import clsx from "clsx";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { useProgress } from "@react-three/drei";
import { BlurOverlayContainer } from "../containers/BlurOverlayContainer";
import useSound from "use-sound";
import { NotificationsComponent } from "../components/NotificationsComponent";
import WorldMapMenuModule from "../modules/WorldMapMenuModule";
import { Tooltip } from "../elements/Tooltip";
import useCombatHistoryStore from "../hooks/store/useCombatHistoryStore";
import useRealmStore from "../hooks/store/useRealmStore";
import { BlankOverlayContainer } from "../containers/BlankOverlayContainer";
import { Onboarding } from "../plugins/onboarding/components/Onboarding";
import { useComputeMarket } from "../hooks/store/useMarketStore";
import { useRefreshHyperstructure } from "../hooks/store/useRefreshHyperstructure";

export const World = () => {
  const setBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const setMouseCoords = useUIStore((state) => state.setMouseCoords);
  const syncCombatHistory = useCombatHistoryStore((state) => state.syncData);
  const isSoundOn = useUIStore((state) => state.isSoundOn);
  const musicLevel = useUIStore((state) => state.musicLevel);
  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const { refreshAllHyperstructures } = useRefreshHyperstructure();

  // only for dev
  // useEffect(() => {
  //   const printUuid = async () => {
  //     let nextUuid = await uuid();
  //     console.log({ nextUuid });
  //   };
  //   printUuid();
  // });

  useFetchBlockchainData();
  useComputeMarket();

  const progress = useProgress((state) => state.progress);

  useEffect(() => {
    if (realmEntityIds.length > 4) {
      setBlankOverlay(false);
    } else {
      setBlankOverlay(true);
    }
  }, []);

  useEffect(() => {
    syncCombatHistory(realmEntityId);
  }, [realmEntityId]);

  const [playBackground, { stop }] = useSound("/sound/music/happy_realm.mp3", {
    soundEnabled: isSoundOn,
    volume: musicLevel / 100,
    loop: true,
  });

  useEffect(() => {
    if (isSoundOn) {
      playBackground();
    } else {
      stop();
    }
  }, [isSoundOn]);

  useEffect(() => {
    refreshAllHyperstructures();
  }, [realmEntityIds]);

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
      <BackgroundContainer className="border-2 border-[#E0AF65] rounded-xl relative">
        <div className="absolute top-0 left-0 z-10 w-full pointer-events-none rounded-xl h-44 bg-gradient-to-b from-black to-transparent opacity-90" />
        <MainScene />
        <div className="absolute bottom-0 left-0 z-10 w-full pointer-events-none rounded-xl h-44 bg-gradient-to-t from-black to-transparent opacity-90" />
        <div
          className={clsx(
            "absolute bottom-0 left-0 z-20 w-full pointer-events-none flex items-center text-white justify-center text-3xl rounded-xl h-full bg-black duration-500 transition-opacity",
            isLoadingScreenEnabled ? "opacity-100" : "opacity-0",
          )}
        >
          <img src="/images/eternum-logo_animated.png" className=" invert scale-50" />
        </div>
      </BackgroundContainer>
      {!showBlankOverlay && (
        <TopContainer>
          <NetworkModule />
          <div className="flex">
            <NavigationModule />
            <NotificationsComponent className="" />
          </div>
          <RealmResourcesComponent />
          {/* <ContextsModule /> */}
        </TopContainer>
      )}
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
      {/* <BottomMiddleContainer><WolrdMapLayersModule /></BottomMiddleContainer> */}
      <BottomMiddleContainer>{<></>}</BottomMiddleContainer>
      <BottomRightContainer>
        <ChatModule />
      </BottomRightContainer>
      <BlankOverlayContainer open={showBlankOverlay}>
        <Onboarding />
      </BlankOverlayContainer>
      <BlurOverlayContainer>
        {/* <SignUpComponent isWorldLive={isWorldLive} worldLoading={worldLoading} worldProgress={worldProgress} /> */}
      </BlurOverlayContainer>
      <Leva hidden={import.meta.env.PROD || import.meta.env.HIDE_THREEJS_MENU} />
      <Tooltip />
      <Redirect to="/map" />
      <div className="absolute bottom-4 right-6 text-white text-xs text-white/60">v0.3.0</div>
    </div>
  );
};
