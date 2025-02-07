import type { ReactElement } from "react";
import clsx from "clsx";

interface Props {
  resource: string;
  size: keyof (typeof STYLES)["size"];
  className?: string;
  label?: boolean;
  withTooltip?: boolean;
  containerClassName?: string;
  tooltipText?: string; // Added custom tooltip text as optional
}

interface Resource {
  component: ReactElement;
  name: string;
}

const Components: Record<string, Resource> = Object.freeze({
  Adamantine: {
    component: <img src={`/realms/resources/20.png`} />,
    name: "Adamantine",
  },
  AlchemicalSilver: {
    component: <img src={`/realms/resources/19.png`} />,
    name: "Alchemical Silver",
  },
  Coal: {
    component: <img src={`/realms/resources/3.png`} />,
    name: "Coal",
  },
  ColdIron: {
    component: <img src={`/realms/resources/8.png`} />,
    name: "Cold Iron",
  },
  Copper: {
    component: <img src={`/realms/resources/4.png`} />,
    name: "Copper",
  },
  DeepCrystal: {
    component: <img src={`/realms/resources/14.png`} />,
    name: "Deep Crystal",
  },
  Diamonds: {
    component: <img src={`/realms/resources/11.png`} />,
    name: "Diamonds",
  },
  Dragonhide: {
    component: <img src={`/realms/resources/22.png`} />,
    name: "Dragonhide",
  },
  EtherealSilica: {
    component: <img src={`/realms/resources/16.png`} />,
    name: "Ethereal Silica",
  },
  Gold: {
    component: <img src={`/realms/resources/9.png`} />,
    name: "Gold",
  },
  Hartwood: {
    component: <img src={`/realms/resources/10.png`} />,
    name: "Hartwood",
  },
  Ignium: {
    component: <img src={`/realms/resources/15.png`} />,
    name: "Ignium",
  },
  Ironwood: {
    component: <img src={`/realms/resources/7.png`} />,
    name: "Ironwood",
  },
  Mithral: {
    component: <img src={`/realms/resources/21.png`} />,
    name: "Mithral",
  },
  Obsidian: {
    component: <img src={`/realms/resources/5.png`} />,
    name: "Obsidian",
  },
  Ruby: {
    component: <img src={`/realms/resources/13.png`} />,
    name: "Ruby",
  },
  Sapphire: {
    component: <img src={`/realms/resources/12.png`} />,
    name: "Sapphire",
  },
  Silver: {
    component: <img src={`/realms/resources/6.png`} />,
    name: "Silver",
  },
  Stone: {
    component: <img src={`/realms/resources/2.png`} />,
    name: "Stone",
  },
  TrueIce: {
    component: <img src={`/realms/resources/17.png`} />,
    name: "TrueIce",
  },
  TwilightQuartz: {
    component: <img src={`/realms/resources/18.png`} />,
    name: "Twilight Quartz",
  },
  Wood: {
    component: <img src={`/realms/resources/1.png`} />,
    name: "Wood",
  },
  Lords: {
    component: <img src={`/realms/resources/coin.png`} />,
    name: "Lords",
  },
  Fish: {
    component: <img src={`/realms/resources/255.png`} />,
    name: "Fish",
  },
  Wheat: {
    component: <img src={`/realms/resources/254.png`} />,
    name: "Wheat",
  },
  Donkey: {
    component: <img src={`/images/buildings/thumb/trade.png`} />,
    name: "Donkey",
  },
  Knight: { component: <img src={`/images/icons/250.png`} />, name: "Knight" },
  Crossbowman: {
    component: <img src={`/images/icons/251.png`} />,
    name: "Crossbowman",
  },
  Paladin: {
    component: <img src={`/images/icons/252.png`} />,
    name: "Paladin",
  },
  AncientFragment: {
    component: <img src={`/realms/resources/29.png`} />,
    name: "Ancient Fragment",
  },
  House: {
    component: <img src={`/images/buildings/thumb/house.png`} />,
    name: "House",
  },
  Silo: {
    component: <img src={`/images/buildings/thumb/silo.png`} />,
    name: "Silo",
  },
  Timeglass: {
    component: <img src={`/images/buildings/thumb/timeglass.png`} />,
    name: "Timeglass",
  },
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

export const ResourceIcon = ({
  withTooltip = true,
  tooltipText,
  ...props
}: Props) => {
  const Icon = (
    <div
      className={`paper group relative flex justify-center rounded-xl ${props.className}`}
    >
      <div
        className={`relative ${clsx(STYLES.size[props.size], props.className)} `}
      >
        {
          Components[props.resource.replace(" ", "").replace("'", "")]
            .component
        }
      </div>

      {props.label && (
        <span className="ml-4 self-center text-center">
          {Components[props.resource.replace(" ", "").replace("'", "")].name}
        </span>
      )}
      {withTooltip && (
        <div className="absolute -top-2 left-1/2 hidden w-max -translate-x-1/2 -translate-y-full flex-col items-center rounded-lg bg-black group-hover:flex">
          <span className="whitespace-no-wrap bg-gray-1000 relative z-10 rounded p-2 text-xs leading-none shadow-lg">
            {tooltipText ||
              Components[props.resource.replace(" ", "").replace("'", "")]
                .name}
          </span>
          <div className="absolute bottom-0 left-1/2 z-100 h-3 w-3 -translate-x-1/2 translate-y-1/2 rotate-45 bg-black"></div>
        </div>
      )}
    </div>
  );
  return Icon;
};
