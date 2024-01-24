import { useState } from "react";
import { Headline } from "../../../../../elements/Headline";
import { Guild } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { guild_description } from "../../../../../data/guilds";
import Button from "../../../../../elements/Button";

type ChooseBuildingProps = {};

export const ChooseBuilding = ({}: ChooseBuildingProps) => {
  const [selectedGuild, setSelectedGuild] = useState<Guild>(Guild.Harvesters);

  const onCreate = () => {};

  return (
    <div>
      <Headline> Choose Labor Guild </Headline>
      <div> Description</div>
      {Object.keys(Guild).map((guild) => {
        const guildKey = guild as keyof typeof Guild;
        const selected = Guild[guildKey] === selectedGuild;
        const disabled = false;
        return (
          <div
            onClick={() => setSelectedGuild(Guild[guildKey])}
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
      <div className={"relative w-full mt-3"}>
        <div className="flex flex-col">
          <img src={`/images/buildings/bank.png`} className="object-cover w-full h-full rounded-[10px]" />
          <img src={`/images/units/troop.png`} className="object-cover w-full h-full rounded-[10px]" />
        </div>
        <div>Description</div>
        <div>{guild_description[selectedGuild]}</div>
      </div>
      <Button onClick={onCreate} variant="primary">
        Construct Guild
      </Button>
    </div>
  );
};
