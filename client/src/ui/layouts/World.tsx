import { Leva } from "leva";
import { Component, lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Redirect } from "wouter";
import useUIStore from "../../hooks/store/useUIStore";

import { addMarketSubscription, syncStructureByPosition } from "@/dojo/queries";
import { useDojo } from "@/hooks/context/DojoContext";
import { PlayerStructure, useEntities } from "@/hooks/helpers/useEntities";
import { useStructureEntityId } from "@/hooks/helpers/useStructureEntityId";
import { useFetchBlockchainData } from "@/hooks/store/useBlockchainStore";
import { useWorldStore } from "@/hooks/store/useWorldLoading";
import { ADMIN_BANK_ENTITY_ID, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { getComponentValue, Metadata } from "@dojoengine/recs";
import { S } from "@dojoengine/recs/dist/types-3444e4c1";
import { getEntities } from "@dojoengine/state";
import { ToriiClient } from "@dojoengine/torii-client";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { env } from "../../../env";
import { IS_MOBILE } from "../config";
import { LoadingOroborus } from "../modules/loading-oroborus";
import { LoadingScreen } from "../modules/LoadingScreen";
// Lazy load components

const SelectedArmy = lazy(() =>
  import("../components/worldmap/armies/SelectedArmy").then((module) => ({ default: module.SelectedArmy })),
);

const ActionInfo = lazy(() =>
  import("../components/worldmap/armies/ActionInfo").then((module) => ({ default: module.ActionInfo })),
);

const ActionInstructions = lazy(() =>
  import("../components/worldmap/armies/ActionInstructions").then((module) => ({ default: module.ActionInstructions })),
);

const ArmyInfoLabel = lazy(() =>
  import("../components/worldmap/armies/ArmyInfoLabel").then((module) => ({ default: module.ArmyInfoLabel })),
);

const BattleInfoLabel = lazy(() =>
  import("../components/worldmap/battles/BattleLabel").then((module) => ({ default: module.BattleInfoLabel })),
);

const BlankOverlayContainer = lazy(() =>
  import("../containers/BlankOverlayContainer").then((module) => ({ default: module.BlankOverlayContainer })),
);
const StructureInfoLabel = lazy(() =>
  import("../components/worldmap/structures/StructureLabel").then((module) => ({ default: module.StructureInfoLabel })),
);
const BattleContainer = lazy(() =>
  import("../containers/BattleContainer").then((module) => ({ default: module.BattleContainer })),
);
const TopCenterContainer = lazy(() => import("../containers/TopCenterContainer"));
const BottomRightContainer = lazy(() =>
  import("../containers/BottomRightContainer").then((module) => ({ default: module.BottomRightContainer })),
);
const LeftMiddleContainer = lazy(() => import("../containers/LeftMiddleContainer"));
const RightMiddleContainer = lazy(() => import("../containers/RightMiddleContainer"));
const TopLeftContainer = lazy(() => import("../containers/TopLeftContainer"));
const Tooltip = lazy(() => import("../elements/Tooltip").then((module) => ({ default: module.Tooltip })));
const BattleView = lazy(() =>
  import("../modules/military/battle-view/BattleView").then((module) => ({ default: module.BattleView })),
);
const TopMiddleNavigation = lazy(() =>
  import("../modules/navigation/TopNavigation").then((module) => ({ default: module.TopMiddleNavigation })),
);
const BottomMiddleContainer = lazy(() =>
  import("../containers/BottomMiddleContainer").then((module) => ({ default: module.BottomMiddleContainer })),
);
const LeftNavigationModule = lazy(() =>
  import("../modules/navigation/LeftNavigationModule").then((module) => ({ default: module.LeftNavigationModule })),
);
const RightNavigationModule = lazy(() =>
  import("../modules/navigation/RightNavigationModule").then((module) => ({ default: module.RightNavigationModule })),
);
const TopLeftNavigation = lazy(() =>
  import("../modules/navigation/TopLeftNavigation").then((module) => ({ default: module.TopLeftNavigation })),
);
const EventStream = lazy(() =>
  import("../modules/stream/EventStream").then((module) => ({ default: module.EventStream })),
);
const Onboarding = lazy(() => import("./Onboarding").then((module) => ({ default: module.Onboarding })));
const OrientationOverlay = lazy(() =>
  import("../components/overlays/OrientationOverlay").then((module) => ({ default: module.OrientationOverlay })),
);

const MiniMapNavigation = lazy(() =>
  import("../modules/navigation/MiniMapNavigation").then((module) => ({ default: module.MiniMapNavigation })),
);

export const World = ({ backgroundImage }: { backgroundImage: string }) => {
  const [subscriptions, setSubscriptions] = useState<{ [entity: string]: boolean }>({});
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);

  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);

  const battleView = useUIStore((state) => state.battleView);

  // Setup hooks
  useFetchBlockchainData();
  useStructureEntityId();

  // We could optimise this deeper....

  const worldLoading = useWorldStore((state) => state.isWorldLoading);
  const setWorldLoading = useWorldStore((state) => state.setWorldLoading);
  const setMarketLoading = useWorldStore((state) => state.setMarketLoading);

  const dojo = useDojo();
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const { playerStructures } = useEntities();
  const structures = playerStructures();

  const filteredStructures = useMemo(
    () => structures.filter((structure: PlayerStructure) => !subscriptions[structure.entity_id.toString()]),
    [structures, subscriptions],
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

    setWorldLoading(true);
    setSubscriptions((prev) => ({
      ...prev,
      [structureEntityId.toString()]: true,
      [ADMIN_BANK_ENTITY_ID.toString()]: true,
    }));
    const fetch = async () => {
      try {
        await syncStructureByPosition(
          dojo.network.toriiClient,
          dojo.network.contractComponents as any,
          structureEntityId.toString(),
          { x: position?.x || 0, y: position?.y || 0 },
        );

        await syncStructureByPosition(
          dojo.network.toriiClient,
          dojo.network.contractComponents as any,
          ADMIN_BANK_ENTITY_ID.toString(),
          { x: 0, y: 0 },
        );

        await initialSync(dojo.network.toriiClient, dojo.network.contractComponents as any);
      } catch (error) {
        console.error("Fetch failed", error);
      } finally {
        setWorldLoading(false);
      }

      console.log("world loading", worldLoading);

      try {
        await addMarketSubscription(dojo.network.toriiClient, dojo.network.contractComponents as any);
      } catch (error) {
        console.error("Fetch failed", error);
      } finally {
        setMarketLoading(false);
      }
    };

    fetch();
  }, [structureEntityId, subscriptions, setWorldLoading, setSubscriptions]);

  useEffect(() => {
    if (filteredStructures.length === 0) return;
    setWorldLoading(true);
    setSubscriptions((prev) => ({
      ...prev,
      ...Object.fromEntries(filteredStructures.map((structure) => [structure.entity_id.toString(), true])),
    }));
    const fetch = async () => {
      try {
        await Promise.all(
          filteredStructures.map((structure: PlayerStructure) =>
            syncStructureByPosition(
              dojo.network.toriiClient,
              dojo.network.contractComponents as any,
              structure.entity_id.toString(),
              { x: structure.position.x, y: structure.position.y },
            ),
          ),
        );
      } catch (error) {
        console.error("Fetch failed", error);
      } finally {
        setWorldLoading(false);
      }

      console.log("world loading", worldLoading);
    };

    fetch();
  }, [filteredStructures, setWorldLoading, setSubscriptions]);

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
        <ActionInstructions />
        {!IS_MOBILE && (
          <>
            <ActionInfo />
            <ArmyInfoLabel />
            <StructureInfoLabel />
            <BattleInfoLabel />
          </>
        )}

        <BattleContainer>
          <BattleView />
        </BattleContainer>

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
            <TopLeftNavigation />
          </TopLeftContainer>
        </div>

        <Redirect to="/" />
        <Leva
          hidden={!env.VITE_PUBLIC_DEV || env.VITE_PUBLIC_HIDE_THREEJS_MENU}
          collapsed
          titleBar={{ position: { x: 0, y: 50 } }}
        />
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

