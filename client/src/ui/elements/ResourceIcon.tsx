import { ReactComponent as People } from "@/assets/icons/common/people.svg";
import { ReactComponent as Cloth } from "@/assets/icons/resources/Cloth.svg";
import { ReactComponent as DemonHide } from "@/assets/icons/resources/DemonHide.svg";
import { ReactComponent as DesertGlass } from "@/assets/icons/resources/DesertGlass.svg";
import { ReactComponent as Lords } from "@/assets/icons/resources/Lords.svg";
import { ReactComponent as Ore } from "@/assets/icons/resources/Ore.svg";
import { ReactComponent as Spores } from "@/assets/icons/resources/Spores.svg";
import clsx from "clsx";
import type { ReactElement } from "react";

type Props = {
  isLabor?: boolean;
  resource: string;
  size: keyof (typeof STYLES)["size"];
  className?: string;
  label?: boolean;
  withTooltip?: boolean;
  containerClassName?: string;
};

type Resource = {
  component: ReactElement;
  name: string;
};

const Components: { [key: string]: Resource } = Object.freeze({
  Adamantine: {
    component: <img src={`/images/resources/20.png`} />,
    name: "Adamantine",
  },
  AlchemicalSilver: {
    component: <img src={`/images/resources/19.png`} />,
    name: "Alchemical Silver",
  },
  Coal: { component: <img src={`/images/resources/3.png`} />, name: "Coal" },
  ColdIron: { component: <img src={`/images/resources/8.png`} />, name: "Cold Iron" },
  Copper: { component: <img src={`/images/resources/4.png`} />, name: "Copper" },
  DeepCrystal: { component: <img src={`/images/resources/14.png`} />, name: "Deep Crystal" },
  Diamonds: { component: <img src={`/images/resources/11.png`} />, name: "Diamonds" },
  Dragonhide: { component: <img src={`/images/resources/22.png`} />, name: "Dragonhide" },
  EtherealSilica: { component: <img src={`/images/resources/16.png`} />, name: "Ethereal Silica" },
  Gold: { component: <img src={`/images/resources/9.png`} />, name: "Gold" },
  Hartwood: { component: <img src={`/images/resources/10.png`} />, name: "Hartwood" },
  Ignium: { component: <img src={`/images/resources/15.png`} />, name: "Ignium" },
  Ironwood: { component: <img src={`/images/resources/7.png`} />, name: "Ironwood" },
  Mithral: { component: <img src={`/images/resources/21.png`} />, name: "Mithral" },
  Obsidian: { component: <img src={`/images/resources/5.png`} />, name: "Obsidian" },
  Ruby: { component: <img src={`/images/resources/13.png`} />, name: "Ruby" },
  Sapphire: { component: <img src={`/images/resources/12.png`} />, name: "Sapphire" },
  Silver: { component: <img src={`/images/resources/6.png`} />, name: "Silver" },
  Stone: { component: <img src={`/images/resources/2.png`} />, name: "Stone" },
  TrueIce: { component: <img src={`/images/resources/17.png`} />, name: "TrueIce" },
  TwilightQuartz: { component: <img src={`/images/resources/18.png`} />, name: "Twilight Quartz" },
  Wood: { component: <img src={`/images/resources/1.png`} />, name: "Wood" },
  EmbersGlow: { component: <DemonHide className="w-full h-full" />, name: "Demon Hide" },
  StoneTemple: { component: <Cloth className="w-full h-full" />, name: "Cloth" },
  DesertOasis: { component: <DesertGlass className="w-full h-full" />, name: "Desert Glass" },
  MountainDeep: { component: <Ore className="w-full h-full" />, name: "Ore" },
  UnderwaterKeep: { component: <Lords className="w-full h-full" />, name: "Lords" },
  ForestRuins: { component: <Spores className="w-full h-full" />, name: "Spores" },
  Lords: { component: <img src={`/images/resources/coin.png`} />, name: "Lords" },
  Fish: { component: <img src={`/images/resources/255.png`} />, name: "Fish" },
  Wheat: { component: <img src={`/images/resources/254.png`} />, name: "Wheat" },
  Donkeys: { component: <img src={`/images/buildings/thumb/trade.png`} />, name: "Donkeys" },
  Knight: { component: <img src={`/images/icons/250.png`} />, name: "Knight" },
  Crossbowman: { component: <img src={`/images/icons/251.png`} />, name: "Crossbowman" },
  Paladin: { component: <img src={`/images/icons/252.png`} />, name: "Paladin" },
  AncientFragment: { component: <img src={`/images/resources/29.png`} />, name: "Ancient Fragment" },
});

const STYLES = {
  size: {
    xs: "w-2 h-2 md:w-4 md:h-4",
    sm: "w-4 h-4 md:w-6 md:h-6",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12 md:w-16 md:h-16",
    xxl: "w-16 h-16 md:w-20 md:h-20",
  },
} as const;

export const ResourceIcon = ({ isLabor = false, withTooltip = true, ...props }: Props) => {
  const Icon = (
    <div className={`flex paper relative group rounded-xl justify-center ${props.className}`}>
      <div className={`relative ${clsx(STYLES.size[props.size], props.className)} `}>
        {Components[props.resource.replace(" ", "").replace("'", "")]?.component}
        {isLabor && <People className="absolute left-4 h-2.5 top-3"></People>}
      </div>

      {props.label && (
        <span className="self-center ml-4 text-center">
          {Components[props.resource.replace(" ", "").replace("'", "")]?.name}
        </span>
      )}
      {withTooltip && (
        <div className="absolute flex -top-2 flex-col items-center hidden -translate-y-full left-1/2 -translate-x-1/2 bg-black rounded-lg w-max group-hover:flex">
          <span className="relative z-10 p-2 text-xs leading-none  whitespace-no-wrap rounded shadow-lg bg-gray-1000">
            {props.resource}
          </span>
          <div className="z-[100] w-3 h-3 bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 absolute rotate-45 bg-black"></div>
        </div>
      )}
    </div>
  );
  return Icon;
};
