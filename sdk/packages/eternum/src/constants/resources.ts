import { ResourceInputs, ResourceOutputs, Resources } from "../types";
import { ResourcesIds } from "./index";

export const resources: Array<Resources> = [
  {
    trait: "Stone",
    value: 3941,
    colour: "#e0e0e0",
    id: 1,
    description: "Stone masonry is a culture bending the bones of the earth itself to their own purpose.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/2.png?raw=true",
    ticker: "$STONE",
  },
  {
    trait: "Coal",
    value: 3833,
    colour: "#757575",
    id: 2,
    description:
      "Coal is the only answer when fire is not enough to stave off the gnawing, winter cold or the ravenous demands of iron forges.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/3.png?raw=true",
    ticker: "$COAL",
  },
  {
    trait: "Wood",
    value: 5015,
    colour: "#78350f",
    id: 3,
    description: "Wood is the backbone of civilization. Fire, industry, and shelter spawned from its sinew and sap.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/1.png?raw=true",
    ticker: "$WOOD",
  },
  {
    trait: "Copper",
    value: 2643,
    colour: "#f59e0b",
    id: 4,
    description:
      "The malleability of copper is a strength. A copper axe will crush a skull as easily as a copper pot sizzles an egg.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/4.png?raw=true",
    ticker: "$COPPER",
  },
  {
    trait: "Ironwood",
    value: 1179,
    colour: "#b91c1c",
    id: 5,
    description:
      "Metallic minerals drawn from the ironwood's deep delving roots are the source of its legendary hardness and appearance.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/7.png?raw=true",
    ticker: "$IRNWD",
  },
  {
    trait: "Obsidian",
    value: 2216,
    colour: "#000000",
    id: 6,
    description:
      "Hard and brittle, obsidian can be honed to a razors edge nanometers wide, parting armor on an atomic level. The preferred material of assassins and cheap jewelers.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/5.png?raw=true",
    ticker: "$OBS",
  },
  {
    trait: "Gold",
    value: 914,
    colour: "#fcd34d",
    id: 7,
    description: "Ripped from its million-year geological womb within the earth to be hoarded in mortal coffers.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/9.png?raw=true",
    ticker: "$GOLD",
  },
  {
    trait: "Silver",
    value: 1741,
    colour: "#eeeeee",
    id: 8,
    description: "The luster and rarity of silver draws out the basest instinct of laymen and nobility alike. Greed.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/6.png?raw=true",
    ticker: "$SILVER",
  },
  {
    trait: "Mithral",
    value: 37,
    colour: "#60a5fa",
    id: 9,
    description:
      "This otherworldly metal has the strength of adamantine but is lighter than air. The pieces are held in place by strange gravitational core. Those who spend much time with it slowly succumb to neurotic delusions of a rapturous, divine apocalypse.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/21.png?raw=true",
    ticker: "$MITHRL",
  },
  {
    trait: "Alchemical Silver",
    value: 93,
    colour: "#bdbdbd",
    id: 10,
    description:
      "Alchemical Silver is found pooled beneath battlegrounds from a forgotten, lost era. It can retain an almost unlimited amount of potential energy, making it the perfect catalyst for those delving into the mysteries of the universe.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/19.png?raw=true",
    ticker: "$ALCHMY",
  },
  {
    trait: "Cold Iron",
    value: 957,
    colour: "#fca5a5",
    id: 11,
    description:
      "Something has infected this metallic ore with a cruel chill and an extraordinary thirst for the warmth of living things.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/8.png?raw=true",
    ticker: "$CLDIRN",
  },
  {
    trait: "Deep Crystal",
    value: 239,
    colour: "#93c5fd",
    id: 12,
    description:
      "Deep crystal was imprisoned from the mortal world by a timeless geode, the source of these formations have confounded scholars for centuries. Strange vibrations can be felt when held.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/14.png?raw=true",
    ticker: "$CRYSTL",
  },
  {
    trait: "Ruby",
    value: 239,
    colour: "#dc2626",
    id: 13,
    description:
      "Rubies are the chimeric fusion of metal alloys and oxygen. This hybrid of metal and minerals is often scarcer than the lives of those who seek it.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/13.png?raw=true",
    ticker: "$RUBY",
  },
  {
    trait: "Diamonds",
    value: 300,
    colour: "#ccbcfb",
    id: 14,
    description:
      "Diamonds carry the hardness of obsidian, the strength of cold iron, and the preciousness of gold. Blood is easily spilled in its name.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/11.png?raw=true",
    ticker: "$DMND",
  },
  {
    trait: "Hartwood",
    value: 594,
    colour: "#fca5a5",
    id: 15,
    description:
      "Revered by the Orders of Cunning, hartwood is only cut in dire circumstance. It bleeds like any mortal and some claim to hear voices from its sap long after being tapped from the trunk.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/10.png?raw=true",
    ticker: "$HRTWD",
  },
  {
    trait: "Ignium",
    value: 172,
    colour: "#ef4444",
    id: 16,
    description:
      "Some horrible power has irrevocably scarred this ignium stone with an infernal radiation that evaporates water and skin alike.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/15.png?raw=true",
    ticker: "$IGNIUM",
  },
  {
    trait: "Twilight Quartz",
    value: 111,
    colour: "#6d28d9",
    id: 17,
    description:
      "Fortunately, this gemstone grows deep within the earth, far away from the soft flesh of mortal kind. Its elegance hides a tendency to rapidly engulf organic matter it encounters in a matter of hours.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/18.png?raw=true",
    ticker: "$QUARTZ",
  },
  {
    trait: "True Ice",
    value: 139,
    colour: "#ffffff",
    id: 18,
    description:
      "True ice does not melt, it is carved like living stone from frozen abyssal caverns far beneath the earth. Many a careless mason has lost their life when placing this near Ignium.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/17.png?raw=true",
    ticker: "$TRUICE",
  },
  {
    trait: "Adamantine",
    value: 55,
    colour: "#1e3a8a",
    id: 19,
    description:
      "Adamantine forms around ontological anomalies like the immune response of a planetary entity. It contains the supernatural strength to contain such terrors from spreading. Woe to those who shortsightedly take it from its original purpose.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/20.png?raw=true",
    ticker: "$ADMT",
  },
  {
    trait: "Sapphire",
    value: 247,
    colour: "#3b82f6",
    id: 20,
    description:
      "Sapphires are given birth from titanic forces that crush and grind for thousands of years in a hellscape of heat and pressure. The result is a gemstone accustomed to both pain and beauty.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/12.png?raw=true",
    ticker: "$SPHR",
  },
  {
    trait: "Ethereal Silica",
    value: 162,
    colour: "#10b981",
    id: 21,
    description:
      "Ethereal silica is a glass that funnels and bends light in ways that deviate from known physics. Those exposed for long periods of time experience an all- consuming lethargic bliss.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/16.png?raw=true",
    ticker: "$SILICA",
  },
  {
    trait: "Dragonhide",
    value: 23,
    colour: "#ec4899",
    id: 22,
    description:
      "Dragons are the hidden guardians of our reality. No mortal can witness their work, lest they be purged by dragonfire. If you find one of these scales, flee. Only death can be found in their presence or by the forces they fight in secret.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/22.png?raw=true",
    ticker: "$DRGNHD",
  },
  {
    trait: "Donkey",
    value: 249,
    colour: "#ec4899",
    id: 249,
    description: "Donkey.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/249.png?raw=true",
    ticker: "$DONKEY",
  },
  {
    trait: "Knight",
    value: 250,
    colour: "#ec4899",
    id: 250,
    description: "Wheat.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/250.png?raw=true",
    ticker: "$KNIGHT",
  },
  {
    trait: "Crossbowman",
    value: 251,
    colour: "#ec4899",
    id: 251,
    description: "Wheat.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/251.png?raw=true",
    ticker: "$CRSSBW",
  },
  {
    trait: "Paladin",
    value: 252,
    colour: "#ec4899",
    id: 252,
    description: "Wheat.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/252.png?raw=true",
    ticker: "$PLDN",
  },
  {
    trait: "Lords",
    value: 253,
    colour: "#ec4899",
    id: 253,
    description: "Lords.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/253.png?raw=true",
    ticker: "$LORDS",
  },
  {
    trait: "Wheat",
    value: 254,
    colour: "#F5DEB3",
    id: 254,
    description: "Wheat.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/254.png?raw=true",
    ticker: "$WHEAT",
  },
  {
    trait: "Fish",
    value: 255,
    colour: "#87CEEB",
    id: 255,
    description: "Fish.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/255.png?raw=true",
    ticker: "$FISH",
  },
  {
    trait: "Ancient Fragment",
    value: 29,
    colour: "#ec4899",
    id: 29,
    description: "Ancient Fragment is a rare and powerful resource that can be used to create powerful items.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/29.png?raw=true",
    ticker: "$FRAGMENT",
  },
];

