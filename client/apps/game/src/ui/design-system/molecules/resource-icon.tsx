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
  tooltipText?: string;
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
  Strk: { component: <img src={`/images/logos/strk.png`} className="object-contain scale-75" />, name: "Strk" },
  Wheat: { component: <img src={`/images/resources/${ResourcesIds.Wheat}.png`} />, name: "Wheat" },
  Fish: { component: <img src={`/images/resources/${ResourcesIds.Fish}.png`} />, name: "Fish" },

  Essence: { component: <img src={`/images/resources/${ResourcesIds.Essence}.png`} />, name: "Essence" },

  // Relics - Army Enhancement Items
  StaminaRelic1: {
    component: <img src={`/images/resources/${ResourcesIds.StaminaRelic1}.png`} />,
    name: "Stamina Relic 1",
  },
  StaminaRelic2: {
    component: <img src={`/images/resources/${ResourcesIds.StaminaRelic2}.png`} />,
    name: "Stamina Relic 2",
  },
  DamageRelic1: {
    component: <img src={`/images/resources/${ResourcesIds.DamageRelic1}.png`} />,
    name: "Damage Relic 1",
  },
  DamageRelic2: {
    component: <img src={`/images/resources/${ResourcesIds.DamageRelic2}.png`} />,
    name: "Damage Relic 2",
  },
  DamageReductionRelic1: {
    component: <img src={`/images/resources/${ResourcesIds.DamageReductionRelic1}.png`} />,
    name: "Damage Reduction Relic 1",
  },
  DamageReductionRelic2: {
    component: <img src={`/images/resources/${ResourcesIds.DamageReductionRelic2}.png`} />,
    name: "Damage Reduction Relic 2",
  },
  ExplorationRelic1: {
    component: <img src={`/images/resources/${ResourcesIds.ExplorationRelic1}.png`} />,
    name: "Exploration Relic 1",
  },
  ExplorationRelic2: {
    component: <img src={`/images/resources/${ResourcesIds.ExplorationRelic2}.png`} />,
    name: "Exploration Relic 2",
  },
  ExplorationRewardRelic1: {
    component: <img src={`/images/resources/${ResourcesIds.ExplorationRewardRelic1}.png`} />,
    name: "Exploration Reward Relic 1",
  },
  ExplorationRewardRelic2: {
    component: <img src={`/images/resources/${ResourcesIds.ExplorationRewardRelic2}.png`} />,
    name: "Exploration Reward Relic 2",
  },

  // Relics - Structure Enhancement Items
  StructureDefenseRelic1: {
    component: <img src={`/images/resources/${ResourcesIds.StructureDamageReductionRelic1}.png`} />,
    name: "Structure Defense Relic 1",
  },
  StructureDefenseRelic2: {
    component: <img src={`/images/resources/${ResourcesIds.StructureDamageReductionRelic2}.png`} />,
    name: "Structure Defense Relic 2",
  },
  ProductionRelic1: {
    component: <img src={`/images/resources/${ResourcesIds.ProductionRelic1}.png`} />,
    name: "Production Relic 1",
  },
  ProductionRelic2: {
    component: <img src={`/images/resources/${ResourcesIds.ProductionRelic2}.png`} />,
    name: "Production Relic 2",
  },
  LaborProductionRelic1: {
    component: <img src={`/images/resources/${ResourcesIds.LaborProductionRelic1}.png`} />,
    name: "Labor Production Relic 1",
  },
  LaborProductionRelic2: {
    component: <img src={`/images/resources/${ResourcesIds.LaborProductionRelic2}.png`} />,
    name: "Labor Production Relic 2",
  },
  TroopProductionRelic1: {
    component: <img src={`/images/resources/${ResourcesIds.TroopProductionRelic1}.png`} />,
    name: "Troop Production Relic 1",
  },
  TroopProductionRelic2: {
    component: <img src={`/images/resources/${ResourcesIds.TroopProductionRelic2}.png`} />,
    name: "Troop Production Relic 2",
  },

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
