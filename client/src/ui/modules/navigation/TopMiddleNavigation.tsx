import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities, useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { QuestStatus } from "@/hooks/helpers/useQuests";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import useUIStore from "@/hooks/store/useUIStore";
import { Position } from "@/types/Position";
import { NavigateToPositionIcon } from "@/ui/components/military/ArmyChip";
import { ViewOnMapIcon } from "@/ui/components/military/ArmyManagementCard";
import { QuestId } from "@/ui/components/quest/questDetails";
import Button from "@/ui/elements/Button";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { formatTime, gramToKg, kgToGram } from "@/ui/utils/utils";
import { BuildingType, CapacityConfigCategory, ID, ResourcesIds, TickIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import clsx from "clsx";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Landmark, Pickaxe, ShieldQuestion, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
};

const StorehouseTooltipContent = ({ storehouseCapacity }: { storehouseCapacity: number }) => {
  const capacity = kgToGram(storehouseCapacity);
  return (
    <div className="text-xs text-gray-200 p-2 max-w-xs">
      <p className="font-semibold">Max Storage Capacity</p>
      <ul className="list-none my-1">
        <li className="flex items-center">
          <ResourceIcon resource="Lords" size="xs" className="mr-1" />
          {(capacity / configManager.getResourceWeight(ResourcesIds.Lords)).toLocaleString()} Lords
        </li>
        <li className="flex items-center">
          <ResourceIcon resource="Wheat" size="xs" className="mr-1" />
          {(capacity / configManager.getResourceWeight(ResourcesIds.Wheat)).toLocaleString()} Food
        </li>
        <li className="flex items-center">
          <ResourceIcon resource="Wood" size="xs" className="mr-1" />
          {(capacity / configManager.getResourceWeight(ResourcesIds.Wood)).toLocaleString()} Other
        </li>
      </ul>
      <p className="italic text-xs">Build Storehouses to increase capacity.</p>
    </div>
  );
};

const WorkersHutTooltipContent = () => {
  const capacity = configManager.getBuildingPopConfig(BuildingType.WorkersHut).capacity;
  return (
    <div className="text-xs text-gray-200 p-2 max-w-xs">
      <p className="font-semibold">Population Capacity</p>
      <ul className="list-disc list-inside my-1">
        <li>{configManager.getBasePopulationCapacity()} Base Capacity</li>
        <li>+{capacity} per Workers Hut</li>
      </ul>
      <p className="italic text-xs">Build Workers Huts to increase population capacity.</p>
    </div>
  );
};

