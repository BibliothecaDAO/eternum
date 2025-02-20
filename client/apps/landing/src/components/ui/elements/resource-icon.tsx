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
  Wood: { component: <img src={`/images/resources/1.png`} />, name: "Wood" },
  Stone: { component: <img src={`/images/resources/2.png`} />, name: "Stone" },
  Coal: { component: <img src={`/images/resources/3.png`} />, name: "Coal" },
  Copper: { component: <img src={`/images/resources/4.png`} />, name: "Copper" },
  Obsidian: { component: <img src={`/images/resources/5.png`} />, name: "Obsidian" },
  Silver: { component: <img src={`/images/resources/6.png`} />, name: "Silver" },
  Ironwood: { component: <img src={`/images/resources/7.png`} />, name: "Ironwood" },
  ColdIron: { component: <img src={`/images/resources/8.png`} />, name: "Cold Iron" },
  Gold: { component: <img src={`/images/resources/9.png`} />, name: "Gold" },
  Hartwood: { component: <img src={`/images/resources/10.png`} />, name: "Hartwood" },
  Diamonds: { component: <img src={`/images/resources/11.png`} />, name: "Diamonds" },
  Sapphire: { component: <img src={`/images/resources/12.png`} />, name: "Sapphire" },
  Ruby: { component: <img src={`/images/resources/13.png`} />, name: "Ruby" },
  DeepCrystal: { component: <img src={`/images/resources/14.png`} />, name: "Deep Crystal" },
  Ignium: { component: <img src={`/images/resources/15.png`} />, name: "Ignium" },
  EtherealSilica: { component: <img src={`/images/resources/16.png`} />, name: "Ethereal Silica" },
  TrueIce: { component: <img src={`/images/resources/17.png`} />, name: "TrueIce" },
  TwilightQuartz: { component: <img src={`/images/resources/18.png`} />, name: "Twilight Quartz" },
  AlchemicalSilver: {
    component: <img src={`/images/resources/19.png`} />,
    name: "Alchemical Silver",
  },
  Adamantine: {
    component: <img src={`/images/resources/20.png`} />,
    name: "Adamantine",
  },
  Mithral: { component: <img src={`/images/resources/21.png`} />, name: "Mithral" },
  Dragonhide: { component: <img src={`/images/resources/22.png`} />, name: "Dragonhide" },
  AncientFragment: { component: <img src={`/images/resources/29.png`} />, name: "Ancient Fragment" },
  Knight: { component: <img src={`/images/icons/250.png`} />, name: "Knight" },
  Crossbowman: { component: <img src={`/images/icons/251.png`} />, name: "Crossbowman" },
  Paladin: { component: <img src={`/images/icons/252.png`} />, name: "Paladin" },
  Lords: { component: <img src={`/images/resources/31.png`} />, name: "Lords" },
  Wheat: { component: <img src={`/images/resources/254.png`} />, name: "Wheat" },
  Fish: { component: <img src={`/images/resources/255.png`} />, name: "Fish" },

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
