import { ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { colors, section, table } from "./styles";

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
    rarity: "Common",
    resources: [
      { name: "Wood", id: ResourcesIds.Wood },
      { name: "Stone", id: ResourcesIds.Stone },
      { name: "Coal", id: ResourcesIds.Coal },
    ],
  },
  {
    rarity: "Uncommon",
    resources: [
      { name: "Copper", id: ResourcesIds.Copper },
      { name: "Obsidian", id: ResourcesIds.Obsidian },
      { name: "Silver", id: ResourcesIds.Silver },
      { name: "Ironwood", id: ResourcesIds.Ironwood },
      { name: "Cold Iron", id: ResourcesIds.ColdIron },
      { name: "Gold", id: ResourcesIds.Gold },
    ],
  },
  {
    rarity: "Rare",
    resources: [
      { name: "Hartwood", id: ResourcesIds.Hartwood },
      { name: "Diamonds", id: ResourcesIds.Diamonds },
      { name: "Sapphire", id: ResourcesIds.Sapphire },
      { name: "Ruby", id: ResourcesIds.Ruby },
    ],
  },
  {
    rarity: "Epic",
    resources: [
      { name: "Deep Crystal", id: ResourcesIds.DeepCrystal },
      { name: "Ignium", id: ResourcesIds.Ignium },
      { name: "Ethereal Silica", id: ResourcesIds.EtherealSilica },
    ],
  },
  {
    rarity: "Legendary",
    resources: [
      { name: "True Ice", id: ResourcesIds.TrueIce },
      { name: "Twilight Quartz", id: ResourcesIds.TwilightQuartz },
      { name: "Alchemical Silver", id: ResourcesIds.AlchemicalSilver },
    ],
  },
  {
    rarity: "Mythic",
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

// Component styles
const componentStyles = {
  resourcesGroupStyle: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.5rem",
    alignItems: "center",
  },
  resourceItemStyle: {
    display: "flex",
    alignItems: "center",
    gap: "0.3rem",
    padding: "0.2rem 0.35rem",
    backgroundColor: colors.background.dark,
    borderRadius: "0.35rem",
    fontSize: "0.75rem",
    border: `1px solid ${colors.border}`,
  },
  rarityCellStyle: {
    ...table.cell,
    color: colors.text.light,
    fontWeight: 500,
  },
};

// Function to get color based on rarity
const getRarityColor = (rarity: string): string => {
  switch (rarity) {
    case "Food":
      return colors.secondary;
    case "Special":
      return colors.arcane;
    case "Common":
      return colors.primary;
    case "Uncommon":
      return colors.secondary;
    case "Rare":
      return colors.primary;
    case "Epic":
      return colors.arcane;
    case "Legendary":
      return colors.primary;
    case "Mythic":
      return colors.secondary;
    case "Units & Transport":
      return colors.borderDark;
    default:
      return colors.primary;
  }
};

const RarityResourceTable = () => {
  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>
        <span style={{ fontSize: "0.85em", fontWeight: 400 }}>Material Rarity Categories</span>
      </div>
      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
          <tr>
            <th style={table.headerCell}>Rarity</th>
            <th style={table.headerCell}>Materials</th>
          </tr>
        </thead>
        <tbody>
          {RESOURCE_RARITIES.map((category) => {
            const rarityColor = getRarityColor(category.rarity);

            return (
              <tr key={category.rarity}>
                <td
                  style={componentStyles.rarityCellStyle}
                >
                  {category.rarity}
                </td>
                <td style={table.cell}>
                  <div style={componentStyles.resourcesGroupStyle}>
                    {category.resources.map((resource) => (
                      <div key={resource.id} style={componentStyles.resourceItemStyle}>
                        <ResourceIcon name={resource.name} id={resource.id} size="sm" />
                        <span style={{ color: colors.text.light }}>{resource.name}</span>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
};

export default RarityResourceTable;
