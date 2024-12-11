import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities, useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import useUIStore from "@/hooks/store/useUIStore";
import { useStartingTutorial } from "@/hooks/use-starting-tutorial";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import { Position } from "@/types/Position";
import { NavigateToPositionIcon } from "@/ui/components/military/ArmyChip";
import { ViewOnMapIcon } from "@/ui/components/military/ArmyManagementCard";
import { IS_MOBILE } from "@/ui/config";
import Button from "@/ui/elements/Button";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { formatTime, gramToKg, kgToGram } from "@/ui/utils/utils";
import { BuildingType, CapacityConfigCategory, ID, ResourcesIds, TickIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { motion } from "framer-motion";
import { Crown, EyeIcon, Landmark, Pickaxe, ShieldQuestion, Sparkles, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuestsMenu } from "./QuestMenu";
import { SecondaryMenuItems } from "./SecondaryMenuItems";

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
  SpectatorMode: <EyeIcon />,
};

const StorehouseTooltipContent = ({ storehouseCapacity }: { storehouseCapacity: number }) => {
  const capacity = kgToGram(storehouseCapacity);
  return (
    <div className="text-xs text-gray-200 p-1 max-w-xs">
      <p className="font-semibold">Max Storage Capacity ({storehouseCapacity.toLocaleString()} kg)</p>
      <div className="grid grid-cols-2 gap-x-4 my-1">
        <ul className="list-none">
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Lords]} size="xs" className="mr-1" />
            {(capacity / configManager.getResourceWeight(ResourcesIds.Lords)).toLocaleString()} Lords
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Wheat]} size="xs" className="mr-1" />
            {(capacity / configManager.getResourceWeight(ResourcesIds.Wheat)).toLocaleString()} Food
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Wood]} size="xs" className="mr-1" />
            {(capacity / configManager.getResourceWeight(ResourcesIds.Wood)).toLocaleString()} Other
          </li>
        </ul>
        <ul className="list-none">
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Knight]} size="xs" className="mr-1" />
            {(capacity / configManager.getResourceWeight(ResourcesIds.Knight)).toLocaleString()} Knights
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Crossbowman]} size="xs" className="mr-1" />
            {(capacity / configManager.getResourceWeight(ResourcesIds.Crossbowman)).toLocaleString()} Crossbowmen
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Paladin]} size="xs" className="mr-1" />
            {(capacity / configManager.getResourceWeight(ResourcesIds.Paladin)).toLocaleString()} Paladins
          </li>
        </ul>
      </div>
      <p className="italic text-xs">Build Storehouses to increase capacity.</p>
    </div>
  );
};

const WorkersHutTooltipContent = () => {
  const capacity = configManager.getBuildingPopConfig(BuildingType.WorkersHut).capacity;
  return (
    <div className="text-xs text-gray-200 p-1 max-w-xs">
      <p className="font-semibold">Population Capacity</p>
      <ul className="list-disc list-inside my-1">
        <li>{configManager.getBasePopulationCapacity()} Base Capacity</li>
        <li>+{capacity} per Workers Hut</li>
      </ul>
      <p className="italic text-xs">Build Workers Huts to increase population capacity.</p>
    </div>
  );
};

