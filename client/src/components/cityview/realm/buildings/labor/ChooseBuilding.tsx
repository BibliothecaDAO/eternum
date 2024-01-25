import { useState } from "react";
import { Guilds, ResourcesIds, resourcesByGuild } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { guild_description } from "../../../../../data/guilds";
import Button from "../../../../../elements/Button";
import { ResourceIcon } from "../../../../../elements/ResourceIcon";
import { ResourceCost } from "../../../../../elements/ResourceCost";
import { divideByPrecision } from "../../../../../utils/utils";

type ChooseBuildingProps = {};

export const ChooseBuilding = ({}: ChooseBuildingProps) => {
  const [selectedGuild, setSelectedGuild] = useState<number>(0);

  const onCreate = () => {};

  const costResources = resourcesByGuild[Guilds[selectedGuild]].map((resourceId) => {
    return {
      resourceId,
      amount: 100,
    };
  });

  return (
    <div className="m-2">
      <div className="grid grid-cols-2 gap-2 text-gold text-center text-xs">
        {Guilds.map((guild, index) => {
          const selected = guild === Guilds[selectedGuild];
          const disabled = false;
          return (
            <div
              onClick={() => setSelectedGuild(index)}
              className={clsx(
                "p-2 relative cursor-pointer group border border-transparent transition-colors duration-200 rounded-xl bg-black/60 hover:border-lightest",
                selected && "!border-gold",
                disabled && "opacity-30 cursor-not-allowed pointer-events-none",
              )}
            >
              {guild}
            </div>
          );
        })}
      </div>
      <div className={"relative w-full mt-3"}>
        <div className="flex flex-row h-full">
          <img
            src={`/images/units/${Guilds[selectedGuild].toLocaleLowerCase()}.png`}
            className="object-cover w-[200px] h-full rounded-[10px] mr-2"
          />
          <div className="flex flex-col p-2 absolute left-2 bottom-2 rounded-[10px] bg-black/60">
            <div className="italic text-light-pink text-xxs">Price:</div>
            <div className="grid grid-cols-5 gap-0.5">
              {costResources.map(({ resourceId, amount }) => (
                <ResourceCost
                  key={resourceId}
                  type="vertical"
                  resourceId={resourceId}
                  amount={divideByPrecision(amount)}
                />
              ))}
            </div>
          </div>
          <div className="w-full h-[200px]">
            <div className="flex flex-col justify-between h-full">
              <div className="">
                <div className="flex flex-row text-gold text-xxs mb-2">
                  Resources:
                  {resourcesByGuild[Guilds[selectedGuild]].map((resource) => (
                    <ResourceIcon size={"xs"} resource={ResourcesIds[resource]}></ResourceIcon>
                  ))}
                </div>
                <div className="text-xxs text-gold italic items-start">{guild_description[selectedGuild]}</div>
              </div>
              <div className="flex items-end justify-center mt-1">
                <Button
                  disabled={selectedGuild === undefined}
                  size={"xs"}
                  className="!rounded-full"
                  onClick={() => {}}
                  variant="success"
                >
                  Create Building
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
