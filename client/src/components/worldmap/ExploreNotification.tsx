import { useEffect } from "react";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { useExplore } from "../../hooks/helpers/useExplore";
import { biomes, findResourceById } from "@bibliothecadao/eternum";
import { divideByPrecision } from "../../utils/utils";
import clsx from "clsx";
import { useNotificationsStore } from "../../hooks/store/useNotificationsStore";
import { useAutoAnimate } from "@formkit/auto-animate/react";

const BIOMES = biomes as Record<string, { color: string; depth: number; name: string }>;

export const ExploreNotifications = () => {
  const exploreNotification = useNotificationsStore((state) => state.exploreNotification);
  const setExploreNotification = useNotificationsStore((state) => state.setExploreNotification);
  const [parent] = useAutoAnimate(/* optional config */);

  const { useFoundResources } = useExplore();
  let { foundResources, setFoundResources } = useFoundResources(exploreNotification?.entityId);

  useEffect(() => {
    if (exploreNotification) {
      setTimeout(() => {
        setExploreNotification(null);
        setFoundResources(undefined);
      }, 5000);
    }
  }, [exploreNotification]);

  return (
    <div
      className="fixed top-[250px] left-0 flex justify-center items-start w-screen h-screen !pointer-events-none"
      ref={parent}
    >
      {exploreNotification && foundResources && (
        <div
          className={clsx("bg-black/80 border border-white rounded-xl font-bold p-0.5 text-white flex items-center")}
        >
          <img src="/images/blobert.png" className="w-[78px] h-[78px]" />
          <div className="px-4">
            <div>
              You found{" "}
              <span className={`text-biome-${exploreNotification.biome}`}>
                {BIOMES[exploreNotification.biome].name}!
              </span>
            </div>
            <div className="flex ">
              and
              <div className="text-gold ml-2">
                +
                {Intl.NumberFormat("en-US", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(divideByPrecision(Number(foundResources?.amount)) || 0)}
              </div>
              {foundResources && (
                <ResourceIcon
                  resource={findResourceById(foundResources?.resourceId)?.trait || ""}
                  size="sm"
                  className="ml-1"
                />
              )}
            </div>
          </div>
          <img
            src={`/images/biomes/${exploreNotification.biome.toLowerCase()}.png`}
            className="w-[78px] h-[78px] rounded-xl ml-2"
          />
        </div>
      )}
    </div>
  );
};