export const TopLeftNavigation = () => {
  const { setup } = useDojo();

  const { isMapView, handleUrlChange, hexPosition } = useQuery();
  const { playerStructures } = useEntities();

  useStartingTutorial();

  const isSpectatorMode = useUIStore((state) => state.isSpectatorMode);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp)!;

  const { getEntityInfo } = useEntitiesUtils();

  const structures = playerStructures();

  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem("favoriteStructures");
    return saved ? JSON.parse(saved) : [];
  });

  const entityInfo = getEntityInfo(structureEntityId);
  const structure = useMemo(() => {
    return { ...entityInfo, isFavorite: favorites.includes(entityInfo.entityId) };
  }, [structureEntityId, getEntityInfo, favorites]);

  const structurePosition = useMemo(() => {
    return new Position(structure?.position || { x: 0, y: 0 }).getNormalized();
  }, [structure]);

  const structuresWithFavorites = useMemo(() => {
    return structures
      .map((structure) => ({
        ...structure,
        isFavorite: favorites.includes(structure.entity_id),
      }))
      .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
  }, [favorites, structures]);

  const toggleFavorite = useCallback((entityId: number) => {
    setFavorites((prev) => {
      const newFavorites = prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId];
      localStorage.setItem("favoriteStructures", JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  const goToHexView = (entityId: ID) => {
    const structure = structures.find((structure) => structure.entity_id === entityId);
    const url = new Position(structure!.position).toHexLocationUrl();
    handleUrlChange(url);
  };

  const goToMapView = (entityId?: ID) => {
    const newPosition = entityId
      ? getComponentValue(setup.components.Position, getEntityIdFromKeys([BigInt(entityId)]))
      : { x: hexPosition.col, y: hexPosition.row };

    if (!newPosition) throw new Error("No position found");

    const url = new Position({ x: newPosition.x, y: newPosition.y }).toMapLocationUrl();

    setPreviewBuilding(null);

    handleUrlChange(url);
  };

  const setTooltip = useUIStore((state) => state.setTooltip);

  const population = useComponentValue(
    setup.components.Population,
    getEntityIdFromKeys([BigInt(structureEntityId || 0)]),
  );

  const storehouses = useMemo(() => {
    const quantity =
      getComponentValue(
        setup.components.BuildingQuantityv2,
        getEntityIdFromKeys([BigInt(structureEntityId || 0), BigInt(BuildingType.Storehouse)]),
      )?.value || 0;

    const storehouseCapacity = configManager.getCapacityConfig(CapacityConfigCategory.Storehouse);

    // Base capacity is storehouseCapacity, then add storehouseCapacity for each additional storehouse
    return { capacityKg: (quantity + 1) * gramToKg(storehouseCapacity), quantity };
  }, [structureEntityId, nextBlockTimestamp]);

  const { timeLeftBeforeNextTick, progress } = useMemo(() => {
    const timeLeft = nextBlockTimestamp % configManager.getTick(TickIds.Armies);
    const progressValue = (timeLeft / configManager.getTick(TickIds.Armies)) * 100;
    return { timeLeftBeforeNextTick: timeLeft, progress: progressValue };
  }, [nextBlockTimestamp]);

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
                      <button className="p-1" type="button" onClick={() => toggleFavorite(structure.entity_id)}>
                        {<Star className={structure.isFavorite ? "h-4 w-4 fill-current" : "h-4 w-4"} />}
                      </button>
                      <SelectItem
                        className="flex justify-between"
                        key={index}
                        value={structure.entity_id?.toString() || ""}
                      >
                        <div className="self-center flex gap-4 text-xl">
                          {structure.name}
                          {IS_MOBILE ? structureIcons[structure.category] : ""}
                        </div>
                      </SelectItem>
                    </div>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="w-full px-4 py-2">
                <h5 className="flex items-center gap-4 truncate">
                  {isSpectatorMode ? (
                    <>
                      {structureIcons.SpectatorMode}
                      <span>Spectator Mode</span>
                    </>
                  ) : (
                    <>
                      {structure.structureCategory ? structureIcons[structure.structureCategory] : structureIcons.None}
                      <span>{structure.name}</span>
                    </>
                  )}
                </h5>
              </div>
            )}
          </div>
        </div>
        <div className="storage-selector bg-brown/90 rounded-b-lg py-1 flex flex-col md:flex-row gap-1 border border-gold/30">
          {storehouses && (
            <div
              onMouseEnter={() => {
                setTooltip({
                  position: "bottom",
                  content: <StorehouseTooltipContent storehouseCapacity={storehouses.capacityKg} />,
                });
              }}
              onMouseLeave={() => {
                setTooltip(null);
              }}
              className="storehouse-selector px-3 flex gap-2 justify-start items-center text-xxs md:text-sm"
            >
              <ResourceIcon withTooltip={false} resource="Silo" size="sm" />
              {IS_MOBILE ? (
                <div className="self-center">{storehouses.quantity.toLocaleString()}</div>
              ) : (
                <div className="self-center">{storehouses.capacityKg.toLocaleString()} kg</div>
              )}
            </div>
          )}

          <div
            onMouseEnter={() => {
              setTooltip({
                position: "bottom",
                content: <WorkersHutTooltipContent />,
              });
            }}
            onMouseLeave={() => {
              setTooltip(null);
            }}
            className="population-selector px-3 flex gap-2 justify-start items-center text-xs md:text-sm"
          >
            <ResourceIcon withTooltip={false} resource="House" size="sm" />
            <div className="self-center">
              {population?.population || 0} / {(population?.capacity || 0) + configManager.getBasePopulationCapacity()}
            </div>
          </div>
        </div>
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
                position={{ x: structurePosition.x, y: structurePosition.y }}
              />
              <ViewOnMapIcon
                className={`h-5 w-5 md:h-7 md:w-7 ${!isMapView ? "opacity-50 pointer-events-none" : ""}`}
                position={{ x: structurePosition.x, y: structurePosition.y }}
              />
            </div>
          </div>
          <div
            className="absolute bottom-0 left-0 h-1 bg-gold to-transparent rounded-bl-2xl rounded-tr-2xl mx-1"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </motion.div>
      <div className="relative">
        <SecondaryMenuItems />
        <div className="absolute right-0 px-4 top-full mt-2">
          <QuestsMenu />
        </div>
      </div>
    </div>
  );
};

