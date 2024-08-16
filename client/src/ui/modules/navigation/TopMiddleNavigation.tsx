import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import {
  BASE_POPULATION_CAPACITY,
  BuildingType,
  EternumGlobalConfig,
  ID,
  STOREHOUSE_CAPACITY,
  StructureType,
} from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Crown, Landmark, Pickaxe, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import { QuestStatus } from "@/hooks/helpers/useQuests";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import { Position } from "@/types/Position";
import { QuestId } from "@/ui/components/quest/questDetails";
import { useComponentValue } from "@dojoengine/react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { ViewOnMapIcon } from "@/ui/components/military/ArmyManagementCard";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";

const slideDown = {
  hidden: { y: "-100%" },
  visible: { y: "0%", transition: { duration: 0.3 } },
};

// use a different icon for each structure depending on their category
const structureIcons: Record<string, JSX.Element> = {
  None: <div />,
  Realm: <Crown />,
  Bank: <Landmark />,
  Hyperstructure: <Sparkles />,
  FragmentMine: <Pickaxe />,
};

export const TopMiddleNavigation = () => {
  const [location, setLocation] = useLocation();

  const { setup } = useDojo();
  const { playerStructures } = useEntities();
  const { hexPosition } = useQuery();

  const realmEntityId = useUIStore((state) => state.realmEntityId);
  const setRealmEntityId = useUIStore((state) => state.setRealmEntityId);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const selectedHex = useUIStore((state) => state.selectedHex);

  // realms always first
  const structures = useMemo(() => {
    return playerStructures().sort((a, b) => {
      if (a.category === StructureType[StructureType.Realm]) return -1;
      if (b.category === StructureType[StructureType.Realm]) return 1;
      return a.category!.localeCompare(b.category!);
    });
  }, [playerStructures().length, realmEntityId]);

  const isHexView = useMemo(() => {
    return location.includes(`/hex`);
  }, [location]);

  const goToHexView = (entityId: ID) => {
    const structure = structures.find((structure) => structure.entity_id === entityId);

    const url = new Position(structure!.position).toHexLocationUrl();

    setLocation(url);
    window.dispatchEvent(new Event("urlChanged"));
    setRealmEntityId(entityId);
  };

  const goToMapView = (entityId?: ID) => {
    const newPosition = entityId
      ? getComponentValue(setup.components.Position, getEntityIdFromKeys([BigInt(entityId)]))
      : { x: hexPosition.col, y: hexPosition.row };

    if (!newPosition) throw new Error("No position found");

    const url = new Position({ x: newPosition.x, y: newPosition.y }).toMapLocationUrl();

    setPreviewBuilding(null);
    if (entityId) {
      setRealmEntityId(entityId);
    }

    setLocation(url);
    window.dispatchEvent(new Event("urlChanged"));
  };

  const setTooltip = useUIStore((state) => state.setTooltip);
  const population = useComponentValue(setup.components.Population, getEntityIdFromKeys([BigInt(realmEntityId || 0)]));

  const storehouses = useMemo(() => {
    const quantity =
      getComponentValue(
        setup.components.BuildingQuantityv2,
        getEntityIdFromKeys([BigInt(realmEntityId || 0), BigInt(BuildingType.Storehouse)]),
      )?.value || 0;

    return quantity * STOREHOUSE_CAPACITY + STOREHOUSE_CAPACITY;
  }, []);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp) as number;

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
              onMouseLeave={() => setTooltip(null)}
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
              onMouseLeave={() => setTooltip(null)}
              className=" px-3 flex gap-2 self-center"
            >
              <ResourceIcon withTooltip={false} resource="House" size="sm" />
              <div className="self-center">
                {population.population} / {population.capacity + BASE_POPULATION_CAPACITY}
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-72 gap-1 text-gold bg-map justify-center border text-center rounded bg-black/90 border-gold/10 relative">
          <div className="self-center flex justify-between w-full">
            <Select
              value={realmEntityId.toString()}
              onValueChange={(a: string) => {
                !isHexView ? goToMapView(ID(a)) : goToHexView(ID(a));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Realm" />
              </SelectTrigger>
              <SelectContent className="bg-black/90">
                {structures.map((structure, index) => (
                  <SelectItem
                    className="flex justify-between"
                    key={index}
                    value={structure.entity_id?.toString() || ""}
                  >
                    <h5 className="self-center flex gap-4">
                      {structureIcons[structure!.category!]}
                      {structure.name}
                    </h5>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                isHexView,
            })}
            onClick={() => {
              if (location !== "/map") {
                goToMapView();
              } else {
                goToHexView(realmEntityId);
              }
            }}
          >
            {location === "/map" ? "Realm" : "World"}
          </Button>
          {location === "/map" && (
            <ViewOnMapIcon
              className="my-auto w-7 fill-gold hover:fill-gold/50 hover:animate-pulse duration-300 transition-all"
              position={{ x: hexPosition.col, y: hexPosition.row }}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
};

const TickProgress = () => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp) as number;

  const { timeLeftBeforeNextTick, progress } = useMemo(() => {
    const timeLeft = nextBlockTimestamp % EternumGlobalConfig.tick.armiesTickIntervalInSeconds;
    const progressValue = (timeLeft / EternumGlobalConfig.tick.armiesTickIntervalInSeconds) * 100;
    return { timeLeftBeforeNextTick: timeLeft, progress: progressValue };
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
      onMouseLeave={() => setTooltip(null)}
      className="self-center text-center px-1 py-1 flex gap-1"
    >
      <ResourceIcon withTooltip={false} resource="Timeglass" size="sm" />
      {progress.toFixed()}%
    </div>
  );
};
