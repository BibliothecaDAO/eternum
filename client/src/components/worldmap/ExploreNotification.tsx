import { useEffect, useMemo, useState } from "react";
import { ResourceIcon } from "../../elements/ResourceIcon";
import useUIStore from "../../hooks/store/useUIStore";
import { useExplore } from "../../hooks/helpers/useExplore";
import { Resource, findResourceById } from "@bibliothecadao/eternum";
import { divideByPrecision } from "../../utils/utils";
import clsx from "clsx";
import { useNotificationsStore } from "../../hooks/store/useNotificationsStore";
import { useAutoAnimate } from "@formkit/auto-animate/react";

export const ExploreNotifications = () => {
  const { hexData, selectedPath, setSelectedEntity, setSelectedPath, setIsExploreMode } = useUIStore();
  const exploreNotifications = useNotificationsStore((state) => state.exploreNotifications);
  const addExploreNotification = useNotificationsStore((state) => state.addExploreNotification);
  const setExploreNotifications = useNotificationsStore((state) => state.setExploreNotifications);
  const [parent] = useAutoAnimate(/* optional config */);

  const { useFoundResources } = useExplore();
  let foundResource: Resource | undefined = useFoundResources(selectedPath?.id);

  const biome = useMemo(() => {
    if (selectedPath?.path.length === 2 && hexData) {
      const hexIndex = hexData.findIndex((h) => h.col === selectedPath?.path[1].x && h.row === selectedPath?.path[1].y);
      return hexData[hexIndex].biome;
    }
  }, [selectedPath, hexData]);

  useEffect(() => {
    if (biome && foundResource) {
      addExploreNotification({
        biome,
        foundResource,
      });
      setSelectedEntity(undefined);
      setSelectedPath(undefined);
      setIsExploreMode(false);
      setTimeout(() => {
        setExploreNotifications([]);
      }, 5000);
    }
  }, [biome, foundResource]);

  return (
    <div
      className="fixed top-[250px] left-0 flex justify-center items-start w-screen h-screen !pointer-events-none"
      ref={parent}
    >
      {exploreNotifications.map(({ biome, foundResource }, i) => {
        return (
          <div
            key={i}
            className={clsx("bg-black/80 border border-white rounded-xl font-bold p-0.5 text-white flex items-center")}
          >
            <img src="/images/blobert.png" className="w-[78px] h-[78px]" />
            <div className="px-4">
              <div>
                You found <span className="">Jungle biome!</span>
              </div>
              <div className="flex text-biome-temperate_desert">
                and
                <div className="text-gold ml-2">
                  +
                  {Intl.NumberFormat("en-US", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(divideByPrecision(Number(foundResource.amount)) || 0)}
                </div>
                <ResourceIcon
                  resource={findResourceById(foundResource.resourceId)?.trait || ""}
                  size="sm"
                  className="ml-1"
                />
              </div>
            </div>
            <img src={`/images/biomes/${biome.toLowerCase()}.png`} className="w-[78px] h-[78px] rounded-xl ml-2" />
          </div>
        );
      })}
    </div>
  );
};