const TickProgress = () => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp)!;
  const cycleTime = configManager.getTick(TickIds.Armies);
  const { play } = useUiSounds(soundSelector.gong);

  const [timeUntilNextCycle, setTimeUntilNextCycle] = useState(0);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const lastProgressRef = useRef(0);

  const progress = useMemo(() => {
    const elapsedTime = nextBlockTimestamp % cycleTime;
    const currentProgress = (elapsedTime / cycleTime) * 100;

    return currentProgress;
  }, [nextBlockTimestamp, cycleTime]);

  useEffect(() => {
    if (lastProgressRef.current > progress) {
      play();
    }
    lastProgressRef.current = progress;
  }, [progress]);

  const updateTooltip = useCallback(() => {
    if (!isTooltipOpen) return;

    setTooltip({
      position: "bottom",
      content: (
        <div className="whitespace-nowrap pointer-events-none flex flex-col mt-3 mb-3 text-sm capitalize">
          <div>
            A day in Eternum is <span className="font-bold">{formatTime(cycleTime)}</span>
          </div>
          <div>
            Time left until next cycle: <span className="font-bold">{formatTime(timeUntilNextCycle)}</span>
          </div>
        </div>
      ),
    });
  }, [isTooltipOpen, cycleTime, timeUntilNextCycle, setTooltip]);

  useEffect(() => {
    if (!isTooltipOpen) return;

    const initialTime = cycleTime - (nextBlockTimestamp % cycleTime);
    setTimeUntilNextCycle(initialTime);

    const interval = setInterval(() => {
      setTimeUntilNextCycle((prevTime) => (prevTime <= 1 ? initialTime : prevTime - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isTooltipOpen, cycleTime, nextBlockTimestamp]);

  useEffect(() => {
    if (isTooltipOpen) {
      updateTooltip();
    }
  }, [isTooltipOpen, updateTooltip]);

  return (
    <div
      onMouseEnter={() => {
        setIsTooltipOpen(true);
        updateTooltip();
      }}
      onMouseLeave={() => {
        setIsTooltipOpen(false);
        setTooltip(null);
      }}
      className="self-center text-center px-1 py-1 flex gap-1"
    >
      <ResourceIcon withTooltip={false} resource="Timeglass" size="sm" />
      {progress.toFixed()}%
    </div>
  );
};
