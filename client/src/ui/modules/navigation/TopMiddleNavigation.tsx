import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import useRealmStore from "@/hooks/store/useRealmStore";
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
import { QuestId } from "@/ui/components/quest/questDetails";
import { useComponentValue } from "@dojoengine/react";
import clsx from "clsx";
import { motion } from "framer-motion";

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

  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const setRealmEntityId = useRealmStore((state) => state.setRealmEntityId);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const moveCameraToColRow = useUIStore((state) => state.moveCameraToColRow);
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

    setIsLoadingScreenEnabled(true);
    setTimeout(() => {
      setLocation(`/hex?col=${structure!.position.x}&row=${structure!.position.y}`);
      window.dispatchEvent(new Event("urlChanged"));
      setRealmEntityId(entityId);
    }, 300);
  };

  const goToMapView = (entityId: ID) => {
    const contractPosition = getComponentValue(setup.components.Position, getEntityIdFromKeys([BigInt(entityId)]));
    moveCameraToColRow(Number(contractPosition?.x), Number(contractPosition?.y));

    setRealmEntityId(entityId);
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

  return (
    <div className=" bg-black/60 backdrop-blur-2xl bg-hex-bg rounded-b-2xl border border-gradient pointer-events-auto">
      <motion.div className="flex flex-wrap " variants={slideDown} initial="hidden" animate="visible">
        <div>
          {selectedHex.col},{selectedHex.row}
        </div>
        <div className="self-center px-3 flex space-x-2 ">
          <TickProgress />
        </div>

        <div className="flex min-w-96 gap-1  clip-angled   py-2 px-4 text-gold bg-map   justify-center border-gold/50 text-center ">
          <div className="self-center flex justify-between w-full">
            <Select
              value={realmEntityId.toString()}
              onValueChange={(a: string) => {
                !isHexView ? goToMapView(ID(a)) : goToHexView(ID(a));
              }}
            >
              <SelectTrigger className="">
                <SelectValue placeholder="Select Realm" />
              </SelectTrigger>
              <SelectContent className="bg-black ">
                {structures.map((structure, index) => (
                  <SelectItem
                    className="flex justify-between text-sm"
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
          <Button
            variant="primary"
            className={clsx({
              "animate-pulse":
                (selectedQuest?.id === QuestId.Travel || selectedQuest?.id === QuestId.Hyperstructure) &&
                selectedQuest.status !== QuestStatus.Completed &&
                isHexView,
            })}
            onClick={() => {
              if (location !== "/map") {
                setIsLoadingScreenEnabled(true);
                setTimeout(() => {
                  setPreviewBuilding(null);
                  setLocation("/map");
                  if (hexPosition.col !== 0 && hexPosition.row !== 0) {
                    const { col, row } = hexPosition;
                    moveCameraToColRow(col, row, 0.01, true);
                    setTimeout(() => {
                      moveCameraToColRow(col, row, 1.5);
                    }, 10);
                  }
                }, 300);
              } else {
                goToHexView(realmEntityId);
              }
            }}
          >
            {location === "/map" ? "Hex" : "World"}
          </Button>
        </div>
      </motion.div>

      <div className="flex justify-between w-full  text-gold p-1 text-xs">
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
            className=" px-3 flex gap-2"
          >
            <div className="uppercase font-bold">population</div>
            {population.population} / {population.capacity + BASE_POPULATION_CAPACITY}
          </div>
        )}
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
            className="px-3 flex gap-2"
          >
            <div className="uppercase font-bold">Store</div>
            {storehouses.toLocaleString()}
          </div>
        )}
      </div>
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
      className="self-center text-center  px-4 py-1 bg-gold text-brown border-gradient  clip-angled"
    >
      {progress.toFixed()}%
    </div>
  );
};
