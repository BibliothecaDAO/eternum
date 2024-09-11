import { Resource, Resources } from "../types";
import { EternumGlobalConfig } from "./global";
import { BuildingType, StructureType } from "./structures";

export const findResourceById = (value: number) => {
  return resources.find((e) => e.id === value);
};

export const findResourceIdByTrait = (trait: string) => {
  // @ts-ignore
  return resources.find((e) => e?.trait === trait).id;
};

export const resources: Array<Resources> = [
  {
    trait: "Wood",
    value: 5015,
    colour: "#78350f",
    id: 1,
    description: "Wood is the backbone of civilization. Fire, industry, and shelter spawned from its sinew and sap.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/wood.gif?raw=true",
    ticker: "$WOOD",
  },

  {
    trait: "Stone",
    value: 3941,
    colour: "#e0e0e0",
    id: 2,
    description: "Stone masonry is a culture bending the bones of the earth itself to their own purpose.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/stone.gif?raw=true",
    ticker: "$STONE",
  },
  {
    trait: "Coal",
    value: 3833,
    colour: "#757575",
    id: 3,
    description:
      "Coal is the only answer when fire is not enough to stave off the gnawing, winter cold or the ravenous demands of iron forges.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/coal.gif?raw=true",
    ticker: "$COAL",
  },
  {
    trait: "Copper",
    value: 2643,
    colour: "#f59e0b",
    id: 4,
    description:
      "The malleability of copper is a strength. A copper axe will crush a skull as easily as a copper pot sizzles an egg.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/copper.gif?raw=true",
    ticker: "$COPPER",
  },
  {
    trait: "Obsidian",
    value: 2216,
    colour: "#000000",
    id: 5,
    description:
      "Hard and brittle, obsidian can be honed to a razors edge nanometers wide, parting armor on an atomic level. The preferred material of assassins and cheap jewelers.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/obsidian.gif?raw=true",
    ticker: "$OBS",
  },
  {
    trait: "Silver",
    value: 1741,
    colour: "#eeeeee",
    id: 6,
    description: "The luster and rarity of silver draws out the basest instinct of laymen and nobility alike. Greed.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/silver.gif?raw=true",
    ticker: "$SILVER",
  },

  {
    trait: "Ironwood",
    value: 1179,
    colour: "#b91c1c",
    id: 7,
    description:
      "Metallic minerals drawn from the ironwood’s deep delving roots are the source of its legendary hardness and appearance.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/ironwood.gif?raw=true",
    ticker: "$IRNWD",
  },
  {
    trait: "Cold Iron",
    value: 957,
    colour: "#fca5a5",
    id: 8,
    description:
      "Something has infected this metallic ore with a cruel chill and an extraordinary thirst for the warmth of living things.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/cold%20iron.gif?raw=true",
    ticker: "$CLDIRN",
  },
  {
    trait: "Gold",
    value: 914,
    colour: "#fcd34d",
    id: 9,
    description: "Ripped from its million-year geological womb within the earth to be hoarded in mortal coffers.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/gold.gif?raw=true",
    ticker: "$GOLD",
  },
  {
    trait: "Hartwood",
    value: 594,
    colour: "#fca5a5",
    id: 10,
    description:
      "Revered by the Orders of Cunning, hartwood is only cut in dire circumstance. It bleeds like any mortal and some claim to hear voices from its sap long after being tapped from the trunk.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/hartwood.gif?raw=true",
    ticker: "$HRTWD",
  },
  {
    trait: "Diamonds",
    value: 300,
    colour: "#ccbcfb",
    id: 11,
    description:
      "Diamonds carry the hardness of obsidian, the strength of cold iron, and the preciousness of gold. Blood is easily spilled in its name.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/diamond.gif?raw=true",
    ticker: "$DMND",
  },
  {
    trait: "Sapphire",
    value: 247,
    colour: "#3b82f6",
    id: 12,
    description:
      "Sapphires are given birth from titanic forces that crush and grind for thousands of years in a hellscape of heat and pressure. The result is a gemstone accustomed to both pain and beauty.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/sapphire.gif?raw=true",
    ticker: "$SPHR",
  },
  {
    trait: "Ruby",
    value: 239,
    colour: "#dc2626",
    id: 13,
    description:
      "Rubies are the chimeric fusion of metal alloys and oxygen. This hybrid of metal and minerals is often scarcer than the lives of those who seek it.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/ruby.gif?raw=true",
    ticker: "$RUBY",
  },
  {
    trait: "Deep Crystal",
    value: 239,
    colour: "#93c5fd",
    id: 14,
    description:
      "Deep crystal was imprisoned from the mortal world by a timeless geode, the source of these formations have confounded scholars for centuries. Strange vibrations can be felt when held.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/deep%20crystal.gif?raw=true",
    ticker: "$CRYSTL",
  },
  {
    trait: "Ignium",
    value: 172,
    colour: "#ef4444",
    id: 15,
    description:
      "Some horrible power has irrevocably scarred this ignium stone with an infernal radiation that evaporates water and skin alike.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/ignium.gif?raw=true",
    ticker: "$IGNIUM",
  },
  {
    trait: "Ethereal Silica",
    value: 162,
    colour: "#10b981",
    id: 16,
    description:
      "Ethereal silica is a glass that funnels and bends light in ways that deviate from known physics. Those exposed for long periods of time experience an all- consuming lethargic bliss.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/ethereal%20silica.gif?raw=true",
    ticker: "$SILICA",
  },
  {
    trait: "True Ice",
    value: 139,
    colour: "#ffffff",
    id: 17,
    description:
      "True ice does not melt, it is carved like living stone from frozen abyssal caverns far beneath the earth. Many a careless mason has lost their life when placing this near Ignium.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/true%20ice.gif?raw=true",
    ticker: "$TRUICE",
  },
  {
    trait: "Twilight Quartz",
    value: 111,
    colour: "#6d28d9",
    id: 18,
    description:
      "Fortunately, this gemstone grows deep within the earth, far away from the soft flesh of mortal kind. Its elegance hides a tendency to rapidly engulf organic matter it encounters in a matter of hours.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/twilight%20quartz.gif?raw=true",
    ticker: "$QUARTZ",
  },
  {
    trait: "Alchemical Silver",
    value: 93,
    colour: "#bdbdbd",
    id: 19,
    description:
      "Alchemical Silver is found pooled beneath battlegrounds from a forgotten, lost era. It can retain an almost unlimited amount of potential energy, making it the perfect catalyst for those delving into the mysteries of the universe.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/alchemical%20silver.gif?raw=true",
    ticker: "$ALCHMY",
  },
  {
    trait: "Adamantine",
    value: 55,
    colour: "#1e3a8a",
    id: 20,
    description:
      "Adamantine forms around ontological anomalies like the immune response of a planetary entity. It contains the supernatural strength to contain such terrors from spreading. Woe to those who shortsightedly take it from its original purpose.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/adamantine.gif?raw=true",
    ticker: "$ADMT",
  },
  {
    trait: "Mithral",
    value: 37,
    colour: "#60a5fa",
    id: 21,
    description:
      "This otherworldly metal has the strength of adamantine but is lighter than air. The pieces are held in place by strange gravitational core. Those who spend much time with it slowly succumb to neurotic delusions of a rapturous, divine apocalypse.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/mithral.gif?raw=true",
    ticker: "$MITHRL",
  },
  {
    trait: "Dragonhide",
    value: 23,
    colour: "#ec4899",
    id: 22,
    description:
      "Dragons are the hidden guardians of our reality. No mortal can witness their work, lest they be purged by dragonfire. If you find one of these scales, flee. Only death can be found in their presence or by the forces they fight in secret.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/dragonhide.gif?raw=true",
    ticker: "$DRGNHD",
  },
  {
    trait: "Donkeys",
    value: 249,
    colour: "#ec4899",
    id: 249,
    description: "Donkeys.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/wheat.gif?raw=true",
    ticker: "$DONKEY",
  },
  {
    trait: "Knight",
    value: 250,
    colour: "#ec4899",
    id: 250,
    description: "Wheat.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/wheat.gif?raw=true",
    ticker: "$KNIGHT",
  },
  {
    trait: "Crossbowman",
    value: 251,
    colour: "#ec4899",
    id: 251,
    description: "Wheat.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/wheat.gif?raw=true",
    ticker: "$CRSSBW",
  },
  {
    trait: "Paladin",
    value: 252,
    colour: "#ec4899",
    id: 252,
    description: "Wheat.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/wheat.gif?raw=true",
    ticker: "$PLDN",
  },
  {
    trait: "Lords",
    value: 253,
    colour: "#ec4899",
    id: 253,
    description: "Lords.",
    img: "",
    ticker: "$LORDS",
  },
  {
    trait: "Wheat",
    value: 254,
    colour: "#ec4899",
    id: 254,
    description: "Wheat.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/wheat.gif?raw=true",
    ticker: "$WHEAT",
  },
  {
    trait: "Fish",
    value: 255,
    colour: "#ec4899",
    id: 255,
    description: "Fish.",
    img: "https://github.com/BibliothecaForAdventurers/voxel-resources/blob/main/compressed/.gif?raw=true",
    ticker: "$FISH",
  },
  {
    trait: "Ancient Fragment",
    value: 29,
    colour: "#ec4899",
    id: 29,
    description: "Earthenshard is a rare and powerful resource that can be used to create powerful items.",
    img: "",
    ticker: "$SHARDS",
  },
];

