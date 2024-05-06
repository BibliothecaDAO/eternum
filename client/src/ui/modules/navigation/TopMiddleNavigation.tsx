import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { getColRowFromUIPosition, getEntityIdFromKeys } from "@/ui/utils/utils";
import useRealmStore from "@/hooks/store/useRealmStore";
import { getRealmNameById } from "@/ui/utils/realms";
import { BASE_POPULATION_CAPACITY, BuildingType, STOREHOUSE_CAPACITY, TIME_PER_TICK } from "@bibliothecadao/eternum";
import { useQuery } from "@/hooks/helpers/useQuery";
import CircleButton from "@/ui/elements/CircleButton";
import { BuildingThumbs } from "./LeftNavigationModule";
import { useLocation } from "wouter";
import { useHexPosition } from "@/hooks/helpers/useHexPosition";
import { assistant, quests } from "@/ui/components/navigation/Config";
import { Compass } from "@/ui/components/worldmap/Compass";
import { Headline } from "@/ui/elements/Headline";
import { useMemo } from "react";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "@/hooks/context/DojoContext";
import { getComponentValue } from "@dojoengine/recs";

export const TopMiddleNavigation = () => {
  const {
    setup: {
      components: { Population, BuildingQuantity },
    },
  } = useDojo();
  const { hexPosition } = useQuery();
  const setTooltip = useUIStore((state) => state.setTooltip);
  const { highlightPositions, moveCameraToColRow, isPopupOpen, togglePopup } = useUIStore();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const { realmId } = useRealmStore();
  const [location, setLocation] = useLocation();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp) as number;
  const { realm } = useHexPosition();

  const { timeLeftBeforeNextTick, progress } = useMemo(() => {
    const timeLeft = nextBlockTimestamp % TIME_PER_TICK;
    const progressValue = (timeLeft / TIME_PER_TICK) * 100;
    return { timeLeftBeforeNextTick: timeLeft, progress: progressValue };
  }, [nextBlockTimestamp]);

  const population = useComponentValue(Population, getEntityIdFromKeys([BigInt(realm?.entity_id || "0")]));

  const storehouses = useMemo(() => {
    const quantity =
      getComponentValue(
        BuildingQuantity,
        getEntityIdFromKeys([BigInt(realm?.entity_id || "0"), BigInt(BuildingType.Storehouse)]),
      )?.value || 0;

    return quantity * STOREHOUSE_CAPACITY + STOREHOUSE_CAPACITY;
  }, []);

  if (!nextBlockTimestamp) {
    return null;
  }

  return (
    <div className="flex">
      {location === "/map" && (
        <div className="flex mr-4">
          <Compass />
        </div>
      )}
      <div
        onMouseEnter={() => {
          setTooltip({
            position: "bottom",
            content: (
              <span className="whitespace-nowrap pointer-events-none">
                <span>A day in Eternum is {TIME_PER_TICK / 60}m</span>
              </span>
            ),
          });
        }}
        onMouseLeave={() => setTooltip(null)}
        className="self-center text-center  px-4 py-1 second-step bg-brown text-gold border-gradient m-2 h5"
      >
        {progress.toFixed()}% in cycle
      </div>
      <div className="flex bg-brown/90  border-gradient py-2  px-24 text-gold bg-map   justify-center border-gold/50 border-b-2 text-center">
        <div className="self-center ">
          <Headline>
            <h5 className="self-center uppercase">{realmId ? getRealmNameById(realmId as any | "") : ""}</h5>
          </Headline>
        </div>
      </div>
      <div className="self-center px-3 flex space-x-2">
        {/* <CircleButton
          image={BuildingThumbs.squire}
          label={assistant}
          active={isPopupOpen(assistant)}
          size="xl"
          onClick={() => togglePopup(assistant)}
        /> */}
        <CircleButton
          image={BuildingThumbs.squire}
          label={quests}
          active={isPopupOpen(quests)}
          size="sm"
          onClick={() => togglePopup(quests)}
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
            className="self-center text-center  px-4 py-1 second-step bg-brown text-gold border-gradient h5"
          >
            {storehouses.toLocaleString()} max
          </div>
        )}
      </div>
    </div>
  );
};
