import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { getColRowFromUIPosition, getEntityIdFromKeys, getUIPositionFromColRow } from "@/ui/utils/utils";
import useRealmStore from "@/hooks/store/useRealmStore";
import { getRealmNameById } from "@/ui/utils/realms";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { BuildingType, EternumGlobalConfig, Position, STOREHOUSE_CAPACITY } from "@bibliothecadao/eternum";
import { useQuery } from "@/hooks/helpers/useQuery";
import CircleButton from "@/ui/elements/CircleButton";
import { BuildingThumbs } from "./LeftNavigationModule";
import { useLocation } from "wouter";
import { useHexPosition } from "@/hooks/helpers/useHexPosition";
import { leaderboard, quests } from "@/ui/components/navigation/Config";
import { useMemo } from "react";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "@/hooks/context/DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import { useModal } from "@/hooks/store/useModal";
import { HintModal } from "@/ui/components/hints/HintModal";
import { ArrowUp } from "lucide-react";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useRealm } from "@/hooks/helpers/useRealm";
import { Map } from "lucide-react";
import Button from "@/ui/elements/Button";

export const TopMiddleNavigation = () => {
  const {
    setup: {
      components: { Population, Position },
    },
  } = useDojo();
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const togglePopup = useUIStore((state) => state.togglePopup);

  const [location, setLocation] = useLocation();
  const { realm } = useHexPosition();

  const population = useComponentValue(Population, getEntityIdFromKeys([BigInt(realm?.entity_id || "0")]));

  const { toggleModal } = useModal();

  const { playerRealms, playerStructures } = useEntities();

  const { realmEntityId, setRealmEntityId } = useRealmStore();

  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const moveCameraToRealm = useUIStore((state) => state.moveCameraToRealm);

  const { getRealmIdFromRealmEntityId } = useRealm();

  const isRealmView = location.includes(`/hex`);

  const gotToRealmView = (entityId: any) => {
    const structure = playerStructures().find((structure) => structure.entity_id?.toString() === entityId);

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
    const position = getComponentValue(Position, getEntityIdFromKeys([BigInt(entityId)])) as Position;
    console.log({ position });
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
              console.log({ a });
              !isRealmView ? goToMapView(a) : gotToRealmView(a);
            }}
          >
            <SelectTrigger className="">
              <SelectValue placeholder="Select Realm" />
            </SelectTrigger>
            <SelectContent className="bg-brown ">
              {playerStructures().map((structure, index) => (
                <SelectItem
                  className="flex justify-between text-sm"
                  key={index}
                  value={structure.entity_id?.toString() || ""}
                >
                  {/* {realm.name} */}
                  <h5 className="self-center flex gap-4">
                    <Map className="self-center" />

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
                gotToRealmView(realmEntityId.toString());
              }, 50);
            }
          }}
        >
          {location === "/map" ? "Realm" : "World"}
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