/* eslint-disable @typescript-eslint/naming-convention */

export enum ResourcesIds {
  Wood = 1,
  Stone = 2,
  Coal = 3,
  Copper = 4,
  Obsidian = 5,
  Silver = 6,
  Ironwood = 7,
  ColdIron = 8,
  Gold = 9,
  Hartwood = 10,
  Diamonds = 11,
  Sapphire = 12,
  Ruby = 13,
  DeepCrystal = 14,
  Ignium = 15,
  EtherealSilica = 16,
  TrueIce = 17,
  TwilightQuartz = 18,
  AlchemicalSilver = 19,
  Adamantine = 20,
  Mithral = 21,
  Dragonhide = 22,
  Earthenshard = 29,
  Donkey = 249,
  Knight = 250,
  Crossbowman = 251,
  Paladin = 252,
  Lords = 253,
  Wheat = 254,
  Fish = 255,
}

// weight that determines the amount of resources need to finish the hyperstructure
export const HyperstructureResourceMultipliers: { [key in ResourcesIds]?: number } = {
  [ResourcesIds.Wood]: 1.0,
  [ResourcesIds.Stone]: 1.27,
  [ResourcesIds.Coal]: 1.31,
  [ResourcesIds.Copper]: 1.9,
  [ResourcesIds.Obsidian]: 2.26,
  [ResourcesIds.Silver]: 2.88,
  [ResourcesIds.Ironwood]: 4.25,
  [ResourcesIds.ColdIron]: 5.24,
  [ResourcesIds.Gold]: 5.49,
  [ResourcesIds.Hartwood]: 8.44,
  [ResourcesIds.Diamonds]: 16.72,
  [ResourcesIds.Sapphire]: 20.3,
  [ResourcesIds.Ruby]: 20.98,
  [ResourcesIds.DeepCrystal]: 20.98,
  [ResourcesIds.Ignium]: 29.15,
  [ResourcesIds.EtherealSilica]: 30.95,
  [ResourcesIds.TrueIce]: 36.06,
  [ResourcesIds.TwilightQuartz]: 45.18,
  [ResourcesIds.AlchemicalSilver]: 53.92,
  [ResourcesIds.Adamantine]: 91.2,
  [ResourcesIds.Mithral]: 135.53,
  [ResourcesIds.Dragonhide]: 217.92,
  [ResourcesIds.Earthenshard]: 20.98,
};