export const RESOURCE_RARITY: { [key in ResourcesIds]?: number } = {
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
  [ResourcesIds.AncientFragment]: 20.98,
  [ResourcesIds.Donkey]: 1,
  [ResourcesIds.Knight]: 1,
  [ResourcesIds.Crossbowman]: 1,
  [ResourcesIds.Paladin]: 1,
  [ResourcesIds.Lords]: 1,
  [ResourcesIds.Wheat]: 1,
  [ResourcesIds.Fish]: 1,
};

// weight in kg
export const WEIGHTS_GRAM: { [key in ResourcesIds]: number } = {
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
  [ResourcesIds.AncientFragment]: 1000,
  [ResourcesIds.Donkey]: 0,
  [ResourcesIds.Knight]: 5000,
  [ResourcesIds.Crossbowman]: 3000,
  [ResourcesIds.Paladin]: 5000,
  [ResourcesIds.Lords]: 0,
  [ResourcesIds.Wheat]: 100,
  [ResourcesIds.Fish]: 100,
};

export enum ResourceTier {
  Lords = 1,
  Military,
  Transport,
  Food,
  Common,
  Uncommon,
  Rare,
  Unique,
  Mythic,
}

export const GET_HYPERSTRUCTURE_RESOURCES_PER_TIER = (
  tier: ResourceTier,
  hyperstructure: boolean = false,
): ResourcesIds[] => {
  switch (tier) {
    case ResourceTier.Lords:
      return RESOURCE_TIERS.lords.filter((resource) => (hyperstructure ? resource !== ResourcesIds.Lords : true));
    case ResourceTier.Military:
      return [];
    case ResourceTier.Transport:
      return [];
    case ResourceTier.Food:
      return [];
    case ResourceTier.Common:
      return RESOURCE_TIERS.common;
    case ResourceTier.Uncommon:
      return RESOURCE_TIERS.uncommon;
    case ResourceTier.Rare:
      return RESOURCE_TIERS.rare;
    case ResourceTier.Unique:
      return RESOURCE_TIERS.unique;
    case ResourceTier.Mythic:
      return RESOURCE_TIERS.mythic;
    default:
      throw new Error(`Invalid resource tier: ${tier}`);
  }
};

