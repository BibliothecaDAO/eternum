import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import useRealmStore from "@/hooks/store/useRealmStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import { useQuery } from "@/hooks/helpers/useQuery";
import CircleButton from "@/ui/elements/CircleButton";
import { BuildingThumbs } from "./LeftNavigationModule";
import { useLocation } from "wouter";
import { useMemo } from "react";

import { useDojo } from "@/hooks/context/DojoContext";

import { useModal } from "@/hooks/store/useModal";
import { HintModal } from "@/ui/components/hints/HintModal";

import { useEntities } from "@/hooks/helpers/useEntities";
import { useRealm } from "@/hooks/helpers/useRealm";
import { Map } from "lucide-react";
import Button from "@/ui/elements/Button";

export const TopMiddleNavigation = () => {
  const {
    setup: {
      components: { Population },
    },
  } = useDojo();

  const [location, setLocation] = useLocation();
  const { toggleModal } = useModal();
  const { playerRealms } = useEntities();
  const { realmEntityId, setRealmEntityId } = useRealmStore();

  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const moveCameraToRealm = useUIStore((state) => state.moveCameraToRealm);

  const { getRealmIdFromRealmEntityId } = useRealm();

  const isRealmView = location.includes(`/hex`);

  const gotToRealmView = (entityId: any) => {
    const realm = playerRealms().find((realm) => realm.entity_id?.toString() === entityId);

    setIsLoadingScreenEnabled(true);
    setTimeout(() => {
      if (location.includes(`/hex`)) {
        setIsLoadingScreenEnabled(false);
      }
      setLocation(`/hex?col=${realm?.position.x}&row=${realm?.position.y}`);
    }, 300);

    setRealmEntityId(BigInt(entityId));
  };

  const goToMapView = (entityId: any) => {
    const realmId = getRealmIdFromRealmEntityId(BigInt(entityId));
    if (!realmId) return;
    moveCameraToRealm(Number(realmId));

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
            onValueChange={(a) => {
              !isRealmView ? goToMapView(a) : gotToRealmView(a);
            }}
          >
            <SelectTrigger className="">
              <SelectValue placeholder="Select Realm" />
            </SelectTrigger>
            <SelectContent className="bg-brown ">
              {playerRealms().map((realm, index) => (
                <SelectItem
                  className="flex justify-between text-sm"
                  key={index}
                  value={realm.entity_id?.toString() || ""}
                >
                  {/* {realm.name} */}
                  <h5 className="self-center flex gap-4">
                    <Map className="self-center" />

                    {realm.name}
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