export const Guilds = ["Harvesters", "Miners", "Collectors", "Hunters"];

export const resourcesByGuild = {
  [Guilds[0]]: [
    ResourcesIds.Wood,
    ResourcesIds.Stone,
    ResourcesIds.Coal,
    ResourcesIds.Ironwood,
    ResourcesIds.Hartwood,
    ResourcesIds.TrueIce,
  ],
  [Guilds[1]]: [
    ResourcesIds.Copper,
    ResourcesIds.Silver,
    ResourcesIds.Gold,
    ResourcesIds.ColdIron,
    ResourcesIds.AlchemicalSilver,
    ResourcesIds.Adamantine,
  ],
  [Guilds[2]]: [
    ResourcesIds.Diamonds,
    ResourcesIds.Sapphire,
    ResourcesIds.Ruby,
    ResourcesIds.DeepCrystal,
    ResourcesIds.TwilightQuartz,
  ],
  [Guilds[3]]: [
    ResourcesIds.Obsidian,
    ResourcesIds.Ignium,
    ResourcesIds.EtherealSilica,
    ResourcesIds.Mithral,
    ResourcesIds.Dragonhide,
  ],
};

// if it's labor, then remove 28 to get the icon resource id
export const getIconResourceId = (resourceId: number, isLabor: boolean) => {
  return isLabor ? resourceId - 28 : resourceId;
};

// weight in kg
export const WEIGHTS_GRAM: {
  [key: number]: number;
} = {
  [ResourcesIds.Wood]: 1000,
  [ResourcesIds.Stone]: 1000,
  [ResourcesIds.Coal]: 1000,
  [ResourcesIds.Copper]: 1000,
  [ResourcesIds.Obsidian]: 1000,
  [ResourcesIds.Silver]: 1000,
  [ResourcesIds.Ironwood]: 1000,
  [ResourcesIds.ColdIron]: 1000,
  [ResourcesIds.Gold]: 1000,
  [ResourcesIds.Hartwood]: 1000,
  [ResourcesIds.Diamonds]: 1000,
  [ResourcesIds.Sapphire]: 1000,
  [ResourcesIds.Ruby]: 1000,
  [ResourcesIds.DeepCrystal]: 1000,
  [ResourcesIds.Ignium]: 1000,
  [ResourcesIds.EtherealSilica]: 1000,
  [ResourcesIds.TrueIce]: 1000,
  [ResourcesIds.TwilightQuartz]: 1000,
  [ResourcesIds.AlchemicalSilver]: 1000,
  [ResourcesIds.Adamantine]: 1000,
  [ResourcesIds.Mithral]: 1000,
  [ResourcesIds.Dragonhide]: 1000,
  [ResourcesIds.Earthenshard]: 1000,
  [ResourcesIds.Donkey]: 0,
  [ResourcesIds.Knight]: 0,
  [ResourcesIds.Crossbowman]: 0,
  [ResourcesIds.Paladin]: 0,
  [ResourcesIds.Lords]: 1,
  [ResourcesIds.Wheat]: 100,
  [ResourcesIds.Fish]: 100,
};