export const GET_RESOURCES_PER_TIER = (tier: ResourceTier, hyperstructure: boolean = false): ResourcesIds[] => {
  switch (tier) {
    case ResourceTier.Lords:
      return RESOURCE_TIERS.lords;
    case ResourceTier.Military:
      return RESOURCE_TIERS.military;
    case ResourceTier.Transport:
      return RESOURCE_TIERS.transport;
    case ResourceTier.Food:
      return RESOURCE_TIERS.food;
    case ResourceTier.Common:
      return RESOURCE_TIERS.common;
    case ResourceTier.Uncommon:
      return RESOURCE_TIERS.uncommon;
    case ResourceTier.Rare:
      return RESOURCE_TIERS.rare;
    case ResourceTier.Unique:
      return RESOURCE_TIERS.unique;
    case ResourceTier.Mythic:
      return RESOURCE_TIERS.mythic;
    default:
      throw new Error(`Invalid resource tier: ${tier}`);
  }
};

export const GET_RESOURCE_TIER = (resource: ResourcesIds): ResourceTier => {
  if (RESOURCE_TIERS.lords.includes(resource)) return ResourceTier.Lords;
  if (RESOURCE_TIERS.military.includes(resource)) return ResourceTier.Military;
  if (RESOURCE_TIERS.transport.includes(resource)) return ResourceTier.Transport;
  if (RESOURCE_TIERS.food.includes(resource)) return ResourceTier.Food;
  if (RESOURCE_TIERS.common.includes(resource)) return ResourceTier.Common;
  if (RESOURCE_TIERS.uncommon.includes(resource)) return ResourceTier.Uncommon;
  if (RESOURCE_TIERS.rare.includes(resource)) return ResourceTier.Rare;
  if (RESOURCE_TIERS.unique.includes(resource)) return ResourceTier.Unique;
  if (RESOURCE_TIERS.mythic.includes(resource)) return ResourceTier.Mythic;

  throw new Error(`Resource ${resource} not found in any tier`);
};

