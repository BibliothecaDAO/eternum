import {
  debouncedGetDonkeysAndArmiesFromTorii,
  debouncedGetEntitiesFromTorii,
  debouncedGetMarketFromTorii,
  debouncedGetOneKeyEntitiesByRealmEntityIdFromTorii,
} from "@/dojo/debounced-queries";
import { useStructureEntityId } from "@/hooks/helpers/use-structure-entity-id";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { LoadingOroborus } from "@/ui/modules/loading-oroborus";
import { LoadingScreen } from "@/ui/modules/loading-screen";
import { ADMIN_BANK_ENTITY_ID, PlayerStructure } from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Leva } from "leva";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { env } from "../../../env";
import { IS_MOBILE } from "../config";

// Lazy load components
const SelectedArmy = lazy(() =>
  import("../components/worldmap/armies/selected-army").then((module) => ({ default: module.SelectedArmy })),
);

const ActionInfo = lazy(() =>
  import("../components/worldmap/armies/action-info").then((module) => ({ default: module.ActionInfo })),
);

const ActionInstructions = lazy(() =>
  import("../components/worldmap/armies/action-instructions").then((module) => ({
    default: module.ActionInstructions,
  })),
);

const ArmyInfoLabel = lazy(() =>
  import("../components/worldmap/armies/army-info-label").then((module) => ({ default: module.ArmyInfoLabel })),
);

const BattleInfoLabel = lazy(() =>
  import("../components/worldmap/battles/battle-label").then((module) => ({ default: module.BattleInfoLabel })),
);

const BlankOverlayContainer = lazy(() =>
  import("../containers/blank-overlay-container").then((module) => ({ default: module.BlankOverlayContainer })),
);
const StructureInfoLabel = lazy(() =>
  import("../components/worldmap/structures/structure-label").then((module) => ({
    default: module.StructureInfoLabel,
  })),
);
const BattleContainer = lazy(() =>
  import("../containers/battle-container").then((module) => ({ default: module.BattleContainer })),
);
const TopCenterContainer = lazy(() => import("../containers/top-center-container"));
const BottomRightContainer = lazy(() =>
  import("../containers/bottom-right-container").then((module) => ({ default: module.BottomRightContainer })),
);
const LeftMiddleContainer = lazy(() => import("../containers/left-middle-container"));
const RightMiddleContainer = lazy(() => import("../containers/right-middle-container"));
const TopLeftContainer = lazy(() => import("../containers/top-left-container"));
const Tooltip = lazy(() => import("../elements/tooltip").then((module) => ({ default: module.Tooltip })));
const BattleView = lazy(() =>
  import("../modules/military/battle-view/battle-view").then((module) => ({ default: module.BattleView })),
);
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

