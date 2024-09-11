import { useDojo } from "@/hooks/context/DojoContext";
import { getEntitiesUtils, useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { QuestStatus } from "@/hooks/helpers/useQuests";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import useUIStore from "@/hooks/store/useUIStore";
import { Position } from "@/types/Position";
import { ViewOnMapIcon } from "@/ui/components/military/ArmyManagementCard";
import { QuestId } from "@/ui/components/quest/questDetails";
import Button from "@/ui/elements/Button";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import {
  BASE_POPULATION_CAPACITY,
  BuildingType,
  CapacityConfigCategory,
  EternumGlobalConfig,
  ID,
} from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import clsx from "clsx";
import { motion } from "framer-motion";
import { Crown, Landmark, Pickaxe, ShieldQuestion, Sparkles } from "lucide-react";
import { useMemo } from "react";

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

export const TopMiddleNavigation = () => {
  const { setup } = useDojo();
  const { isMapView, handleUrlChange, hexPosition } = useQuery();
  const { playerStructures } = useEntities();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const { getEntityInfo } = getEntitiesUtils();

  const structure = useMemo(() => {
    return getEntityInfo(structureEntityId);
  }, [structureEntityId]);

  const structurePosition = useMemo(() => {
    return new Position(structure?.position || { x: 0, y: 0 }).getNormalized();
  }, [structure]);

  const structures = playerStructures();

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

    return (
      quantity * EternumGlobalConfig.carryCapacityKg[CapacityConfigCategory.Storehouse] +
      EternumGlobalConfig.carryCapacityKg[CapacityConfigCategory.Storehouse]
    );
  }, [structureEntityId]);

  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp)!;

  const { timeLeftBeforeNextTick, progress } = useMemo(() => {
    const timeLeft = nextBlockTimestamp % EternumGlobalConfig.tick.armiesTickIntervalInSeconds;
    const progressValue = (timeLeft / EternumGlobalConfig.tick.armiesTickIntervalInSeconds) * 100;
    return { timeLeftBeforeNextTick: timeLeft, progress: progressValue };
  }, [nextBlockTimestamp]);

  return (
    <div className="pointer-events-auto mt-1 ">
      <motion.div className="flex flex-wrap " variants={slideDown} initial="hidden" animate="visible">
        <div className=" bg-black/90 rounded-l-xl my-1 border-white/5 border flex gap-1">
          {storehouses && (
            <div
              onMouseEnter={() => {
                setTooltip({
                  position: "bottom",
                  content: (
                    <div className="whitespace-nowrap pointer-events-none text-sm capitalize">
                      <span>This is the max per resource you can store</span>

                      <br />
                      <span>Build Storehouses to increase this.</span>
                    </div>
                  ),
                });
              }}
              onMouseLeave={() => {
                setTooltip(null);
              }}
              className="px-3 flex gap-2 self-center text-xs"
            >
              <ResourceIcon withTooltip={false} resource="Silo" size="sm" />
              <div className="self-center">{storehouses.toLocaleString()}</div>
            </div>
          )}
          {population && (
            <div
              onMouseEnter={() => {
                setTooltip({
                  position: "bottom",
                  content: (
                    <span className="whitespace-nowrap pointer-events-none text-sm capitalize">
                      <span>
                        {population.population} population / {population.capacity + BASE_POPULATION_CAPACITY} capacity
                      </span>
                      <br />
                      <span>Build Workers huts to expand population</span>
                    </span>
                  ),
                });
              }}
              onMouseLeave={() => {
                setTooltip(null);
              }}
              className=" px-3 flex gap-2 self-center"
            >
              <ResourceIcon withTooltip={false} resource="House" size="sm" />
              <div className="self-center">
                {population.population} / {population.capacity + BASE_POPULATION_CAPACITY}
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-72 gap-1 text-gold bg-hex-bg justify-center border text-center rounded bg-black/90 border-gold/10 relative">
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
                  {structure.owner ? structure.name : "Unsettled"}
                </div>
              </div>
            )}
          </div>
          <div
            className="absolute bottom-0 left-0 h-1 bg-gold to-transparent rounded"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className=" bg-black/90 rounded-r-xl my-1 border border-gold/5 flex gap-1 justify-between p-1">
          <TickProgress />
          <Button
            variant="outline"
            size="xs"
            className={clsx("self-center", {
              "animate-pulse":
                (selectedQuest?.id === QuestId.Travel || selectedQuest?.id === QuestId.Hyperstructure) &&
                selectedQuest.status !== QuestStatus.Completed &&
                !isMapView,
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
            <ViewOnMapIcon className="my-auto h-7 w-7" position={{ x: structurePosition.x, y: structurePosition.y }} />
          )}
        </div>
      </motion.div>
    </div>
  );
};

const TickProgress = () => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp)!;

  const progress = useMemo(() => {
    const timeLeft = nextBlockTimestamp % EternumGlobalConfig.tick.armiesTickIntervalInSeconds;
    return (timeLeft / EternumGlobalConfig.tick.armiesTickIntervalInSeconds) * 100;
  }, [nextBlockTimestamp]);

  return (
    <div
      onMouseEnter={() => {
        setTooltip({
          position: "bottom",
          content: (
            <span className="whitespace-nowrap pointer-events-none">
              <span>A day in Eternum is {EternumGlobalConfig.tick.armiesTickIntervalInSeconds / 60}m</span>
            </span>
          ),
        });
      }}
      onMouseLeave={() => {
        setTooltip(null);
      }}
      className="self-center text-center px-1 py-1 flex gap-1"
    >
      <ResourceIcon withTooltip={false} resource="Timeglass" size="sm" />
      {progress.toFixed()}%
    </div>
  );
};