export const RESOURCE_TIERS = {
  lords: [ResourcesIds.Lords, ResourcesIds.Earthenshard],
  military: [ResourcesIds.Knight, ResourcesIds.Crossbowman, ResourcesIds.Paladin],
  transport: [ResourcesIds.Donkey],
  food: [ResourcesIds.Fish, ResourcesIds.Wheat],
  common: [ResourcesIds.Wood, ResourcesIds.Stone, ResourcesIds.Coal, ResourcesIds.Copper, ResourcesIds.Obsidian],
  uncommon: [ResourcesIds.Silver, ResourcesIds.Ironwood, ResourcesIds.ColdIron, ResourcesIds.Gold],
  rare: [ResourcesIds.Hartwood, ResourcesIds.Diamonds, ResourcesIds.Sapphire, ResourcesIds.Ruby],
  unique: [
    ResourcesIds.DeepCrystal,
    ResourcesIds.Ignium,
    ResourcesIds.EtherealSilica,
    ResourcesIds.TrueIce,
    ResourcesIds.TwilightQuartz,
    ResourcesIds.AlchemicalSilver,
  ],
  mythic: [ResourcesIds.Adamantine, ResourcesIds.Mithral, ResourcesIds.Dragonhide],
};

export interface ResourceInputs {
  [key: number]: { resource: ResourcesIds; amount: number }[];
}

export interface ResourceOutputs {
  [key: number]: number;
}

export const RESOURCE_OUTPUTS: ResourceOutputs = {
  [ResourcesIds.Wood]: 100,
  [ResourcesIds.Stone]: 100,
  [ResourcesIds.Coal]: 100,
  [ResourcesIds.Copper]: 100,
  [ResourcesIds.Obsidian]: 100,
  [ResourcesIds.Silver]: 100,
  [ResourcesIds.Ironwood]: 100,
  [ResourcesIds.ColdIron]: 100,
  [ResourcesIds.Gold]: 100,
  [ResourcesIds.Hartwood]: 100,
  [ResourcesIds.Diamonds]: 100,
  [ResourcesIds.Sapphire]: 100,
  [ResourcesIds.Ruby]: 100,
  [ResourcesIds.DeepCrystal]: 100,
  [ResourcesIds.Ignium]: 100,
  [ResourcesIds.EtherealSilica]: 100,
  [ResourcesIds.TrueIce]: 100,
  [ResourcesIds.TwilightQuartz]: 100,
  [ResourcesIds.AlchemicalSilver]: 100,
  [ResourcesIds.Adamantine]: 100,
  [ResourcesIds.Mithral]: 100,
  [ResourcesIds.Dragonhide]: 100,
  [ResourcesIds.Donkey]: 30,
  [ResourcesIds.Knight]: 10,
  [ResourcesIds.Crossbowman]: 10,
  [ResourcesIds.Paladin]: 10,
  [ResourcesIds.Lords]: 10,
  [ResourcesIds.Wheat]: 300,
  [ResourcesIds.Fish]: 300,
  [ResourcesIds.Earthenshard]: 100,
};

