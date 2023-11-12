import type { ReactElement } from "react";
import clsx from "clsx";
import { ReactComponent as Adamantine } from "../assets/icons/resources/Adamantine.svg";
import { ReactComponent as AlchemicalSilver } from "../assets/icons/resources/AlchemicalSilver.svg";
import { ReactComponent as Cloth } from "../assets/icons/resources/Cloth.svg";
import { ReactComponent as Coal } from "../assets/icons/resources/Coal.svg";
import { ReactComponent as ColdIron } from "../assets/icons/resources/ColdIron.svg";
import { ReactComponent as Copper } from "../assets/icons/resources/Copper.svg";
import { ReactComponent as DeepCrystal } from "../assets/icons/resources/DeepCrystal.svg";
import { ReactComponent as DemonHide } from "../assets/icons/resources/DemonHide.svg";
import { ReactComponent as DesertGlass } from "../assets/icons/resources/DesertGlass.svg";
import { ReactComponent as Diamonds } from "../assets/icons/resources/Diamonds.svg";
import { ReactComponent as Dragonhide } from "../assets/icons/resources/Dragonhide.svg";
import { ReactComponent as EtherealSilica } from "../assets/icons/resources/EtherealSilica.svg";
import { ReactComponent as Fish } from "../assets/icons/resources/fish.svg";
import { ReactComponent as Gold } from "../assets/icons/resources/Gold.svg";
import { ReactComponent as Hartwood } from "../assets/icons/resources/Hartwood.svg";
import { ReactComponent as Ignium } from "../assets/icons/resources/Ignium.svg";
import { ReactComponent as Ironwood } from "../assets/icons/resources/Ironwood.svg";
import { ReactComponent as Mithral } from "../assets/icons/resources/Mithral.svg";
import { ReactComponent as Obsidian } from "../assets/icons/resources/Obsidian.svg";
import { ReactComponent as Ore } from "../assets/icons/resources/Ore.svg";
import { ReactComponent as Ruby } from "../assets/icons/resources/Ruby.svg";
import { ReactComponent as Sapphire } from "../assets/icons/resources/Sapphire.svg";
import { ReactComponent as Shekels } from "../assets/icons/resources/Shekels.svg";
import { ReactComponent as Silver } from "../assets/icons/resources/Silver.svg";
import { ReactComponent as Spores } from "../assets/icons/resources/Spores.svg";
import { ReactComponent as Stone } from "../assets/icons/resources/Stone.svg";
import { ReactComponent as TrueIce } from "../assets/icons/resources/TrueIce.svg";
import { ReactComponent as TwilightQuartz } from "../assets/icons/resources/TwilightQuartz.svg";
import { ReactComponent as Wheat } from "../assets/icons/resources/wheat.svg";
import { ReactComponent as Wood } from "../assets/icons/resources/Wood.svg";

export type Props = {
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
  Adamantine: { component: <Adamantine />, name: "Adamantine" },
  AlchemicalSilver: {
    component: <AlchemicalSilver />,
    name: "Alchemical Silver",
  },
  Coal: { component: <Coal className="w-full h-full" />, name: "Coal" },
  ColdIron: { component: <ColdIron className="w-full h-full" />, name: "Cold Iron" },
  Copper: { component: <Copper className="w-full h-full" />, name: "Copper" },
  DeepCrystal: { component: <DeepCrystal className="w-full h-full" />, name: "Deep Crystal" },
  Diamonds: { component: <Diamonds className="w-full h-full" />, name: "Diamonds" },
  Dragonhide: { component: <Dragonhide className="w-full h-full" />, name: "Dragonhide" },
  EtherealSilica: { component: <EtherealSilica className="w-full h-full" />, name: "Ethereal Silica" },
  Gold: { component: <Gold className="w-full h-full" />, name: "Gold" },
  Hartwood: { component: <Hartwood className="w-full h-full" />, name: "Hartwood" },
  Ignium: { component: <Ignium className="w-full h-full" />, name: "Ignium" },
  Ironwood: { component: <Ironwood className="w-full h-full" />, name: "Ironwood" },
  Mithral: { component: <Mithral className="w-full h-full" />, name: "Mithral" },
  Obsidian: { component: <Obsidian className="w-full h-full" />, name: "Obsidian" },
  Ruby: { component: <Ruby className="w-full h-full" />, name: "Ruby" },
  Sapphire: { component: <Sapphire className="w-full h-full" />, name: "Sapphire" },
  Silver: { component: <Silver className="w-full h-full" />, name: "Silver" },
  Stone: { component: <Stone className="w-full h-full" />, name: "Stone" },
  TrueIce: { component: <TrueIce className="w-full h-full" />, name: "TrueIce" },
  TwilightQuartz: { component: <TwilightQuartz className="w-full h-full" />, name: "Twilight Quartz" },
  Wood: { component: <Wood className="w-full h-full" />, name: "Wood" },
  EmbersGlow: { component: <DemonHide className="w-full h-full" />, name: "Demon Hide" },
  StoneTemple: { component: <Cloth className="w-full h-full" />, name: "Cloth" },
  DesertOasis: { component: <DesertGlass className="w-full h-full" />, name: "Desert Glass" },
  MountainDeep: { component: <Ore className="w-full h-full" />, name: "Ore" },
  UnderwaterKeep: { component: <Shekels className="w-full h-full" />, name: "Shekels" },
  ForestRuins: { component: <Spores className="w-full h-full" />, name: "Spores" },
  Shekels: { component: <Shekels className="w-full h-full" />, name: "Shekels" },
  Fish: { component: <Fish className="w-full h-full" />, name: "Fish" },
  Wheat: { component: <Wheat className="w-full h-full" />, name: "Wheat" },
});

const STYLES = {
  size: {
    xs: "w-2 h-2 md:w-4 md:h-4",
    sm: "w-4 h-4 md:w-6 md:h-6",
    md: "w-6 h-6 md:w-8 md:h-8",
    lg: "w-8 h-8 md:w-12 md:h-16",
  },
} as const;

export const ResourceIcon = ({ withTooltip = true, ...props }: Props) => {
  const Icon = (
    <div
      className={`flex self-center w-min paper relative group rounded-xl justify-center w-full ${props.containerClassName}`}
    >
      <div className={` mx-auto ${clsx(STYLES.size[props.size], props.className)} `}>
        {Components[props.resource.replace(" ", "").replace("'", "")]?.component}
      </div>

      {props.label && (
        <span className="self-center ml-4 text-center">
          {Components[props.resource.replace(" ", "").replace("'", "")]?.name}
        </span>
      )}
      {withTooltip && (
        <div className="absolute flex -top-2 flex-col items-center hidden -translate-y-full left-1/2 -translate-x-1/2 bg-black rounded-lg w-max group-hover:flex">
          <span className="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap rounded shadow-lg bg-gray-1000">
            {props.resource}
          </span>
          <div className="z-[100] w-3 h-3 bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 absolute rotate-45 bg-black"></div>
        </div>
      )}
    </div>
  );
  return Icon;
};
