import { Resources } from "../types";
import { ResourcesIds } from "./index";

export const STEALABLE_RESOURCES = [
  ResourcesIds.Lords,
  ResourcesIds.Donkey,
  ResourcesIds.AncientFragment,
  // T3 Troops
  ResourcesIds.PaladinT3,
  ResourcesIds.CrossbowmanT3,
  ResourcesIds.KnightT3,

  ResourcesIds.Dragonhide,
  ResourcesIds.Mithral,
  ResourcesIds.Adamantine,
  ResourcesIds.AlchemicalSilver,
  ResourcesIds.TwilightQuartz,
  ResourcesIds.TrueIce,

  // T2 Troops
  ResourcesIds.PaladinT2,
  ResourcesIds.CrossbowmanT2,
  ResourcesIds.KnightT2,

  ResourcesIds.EtherealSilica,
  ResourcesIds.Ignium,
  ResourcesIds.DeepCrystal,
  ResourcesIds.Ruby,
  ResourcesIds.Sapphire,
  ResourcesIds.Diamonds,

  // T1 Troops
  ResourcesIds.Paladin,
  ResourcesIds.Crossbowman,
  ResourcesIds.Knight,

  ResourcesIds.Hartwood,
  ResourcesIds.Gold,
  ResourcesIds.ColdIron,
  ResourcesIds.Ironwood,
  ResourcesIds.Silver,
  ResourcesIds.Obsidian,
  ResourcesIds.Copper,
  // labor
  ResourcesIds.Labor,

  ResourcesIds.Coal,
  ResourcesIds.Stone,
  ResourcesIds.Wood,

  // food
  ResourcesIds.Fish,
  ResourcesIds.Wheat,
];