export const RESOURCE_INPUTS: ResourceInputs = {
  [ResourcesIds.Wood]: [
    { resource: ResourcesIds.Stone, amount: 0.0015 },
    { resource: ResourcesIds.Coal, amount: 0.0016 },
    { resource: ResourcesIds.Wheat, amount: 0.0025 },
  ],
  [ResourcesIds.Stone]: [
    { resource: ResourcesIds.Wood, amount: 0.0025 },
    { resource: ResourcesIds.Coal, amount: 0.0019 },
    { resource: ResourcesIds.Wheat, amount: 0.0025 },
  ],
  [ResourcesIds.Coal]: [
    { resource: ResourcesIds.Stone, amount: 0.0021 },
    { resource: ResourcesIds.Copper, amount: 0.0014 },
    { resource: ResourcesIds.Wheat, amount: 0.0025 },
  ],
  [ResourcesIds.Copper]: [
    { resource: ResourcesIds.Coal, amount: 0.0029 },
    { resource: ResourcesIds.Obsidian, amount: 0.0017 },
    { resource: ResourcesIds.Wheat, amount: 0.0025 },
  ],
  [ResourcesIds.Obsidian]: [
    { resource: ResourcesIds.Copper, amount: 0.0024 },
    { resource: ResourcesIds.Silver, amount: 0.0016 },
    { resource: ResourcesIds.Wheat, amount: 0.0025 },
  ],
  [ResourcesIds.Silver]: [
    { resource: ResourcesIds.Obsidian, amount: 0.0025 },
    { resource: ResourcesIds.Ironwood, amount: 0.0014 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.Ironwood]: [
    { resource: ResourcesIds.Silver, amount: 0.003 },
    { resource: ResourcesIds.ColdIron, amount: 0.0016 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.ColdIron]: [
    { resource: ResourcesIds.Ironwood, amount: 0.0025 },
    { resource: ResourcesIds.Gold, amount: 0.0019 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.Gold]: [
    { resource: ResourcesIds.ColdIron, amount: 0.0021 },
    { resource: ResourcesIds.Hartwood, amount: 0.0013 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.Hartwood]: [
    { resource: ResourcesIds.Gold, amount: 0.0031 },
    { resource: ResourcesIds.Diamonds, amount: 0.001 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.Diamonds]: [
    { resource: ResourcesIds.Hartwood, amount: 0.004 },
    { resource: ResourcesIds.Sapphire, amount: 0.0016 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.Sapphire]: [
    { resource: ResourcesIds.Diamonds, amount: 0.0024 },
    { resource: ResourcesIds.Ruby, amount: 0.0019 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.Ruby]: [
    { resource: ResourcesIds.Sapphire, amount: 0.0021 },
    { resource: ResourcesIds.DeepCrystal, amount: 0.002 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.DeepCrystal]: [
    { resource: ResourcesIds.Ruby, amount: 0.002 },
    { resource: ResourcesIds.Ignium, amount: 0.0014 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.Ignium]: [
    { resource: ResourcesIds.DeepCrystal, amount: 0.0028 },
    { resource: ResourcesIds.EtherealSilica, amount: 0.0019 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.EtherealSilica]: [
    { resource: ResourcesIds.Ignium, amount: 0.0021 },
    { resource: ResourcesIds.TrueIce, amount: 0.0017 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.TrueIce]: [
    { resource: ResourcesIds.EtherealSilica, amount: 0.0023 },
    { resource: ResourcesIds.TwilightQuartz, amount: 0.0016 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.TwilightQuartz]: [
    { resource: ResourcesIds.TrueIce, amount: 0.0025 },
    { resource: ResourcesIds.AlchemicalSilver, amount: 0.0017 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.AlchemicalSilver]: [
    { resource: ResourcesIds.TwilightQuartz, amount: 0.0024 },
    { resource: ResourcesIds.Adamantine, amount: 0.0012 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.Adamantine]: [
    { resource: ResourcesIds.AlchemicalSilver, amount: 0.0034 },
    { resource: ResourcesIds.Mithral, amount: 0.0013 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.Mithral]: [
    { resource: ResourcesIds.Adamantine, amount: 0.003 },
    { resource: ResourcesIds.Dragonhide, amount: 0.0012 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.Dragonhide]: [
    { resource: ResourcesIds.Mithral, amount: 0.0032 },
    { resource: ResourcesIds.Adamantine, amount: 0.002 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
  ],
  [ResourcesIds.Donkey]: [
    { resource: ResourcesIds.Wheat, amount: 0.001 },
    { resource: ResourcesIds.Fish, amount: 0.002 },
    { resource: ResourcesIds.Diamonds, amount: 0.001 },
  ],
  [ResourcesIds.Knight]: [
    { resource: ResourcesIds.Wheat, amount: 0.0025 },
    { resource: ResourcesIds.Silver, amount: 0.001 },
    { resource: ResourcesIds.Ironwood, amount: 0.0025 },
  ],
  [ResourcesIds.Crossbowman]: [
    { resource: ResourcesIds.Wheat, amount: 0.0025 },
    { resource: ResourcesIds.Obsidian, amount: 0.001 },
    { resource: ResourcesIds.ColdIron, amount: 0.0025 },
  ],
  [ResourcesIds.Paladin]: [
    { resource: ResourcesIds.Wheat, amount: 0.0025 },
    { resource: ResourcesIds.Copper, amount: 0.001 },
    { resource: ResourcesIds.Gold, amount: 0.0025 },
  ],
  [ResourcesIds.Wheat]: [],
  [ResourcesIds.Fish]: [],
  [ResourcesIds.Lords]: [],
  [ResourcesIds.Earthenshard]: [],
};

export const BUILDING_COSTS: ResourceInputs = {
  [BuildingType.Castle]: [],
  [BuildingType.Bank]: [],
  [BuildingType.FragmentMine]: [],
  [BuildingType.Resource]: [
    { resource: ResourcesIds.Wheat, amount: 500 },
    { resource: ResourcesIds.Fish, amount: 500 },
  ],
  [BuildingType.Farm]: [{ resource: ResourcesIds.Fish, amount: 900 }],
  [BuildingType.FishingVillage]: [{ resource: ResourcesIds.Wheat, amount: 900 }],
  [BuildingType.Barracks]: [
    { resource: ResourcesIds.Wheat, amount: 2000 },
    { resource: ResourcesIds.Wood, amount: 150 },
    { resource: ResourcesIds.Coal, amount: 50 },
  ],
  [BuildingType.Market]: [
    { resource: ResourcesIds.Wheat, amount: 1500 },
    { resource: ResourcesIds.Stone, amount: 100 },
    { resource: ResourcesIds.Gold, amount: 20 },
    { resource: ResourcesIds.Ruby, amount: 20 },
  ],
  [BuildingType.ArcheryRange]: [
    { resource: ResourcesIds.Wheat, amount: 2000 },
    { resource: ResourcesIds.Wood, amount: 100 },
    { resource: ResourcesIds.Obsidian, amount: 40 },
  ],
  [BuildingType.Stable]: [
    { resource: ResourcesIds.Wheat, amount: 2000 },
    { resource: ResourcesIds.Wood, amount: 100 },
    { resource: ResourcesIds.ColdIron, amount: 40 },
  ],
  [BuildingType.TradingPost]: [],
  [BuildingType.WorkersHut]: [
    { resource: ResourcesIds.Wheat, amount: 500 },
    { resource: ResourcesIds.Stone, amount: 10 },
    { resource: ResourcesIds.Wood, amount: 10 },
    { resource: ResourcesIds.Coal, amount: 20 },
  ],
  [BuildingType.WatchTower]: [],
  [BuildingType.Walls]: [],
  [BuildingType.Storehouse]: [
    { resource: ResourcesIds.Wheat, amount: 2000 },
    { resource: ResourcesIds.Wood, amount: 100 },
    { resource: ResourcesIds.Ironwood, amount: 10 },
    { resource: ResourcesIds.Silver, amount: 10 },
  ],
};

export const RESOURCE_BUILDING_COSTS: ResourceInputs = {
  [ResourcesIds.Wood]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.Stone]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.Coal]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.Copper]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.Obsidian]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.Silver]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.Ironwood]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.ColdIron]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.Gold]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.Hartwood]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.Diamonds]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.Sapphire]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.Ruby]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.DeepCrystal]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.Ignium]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.EtherealSilica]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.TrueIce]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.TwilightQuartz]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.AlchemicalSilver]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.Adamantine]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.Mithral]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.Dragonhide]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.Donkey]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.Knight]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.Crossbowman]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.Paladin]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.Wheat]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.Fish]: [{ resource: ResourcesIds.Fish, amount: 500 }],
  [ResourcesIds.Lords]: [{ resource: ResourcesIds.Wheat, amount: 500 }],
  [ResourcesIds.Earthenshard]: [{ resource: ResourcesIds.Fish, amount: 500 }],
};