const initialSync = async (client: ToriiClient, components: Component<S, Metadata, undefined>[]) => {
  const isAlreadySyncedComponentProof = getComponentValue(
    (components as any).Season,
    getEntityIdFromKeys([WORLD_CONFIG_ID]),
  );
  if (isAlreadySyncedComponentProof) {
    return;
  }

  await getEntities(
    client,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "FixedLen",
        models: [
          "s0_eternum-CapacityCategory",
          "s0_eternum-Health",
          "s0_eternum-Army",
          "s0_eternum-Protector",
          "s0_eternum-Protectee",
          "s0_eternum-Battle",
          "s0_eternum-Guild",
          "s0_eternum-GuildMember",
          "s0_eternum-Hyperstructure",
          "s0_eternum-Movable",
          "s0_eternum-ArrivalTime",
          "s0_eternum-EntityName",
          "s0_eternum-Position",
          "s0_eternum-ProductionDeadline",
          "s0_eternum-Quantity",
          "s0_eternum-QuantityTracker",
          "s0_eternum-OwnedResourcesTracker",
          "s0_eternum-ResourceTransferLock",
          "s0_eternum-Season",
          "s0_eternum-Leaderboard",
          "s0_eternum-LeaderboardRegistered",
          "s0_eternum-LeaderboardRewardClaimed",
          "s0_eternum-LeaderboardEntry",
          "s0_eternum-Stamina",
          "s0_eternum-Structure",
          "s0_eternum-StructureCount",
          "s0_eternum-Trade",
          "s0_eternum-Status",
          "s0_eternum-Weight",
          "s0_eternum-Bank",
        ],
      },
    },
    components as any,
    100_000,
    false,
  );
};
