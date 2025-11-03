import { useGoToStructure, useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getBlockTimestamp, getIsBlitz, Position } from "@bibliothecadao/eternum";

import { useUISound } from "@/audio/hooks/useUISound";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { CapacityInfo, SecondaryMenuItems } from "@/ui/features/world";
import { NameChangePopup } from "@/ui/shared";
import {
  deleteEntityNameLocalStorage,
  getEntityInfo,
  getStructureName,
  setEntityNameLocalStorage,
} from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ClientComponents, ContractAddress, ID } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { motion } from "framer-motion";
import { EyeIcon, Swords } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useFavoriteStructures } from "./favorites";
import { GameEndTimer } from "./game-end-timer";
import { useStructureGroups } from "./structure-groups";
import { StructureSelectPanel } from "./structure-select-panel";
import { TickProgress } from "./tick-progress";

const slideDown = {
  hidden: { y: "-100%" },
  visible: { y: "0%", transition: { duration: 0.3 } },
};

export const TopLeftNavigation = memo(() => {
  const {
    setup,
    account: { account },
  } = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const [structureNameChange, setStructureNameChange] = useState<ComponentValue<
    ClientComponents["Structure"]["schema"]
  > | null>(null);
  const structures = useUIStore((state) => state.playerStructures);

  const { isMapView } = useQuery();

  const playClick = useUISound("ui.click");
  const playHover = useUISound("ui.hover");

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const followArmyCombats = useUIStore((state) => state.followArmyCombats);
  const setFollowArmyCombats = useUIStore((state) => state.setFollowArmyCombats);
  const isSpectating = useUIStore((state) => state.isSpectating);
  const worldMapReturnPosition = useUIStore((state) => state.worldMapReturnPosition);
  const lastControlledStructureEntityId = useUIStore((state) => state.lastControlledStructureEntityId);

  const exitSpectatorMode = useUIStore((state) => state.exitSpectatorMode);
  const isFollowingArmy = useUIStore((state) => state.isFollowingArmy);
  const followingArmyMessage = useUIStore((state) => state.followingArmyMessage);

  const { favorites, toggleFavorite } = useFavoriteStructures();
  const { structureGroups, updateStructureGroup } = useStructureGroups();

  // force a refresh of getEntityInfo when the structure data arrives
  const structure = useComponentValue(setup.components.Structure, getEntityIdFromKeys([BigInt(structureEntityId)]));
  const entityInfo = useMemo(
    () => getEntityInfo(structureEntityId, ContractAddress(account.address), setup.components, getIsBlitz()),
    [structureEntityId, currentDefaultTick, account.address, structure],
  );

  const selectedStructure = useMemo(() => {
    return { ...entityInfo, isFavorite: favorites.includes(entityInfo.entityId) };
  }, [structureEntityId, favorites, entityInfo]);

  const selectedStructurePosition = useMemo(() => {
    return new Position(selectedStructure?.position || { x: 0, y: 0 }).getNormalized();
  }, [selectedStructure]);

  console.log("[TopLeftNavigation] selectedStructure:", lastControlledStructureEntityId);

  const goToStructure = useGoToStructure(setup);
  const navigateToMapView = useNavigateToMapView();

  const onSelectStructure = useCallback(
    (entityId: ID) => {
      const structurePosition = getComponentValue(
        setup.components.Structure,
        getEntityIdFromKeys([BigInt(entityId)]),
      )?.base;

      if (!structurePosition) return;

      goToStructure(entityId, new Position({ x: structurePosition.coord_x, y: structurePosition.coord_y }), isMapView);
    },
    [goToStructure, isMapView, setup.components.Structure],
  );

  const handleNameChange = useCallback((structureEntityId: ID, newName: string) => {
    setEntityNameLocalStorage(structureEntityId, newName);
    setStructureNameChange(null);
  }, []);

  const handleNameDelete = useCallback((structureEntityId: ID) => {
    deleteEntityNameLocalStorage(structureEntityId);
    setStructureNameChange(null);
  }, []);
  const handleReturnToMyRealms = useCallback(() => {
    const fallbackId =
      lastControlledStructureEntityId !== UNDEFINED_STRUCTURE_ENTITY_ID
        ? lastControlledStructureEntityId
        : structures[0]?.entityId;

    const spectatedBase = isSpectating
      ? getComponentValue(setup.components.Structure, getEntityIdFromKeys([BigInt(structureEntityId)]))?.base
      : null;

    const fallbackBase =
      fallbackId !== undefined && fallbackId !== null && fallbackId !== UNDEFINED_STRUCTURE_ENTITY_ID
        ? getComponentValue(setup.components.Structure, getEntityIdFromKeys([BigInt(fallbackId)]))?.base
        : null;

    const storedReturnPosition = worldMapReturnPosition;

    exitSpectatorMode();

    const mapTarget = spectatedBase
      ? { x: spectatedBase.coord_x, y: spectatedBase.coord_y }
      : storedReturnPosition
        ? { x: storedReturnPosition.col, y: storedReturnPosition.row }
        : fallbackBase
          ? { x: fallbackBase.coord_x, y: fallbackBase.coord_y }
          : null;

    if (mapTarget) {
      navigateToMapView(new Position({ x: mapTarget.x, y: mapTarget.y }));
    }
  }, [
    exitSpectatorMode,
    isSpectating,
    lastControlledStructureEntityId,
    navigateToMapView,
    setup.components.Structure,
    structureEntityId,
    structures,
    worldMapReturnPosition,
  ]);

  const handleRequestNameChange = useCallback((structure: ComponentValue<ClientComponents["Structure"]["schema"]>) => {
    setStructureNameChange(structure);
  }, []);

  return (
    <div className="pointer-events-auto w-screen flex justify-between">
      <motion.div
        className="top-left-navigation-selector flex flex-wrap bg-dark-wood panel-wood panel-wood-corners w-full"
        variants={slideDown}
        initial="hidden"
        animate="visible"
      >
        <div className="flex max-w-[150px] w-24 md:min-w-72 text-gold justify-center text-center relative">
          <StructureSelectPanel
            structureEntityId={structureEntityId}
            selectedStructure={selectedStructure}
            structures={structures}
            favorites={favorites}
            structureGroups={structureGroups}
            onToggleFavorite={toggleFavorite}
            onSelectStructure={onSelectStructure}
            onRequestNameChange={handleRequestNameChange}
            onUpdateStructureGroup={updateStructureGroup}
          />
        </div>

        <CapacityInfo
          structureEntityId={structureEntityId}
          className="storage-selector flex flex-col md:flex-row gap-1  self-center"
        />
        <div className="world-navigation-selector text-xs md:text-base flex md:flex-row gap-2 md:gap-2 justify-between p-1 md:px-4 relative ">
          <div className="cycle-selector flex justify-center md:justify-start gap-2">
            <TickProgress />
            <GameEndTimer />
          </div>
          <div className="map-button-selector flex items-center justify-center md:justify-start gap-2 px-4">
            <span
              onClick={() => {
                playClick();
                goToStructure(
                  structureEntityId,
                  new Position({ x: selectedStructurePosition.x, y: selectedStructurePosition.y }),
                  false,
                );
              }}
              onMouseEnter={() => playHover()}
              className={cn("text-xs", !isMapView && "text-gold font-bold")}
            >
              Local
            </span>
            <label className="relative inline-flex items-center cursor-pointer" onMouseEnter={() => playHover()}>
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isMapView}
                onChange={(e) => {
                  const checked = e.target.checked;
                  playClick();
                  goToStructure(
                    // if there's a controlled structure, needs to go back there
                    lastControlledStructureEntityId || structureEntityId,
                    new Position({ x: selectedStructurePosition.x, y: selectedStructurePosition.y }),
                    checked,
                  );
                }}
              />
              <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gold after:rounded-full after:h-4 after:w-4 after:transition-all bg-gold/30"></div>
            </label>
            <span
              onClick={() => {
                playClick();
                goToStructure(
                  structureEntityId,
                  new Position({ x: selectedStructurePosition.x, y: selectedStructurePosition.y }),
                  true,
                );
              }}
              onMouseEnter={() => playHover()}
              className={cn("text-xs", isMapView && "text-gold font-bold")}
            >
              World
            </span>
            <div className="relative flex gap-2">
              <button
                type="button"
                className={cn(
                  "rounded-full p-2 transition-all duration-300 border-2",
                  followArmyCombats
                    ? "bg-gold/30 hover:bg-gold/40 border-gold shadow-lg shadow-gold/20 animate-pulse"
                    : "bg-gold/10 hover:bg-gold/20 border-gold/30",
                )}
                onClick={() => {
                  setFollowArmyCombats(!followArmyCombats);
                  playClick();
                }}
                onMouseEnter={() => playHover()}
                aria-pressed={followArmyCombats}
                title={followArmyCombats ? "Stop following army combat" : "Follow army combat"}
              >
                <Swords className={cn("w-4 h-4", followArmyCombats ? "text-gold animate-pulse" : "text-gold/60")} />
              </button>
            </div>
          </div>
        </div>

        <SecondaryMenuItems />

        {/* Camera Following Status Indicator */}
        {isFollowingArmy && (
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-5 z-50">
            <div className="bg-dark-wood text-gold px-4 py-2 rounded-lg shadow-lg border-2 border-gold animate-bounce">
              <div className="flex items-center gap-2">
                {followingArmyMessage?.toLowerCase().includes("combat") ? (
                  <Swords className="w-4 h-4 animate-pulse text-gold" />
                ) : (
                  <EyeIcon className="w-4 h-4 animate-pulse text-gold" />
                )}
                <span className="text-sm font-semibold text-gold">{followingArmyMessage ?? "Following Army"}</span>
              </div>
            </div>
          </div>
        )}

        {structureNameChange && selectedStructure.structure && (
          <NameChangePopup
            currentName={getStructureName(structureNameChange, getIsBlitz()).name}
            originalName={getStructureName(structureNameChange, getIsBlitz()).originalName}
            onConfirm={(newName) => handleNameChange(structureNameChange.entity_id, newName)}
            onCancel={() => setStructureNameChange(null)}
            onDelete={() => handleNameDelete(structureNameChange.entity_id)}
          />
        )}
      </motion.div>
    </div>
  );
});

TopLeftNavigation.displayName = "TopLeftNavigation";
