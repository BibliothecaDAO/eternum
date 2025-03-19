import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useNavigateToHexView, useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import { NavigateToPositionIcon } from "@/ui/components/military/army-chip";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { ViewOnMapIcon } from "@/ui/elements/view-on-map-icon";
import { SecondaryMenuItems } from "@/ui/modules/navigation/secondary-menu-items";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  configManager,
  ContractAddress,
  formatTime,
  getEntityInfo,
  ID,
  PlayerStructure,
  StructureType,
  TickIds,
} from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { motion } from "framer-motion";
import { Crown, EyeIcon, Landmark, Pickaxe, ShieldQuestion, Sparkles, Star } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CapacityInfo } from "./capacity-info";

const slideDown = {
  hidden: { y: "-100%" },
  visible: { y: "0%", transition: { duration: 0.3 } },
};

// use a different icon for each structure depending on their category
const structureIcons: Record<string, JSX.Element> = {
  None: <ShieldQuestion />,
  Realm: <Crown />,
  Bank: <Landmark />,
  Hyperstructure: <Sparkles />,
  FragmentMine: <Pickaxe />,
  ReadOnly: <EyeIcon />,
};

export const TopLeftNavigation = memo(({ structures }: { structures: PlayerStructure[] }) => {
  const {
    setup,
    account: { account },
  } = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const { isMapView, hexPosition } = useQuery();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const { currentBlockTimestamp } = useBlockTimestamp();

  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem("favoriteStructures");
    return saved ? JSON.parse(saved) : [];
  });

  const entityInfo = useMemo(
    () => getEntityInfo(structureEntityId, ContractAddress(account.address), currentDefaultTick, setup.components),
    [structureEntityId, currentDefaultTick, account.address],
  );

  const structure = useMemo(() => {
    return { ...entityInfo, isFavorite: favorites.includes(entityInfo.entityId) };
  }, [structureEntityId, favorites, entityInfo]);

  const structurePosition = useMemo(() => {
    return new Position(structure?.position || { x: 0, y: 0 }).getNormalized();
  }, [structure]);

  const structuresWithFavorites = useMemo(() => {
    return structures
      .map((structure) => ({
        ...structure,
        isFavorite: favorites.includes(structure.structure.entity_id),
      }))
      .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
  }, [favorites, structures.length]);

  const toggleFavorite = useCallback((entityId: number) => {
    setFavorites((prev) => {
      const newFavorites = prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId];
      localStorage.setItem("favoriteStructures", JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  const navigateToHexView = useNavigateToHexView();
  const navigateToMapView = useNavigateToMapView();

  const goToHexView = useCallback(
    (entityId: ID) => {
      const structurePosition = getComponentValue(
        setup.components.Structure,
        getEntityIdFromKeys([BigInt(entityId)]),
      )?.base;
      if (!structurePosition) return;
      navigateToHexView(new Position({ x: structurePosition.coord_x, y: structurePosition.coord_y }));
    },
    [navigateToHexView],
  );

  const goToMapView = useCallback(
    (entityId?: ID) => {
      const position = entityId
        ? getComponentValue(setup.components.Structure, getEntityIdFromKeys([BigInt(entityId)]))?.base
        : { coord_x: hexPosition.col, coord_y: hexPosition.row };

      if (!position) return;
      navigateToMapView(new Position({ x: position.coord_x, y: position.coord_y }));
    },
    [navigateToMapView, hexPosition.col, hexPosition.row],
  );

  const { progress } = useMemo(() => {
    const timeLeft = currentBlockTimestamp % configManager.getTick(TickIds.Armies);
    const progressValue = (timeLeft / configManager.getTick(TickIds.Armies)) * 100;
    return { timeLeftBeforeNextTick: timeLeft, progress: progressValue };
  }, [currentBlockTimestamp]);

  return (
    <div className="pointer-events-auto w-screen flex justify-between md:pl-2">
      <motion.div
        className="top-left-navigation-selector flex flex-wrap  gap-2"
        variants={slideDown}
        initial="hidden"
        animate="visible"
      >
        <div className="flex max-w-[150px] w-24 md:min-w-72 gap-1 text-gold justify-center border text-center rounded-b-lg bg-brown border-gold/30 relative">
          <div className="structure-name-selector self-center flex justify-between w-full">
            {structure.isMine ? (
              <Select
                value={structureEntityId.toString()}
                onValueChange={(a: string) => {
                  isMapView ? goToMapView(ID(a)) : goToHexView(ID(a));
                }}
              >
                <SelectTrigger className="truncate">
                  <SelectValue placeholder="Select Structure" />
                </SelectTrigger>
                <SelectContent className="bg-brown">
                  {structuresWithFavorites.map((structure, index) => (
                    <div key={index} className="flex flex-row items-center">
                      <button
                        className="p-1"
                        type="button"
                        onClick={() => toggleFavorite(structure.structure.entity_id)}
                      >
                        {<Star className={structure.isFavorite ? "h-4 w-4 fill-current" : "h-4 w-4"} />}
                      </button>
                      <SelectItem
                        className="flex justify-between"
                        key={index}
                        value={structure.structure.entity_id?.toString() || ""}
                      >
                        <div className="self-center flex gap-4 text-xl">{structure.name}</div>
                      </SelectItem>
                    </div>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="w-full px-4 py-2">
                <h5 className="flex items-center gap-4 truncate">
                  <>
                    {!account || account.address === "0x0"
                      ? structureIcons.ReadOnly
                      : structure.structureCategory
                        ? structureIcons[structure.structureCategory]
                        : structureIcons.None}
                    <span>{structure.name}</span>
                  </>
                </h5>
              </div>
            )}
          </div>
        </div>
        <CapacityInfo
          structureEntityId={structureEntityId}
          structureCategory={structure.structureCategory as StructureType}
          className="storage-selector bg-brown/90 rounded-b-lg py-1 flex flex-col md:flex-row gap-1 border border-gold/30"
        />
        <div className="world-navigation-selector bg-brown/90 bg-hex-bg rounded-b-lg text-xs md:text-base flex md:flex-row gap-2 md:gap-4 justify-between p-1 md:px-4 relative border border-gold/30">
          <div className="cycle-selector flex justify-center md:justify-start">
            <TickProgress />
          </div>
          <div className="map-button-selector flex justify-center md:justify-start">
            <Button
              variant="outline"
              size="xs"
              className="self-center"
              onClick={() => {
                if (!isMapView) {
                  goToMapView();
                } else {
                  goToHexView(structureEntityId);
                }
              }}
            >
              {isMapView ? "Realm" : "World"}
            </Button>
          </div>
          <div className="flex flex-row">
            <div className="flex justify-center md:justify-start items-center gap-1">
              <NavigateToPositionIcon
                className={`h-6 w-6 md:h-8 md:w-8 ${!isMapView ? "opacity-50 pointer-events-none" : ""}`}
                position={new Position(structurePosition)}
              />
              <ViewOnMapIcon
                className={`h-5 w-5 md:h-7 md:w-7 ${!isMapView ? "opacity-50 pointer-events-none" : ""}`}
                position={new Position(structurePosition)}
              />
            </div>
          </div>
          <ProgressBar progress={progress} />
        </div>
      </motion.div>
      <div className="relative">
        <SecondaryMenuItems />
      </div>
    </div>
  );
});

TopLeftNavigation.displayName = "TopLeftNavigation";

const ProgressBar = memo(({ progress }: { progress: number }) => {
  return (
    <div
      className="absolute bottom-0 left-0 h-1 bg-gold to-transparent rounded-bl-2xl rounded-tr-2xl mx-1"
      style={{ width: `${progress}%` }}
    ></div>
  );
});

ProgressBar.displayName = "ProgressBar";

const TickProgress = memo(() => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const { currentBlockTimestamp } = useBlockTimestamp();

  const cycleTime = configManager.getTick(TickIds.Armies);
  const { play } = useUiSounds(soundSelector.gong);

  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const lastProgressRef = useRef(0);

  // Calculate progress once and memoize
  const progress = useMemo(() => {
    const elapsedTime = currentBlockTimestamp % cycleTime;
    return (elapsedTime / cycleTime) * 100;
  }, [currentBlockTimestamp, cycleTime]);

  // Play sound when progress resets
  useEffect(() => {
    if (lastProgressRef.current > progress) {
      play();
    }
    lastProgressRef.current = progress;
  }, [progress, play]);

  // Memoize tooltip content
  const tooltipContent = useMemo(
    () => (
      <div className="whitespace-nowrap pointer-events-none flex flex-col mt-3 mb-3 text-sm capitalize">
        <div>
          A day in Eternum is <span className="font-bold">{formatTime(cycleTime)}</span>
        </div>
        <div>
          Time left until next cycle:{" "}
          <span className="font-bold">{formatTime(cycleTime - (currentBlockTimestamp % cycleTime))}</span>
        </div>
      </div>
    ),
    [cycleTime, currentBlockTimestamp],
  );

  // Handle tooltip visibility
  const handleMouseEnter = useCallback(() => {
    setIsTooltipOpen(true);
    setTooltip({
      position: "bottom",
      content: tooltipContent,
    });
  }, [setTooltip, tooltipContent]);

  const handleMouseLeave = useCallback(() => {
    setIsTooltipOpen(false);
    setTooltip(null);
  }, [setTooltip]);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="self-center text-center px-1 py-1 flex gap-1"
    >
      <ResourceIcon withTooltip={false} resource="Timeglass" size="sm" />
      {progress.toFixed()}%
    </div>
  );
});
