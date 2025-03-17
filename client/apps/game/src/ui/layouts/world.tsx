import { syncMarketAndBankData, syncPlayerStructuresData, syncStructureData } from "@/dojo/sync";
import { useStructureEntityId } from "@/hooks/helpers/use-structure-entity-id";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingOroborus } from "@/ui/modules/loading-oroborus";
import { LoadingScreen } from "@/ui/modules/loading-screen";
import { ADMIN_BANK_ENTITY_ID, PlayerStructure } from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Leva } from "leva";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { env } from "../../../env";
import { NotLoggedInMessage } from "../components/not-logged-in-message";

// Lazy load components
const SelectedArmy = lazy(() =>
  import("../components/worldmap/actions/selected-worldmap-entity").then((module) => ({
    default: module.SelectedWorldmapEntity,
  })),
);

const ActionInfo = lazy(() =>
  import("../components/worldmap/actions/action-info").then((module) => ({ default: module.ActionInfo })),
);

const ActionInstructions = lazy(() =>
  import("../components/worldmap/actions/action-instructions").then((module) => ({
    default: module.ActionInstructions,
  })),
);

const BlankOverlayContainer = lazy(() =>
  import("../containers/blank-overlay-container").then((module) => ({ default: module.BlankOverlayContainer })),
);
const EntitiesInfoLabel = lazy(() =>
  import("../components/worldmap/entities/entities-label").then((module) => ({
    default: module.EntityInfoLabel,
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
  import("../modules/navigation/top-navigation").then((module) => ({ default: module.TopMiddleNavigation })),
);
const BottomMiddleContainer = lazy(() =>
  import("../containers/bottom-middle-container").then((module) => ({ default: module.BottomMiddleContainer })),
);
const LeftNavigationModule = lazy(() =>
  import("../modules/navigation/left-navigation-module").then((module) => ({ default: module.LeftNavigationModule })),
);
const RightNavigationModule = lazy(() =>
  import("../modules/navigation/right-navigation-module").then((module) => ({
    default: module.RightNavigationModule,
  })),
);
const TopLeftNavigation = lazy(() =>
  import("../modules/navigation/top-left-navigation").then((module) => ({ default: module.TopLeftNavigation })),
);
const EventStream = lazy(() =>
  import("../modules/stream/event-stream").then((module) => ({ default: module.EventStream })),
);
const Onboarding = lazy(() => import("./onboarding").then((module) => ({ default: module.Onboarding })));
const OrientationOverlay = lazy(() =>
  import("../components/overlays/orientation-overlay").then((module) => ({ default: module.OrientationOverlay })),
);

const MiniMapNavigation = lazy(() =>
  import("../modules/navigation/mini-map-navigation").then((module) => ({ default: module.MiniMapNavigation })),
);

const RealmTransferManager = lazy(() =>
  import("../components/resources/realm-transfer-manager").then((module) => ({ default: module.RealmTransferManager })),
);

export const World = ({ backgroundImage }: { backgroundImage: string }) => {
  const [subscriptions, setSubscriptions] = useState<{ [entity: string]: boolean }>({});
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);
  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  // Setup hooks
  useStructureEntityId();

  // We could optimise this deeper....
  const setLoading = useUIStore((state) => state.setLoading);

  const dojo = useDojo();

  const playerStructures = usePlayerStructures();

  const filteredStructures = useMemo(
    () =>
      playerStructures.filter((structure: PlayerStructure) => !subscriptions[structure.structure.entity_id.toString()]),
    [playerStructures, subscriptions],
  );

  useEffect(() => {
    if (
      !structureEntityId ||
      subscriptions[structureEntityId.toString()] ||
      subscriptions[ADMIN_BANK_ENTITY_ID.toString()] ||
      structureEntityId === 999999999
    ) {
      return;
    }

    const structureBase = getComponentValue(
      dojo.setup.components.Structure,
      getEntityIdFromKeys([BigInt(structureEntityId)]),
    )?.base;

    setSubscriptions((prev) => ({
      ...prev,
      [structureEntityId.toString()]: true,
      [ADMIN_BANK_ENTITY_ID.toString()]: true,
      ...Object.fromEntries(filteredStructures.map((structure) => [structure.structure.entity_id.toString(), true])),
    }));

    syncStructureData(
      dojo.setup,
      structureEntityId.toString(),
      setLoading,
      structureBase ? { x: structureBase.coord_x, y: structureBase.coord_y } : undefined,
    );
  }, [structureEntityId, subscriptions]);

  useEffect(() => {
    syncPlayerStructuresData(dojo.setup, filteredStructures, setLoading);
  }, [playerStructures.length]);

  useEffect(() => {
    syncMarketAndBankData(dojo.setup, setLoading);
  }, []);

  return (
    <>
      <NotLoggedInMessage />

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
          <LoadingOroborus loading={isLoadingScreenEnabled} />
          <RealmTransferManager zIndex={100} />
          <BlankOverlayContainer zIndex={120} open={showModal}>
            {modalContent}
          </BlankOverlayContainer>
          <BlankOverlayContainer zIndex={110} open={showBlankOverlay}>
            <Onboarding backgroundImage={backgroundImage} />
          </BlankOverlayContainer>
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
              <TopLeftNavigation structures={playerStructures} />
            </TopLeftContainer>
          </div>

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