export const World = ({ backgroundImage }: { backgroundImage: string }) => {
  const [subscriptions, setSubscriptions] = useState<{ [entity: string]: boolean }>({});
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);
  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);
  const battleView = useUIStore((state) => state.battleView);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  console.log("rerender world");

  // Setup hooks
  useStructureEntityId();

  // We could optimise this deeper....
  const setLoading = useUIStore((state) => state.setLoading);

  const dojo = useDojo();

  const playerStructures = usePlayerStructures();

  const filteredStructures = useMemo(
    () => playerStructures.filter((structure: PlayerStructure) => !subscriptions[structure.entity_id.toString()]),
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

    const position = getComponentValue(
      dojo.setup.components.Position,
      getEntityIdFromKeys([BigInt(structureEntityId)]),
    );

    setSubscriptions((prev) => ({
      ...prev,
      [structureEntityId.toString()]: true,
      [ADMIN_BANK_ENTITY_ID.toString()]: true,
      ...Object.fromEntries(filteredStructures.map((structure) => [structure.entity_id.toString(), true])),
    }));

    setLoading(LoadingStateKey.SelectedStructure, true);
    const fetch = async () => {
      try {
        let start = performance.now();
        await Promise.all([
          debouncedGetEntitiesFromTorii(
            dojo.network.toriiClient,
            dojo.network.contractComponents as any,
            [structureEntityId.toString()],
            [
              "s1_eternum-BuildingQuantityv2",
              "s1_eternum-Hyperstructure",
              "s1_eternum-Resource",
              "s1_eternum-Building",
              "s1_eternum-Quest",
            ],
            [{ x: position?.x || 0, y: position?.y || 0 }],
            () => setLoading(LoadingStateKey.SelectedStructure, false),
          ),
        ]);
        let end = performance.now();
        console.log("[composite] structure query", end - start);
      } catch (error) {
        console.error("Fetch failed", error);
      }
    };

    fetch();
  }, [structureEntityId]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(LoadingStateKey.PlayerStructuresOneKey, true);
      setLoading(LoadingStateKey.PlayerStructuresTwoKey, true);
      setLoading(LoadingStateKey.DonkeysAndArmies, true);

      try {
        let start = performance.now();
        await debouncedGetEntitiesFromTorii(
          dojo.network.toriiClient,
          dojo.network.contractComponents as any,
          [...filteredStructures.map((structure) => structure.entity_id.toString())],
          [
            "s1_eternum-BuildingQuantityv2",
            "s1_eternum-Hyperstructure",
            "s1_eternum-Resource",
            "s1_eternum-Building",
            "s1_eternum-Quest",
          ],
          [...filteredStructures.map((structure) => ({ x: structure.position.x, y: structure.position.y }))],
          () => setLoading(LoadingStateKey.PlayerStructuresOneKey, false),
        );
        let end = performance.now();
        console.log("[composite] buildings query", end - start);

        start = performance.now();
        await debouncedGetOneKeyEntitiesByRealmEntityIdFromTorii(
          dojo.network.toriiClient,
          dojo.network.contractComponents as any,
          [...filteredStructures.map((structure) => structure.entity_id.toString())],
          () => setLoading(LoadingStateKey.PlayerStructuresTwoKey, false),
        );
        end = performance.now();
        console.log("[composite] realm one key query", end - start);

        start = performance.now();
        await debouncedGetDonkeysAndArmiesFromTorii(
          dojo.network.toriiClient,
          dojo.network.contractComponents as any,
          [...playerStructures.map((structure) => structure.entity_id)],
          () => setLoading(LoadingStateKey.DonkeysAndArmies, false),
        );
        end = performance.now();
        console.log("[composite] donkeys and armies query", end - start);
      } catch (error) {
        console.error("Fetch failed", error);
      }
    };

    fetch();
  }, [playerStructures.length]);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(LoadingStateKey.Market, true);
        setLoading(LoadingStateKey.Bank, true);

        let start = performance.now();
        await debouncedGetEntitiesFromTorii(
          dojo.network.toriiClient,
          dojo.network.contractComponents as any,
          [ADMIN_BANK_ENTITY_ID.toString()],
          [
            "s1_eternum-BuildingQuantityv2",
            "s1_eternum-Hyperstructure",
            "s1_eternum-Resource",
            "s1_eternum-Building",
            "s1_eternum-Quest",
          ],
          undefined,
          () => setLoading(LoadingStateKey.Bank, false),
        );
        let end = performance.now();
        console.log("[keys] bank query", end - start);

        await debouncedGetMarketFromTorii(dojo.network.toriiClient, dojo.network.contractComponents as any, () =>
          setLoading(LoadingStateKey.Market, false),
        );
      } catch (error) {
        console.error("Fetch failed", error);
      } finally {
        // Ensure loading states are reset even if there's an error
        setLoading(LoadingStateKey.Bank, false);
        setLoading(LoadingStateKey.Market, false);
      }
    };

    fetch();
  }, []);

  const battleViewContent = useMemo(
    () => (
      <div>
        <Suspense fallback={<LoadingOroborus loading={true} />}>
          {battleView && (
            <BattleContainer>
              <BattleView />
            </BattleContainer>
          )}
        </Suspense>
      </div>
    ),
    [battleView],
  );

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
      className="world-selector fixed antialiased top-0 left-0 z-0 w-screen h-screen overflow-hidden ornate-borders pointer-events-none"
    >
      <div className="vignette" />

      <Suspense fallback={<LoadingScreen backgroundImage={backgroundImage} />}>
        {IS_MOBILE && <OrientationOverlay />}
        <LoadingOroborus loading={isLoadingScreenEnabled} />
        <BlankOverlayContainer open={showModal}>{modalContent}</BlankOverlayContainer>
        <BlankOverlayContainer open={showBlankOverlay}>
          <Onboarding backgroundImage={backgroundImage} />
        </BlankOverlayContainer>
        {/* <Onboarding backgroundImage={backgroundImage} /> */}
        <ActionInstructions />
        {!IS_MOBILE && (
          <>
            <ActionInfo />
            <ArmyInfoLabel />
            <StructureInfoLabel />
            <BattleInfoLabel />
          </>
        )}

        {battleViewContent}

        <div className={`${battleView ? "opacity-0 pointer-events-none" : ""}`}>
          <LeftMiddleContainer>
            <LeftNavigationModule />
          </LeftMiddleContainer>

          <TopCenterContainer>
            <TopMiddleNavigation />
          </TopCenterContainer>

          <BottomMiddleContainer>
            <SelectedArmy />
          </BottomMiddleContainer>

          {!IS_MOBILE && (
            <>
              <BottomRightContainer>
                <MiniMapNavigation />
              </BottomRightContainer>
              <RightMiddleContainer>
                <RightNavigationModule />
              </RightMiddleContainer>
            </>
          )}

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
  );
};

const VersionDisplay = () => (
  <div className="absolute bottom-4 right-6 text-xs text-white/60 hover:text-white pointer-events-auto bg-white/20 rounded-lg p-1">
    <a target="_blank" href={"https://github.com/BibliothecaDAO/eternum"} rel="noopener noreferrer">
      {env.VITE_PUBLIC_GAME_VERSION}
    </a>
  </div>
);
