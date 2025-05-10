import { getQuestTilesFromTorii, getStructuresDataFromTorii } from "@/dojo/queries";
import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { LoadingOroborus } from "@/ui/modules/loading-oroborus";
import { LoadingScreen } from "@/ui/modules/loading-screen";
import { getEntityInfo } from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures, useQuests } from "@bibliothecadao/react";
import { getAllStructuresFromToriiClient } from "@bibliothecadao/torii-client";
import { ContractAddress, Tile } from "@bibliothecadao/types";
import { Leva } from "leva";
import { useGameSettingsMetadata, useMiniGames } from "metagame-sdk";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const CustomHooks = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const setDisableButtons = useUIStore((state) => state.setDisableButtons);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const structureInfo = useMemo(
    () => getEntityInfo(structureEntityId, ContractAddress(account.address), components),
    [structureEntityId, account.address, components],
  );

  const structureIsMine = useMemo(() => structureInfo.isMine, [structureInfo]);

  const seasonHasStarted = useMemo(() => env.VITE_PUBLIC_SEASON_START_TIME < Date.now() / 1000, []);

  useEffect(() => {
    const disableButtons = !structureIsMine || account.address === "0x0" || !seasonHasStarted;
    setDisableButtons(disableButtons);
  }, [setDisableButtons, structureIsMine, account.address, seasonHasStarted]);

  return null;
};

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
  const syncedStructures = useRef<Set<string>>(new Set());
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);
  const minigameStore = useMinigameStore.getState();
  const { setup, account } = useDojo();
  const playerStructures = usePlayerStructures();
  const quests = useQuests();
  const setLoading = useUIStore((state) => state.setLoading);

  // Consolidated subscription logic into a single function
  const syncStructures = useCallback(
    async ({ structures }: { structures: { entityId: number; position: { col: number; row: number } }[] }) => {
      if (!structures.length) return;

      try {
        const start = performance.now();
        setLoading(LoadingStateKey.AllPlayerStructures, true);
        await getStructuresDataFromTorii(
          setup.network.toriiClient,
          setup.network.contractComponents as any,
          structures,
        );
        const end = performance.now();

        console.log(
          `[sync] structures query structures ${structures.map((s) => `${s.entityId}(${s.position.col},${s.position.row})`)}`,
          end - start,
        );
      } catch (error) {
        console.error("Failed to sync structures:", error);
      } finally {
        setLoading(LoadingStateKey.AllPlayerStructures, false);
      }
    },
    [setup.network.toriiClient, setup.network.contractComponents],
  );

  // Function to update the synced structures ref
  const setSyncedStructures = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    syncedStructures.current = updater(syncedStructures.current);
  }, []);

  const [fetchedStructures, setFetchedStructures] = useState<
    { entityId: number; position: { col: number; row: number } }[]
  >([]);

  // Fetch all structures from Torii client
  useEffect(() => {
    const fetchAllStructures = async () => {
      if (!account.account) return;

      try {
        const structures = await getAllStructuresFromToriiClient(setup.network.toriiClient, account.account.address);
        setFetchedStructures(structures);
      } catch (error) {
        console.error("Failed to fetch structures:", error);
      }
    };

    fetchAllStructures();
  }, [account.account, setup]);

  // Handle structure synchronization
  useEffect(() => {
    if (!account.account) return;

    const syncUnsyncedStructures = async () => {
      try {
        // Combine structures from both sources
        const allStructureIds = new Set([
          ...fetchedStructures.map((structure) => structure.entityId.toString()),
          ...playerStructures.map((structure) => structure.structure.entity_id.toString()),
        ]);

        // Find structures that haven't been synced yet
        const unsyncedIds = Array.from(allStructureIds)
          .filter((id) => !syncedStructures.current.has(id))
          .map(Number);

        if (unsyncedIds.length === 0) return;

        // Prepare structures with positions for syncing
        const structuresToSync = unsyncedIds.reduce(
          (acc, entityId) => {
            // Try to find position from fetched structures
            const fetchedStructure = fetchedStructures.find((s) => s.entityId === entityId);

            if (fetchedStructure) {
              acc.push({
                entityId,
                position: fetchedStructure.position,
              });
              return acc;
            }

            // Otherwise try to find in player structures
            const playerStructure = playerStructures.find((s) => Number(s.structure.entity_id) === entityId);

            if (playerStructure?.structure.base) {
              acc.push({
                entityId,
                position: {
                  col: playerStructure.structure.base.coord_x,
                  row: playerStructure.structure.base.coord_y,
                },
              });
            }

            return acc;
          },
          [] as { entityId: number; position: { col: number; row: number } }[],
        );

        // Mark all these structures as synced
        if (structuresToSync.length > 0) {
          setSyncedStructures((prev) => {
            const newSet = new Set(prev);
            structuresToSync.forEach((s) => newSet.add(s.entityId.toString()));
            return newSet;
          });

          // Sync the structures with the network
          await syncStructures({ structures: structuresToSync });
        }
      } catch (error) {
        console.error("Failed to sync structures:", error);
      }
    };

    syncUnsyncedStructures();
  }, [account.account, playerStructures, fetchedStructures, syncStructures, setSyncedStructures]);

  const syncQuestTiles = useCallback(
    async ({ questTiles }: { questTiles: Tile[] }) => {
      if (!questTiles.length) return;

      try {
        const start = performance.now();
        setLoading(LoadingStateKey.Quests, true);
        await getQuestTilesFromTorii(
          setup.network.toriiClient,
          setup.network.contractComponents as any,
          questTiles.map((q) => q.occupier_id),
        );
        const end = performance.now();
        console.log(
          `[sync] quest tiles query questTiles ${questTiles.map((q) => `${q.occupier_id}(${q.col},${q.row})`)}`,
          end - start,
        );
      } catch (error) {
        console.error("Failed to sync quest tiles:", error);
      } finally {
        setLoading(LoadingStateKey.Quests, false);
      }
    },
    [setup.network.toriiClient, setup.network.contractComponents],
  );

  useEffect(() => {
    if (quests.length > 0) {
      syncQuestTiles({ questTiles: quests });
    }
  }, [quests, syncQuestTiles]);

  const { data: minigames } = useMiniGames({});

  const { data: settingsMetadata } = useGameSettingsMetadata({ gameAddress: minigames?.[0]?.contract_address });

  useEffect(() => {
    if (minigames) {
      minigameStore.setMinigames(minigames);
    }

    if (settingsMetadata) {
      minigameStore.setSettingsMetadata(settingsMetadata);
    }
  }, [minigames, settingsMetadata, minigameStore]);

  return (
    <>
      <CustomHooks />
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
