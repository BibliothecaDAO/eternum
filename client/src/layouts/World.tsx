import { Background as BackgroundContainer } from "../containers/Background";
import { MainScene } from "../modules/scenes/MainScene";
import useUIStore, { Background } from "../hooks/store/useUIStore";
import ActiveLink from "../elements/ActiveLink";
import { Leva } from "leva";
import { BottomRightContainer } from "../containers/BottomRightContainer";
import ChatModule from "../modules/ChatModule";
import NetworkModule from "../modules/NetworkModule";
import BottomMiddleContainer from "../containers/BottomMiddleContainer";
import WolrdMapLayersModule from "../modules/WorldMapLayersModule";
import TopContainer from "../containers/TopContainer";
import ContextsModule from "../modules/ContextsModule";
import NavigationModule from "../modules/NavigationModule";
import ContentContainer from "../containers/ContentContainer";
import RealmManagementModule from "../modules/RealmManagementModule";
import EpochCountdown from "../components/network/EpochCountdown";
import RealmStatusComponent from "../components/cityview/realm/RealmStatusComponent";
import { Redirect } from "wouter";
import RealmResourcesComponent from "../components/cityview/realm/RealmResourcesComponent";
import { useFetchBlockchainData } from "../hooks/store/useBlockchainStore";
import { useMemo } from "react";


export const World = () => {
  useFetchBlockchainData()

  const isSoundOn = useUIStore(
    (state) => state.isSoundOn,
  );

  useMemo(() => {
    if (isSoundOn) {

    }
  }, [isSoundOn]);

  return (
    <div className="fixed top-0 left-0 z-0 w-screen h-screen p-2">
      <BackgroundContainer className="border-2 border-[#E0AF65] rounded-xl relative">
        <div className="absolute top-0 left-0 z-10 w-full pointer-events-none rounded-xl h-44 bg-gradient-to-b from-black to-transparent opacity-90" />
        <MainScene />
        <div className="absolute bottom-0 left-0 z-10 w-full pointer-events-none rounded-xl h-44 bg-gradient-to-t from-black to-transparent opacity-90" />
      </BackgroundContainer>
      <TopContainer>
        <NetworkModule />
        <div className="flex">
          <NavigationModule />
          <RealmResourcesComponent className="ml-20 -mt-1" />
          <RealmStatusComponent className="ml-auto -translate-y-1/2" />
        </div>

        {/* <ContextsModule /> */}
      </TopContainer>
      <ContentContainer>
        <RealmManagementModule />
      </ContentContainer>
      <BottomMiddleContainer>
        {/* <WolrdMapLayersModule /> */}
      </BottomMiddleContainer>
      <BottomRightContainer>
        <ChatModule />
      </BottomRightContainer>
      <EpochCountdown />
      <Leva hidden />
      {/* <Redirect to="/map" /> */}
    </div>
  );
};
