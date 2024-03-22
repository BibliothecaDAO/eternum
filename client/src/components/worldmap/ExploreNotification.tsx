import { useEffect, useMemo, useState } from "react";
import { ResourceIcon } from "../../elements/ResourceIcon";
import useUIStore from "../../hooks/store/useUIStore";
import { useExplore } from "../../hooks/helpers/useExplore";
import { Resource, findResourceById } from "@bibliothecadao/eternum";
import { divideByPrecision } from "../../utils/utils";
import clsx from "clsx";
import { useNotificationsStore } from "../../hooks/store/useNotificationsStore";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { biomeNames } from "../../geodata/hex/biomes";

export const ExploreNotifications = () => {
  const exploreNotification = useNotificationsStore((state) => state.exploreNotification);
  const setExploreNotification = useNotificationsStore((state) => state.setExploreNotification);
  const [parent] = useAutoAnimate(/* optional config */);

  const { useFoundResources } = useExplore();
  let foundResource: Resource | undefined = useFoundResources(exploreNotification?.entityId);

  useEffect(() => {
    if (exploreNotification) {
      setTimeout(() => {
        setExploreNotification(null);
      }, 5000);
    }
  }, [exploreNotification]);

  return (
    <div
      className="fixed top-[250px] left-0 flex justify-center items-start w-screen h-screen !pointer-events-none"
      ref={parent}
    >
      {exploreNotification && (
        <div
          className={clsx("bg-black/80 border border-white rounded-xl font-bold p-0.5 text-white flex items-center")}
        >
          <img src="/images/blobert.png" className="w-[78px] h-[78px]" />
          <div className="px-4">
            <div>
              You found{" "}
              <span className={`text-biome-${exploreNotification.biome}`}>
                {biomeNames[exploreNotification.biome]}!
              </span>
            </div>
            <div className="flex ">
              and
              <div className="text-gold ml-2">
                +
                {Intl.NumberFormat("en-US", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(divideByPrecision(Number(foundResource?.amount)) || 0)}
              </div>
              {foundResource && (
                <ResourceIcon
                  resource={findResourceById(foundResource?.resourceId)?.trait || ""}
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