export const RESOURCE_TIERS = {
  lords: [ResourcesIds.Lords, ResourcesIds.AncientFragment],
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

export const RESOURCE_OUTPUTS: ResourceOutputs = {
  [ResourcesIds.Wood]: 30,
  [ResourcesIds.Stone]: 30,
  [ResourcesIds.Coal]: 30,
  [ResourcesIds.Copper]: 30,
  [ResourcesIds.Obsidian]: 30,
  [ResourcesIds.Silver]: 30,
  [ResourcesIds.Ironwood]: 30,
  [ResourcesIds.ColdIron]: 30,
  [ResourcesIds.Gold]: 30,
  [ResourcesIds.Hartwood]: 30,
  [ResourcesIds.Diamonds]: 30,
  [ResourcesIds.Sapphire]: 30,
  [ResourcesIds.Ruby]: 30,
  [ResourcesIds.DeepCrystal]: 30,
  [ResourcesIds.Ignium]: 30,
  [ResourcesIds.EtherealSilica]: 30,
  [ResourcesIds.TrueIce]: 30,
  [ResourcesIds.TwilightQuartz]: 30,
  [ResourcesIds.AlchemicalSilver]: 30,
  [ResourcesIds.Adamantine]: 30,
  [ResourcesIds.Mithral]: 30,
  [ResourcesIds.Dragonhide]: 30,
  [ResourcesIds.Donkey]: 0.01,
  [ResourcesIds.Knight]: 0.04,
  [ResourcesIds.Crossbowman]: 0.04,
  [ResourcesIds.Paladin]: 0.04,
  [ResourcesIds.Lords]: 0,
  [ResourcesIds.Wheat]: 50,
  [ResourcesIds.Fish]: 50,
  [ResourcesIds.AncientFragment]: 1,
};

export const RESOURCE_INPUTS: ResourceInputs = {
  [ResourcesIds.Wood]: [
    { resource: ResourcesIds.Stone, amount: 0.003 },
    { resource: ResourcesIds.Coal, amount: 0.0032 },
    { resource: ResourcesIds.Wheat, amount: 0.005 },
  ],
  [ResourcesIds.Stone]: [
    { resource: ResourcesIds.Wood, amount: 0.005 },
    { resource: ResourcesIds.Coal, amount: 0.0038 },
    { resource: ResourcesIds.Wheat, amount: 0.005 },
  ],
  [ResourcesIds.Coal]: [
    { resource: ResourcesIds.Stone, amount: 0.0042 },
    { resource: ResourcesIds.Copper, amount: 0.0028 },
    { resource: ResourcesIds.Wheat, amount: 0.005 },
  ],
  [ResourcesIds.Copper]: [
    { resource: ResourcesIds.Coal, amount: 0.0058 },
    { resource: ResourcesIds.Obsidian, amount: 0.0034 },
    { resource: ResourcesIds.Wheat, amount: 0.005 },
  ],
  [ResourcesIds.Obsidian]: [
    { resource: ResourcesIds.Copper, amount: 0.0048 },
    { resource: ResourcesIds.Silver, amount: 0.0032 },
    { resource: ResourcesIds.Wheat, amount: 0.005 },
  ],
  [ResourcesIds.Silver]: [
    { resource: ResourcesIds.Obsidian, amount: 0.005 },
    { resource: ResourcesIds.Ironwood, amount: 0.0028 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.Ironwood]: [
    { resource: ResourcesIds.Silver, amount: 0.006 },
    { resource: ResourcesIds.ColdIron, amount: 0.0032 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.ColdIron]: [
    { resource: ResourcesIds.Ironwood, amount: 0.005 },
    { resource: ResourcesIds.Gold, amount: 0.0038 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.Gold]: [
    { resource: ResourcesIds.ColdIron, amount: 0.0042 },
    { resource: ResourcesIds.Hartwood, amount: 0.0026 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.Hartwood]: [
    { resource: ResourcesIds.Gold, amount: 0.0062 },
    { resource: ResourcesIds.Diamonds, amount: 0.002 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.Diamonds]: [
    { resource: ResourcesIds.Hartwood, amount: 0.008 },
    { resource: ResourcesIds.Sapphire, amount: 0.0032 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.Sapphire]: [
    { resource: ResourcesIds.Diamonds, amount: 0.0048 },
    { resource: ResourcesIds.Ruby, amount: 0.0038 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.Ruby]: [
    { resource: ResourcesIds.Sapphire, amount: 0.0042 },
    { resource: ResourcesIds.DeepCrystal, amount: 0.004 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.DeepCrystal]: [
    { resource: ResourcesIds.Ruby, amount: 0.004 },
    { resource: ResourcesIds.Ignium, amount: 0.0042 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.Ignium]: [
    { resource: ResourcesIds.DeepCrystal, amount: 0.0056 },
    { resource: ResourcesIds.EtherealSilica, amount: 0.0038 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.EtherealSilica]: [
    { resource: ResourcesIds.Ignium, amount: 0.0042 },
    { resource: ResourcesIds.TrueIce, amount: 0.0034 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.TrueIce]: [
    { resource: ResourcesIds.EtherealSilica, amount: 0.0046 },
    { resource: ResourcesIds.TwilightQuartz, amount: 0.0032 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.TwilightQuartz]: [
    { resource: ResourcesIds.TrueIce, amount: 0.005 },
    { resource: ResourcesIds.AlchemicalSilver, amount: 0.0034 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.AlchemicalSilver]: [
    { resource: ResourcesIds.TwilightQuartz, amount: 0.0048 },
    { resource: ResourcesIds.Adamantine, amount: 0.0024 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.Adamantine]: [
    { resource: ResourcesIds.AlchemicalSilver, amount: 0.0068 },
    { resource: ResourcesIds.Mithral, amount: 0.0026 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.Mithral]: [
    { resource: ResourcesIds.Adamantine, amount: 0.006 },
    { resource: ResourcesIds.Dragonhide, amount: 0.0024 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.Dragonhide]: [
    { resource: ResourcesIds.Mithral, amount: 0.0064 },
    { resource: ResourcesIds.Adamantine, amount: 0.004 },
    { resource: ResourcesIds.Fish, amount: 0.004 },
  ],
  [ResourcesIds.Donkey]: [
    { resource: ResourcesIds.Wheat, amount: 0.025 },
    { resource: ResourcesIds.Lords, amount: 0.00001 },
  ],
  [ResourcesIds.Knight]: [
    { resource: ResourcesIds.Wheat, amount: 0.05 },
    { resource: ResourcesIds.Fish, amount: 0.05 },
    { resource: ResourcesIds.Silver, amount: 0.002 },
    { resource: ResourcesIds.Ironwood, amount: 0.005 },
  ],
  [ResourcesIds.Crossbowman]: [
    { resource: ResourcesIds.Wheat, amount: 0.05 },
    { resource: ResourcesIds.Fish, amount: 0.05 },
    { resource: ResourcesIds.Obsidian, amount: 0.002 },
    { resource: ResourcesIds.ColdIron, amount: 0.005 },
  ],
  [ResourcesIds.Paladin]: [
    { resource: ResourcesIds.Wheat, amount: 0.05 },
    { resource: ResourcesIds.Fish, amount: 0.05 },
    { resource: ResourcesIds.Copper, amount: 0.002 },
    { resource: ResourcesIds.Gold, amount: 0.005 },
  ],
  [ResourcesIds.Wheat]: [],
  [ResourcesIds.Fish]: [],
  [ResourcesIds.Lords]: [],
  [ResourcesIds.AncientFragment]: [],
};

export const RESOURCE_BUILDING_COSTS: ResourceInputs = {
  [ResourcesIds.Wood]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.Stone]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.Coal]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.Copper]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.Obsidian]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.Silver]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.Ironwood]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.ColdIron]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.Gold]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.Hartwood]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.Diamonds]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.Sapphire]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.Ruby]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.DeepCrystal]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.Ignium]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.EtherealSilica]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.TrueIce]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.TwilightQuartz]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.AlchemicalSilver]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.Adamantine]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.Mithral]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.Dragonhide]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.Donkey]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.Knight]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.Crossbowman]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.Paladin]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.Wheat]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.Fish]: [{ resource: ResourcesIds.Fish, amount: 750 }],
  [ResourcesIds.Lords]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.AncientFragment]: [{ resource: ResourcesIds.Fish, amount: 750 }],
};