export const resources: Array<Resources> = [
  {
    trait: "Stone",
    value: 3941,
    colour: "#e0e0e0",
    id: ResourcesIds.Stone,
    description: "Stone masonry is a culture bending the bones of the earth itself to their own purpose.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/2.png?raw=true",
    ticker: "$STONE",
  },
  {
    trait: "Coal",
    value: 3833,
    colour: "#757575",
    id: ResourcesIds.Coal,
    description:
      "Coal is the only answer when fire is not enough to stave off the gnawing, winter cold or the ravenous demands of iron forges.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/3.png?raw=true",
    ticker: "$COAL",
  },
  {
    trait: "Wood",
    value: 5015,
    colour: "#78350f",
    id: ResourcesIds.Wood,
    description: "Wood is the backbone of civilization. Fire, industry, and shelter spawned from its sinew and sap.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/1.png?raw=true",
    ticker: "$WOOD",
  },
  {
    trait: "Copper",
    value: 2643,
    colour: "#f59e0b",
    id: ResourcesIds.Copper,
    description:
      "The malleability of copper is a strength. A copper axe will crush a skull as easily as a copper pot sizzles an egg.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/4.png?raw=true",
    ticker: "$COPPER",
  },
  {
    trait: "Ironwood",
    value: 1179,
    colour: "#b91c1c",
    id: ResourcesIds.Ironwood,
    description:
      "Metallic minerals drawn from the ironwood's deep delving roots are the source of its legendary hardness and appearance.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/7.png?raw=true",
    ticker: "$IRNWD",
  },
  {
    trait: "Obsidian",
    value: 2216,
    colour: "#000000",
    id: ResourcesIds.Obsidian,
    description:
      "Hard and brittle, obsidian can be honed to a razors edge nanometers wide, parting armor on an atomic level. The preferred material of assassins and cheap jewelers.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/5.png?raw=true",
    ticker: "$OBS",
  },
  {
    trait: "Gold",
    value: 914,
    colour: "#fcd34d",
    id: ResourcesIds.Gold,
    description: "Ripped from its million-year geological womb within the earth to be hoarded in mortal coffers.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/9.png?raw=true",
    ticker: "$GOLD",
  },
  {
    trait: "Silver",
    value: 1741,
    colour: "#eeeeee",
    id: ResourcesIds.Silver,
    description: "The luster and rarity of silver draws out the basest instinct of laymen and nobility alike. Greed.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/6.png?raw=true",
    ticker: "$SILVER",
  },
  {
    trait: "Mithral",
    value: 37,
    colour: "#60a5fa",
    id: ResourcesIds.Mithral,
    description:
      "This otherworldly metal has the strength of adamantine but is lighter than air. The pieces are held in place by strange gravitational core. Those who spend much time with it slowly succumb to neurotic delusions of a rapturous, divine apocalypse.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/21.png?raw=true",
    ticker: "$MITHRL",
  },
  {
    trait: "Alchemical Silver",
    value: 93,
    colour: "#bdbdbd",
    id: ResourcesIds.AlchemicalSilver,
    description:
      "Alchemical Silver is found pooled beneath battlegrounds from a forgotten, lost era. It can retain an almost unlimited amount of potential energy, making it the perfect catalyst for those delving into the mysteries of the universe.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/19.png?raw=true",
    ticker: "$ALCHMY",
  },
  {
    trait: "Cold Iron",
    value: 957,
    colour: "#fca5a5",
    id: ResourcesIds.ColdIron,
    description:
      "Something has infected this metallic ore with a cruel chill and an extraordinary thirst for the warmth of living things.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/8.png?raw=true",
    ticker: "$CLDIRN",
  },
  {
    trait: "Deep Crystal",
    value: 239,
    colour: "#93c5fd",
    id: ResourcesIds.DeepCrystal,
    description:
      "Deep crystal was imprisoned from the mortal world by a timeless geode, the source of these formations have confounded scholars for centuries. Strange vibrations can be felt when held.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/14.png?raw=true",
    ticker: "$CRYSTL",
  },
  {
    trait: "Ruby",
    value: 239,
    colour: "#dc2626",
    id: ResourcesIds.Ruby,
    description:
      "Rubies are the chimeric fusion of metal alloys and oxygen. This hybrid of metal and minerals is often scarcer than the lives of those who seek it.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/13.png?raw=true",
    ticker: "$RUBY",
  },
  {
    trait: "Diamonds",
    value: 300,
    colour: "#ccbcfb",
    id: ResourcesIds.Diamonds,
    description:
      "Diamonds carry the hardness of obsidian, the strength of cold iron, and the preciousness of gold. Blood is easily spilled in its name.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/11.png?raw=true",
    ticker: "$DMND",
  },
  {
    trait: "Hartwood",
    value: 594,
    colour: "#fca5a5",
    id: ResourcesIds.Hartwood,
    description:
      "Revered by the Orders of Cunning, hartwood is only cut in dire circumstance. It bleeds like any mortal and some claim to hear voices from its sap long after being tapped from the trunk.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/10.png?raw=true",
    ticker: "$HRTWD",
  },
  {
    trait: "Ignium",
    value: 172,
    colour: "#ef4444",
    id: ResourcesIds.Ignium,
    description:
      "Some horrible power has irrevocably scarred this ignium stone with an infernal radiation that evaporates water and skin alike.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/15.png?raw=true",
    ticker: "$IGNIUM",
  },
  {
    trait: "Twilight Quartz",
    value: 111,
    colour: "#6d28d9",
    id: ResourcesIds.TwilightQuartz,
    description:
      "Fortunately, this gemstone grows deep within the earth, far away from the soft flesh of mortal kind. Its elegance hides a tendency to rapidly engulf organic matter it encounters in a matter of hours.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/18.png?raw=true",
    ticker: "$QUARTZ",
  },
  {
    trait: "True Ice",
    value: 139,
    colour: "#ffffff",
    id: ResourcesIds.TrueIce,
    description:
      "True ice does not melt, it is carved like living stone from frozen abyssal caverns far beneath the earth. Many a careless mason has lost their life when placing this near Ignium.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/17.png?raw=true",
    ticker: "$TRUICE",
  },
  {
    trait: "Adamantine",
    value: 55,
    colour: "#1e3a8a",
    id: ResourcesIds.Adamantine,
    description:
      "Adamantine forms around ontological anomalies like the immune response of a planetary entity. It contains the supernatural strength to contain such terrors from spreading. Woe to those who shortsightedly take it from its original purpose.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/20.png?raw=true",
    ticker: "$ADMT",
  },
  {
    trait: "Sapphire",
    value: 247,
    colour: "#3b82f6",
    id: ResourcesIds.Sapphire,
    description:
      "Sapphires are given birth from titanic forces that crush and grind for thousands of years in a hellscape of heat and pressure. The result is a gemstone accustomed to both pain and beauty.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/12.png?raw=true",
    ticker: "$SPHR",
  },
  {
    trait: "Ethereal Silica",
    value: 162,
    colour: "#10b981",
    id: ResourcesIds.EtherealSilica,
    description:
      "Ethereal silica is a glass that funnels and bends light in ways that deviate from known physics. Those exposed for long periods of time experience an all- consuming lethargic bliss.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/16.png?raw=true",
    ticker: "$SILICA",
  },
  {
    trait: "Dragonhide",
    value: 22,
    colour: "#ec4899",
    id: ResourcesIds.Dragonhide,
    description:
      "Dragons are the hidden guardians of our reality. No mortal can witness their work, lest they be purged by dragonfire. If you find one of these scales, flee. Only death can be found in their presence or by the forces they fight in secret.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/22.png?raw=true",
    ticker: "$DRGNHD",
  },
  {
    trait: "Labor",
    value: 23,
    colour: "#ec4899",
    id: ResourcesIds.Labor,
    description: "Labor",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/23.png?raw=true",
    ticker: "$LABOR",
  },
  {
    trait: "Ancient Fragment",
    value: 29,
    colour: "#ec4899",
    id: ResourcesIds.AncientFragment,
    description: "Ancient Fragment is a rare and powerful resource that can be used to create powerful items.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/29.png?raw=true",
    ticker: "$FRAGMENT",
  },
  {
    trait: "Donkey",
    value: 249,
    colour: "#ec4899",
    id: ResourcesIds.Donkey,
    description: "Donkey.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/249.png?raw=true",
    ticker: "$DONKEY",
  },
  {
    trait: "Knight",
    value: 250,
    colour: "#ec4899",
    id: ResourcesIds.Knight,
    description: "Knight Tier 1",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/250.png?raw=true",
    ticker: "$KNIGHT1",
  },
  {
    trait: "KnightT2",
    value: 251,
    colour: "#ec4899",
    id: ResourcesIds.KnightT2,
    description: "Knight Tier 2",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/251.png?raw=true",
    ticker: "$KNIGHT2",
  },
  {
    trait: "KnightT3",
    value: 252,
    colour: "#ec4899",
    id: ResourcesIds.KnightT3,
    description: "Knight Tier 3",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/252.png?raw=true",
    ticker: "$KNIGHT3",
  },
  {
    trait: "Crossbowman",
    value: 253,
    colour: "#ec4899",
    id: ResourcesIds.Crossbowman,
    description: "Crossbowman Tier 1",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/253.png?raw=true",
    ticker: "$CROSS1",
  },
  {
    trait: "CrossbowmanT2",
    value: 254,
    colour: "#ec4899",
    id: ResourcesIds.CrossbowmanT2,
    description: "Crossbowman Tier 2",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/254.png?raw=true",
    ticker: "$CROSS2",
  },
  {
    trait: "CrossbowmanT3",
    value: 255,
    colour: "#ec4899",
    id: ResourcesIds.CrossbowmanT3,
    description: "Crossbowman Tier 3",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/255.png?raw=true",
    ticker: "$CROSS3",
  },
  {
    trait: "Paladin",
    value: 256,
    colour: "#ec4899",
    id: ResourcesIds.Paladin,
    description: "Paladin Tier 1",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/256.png?raw=true",
    ticker: "$PLDN1",
  },
  {
    trait: "PaladinT2",
    value: 257,
    colour: "#ec4899",
    id: ResourcesIds.PaladinT2,
    description: "Paladin Tier 2",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/257.png?raw=true",
    ticker: "$PLDN2",
  },
  {
    trait: "PaladinT3",
    value: 258,
    colour: "#ec4899",
    id: ResourcesIds.PaladinT3,
    description: "Paladin Tier 3",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/258.png?raw=true",
    ticker: "$PLDN3",
  },
  {
    trait: "Wheat",
    value: 259,
    colour: "#F5DEB3",
    id: ResourcesIds.Wheat,
    description: "Wheat.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/259.png?raw=true",
    ticker: "$WHEAT",
  },
  {
    trait: "Fish",
    value: 260,
    colour: "#87CEEB",
    id: ResourcesIds.Fish,
    description: "Fish.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/260.png?raw=true",
    ticker: "$FISH",
  },
  {
    trait: "Lords",
    value: 261,
    colour: "#ec4899",
    id: ResourcesIds.Lords,
    description: "Lords.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/261.png?raw=true",
    ticker: "$LORDS",
  },

  // Relics - Army Enhancement Items
  {
    trait: "Stamina Relic I",
    value: 39,
    colour: "#4ade80",
    id: ResourcesIds.StaminaRelic1,
    description: "A mystical artifact that enhances stamina regeneration for armies by 50% for 3 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/39.png?raw=true",
    ticker: "$STAM1",
  },
  {
    trait: "Stamina Relic II",
    value: 40,
    colour: "#22c55e",
    id: ResourcesIds.StaminaRelic2,
    description: "A powerful artifact that doubles stamina regeneration for armies for 3 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/40.png?raw=true",
    ticker: "$STAM2",
  },
  {
    trait: "Damage Relic I",
    value: 41,
    colour: "#f87171",
    id: ResourcesIds.DamageRelic1,
    description: "An ancient weapon enhancement that increases army damage by 20% for 3 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/41.png?raw=true",
    ticker: "$DMG1",
  },
  {
    trait: "Damage Relic II",
    value: 42,
    colour: "#ef4444",
    id: ResourcesIds.DamageRelic2,
    description: "A legendary weapon enhancement that increases army damage by 40% for 3 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/42.png?raw=true",
    ticker: "$DMG2",
  },
  {
    trait: "Damage Reduction Relic I",
    value: 43,
    colour: "#60a5fa",
    id: ResourcesIds.DamageReductionRelic1,
    description: "A protective ward that reduces damage taken by armies by 20% for 3 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/43.png?raw=true",
    ticker: "$DEF1",
  },
  {
    trait: "Damage Reduction Relic II",
    value: 44,
    colour: "#3b82f6",
    id: ResourcesIds.DamageReductionRelic2,
    description: "A powerful protective ward that reduces damage taken by armies by 40% for 3 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/44.png?raw=true",
    ticker: "$DEF2",
  },
  {
    trait: "Exploration Relic I",
    value: 45,
    colour: "#a78bfa",
    id: ResourcesIds.ExplorationRelic1,
    description: "A mystical compass that instantly reveals terrain in a one-tile radius.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/45.png?raw=true",
    ticker: "$EXP1",
  },
  {
    trait: "Exploration Relic II",
    value: 46,
    colour: "#8b5cf6",
    id: ResourcesIds.ExplorationRelic2,
    description: "A powerful mystical compass that instantly reveals terrain in a two-tile radius.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/46.png?raw=true",
    ticker: "$EXP2",
  },
  {
    trait: "Exploration Reward Relic I",
    value: 47,
    colour: "#fbbf24",
    id: ResourcesIds.ExplorationRewardRelic1,
    description: "A treasure hunter's charm that doubles all exploration rewards for 3 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/47.png?raw=true",
    ticker: "$EXPR1",
  },
  {
    trait: "Exploration Reward Relic II",
    value: 48,
    colour: "#f59e0b",
    id: ResourcesIds.ExplorationRewardRelic2,
    description: "A legendary treasure hunter's charm that triples all exploration rewards for 3 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/48.png?raw=true",
    ticker: "$EXPR2",
  },

  // Relics - Structure Enhancement Items
  {
    trait: "Structure Defense Relic I",
    value: 49,
    colour: "#94a3b8",
    id: ResourcesIds.StructureDamageReductionRelic1,
    description: "A fortress ward that reduces damage taken by all guard armies by 15% for 6 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/49.png?raw=true",
    ticker: "$SDEF1",
  },
  {
    trait: "Structure Defense Relic II",
    value: 50,
    colour: "#64748b",
    id: ResourcesIds.StructureDamageReductionRelic2,
    description: "A powerful fortress ward that reduces damage taken by all guard armies by 30% for 6 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/50.png?raw=true",
    ticker: "$SDEF2",
  },
  {
    trait: "Production Relic I",
    value: 51,
    colour: "#10b981",
    id: ResourcesIds.ProductionRelic1,
    description: "An efficiency enhancement that increases resource production rate by 20% for 3 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/51.png?raw=true",
    ticker: "$PROD1",
  },
  {
    trait: "Production Relic II",
    value: 52,
    colour: "#059669",
    id: ResourcesIds.ProductionRelic2,
    description: "A powerful efficiency enhancement that increases resource production rate by 40% for 3 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/52.png?raw=true",
    ticker: "$PROD2",
  },
  {
    trait: "Labor Production Relic I",
    value: 53,
    colour: "#f472b6",
    id: ResourcesIds.LaborProductionRelic1,
    description: "A workforce motivator that increases labor production rate by 20% for 6 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/53.png?raw=true",
    ticker: "$LAB1",
  },
  {
    trait: "Labor Production Relic II",
    value: 54,
    colour: "#ec4899",
    id: ResourcesIds.LaborProductionRelic2,
    description: "A powerful workforce motivator that increases labor production rate by 20% for 12 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/54.png?raw=true",
    ticker: "$LAB2",
  },
  {
    trait: "Troop Production Relic I",
    value: 55,
    colour: "#fb923c",
    id: ResourcesIds.TroopProductionRelic1,
    description: "A military accelerator that increases troop production rate by 20% for 6 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/55.png?raw=true",
    ticker: "$TROOP1",
  },
  {
    trait: "Troop Production Relic II",
    value: 56,
    colour: "#ea580c",
    id: ResourcesIds.TroopProductionRelic2,
    description: "A powerful military accelerator that increases troop production rate by 20% for 12 Eternum Days.",
    img: "https://github.com/BibliothecaDAO/eternum/blob/main/client/public/images/resources/56.png?raw=true",
    ticker: "$TROOP2",
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
  [ResourcesIds.DeepCrystal]: 20.99,
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
  labor: [ResourcesIds.Labor],
  military: [
    ResourcesIds.Knight,
    ResourcesIds.KnightT2,
    ResourcesIds.KnightT3,
    ResourcesIds.Crossbowman,
    ResourcesIds.CrossbowmanT2,
    ResourcesIds.CrossbowmanT3,
    ResourcesIds.Paladin,
    ResourcesIds.PaladinT2,
    ResourcesIds.PaladinT3,
  ],
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
  relics: [
    // Army Enhancement Relics
    ResourcesIds.StaminaRelic1,
    ResourcesIds.StaminaRelic2,
    ResourcesIds.DamageRelic1,
    ResourcesIds.DamageRelic2,
    ResourcesIds.DamageReductionRelic1,
    ResourcesIds.DamageReductionRelic2,
    ResourcesIds.ExplorationRelic1,
    ResourcesIds.ExplorationRelic2,
    ResourcesIds.ExplorationRewardRelic1,
    ResourcesIds.ExplorationRewardRelic2,
    // Structure Enhancement Relics
    ResourcesIds.StructureDamageReductionRelic1,
    ResourcesIds.StructureDamageReductionRelic2,
    ResourcesIds.ProductionRelic1,
    ResourcesIds.ProductionRelic2,
    ResourcesIds.LaborProductionRelic1,
    ResourcesIds.LaborProductionRelic2,
    ResourcesIds.TroopProductionRelic1,
    ResourcesIds.TroopProductionRelic2,
  ],
};
