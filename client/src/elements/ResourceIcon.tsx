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
  Coal: { component: <Coal />, name: "Coal" },
  ColdIron: { component: <ColdIron />, name: "Cold Iron" },
  Copper: { component: <Copper />, name: "Copper" },
  DeepCrystal: { component: <DeepCrystal />, name: "Deep Crystal" },
  Diamonds: { component: <Diamonds />, name: "Diamonds" },
  Dragonhide: { component: <Dragonhide />, name: "Dragonhide" },
  EtherealSilica: { component: <EtherealSilica />, name: "Ethereal Silica" },
  Gold: { component: <Gold />, name: "Gold" },
  Hartwood: { component: <Hartwood />, name: "Hartwood" },
  Ignium: { component: <Ignium />, name: "Ignium" },
  Ironwood: { component: <Ironwood />, name: "Ironwood" },
  Mithral: { component: <Mithral />, name: "Mithral" },
  Obsidian: { component: <Obsidian />, name: "Obsidian" },
  Ruby: { component: <Ruby />, name: "Ruby" },
  Sapphire: { component: <Sapphire />, name: "Sapphire" },
  Silver: { component: <Silver />, name: "Silver" },
  Stone: { component: <Stone />, name: "Stone" },
  TrueIce: { component: <TrueIce />, name: "TrueIce" },
  TwilightQuartz: { component: <TwilightQuartz />, name: "Twilight Quartz" },
  Wood: { component: <Wood />, name: "Wood" },
  EmbersGlow: { component: <DemonHide />, name: "Demon Hide" },
  StoneTemple: { component: <Cloth />, name: "Cloth" },
  DesertOasis: { component: <DesertGlass />, name: "Desert Glass" },
  MountainDeep: { component: <Ore />, name: "Ore" },
  UnderwaterKeep: { component: <Shekels />, name: "Shekels" },
  ForestRuins: { component: <Spores />, name: "Spores" },
  Shekels: { component: <Shekels />, name: "Shekels" },
  Fish: { component: <Fish />, name: "Fish" },
  Wheat: { component: <Wheat />, name: "Wheat" },
});

const STYLES = {
  size: {
    xs: "w-2 md:w-4",
    sm: "w-4 md:w-6",
    md: "w-6 md:w-8",
    lg: "w-8 md:w-12",
  },
} as const;

export const ResourceIcon = ({ withTooltip = true, ...props }: Props) => {
  const Icon = (
    <div
      className={`flex self-center w-min paper relative group rounded-xl justify-center w-full ${props.containerClassName}`}
    >
      <span className={` mx-auto ${clsx(STYLES.size[props.size], props.className)} `}>
        {Components[props.resource.replace(" ", "").replace("'", "")]?.component}
      </span>

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