export const HYPERSTRUCTURE_CREATION_COSTS: { resource: number; amount: number }[] = [
  {
    resource: ResourcesIds.Earthenshard,
    amount: 500,
  },
];

export const HYPERSTRUCTURE_CONSTRUCTION_COSTS: { resource: number; amount: number }[] = [
  { resource: ResourcesIds.Wood, amount: 500 },
  { resource: ResourcesIds.Stone, amount: 500 },
  { resource: ResourcesIds.Coal, amount: 500 },
  { resource: ResourcesIds.Copper, amount: 300 },
  { resource: ResourcesIds.Obsidian, amount: 300 },
  { resource: ResourcesIds.Silver, amount: 300 },
  { resource: ResourcesIds.Ironwood, amount: 300 },
  { resource: ResourcesIds.ColdIron, amount: 150 },
  { resource: ResourcesIds.Gold, amount: 150 },
  { resource: ResourcesIds.Hartwood, amount: 150 },
  { resource: ResourcesIds.Diamonds, amount: 150 },
  { resource: ResourcesIds.Sapphire, amount: 150 },
  { resource: ResourcesIds.Ruby, amount: 150 },
  { resource: ResourcesIds.DeepCrystal, amount: 150 },
  { resource: ResourcesIds.Ignium, amount: 150 },
  { resource: ResourcesIds.EtherealSilica, amount: 150 },
  { resource: ResourcesIds.TrueIce, amount: 150 },
  { resource: ResourcesIds.TwilightQuartz, amount: 150 },
  { resource: ResourcesIds.AlchemicalSilver, amount: 150 },
  { resource: ResourcesIds.Adamantine, amount: 100 },
  { resource: ResourcesIds.Mithral, amount: 100 },
  { resource: ResourcesIds.Dragonhide, amount: 50 },
];

