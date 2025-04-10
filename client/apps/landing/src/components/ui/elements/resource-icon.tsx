import { ResourcesIds } from "@bibliothecadao/types";
import clsx from "clsx";
import type { ReactElement } from "react";

type Props = {
  resource: string;
  size: keyof (typeof STYLES)["size"];
  className?: string;
  label?: boolean;
  withTooltip?: boolean;
  containerClassName?: string;
  tooltipText?: string; // Added custom tooltip text as optional
};

type Resource = {
  component: ReactElement;
  name: string;
};

const Components: { [key: string]: Resource } = Object.freeze({
  Wood: { component: <img src={`/images/resources/${ResourcesIds.Wood}.png`} />, name: "Wood" },
  Stone: { component: <img src={`/images/resources/${ResourcesIds.Stone}.png`} />, name: "Stone" },
  Coal: { component: <img src={`/images/resources/${ResourcesIds.Coal}.png`} />, name: "Coal" },
  Copper: { component: <img src={`/images/resources/${ResourcesIds.Copper}.png`} />, name: "Copper" },
  Obsidian: { component: <img src={`/images/resources/${ResourcesIds.Obsidian}.png`} />, name: "Obsidian" },
  Silver: { component: <img src={`/images/resources/${ResourcesIds.Silver}.png`} />, name: "Silver" },
  Ironwood: { component: <img src={`/images/resources/${ResourcesIds.Ironwood}.png`} />, name: "Ironwood" },
  ColdIron: { component: <img src={`/images/resources/${ResourcesIds.ColdIron}.png`} />, name: "Cold Iron" },
  Gold: { component: <img src={`/images/resources/${ResourcesIds.Gold}.png`} />, name: "Gold" },
  Hartwood: { component: <img src={`/images/resources/${ResourcesIds.Hartwood}.png`} />, name: "Hartwood" },
  Diamonds: { component: <img src={`/images/resources/${ResourcesIds.Diamonds}.png`} />, name: "Diamonds" },
  Sapphire: { component: <img src={`/images/resources/${ResourcesIds.Sapphire}.png`} />, name: "Sapphire" },
  Ruby: { component: <img src={`/images/resources/${ResourcesIds.Ruby}.png`} />, name: "Ruby" },
  DeepCrystal: { component: <img src={`/images/resources/${ResourcesIds.DeepCrystal}.png`} />, name: "Deep Crystal" },
  Ignium: { component: <img src={`/images/resources/${ResourcesIds.Ignium}.png`} />, name: "Ignium" },
  EtherealSilica: {
    component: <img src={`/images/resources/${ResourcesIds.EtherealSilica}.png`} />,
    name: "Ethereal Silica",
  },
  TrueIce: { component: <img src={`/images/resources/${ResourcesIds.TrueIce}.png`} />, name: "TrueIce" },
  TwilightQuartz: {
    component: <img src={`/images/resources/${ResourcesIds.TwilightQuartz}.png`} />,
    name: "Twilight Quartz",
  },
  AlchemicalSilver: {
    component: <img src={`/images/resources/${ResourcesIds.AlchemicalSilver}.png`} />,
    name: "Alchemical Silver",
  },
  Adamantine: {
    component: <img src={`/images/resources/${ResourcesIds.Adamantine}.png`} />,
    name: "Adamantine",
  },
  Mithral: { component: <img src={`/images/resources/${ResourcesIds.Mithral}.png`} />, name: "Mithral" },
  Dragonhide: { component: <img src={`/images/resources/${ResourcesIds.Dragonhide}.png`} />, name: "Dragonhide" },
  Labor: { component: <img src={`/images/resources/${ResourcesIds.Labor}.png`} />, name: "Labor" },
  AncientFragment: {
    component: <img src={`/images/resources/${ResourcesIds.AncientFragment}.png`} />,
    name: "Ancient Fragment",
  },
  Knight: { component: <img src={`/images/resources/${ResourcesIds.Knight}.png`} />, name: "Knight" },
  KnightT2: { component: <img src={`/images/resources/${ResourcesIds.KnightT2}.png`} />, name: "Knight T2" },
  KnightT3: { component: <img src={`/images/resources/${ResourcesIds.KnightT3}.png`} />, name: "Knight T3" },
  Crossbowman: { component: <img src={`/images/resources/${ResourcesIds.Crossbowman}.png`} />, name: "Crossbowman" },
  CrossbowmanT2: {
    component: <img src={`/images/resources/${ResourcesIds.CrossbowmanT2}.png`} />,
    name: "Crossbowman T2",
  },
  CrossbowmanT3: {
    component: <img src={`/images/resources/${ResourcesIds.CrossbowmanT3}.png`} />,
    name: "Crossbowman T3",
  },
  Paladin: { component: <img src={`/images/resources/${ResourcesIds.Paladin}.png`} />, name: "Paladin" },
  PaladinT2: { component: <img src={`/images/resources/${ResourcesIds.PaladinT2}.png`} />, name: "Paladin T2" },
  PaladinT3: { component: <img src={`/images/resources/${ResourcesIds.PaladinT3}.png`} />, name: "Paladin T3" },
  Lords: { component: <img src={`/images/resources/${ResourcesIds.Lords}.png`} />, name: "Lords" },
  Wheat: { component: <img src={`/images/resources/${ResourcesIds.Wheat}.png`} />, name: "Wheat" },
  Fish: { component: <img src={`/images/resources/${ResourcesIds.Fish}.png`} />, name: "Fish" },

  Donkey: { component: <img src={`/images/buildings/thumb/trade.png`} />, name: "Donkey" },
  House: { component: <img src={`/images/buildings/thumb/house.png`} />, name: "House" },
  Silo: { component: <img src={`/images/buildings/thumb/silo.png`} />, name: "Silo" },
  Timeglass: { component: <img src={`/images/buildings/thumb/timeglass.png`} />, name: "Timeglass" },
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

export const ResourceIcon = ({ withTooltip = true, tooltipText, ...props }: Props) => {
  const Icon = (
    <div className={`flex paper relative group rounded-xl justify-center ${props.className}`}>
      <div className={`relative ${clsx(STYLES.size[props.size], props.className)} `}>
        {Components[props.resource.replace(" ", "").replace("'", "")]?.component}
      </div>

      {props.label && (
        <span className="self-center ml-4 text-center">
          {Components[props.resource.replace(" ", "").replace("'", "")]?.name}
        </span>
      )}
      {withTooltip && (
        <div className="absolute -top-2 flex-col items-center hidden -translate-y-full left-1/2 -translate-x-1/2 bg-brown rounded-lg w-max group-hover:flex">
          <span className="relative z-10 p-2 text-xs leading-none  whitespace-no-wrap rounded shadow-lg bg-gray-1000">
            {tooltipText || Components[props.resource.replace(" ", "").replace("'", "")]?.name}
          </span>
          <div className="z-[100] w-3 h-3 bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 absolute rotate-45 bg-brown"></div>
        </div>
      )}
    </div>
  );
  return Icon;
};
