import { getStructuresDataFromTorii } from "@/dojo/queries";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingOroborus } from "@/ui/modules/loading-oroborus";
import { LoadingScreen } from "@/ui/modules/loading-screen";
import { getAllStructures, PlayerStructure } from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { Leva } from "leva";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
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
const Onboarding = lazy(() => import("./onboarding").then((module) => ({ default: module.Onboarding })));

const MiniMapNavigation = lazy(() =>
  import("../modules/navigation/mini-map-navigation").then((module) => ({ default: module.MiniMapNavigation })),
);

const RealmTransferManager = lazy(() =>
  import("../components/resources/realm-transfer-manager").then((module) => ({ default: module.RealmTransferManager })),
);

// Modal component to prevent unnecessary World re-renders
const ModalOverlay = () => {
  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);

  return (
    <Suspense fallback={null}>
      <BlankOverlayContainer zIndex={120} open={showModal}>
        {modalContent}
      </BlankOverlayContainer>
    </Suspense>
  );
};

// Blank overlay component for onboarding
const OnboardingOverlay = ({ backgroundImage }: { backgroundImage: string }) => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);

  return (
    <Suspense fallback={null}>
      <BlankOverlayContainer zIndex={110} open={showBlankOverlay}>
        <Onboarding backgroundImage={backgroundImage} />
      </BlankOverlayContainer>
    </Suspense>
  );
};

export const World = ({ backgroundImage }: { backgroundImage: string }) => {
  const [syncedStructures, setSyncedStructures] = useState<Set<string>>(new Set());
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);
  const { setup, account } = useDojo();
  const playerStructures = usePlayerStructures();

  // Consolidated subscription logic into a single function
  const syncStructures = useCallback(
    async (structureIds: number[]) => {
      if (!structureIds.length) return;

      try {
        const start = performance.now();
        await getStructuresDataFromTorii(
          setup.network.toriiClient,
          setup.network.contractComponents as any,
          structureIds,
        );
        const end = performance.now();
        console.log("[keys] structures query", end - start);

        setSyncedStructures((prev) => {
          const newSet = new Set(prev);
          structureIds.forEach((id) => newSet.add(id.toString()));
          return newSet;
        });
      } catch (error) {
        console.error("Failed to sync structures:", error);
      }
    },
    [setup.network.toriiClient, setup.network.contractComponents],
  );

  // Handle initial structure fetch and sync
  useEffect(() => {
    const fetchAndSyncStructures = async () => {
      if (!account.account) return;

      try {
        const structures = await getAllStructures(setup, account.account.address);
        if (!structures) return;

        const unsyncedStructureIds = structures
          .map((structure) => Number(structure.entityId))
          .filter((id) => !syncedStructures.has(id.toString()));

        await syncStructures(unsyncedStructureIds);
      } catch (error) {
        console.error("Failed to fetch structures:", error);
      }
    };

    fetchAndSyncStructures();
  }, [account.account, syncStructures]);

  // Handle syncing of new structures from playerStructures
  useEffect(() => {
    const unsyncedStructures = playerStructures.filter(
      (structure: PlayerStructure) => !syncedStructures.has(structure.structure.entity_id.toString()),
    );

    if (unsyncedStructures.length > 0) {
      const structureIds = unsyncedStructures.map((structure) => Number(structure.structure.entity_id));
      syncStructures(structureIds);
    }
  }, [playerStructures, syncStructures]);

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
          <RealmTransferManager zIndex={100} />

          {/* Extracted modal components */}
          <ModalOverlay />
          <OnboardingOverlay backgroundImage={backgroundImage} />

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
              <RightNavigationModule structures={playerStructures} />
            </RightMiddleContainer>

            <TopLeftContainer>
              <TopLeftNavigation structures={playerStructures} />
            </TopLeftContainer>
          </div>

          <LoadingOroborus loading={isLoadingScreenEnabled} />

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