export const HYPERSTRUCTURE_TOTAL_COSTS: { resource: number; amount: number }[] = [
  ...HYPERSTRUCTURE_CONSTRUCTION_COSTS,
  ...HYPERSTRUCTURE_CREATION_COSTS,
];

export const STRUCTURE_COSTS: ResourceInputs = {
  [StructureType.Hyperstructure]: HYPERSTRUCTURE_CREATION_COSTS,
  [StructureType.Bank]: [{ resource: ResourcesIds.Gold, amount: 100_000 }],
  [StructureType.Settlement]: [
    { resource: ResourcesIds.Wheat, amount: 100_000 },
    { resource: ResourcesIds.Fish, amount: 100_000 },
  ],
};

export const RESOURCE_INFORMATION: {
  [key: number]: string;
} = {
  [ResourcesIds.Wood]:
    "Wood is the backbone of civilization. Fire, industry, and shelter spawned from its sinew and sap.",
  [ResourcesIds.Stone]: "Stone masonry is a culture bending the bones of the earth itself to their own purpose.",
  [ResourcesIds.Coal]:
    "Coal is the only answer when fire is not enough to stave off the gnawing, winter cold or the ravenous demands of iron forges.",
  [ResourcesIds.Copper]:
    "The malleability of copper is a strength. A copper axe will crush a skull as easily as a copper pot sizzles an egg.",
  [ResourcesIds.Obsidian]:
    "Hard and brittle, obsidian can be honed to a razors edge nanometers wide, parting armor on an atomic level. The preferred material of assassins and cheap jewelers.",
  [ResourcesIds.Silver]:
    "The luster and rarity of silver draws out the basest instinct of laymen and nobility alike. Greed.",
  [ResourcesIds.Ironwood]:
    "Metallic minerals drawn from the ironwood’s deep delving roots are the source of its legendary hardness and appearance.",
  [ResourcesIds.ColdIron]:
    "Something has infected this metallic ore with a cruel chill and an extraordinary thirst for the warmth of living things.",
  [ResourcesIds.Gold]: "Ripped from its million-year geological womb within the earth to be hoarded in mortal coffers.",
  [ResourcesIds.Hartwood]:
    "Revered by the Orders of Cunning, hartwood is only cut in dire circumstance. It bleeds like any mortal and some claim to hear voices from its sap long after being tapped from the trunk.",
  [ResourcesIds.Diamonds]:
    "Diamonds carry the hardness of obsidian, the strength of cold iron, and the preciousness of gold. Blood is easily spilled in its name.",
  [ResourcesIds.Sapphire]:
    "Sapphires are given birth from titanic forces that crush and grind for thousands of years in a hellscape of heat and pressure. The result is a gemstone accustomed to both pain and beauty.",
  [ResourcesIds.Ruby]:
    "Rubies are the chimeric fusion of metal alloys and oxygen. This hybrid of metal and minerals is often scarcer than the lives of those who seek it.",
  [ResourcesIds.DeepCrystal]:
    "Deep crystal was imprisoned from the mortal world by a timeless geode, the source of these formations have confounded scholars for centuries. Strange vibrations can be felt when held.",
  [ResourcesIds.Ignium]:
    "Some horrible power has irrevocably scarred this ignium stone with an infernal radiation that evaporates water and skin alike.",
  [ResourcesIds.EtherealSilica]:
    "Ethereal silica is a glass that funnels and bends light in ways that deviate from known physics. Those exposed for long periods of time experience an all- consuming lethargic bliss.",
  [ResourcesIds.TrueIce]:
    "True ice does not melt, it is carved like living stone from frozen abyssal caverns far beneath the earth. Many a careless mason has lost their life when placing this near Ignium.",
  [ResourcesIds.TwilightQuartz]:
    "Fortunately, this gemstone grows deep within the earth, far away from the soft flesh of mortal kind. Its elegance hides a tendency to rapidly engulf organic matter it encounters in a matter of hours.",
  [ResourcesIds.AlchemicalSilver]:
    "Alchemical Silver is found pooled beneath battlegrounds from a forgotten, lost era. It can retain an almost unlimited amount of potential energy, making it the perfect catalyst for those delving into the mysteries of the universe.",
  [ResourcesIds.Adamantine]:
    "Adamantine forms around ontological anomalies like the immune response of a planetary entity. It contains the supernatural strength to contain such terrors from spreading. Woe to those who shortsightedly take it from its original purpose.",
  [ResourcesIds.Mithral]:
    "This otherworldly metal has the strength of adamantine but is lighter than air. The pieces are held in place by strange gravitational core. Those who spend much time with it slowly succumb to neurotic delusions of a rapturous, divine apocalypse.",
  [ResourcesIds.Dragonhide]:
    "Dragons are the hidden guardians of our reality. No mortal can witness their work, lest they be purged by dragonfire. If you find one of these scales, flee. Only death can be found in their presence or by the forces they fight in secret.",
  [ResourcesIds.Earthenshard]:
    "Earthenshard is a rare and powerful resource that can be used to create powerful items.",
};