export const TopMiddleNavigation = () => {
  const { setup } = useDojo();

  const { isMapView, handleUrlChange, hexPosition } = useQuery();
  const { playerStructures } = useEntities();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const selectedQuest = useQuestStore((state) => state.selectedQuest);
  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp)!;

  const { getEntityInfo } = useEntitiesUtils();

  const structure = useMemo(() => {
    return getEntityInfo(structureEntityId);
  }, [structureEntityId]);

  const structurePosition = useMemo(() => {
    return new Position(structure?.position || { x: 0, y: 0 }).getNormalized();
  }, [structure]);

  const structures = playerStructures();

  const pointToWorldButton =
    (selectedQuest?.id === QuestId.Travel || selectedQuest?.id === QuestId.Hyperstructure) &&
    selectedQuest.status !== QuestStatus.Completed &&
    !isMapView;

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

    return quantity * gramToKg(storehouseCapacity) + gramToKg(storehouseCapacity);
  }, [structureEntityId, nextBlockTimestamp]);

  const { timeLeftBeforeNextTick, progress } = useMemo(() => {
    const timeLeft = nextBlockTimestamp % configManager.getTick(TickIds.Armies);
    const progressValue = (timeLeft / configManager.getTick(TickIds.Armies)) * 100;
    return { timeLeftBeforeNextTick: timeLeft, progress: progressValue };
  }, [nextBlockTimestamp]);

  return (
    <div className="pointer-events-auto mx-2 w-screen flex justify-between pl-2">
      <motion.div className="flex flex-wrap  gap-2" variants={slideDown} initial="hidden" animate="visible">
        <div className="flex min-w-72 gap-1 text-gold bg-hex-bg justify-center border text-center rounded-b-xl bg-black border-gold/10 relative">
          <div className="self-center flex justify-between w-full">
            {structure.isMine ? (
              <Select
                value={structureEntityId.toString()}
                onValueChange={(a: string) => {
                  isMapView ? goToMapView(ID(a)) : goToHexView(ID(a));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Structure" />
                </SelectTrigger>
                <SelectContent className="bg-black/90">
                  {structures.map((structure, index) => (
                    <SelectItem
                      className="flex justify-between"
                      key={index}
                      value={structure.entity_id?.toString() || ""}
                    >
                      <h5 className="self-center flex gap-4">
                        {structureIcons[structure.category]}
                        {structure.name}
                      </h5>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div>
                <div className="self-center flex gap-4">
                  {structure.structureCategory ? structureIcons[structure.structureCategory] : structureIcons.None}
                  {structure.name}
                </div>
              </div>
            )}
          </div>
          <div
            className="absolute bottom-0 left-0 h-1 bg-gold to-transparent rounded"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className=" bg-black/90 bg-hex-bg   rounded-b-xl   flex gap-1">
          {storehouses && (
            <div
              onMouseEnter={() => {
                setTooltip({
                  position: "bottom",
                  content: <StorehouseTooltipContent storehouseCapacity={storehouses} />,
                });
              }}
              onMouseLeave={() => {
                setTooltip(null);
              }}
              className="px-3 flex gap-2 self-center text-xs"
            >
              <ResourceIcon withTooltip={false} resource="Silo" size="sm" />
              <div className="self-center">{storehouses.toLocaleString() + " kg"}</div>
            </div>
          )}
          {population && (
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
              className=" px-3 flex gap-2 self-center"
            >
              <ResourceIcon withTooltip={false} resource="House" size="sm" />
              <div className="self-center">
                {population.population} / {population.capacity + configManager.getBasePopulationCapacity()}
              </div>
            </div>
          )}
        </div>
        <div className=" bg-black/90 bg-hex-bg  rounded-b-xl  flex gap-4 justify-between px-4">
          <TickProgress />
          <Button
            variant="outline"
            size="xs"
            className={clsx("self-center", {
              "animate-pulse": pointToWorldButton,
            })}
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
          {isMapView && (
            <div className="flex flex-row items-center ">
              <NavigateToPositionIcon
                className="h-8 w-8"
                position={{ x: structurePosition.x, y: structurePosition.y }}
              />
              <ViewOnMapIcon className="h-7 w-7" position={{ x: structurePosition.x, y: structurePosition.y }} />
            </div>
          )}
        </div>
        {pointToWorldButton && (
          <div className="bg-black/90 text-gold border border-gold/30 rounded-md shadow-lg left-1/2 transform p-3 flex flex-row items-center animate-pulse">
            <ArrowLeft className="text-gold w-5 h-5 mb-2" />
            <div className="text-sm font-semibold mb-2 text-center leading-tight">Explore the map</div>
          </div>
        )}
      </motion.div>
      <SecondaryMenuItems />
    </div>
  );
};

const TickProgress = () => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp)!;

  const [timeUntilNextCycle, setTimeUntilNextCycle] = useState(0);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  let cycleTime = configManager.getTick(TickIds.Armies);

  useEffect(() => {
    const initialTime = cycleTime - (nextBlockTimestamp % cycleTime);
    setTimeUntilNextCycle(initialTime);

    const interval = setInterval(() => {
      setTimeUntilNextCycle((prevTime) => {
        if (prevTime <= 1) {
          return initialTime;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [nextBlockTimestamp]);

  const progress = useMemo(() => {
    return ((cycleTime - timeUntilNextCycle) / cycleTime) * 100;
  }, [timeUntilNextCycle]);

  const updateTooltip = useCallback(() => {
    if (isTooltipOpen) {
      setTooltip({
        position: "bottom",
        content: (
          <div className="whitespace-nowrap pointer-events-none flex flex-col  text-sm capitalize">
            <div>
              A day in Eternum is <span className="font-bold">{formatTime(cycleTime)}</span>
            </div>
            <div>
              Time left until next cycle: <span className="font-bold">{formatTime(timeUntilNextCycle)}</span>
            </div>
          </div>
        ),
      });
    }
  }, [isTooltipOpen, timeUntilNextCycle, setTooltip]);

  useEffect(() => {
    updateTooltip();
  }, [updateTooltip]);

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
