import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { getColRowFromUIPosition, getEntityIdFromKeys } from "@/ui/utils/utils";
import useRealmStore from "@/hooks/store/useRealmStore";
import { getRealmNameById } from "@/ui/utils/realms";
import {
  BASE_POPULATION_CAPACITY,
  BuildingType,
  EternumGlobalConfig,
  STOREHOUSE_CAPACITY,
} from "@bibliothecadao/eternum";
import { useQuery } from "@/hooks/helpers/useQuery";
import CircleButton from "@/ui/elements/CircleButton";
import { BuildingThumbs } from "./LeftNavigationModule";
import { useLocation } from "wouter";
import { useHexPosition } from "@/hooks/helpers/useHexPosition";
import { assistant, leaderboard, quests } from "@/ui/components/navigation/Config";
import { Compass } from "@/ui/components/worldmap/Compass";
import { Headline } from "@/ui/elements/Headline";
import { useMemo } from "react";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "@/hooks/context/DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import { useModal } from "@/hooks/store/useModal";
import { HintModal } from "@/ui/components/hints/HintModal";
import { ArrowUp } from "lucide-react";

export const TopMiddleNavigation = () => {
  const {
    setup: {
      components: { Population, BuildingQuantityv2 },
    },
  } = useDojo();
  const setTooltip = useUIStore((state) => state.setTooltip);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const togglePopup = useUIStore((state) => state.togglePopup);
  const { realmId } = useRealmStore();
  const [location, setLocation] = useLocation();
  const { realm } = useHexPosition();

  const population = useComponentValue(Population, getEntityIdFromKeys([BigInt(realm?.entity_id || "0")]));

  const storehouses = useMemo(() => {
    const quantity =
      getComponentValue(
        BuildingQuantityv2,
        getEntityIdFromKeys([BigInt(realm?.entity_id || "0"), BigInt(BuildingType.Storehouse)]),
      )?.value || 0;

    return quantity * STOREHOUSE_CAPACITY + STOREHOUSE_CAPACITY;
  }, []);

  const { toggleModal } = useModal();

  return (
    <div className="flex">
      <div className="self-center px-3 flex space-x-2">
        <CircleButton
          image={BuildingThumbs.leaderboard}
          label={leaderboard}
          active={isPopupOpen(leaderboard)}
          size="sm"
          onClick={() => togglePopup(leaderboard)}
        />
        <div className="relative">
          <CircleButton
            image={BuildingThumbs.squire}
            label={quests}
            active={isPopupOpen(quests)}
            size="sm"
            onClick={() => togglePopup(quests)}
            className="forth-step"
          />

          {population?.population == null && location !== "/map" && (
            <div className="absolute bg-brown text-gold border-gradient border top-12 w-32 animate-bounce px-1 py-1 flex uppercase">
              <ArrowUp className="text-gold w-4 mr-3" />
              <div>Start here</div>
            </div>
          )}
        </div>
        <TickProgress />
      </div>

      <div className="flex bg-brown/90 clip-angled  border-gradient py-2  px-24 text-gold bg-map   justify-center border-gold/50 border-b-2 text-center">
        <div className="self-center ">
          <Headline>
            <h5 className="self-center uppercase">{realmId ? getRealmNameById(realmId as any | "") : ""}</h5>
          </Headline>
        </div>
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
        {population && (
          <div
            onMouseEnter={() => {
              setTooltip({
                position: "bottom",
                content: (
                  <span className="whitespace-nowrap pointer-events-none">
                    <Headline>Population</Headline>

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
            className="self-center text-center  px-4 py-1 second-step bg-brown text-gold border-gradient h5"
          >
            {population.population} / {population.capacity + BASE_POPULATION_CAPACITY} pop
          </div>
        )}
        {storehouses && (
          <div
            onMouseEnter={() => {
              setTooltip({
                position: "bottom",
                content: (
                  <div className="whitespace-nowrap pointer-events-none">
                    <Headline>Storehouses Capacity</Headline>

                    <span>This is the max per resource you can store</span>

                    <br />
                    <span>Build Storehouses to increase this</span>
                  </div>
                ),
              });
            }}
            onMouseLeave={() => setTooltip(null)}
            className="self-center text-center  px-4 py-1 second-step bg-brown text-gold border-gradient h5 "
          >
            {storehouses.toLocaleString()} max
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