export const EXPLORATION_COSTS: Resource[] = [
  {
    resourceId: ResourcesIds.Wheat,
    amount: EternumGlobalConfig.exploration.wheatBurn,
  },
  { resourceId: ResourcesIds.Fish, amount: EternumGlobalConfig.exploration.fishBurn },
];

export enum QuestType {
  Food = 1,
  CommonResources,
  UncommonResources,
  UniqueResources,
  RareResources,
  LegendaryResources,
  MythicResources,
  Trade,
  Military,
  Earthenshard,
  Travel,
  Population,
  Market,
  Mine,
  Pillage,
  Hyperstructure,
  Contribution,
  PauseProduction,
  CreateDefenseArmy,
}

export const QUEST_RESOURCES = {
  [QuestType.Food]: [
    { resource: ResourcesIds.Wheat, amount: 1500 },
    { resource: ResourcesIds.Fish, amount: 1500 },
  ],
  [QuestType.CommonResources]: [
    { resource: ResourcesIds.Wood, amount: 5 },
    { resource: ResourcesIds.Stone, amount: 5 },
    { resource: ResourcesIds.Coal, amount: 5 },
    { resource: ResourcesIds.Copper, amount: 5 },
  ],
  [QuestType.UncommonResources]: [
    { resource: ResourcesIds.Obsidian, amount: 5 },
    { resource: ResourcesIds.Silver, amount: 5 },
    { resource: ResourcesIds.Ironwood, amount: 5 },
  ],
  [QuestType.UniqueResources]: [
    { resource: ResourcesIds.ColdIron, amount: 5 },
    { resource: ResourcesIds.Gold, amount: 5 },
    { resource: ResourcesIds.Hartwood, amount: 5 },
    { resource: ResourcesIds.Diamonds, amount: 5 },
  ],
  [QuestType.RareResources]: [
    { resource: ResourcesIds.Sapphire, amount: 5 },
    { resource: ResourcesIds.Ruby, amount: 5 },
    { resource: ResourcesIds.DeepCrystal, amount: 5 },
  ],
  [QuestType.LegendaryResources]: [
    { resource: ResourcesIds.Ignium, amount: 5 },
    { resource: ResourcesIds.EtherealSilica, amount: 5 },
    { resource: ResourcesIds.TrueIce, amount: 5 },
    { resource: ResourcesIds.TwilightQuartz, amount: 5 },
  ],
  [QuestType.MythicResources]: [
    { resource: ResourcesIds.AlchemicalSilver, amount: 5 },
    { resource: ResourcesIds.Adamantine, amount: 5 },
    { resource: ResourcesIds.Mithral, amount: 5 },
    { resource: ResourcesIds.Dragonhide, amount: 5 },
  ],
  [QuestType.Trade]: [
    { resource: ResourcesIds.Donkey, amount: 3 },
    { resource: ResourcesIds.Lords, amount: 100 },
  ],
  [QuestType.Military]: [
    { resource: ResourcesIds.Knight, amount: 3 },
    { resource: ResourcesIds.Crossbowman, amount: 3 },
    { resource: ResourcesIds.Paladin, amount: 3 },
  ],
  [QuestType.Earthenshard]: [{ resource: ResourcesIds.Earthenshard, amount: 5 }],
  [QuestType.Travel]: [{ resource: ResourcesIds.Earthenshard, amount: 5 }],
  [QuestType.Population]: [{ resource: ResourcesIds.Earthenshard, amount: 5 }],
  [QuestType.Market]: [{ resource: ResourcesIds.Earthenshard, amount: 5 }],
  [QuestType.Mine]: [{ resource: ResourcesIds.Earthenshard, amount: 5 }],
  [QuestType.Pillage]: [{ resource: ResourcesIds.Earthenshard, amount: 5 }],
  [QuestType.Hyperstructure]: [{ resource: ResourcesIds.Earthenshard, amount: 5 }],
  [QuestType.Contribution]: [{ resource: ResourcesIds.Earthenshard, amount: 5 }],
  [QuestType.PauseProduction]: [{ resource: ResourcesIds.Earthenshard, amount: 2.5 }],
  [QuestType.CreateDefenseArmy]: [{ resource: ResourcesIds.Earthenshard, amount: 2.5 }],
};
