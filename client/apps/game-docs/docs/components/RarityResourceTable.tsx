import { ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";

const RESOURCE_RARITIES = [
  {
    rarity: "Food",
    resources: [
      { name: "Wheat", id: ResourcesIds.Wheat },
      { name: "Fish", id: ResourcesIds.Fish },
    ],
  },
  {
    rarity: "Special",
    resources: [
      { name: "Ancient Fragment", id: ResourcesIds.AncientFragment },
      { name: "Labor", id: ResourcesIds.Labor },
      { name: "Lords", id: ResourcesIds.Lords },
    ],
  },
  {
    rarity: "Common (Widely Available)",
    resources: [
      { name: "Wood", id: ResourcesIds.Wood },
      { name: "Stone", id: ResourcesIds.Stone },
      { name: "Coal", id: ResourcesIds.Coal },
      { name: "Copper", id: ResourcesIds.Copper },
      { name: "Obsidian", id: ResourcesIds.Obsidian },
    ],
  },
  {
    rarity: "Uncommon (Limited Availability)",
    resources: [
      { name: "Silver", id: ResourcesIds.Silver },
      { name: "Ironwood", id: ResourcesIds.Ironwood },
      { name: "Cold Iron", id: ResourcesIds.ColdIron },
      { name: "Gold", id: ResourcesIds.Gold },
    ],
  },
  {
    rarity: "Rare (Scarce)",
    resources: [
      { name: "Hartwood", id: ResourcesIds.Hartwood },
      { name: "Diamonds", id: ResourcesIds.Diamonds },
      { name: "Sapphire", id: ResourcesIds.Sapphire },
      { name: "Ruby", id: ResourcesIds.Ruby },
    ],
  },
  {
    rarity: "Unique (Very Scarce)",
    resources: [
      { name: "Deep Crystal", id: ResourcesIds.DeepCrystal },
      { name: "Ignium", id: ResourcesIds.Ignium },
      { name: "Ethereal Silica", id: ResourcesIds.EtherealSilica },
      { name: "True Ice", id: ResourcesIds.TrueIce },
      { name: "Twilight Quartz", id: ResourcesIds.TwilightQuartz },
      { name: "Alchemical Silver", id: ResourcesIds.AlchemicalSilver },
    ],
  },
  {
    rarity: "Mythic (Extremely Rare)",
    resources: [
      { name: "Adamantine", id: ResourcesIds.Adamantine },
      { name: "Mithral", id: ResourcesIds.Mithral },
      { name: "Dragonhide", id: ResourcesIds.Dragonhide },
    ],
  },
  {
    rarity: "Units & Transport",
    resources: [
      { name: "Donkey", id: ResourcesIds.Donkey },
      { name: "Knight", id: ResourcesIds.Knight },
      { name: "Knight T2", id: ResourcesIds.KnightT2 },
      { name: "Knight T3", id: ResourcesIds.KnightT3 },
      { name: "Crossbowman", id: ResourcesIds.Crossbowman },
      { name: "Crossbowman T2", id: ResourcesIds.CrossbowmanT2 },
      { name: "Crossbowman T3", id: ResourcesIds.CrossbowmanT3 },
      { name: "Paladin", id: ResourcesIds.Paladin },
      { name: "Paladin T2", id: ResourcesIds.PaladinT2 },
      { name: "Paladin T3", id: ResourcesIds.PaladinT3 },
    ],
  },
];

const RarityResourceTable = () => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-gray">
        <thead>
          <tr>
            <th className="py-2 px-4 border-b-2 border-gray-300 text-left">Rarity</th>
            <th className="py-2 px-4 border-b-2 border-gray-300 text-left">Resources</th>
          </tr>
        </thead>
        <tbody>
          {RESOURCE_RARITIES.map((category) => (
            <tr key={category.rarity}>
              <td className="py-2 px-4 border-b border-gray-300">{category.rarity}</td>
              <td className="py-2 px-4 border-b border-gray-300">
                <div className="flex items-baseline gap-1">
                  {category.resources.map((resource) => (
                    <ResourceIcon key={resource.id} name={resource.name} id={resource.id} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RarityResourceTable;
