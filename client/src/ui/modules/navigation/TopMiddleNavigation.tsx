import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import useRealmStore, { STARTING_ENTITY_ID } from "@/hooks/store/useRealmStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { EternumGlobalConfig, Position } from "@bibliothecadao/eternum";
import { useQuery } from "@/hooks/helpers/useQuery";
import CircleButton from "@/ui/elements/CircleButton";
import { BuildingThumbs } from "./LeftNavigationModule";
import { useLocation } from "wouter";
import { useEffect, useMemo } from "react";
import { useDojo } from "@/hooks/context/DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import { useModal } from "@/hooks/store/useModal";
import { HintModal } from "@/ui/components/hints/HintModal";
import { useEntities } from "@/hooks/helpers/useEntities";
import { Crown, Building, Warehouse, Factory } from "lucide-react";
import Button from "@/ui/elements/Button";

// use a different icon for each structure depending on their category
const structureIcons: Record<string, JSX.Element> = {
  None: <Building />,
  Realm: <Crown />,
  Bank: <Building />,
  Hyperstructure: <Warehouse />,
  ShardsMine: <Factory />,
};

export const TopMiddleNavigation = () => {
  const { setup } = useDojo();

  const [location, setLocation] = useLocation();

  const { toggleModal } = useModal();

  const { playerStructures } = useEntities();
  const structures = playerStructures();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const setRealmEntityId = useRealmStore((state) => state.setRealmEntityId);

  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  const isHexView = location.includes(`/hex`);

  const goToHexView = (entityId: any) => {
    const structure = structures.find((structure) => structure.entity_id?.toString() === entityId);

    setIsLoadingScreenEnabled(true);
    setTimeout(() => {
      if (location.includes(`/hex`)) {
        setIsLoadingScreenEnabled(false);
      }
      setLocation(`/hex?col=${structure!.position.x}&row=${structure!.position.y}`);
    }, 300);

    setRealmEntityId(BigInt(entityId));
  };

  const goToMapView = (entityId: any) => {
    const position = getComponentValue(setup.components.Position, getEntityIdFromKeys([BigInt(entityId)])) as Position;
    moveCameraToColRow(position.x, position.y);

    setRealmEntityId(BigInt(entityId));
  };

  const { hexPosition } = useQuery();
  const moveCameraToColRow = useUIStore((state) => state.moveCameraToColRow);

  return (
    <div className="flex">
      <div className="self-center px-3 flex space-x-2">
        <TickProgress />
      </div>

      <div className="flex min-w-96 bg-brown clip-angled  border-gradient py-2 px-4 text-gold bg-map   justify-center border-gold/50 border-b-2 text-center">
        <div className="self-center flex justify-between w-full">
          <Select
            value={realmEntityId.toString()}
            onValueChange={(a: any) => {
              !isHexView ? goToMapView(a) : goToHexView(a);
            }}
          >
            <SelectTrigger className="">
              <SelectValue placeholder="Select Realm" />
            </SelectTrigger>
            <SelectContent className="bg-brown ">
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
          onClick={() => {
            if (location !== "/map") {
              setIsLoadingScreenEnabled(true);
              setTimeout(() => {
                setLocation("/map");
                if (hexPosition.col !== 0 && hexPosition.row !== 0) {
                  moveCameraToColRow(hexPosition.col, hexPosition.row, 0.01, true);
                  setTimeout(() => {
                    moveCameraToColRow(hexPosition.col, hexPosition.row, 1.5);
                  }, 10);
                }
              }, 100);
            } else {
              setTimeout(() => {
                goToHexView(realmEntityId.toString());
              }, 50);
            }
          }}
        >
          {location === "/map" ? "Hex" : "World"}
        </Button>
      </div>
      <div className="self-center px-3 flex space-x-2">
        <CircleButton
          image={BuildingThumbs.question}
          label={"Hints"}
          // active={isPopupOpen(quests)}
          className="fifth-step"
          size="sm"
          onClick={() => toggleModal(<HintModal />)}
        />
      </div>
    </div>
  );
};

const TickProgress = () => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp) as number;

  const { timeLeftBeforeNextTick, progress } = useMemo(() => {
    const timeLeft = nextBlockTimestamp % EternumGlobalConfig.tick.tickIntervalInSeconds;
    const progressValue = (timeLeft / EternumGlobalConfig.tick.tickIntervalInSeconds) * 100;
    return { timeLeftBeforeNextTick: timeLeft, progress: progressValue };
  }, [nextBlockTimestamp]);

  return (
    <div
      onMouseEnter={() => {
        setTooltip({
          position: "bottom",
          content: (
            <span className="whitespace-nowrap pointer-events-none">
              <span>A day in Eternum is {EternumGlobalConfig.tick.tickIntervalInSeconds / 60}m</span>
            </span>
          ),
        });
      }}
      onMouseLeave={() => setTooltip(null)}
      className="self-center text-center  px-4 py-1 second-step bg-brown text-gold border-gradient h5 clip-angled"
    >
      {progress.toFixed()}%
    </div>
  );
};
