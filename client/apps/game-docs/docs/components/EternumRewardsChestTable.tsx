import { colors, table } from "./styles";

// Data from the Eternum Rewards Chest image
const ETERNUM_REWARDS_CHEST_ITEMS = [
  {
    itemName: "Legacy Guardian",
    epochItemNo: 2,
    rarity: "Legendary",
    description:
      "An impressive and timeless Knight armor set, inspired by the Knight troop models of Eternum Season 1. Part of the First Legacy Set.",
    type: "Troop Armor",
    troopType: "Knight",
    drawChance: 1.41,
  },
  {
    itemName: "Aura of the Legacy Warrior",
    epochItemNo: 3,
    rarity: "Legendary",
    description: "An aura of golden magnificence for troops of a distinguished Realm. Part of the First Legacy Set.",
    type: "Troop Aura",
    troopType: "N/A",
    drawChance: 1.41,
  },
  {
    itemName: "Aura of the Legacy Realm",
    epochItemNo: 4,
    rarity: "Epic",
    description: "An aura of golden magnificence for a distinguished Realm. Part of the First Legacy Set.",
    type: "Realm Aura",
    troopType: "N/A",
    drawChance: 4.22,
  },
  {
    itemName: "Winterhold",
    epochItemNo: 5,
    rarity: "Rare",
    description: "The icy domain of a Lord that has withstood the fiercest of winters. Part of the Winter Lord Set.",
    type: "Realm Skin",
    troopType: "N/A",
    drawChance: 8.45,
  },
  {
    itemName: "Winter's Palisade",
    epochItemNo: 6,
    rarity: "Rare",
    description: "A ring of razor-sharp ice spikes to deter a Lord's foes. Part of the Winter Lord Set.",
    type: "Realm Aura",
    troopType: "N/A",
    drawChance: 8.45,
  },
  {
    itemName: "Battleaxe of the Winter Paladin",
    epochItemNo: 7,
    rarity: "Uncommon",
    description: "A frosty, spiked battleaxe wielded by Winter Paladins. Part of the Winter Lord Set.",
    type: "Troop Primary",
    troopType: "Paladin",
    drawChance: 12.68,
  },
  {
    itemName: "Shield of the Winter Paladin",
    epochItemNo: 8,
    rarity: "Uncommon",
    description:
      "An elegant, snowflake-patterned cavalry shield wielded by Winter Paladins. Part of the Winter Lord Set.",
    type: "Troop Secondary",
    troopType: "Paladin",
    drawChance: 12.68,
  },
  {
    itemName: "Hunter's Bow",
    epochItemNo: 9,
    rarity: "Common",
    description: "A wooden hunting bow. Part of the S1 Alternates Set.",
    type: "Troop Primary",
    troopType: "Crossbowman",
    drawChance: 16.9,
  },
  {
    itemName: "Hunter's Quiver",
    epochItemNo: 10,
    rarity: "Common",
    description: "A leather quiver filled with hunting arrows. Part of the S1 Alternates Set.",
    type: "Troop Secondary",
    troopType: "Crossbowman",
    drawChance: 16.9,
  },
  {
    itemName: "Carved Wooden Base",
    epochItemNo: 11,
    rarity: "Common",
    description: "A basic-but-sturdy wooden platform. Part of the S1 Alternates Set.",
    type: "Troop Base",
    troopType: "N/A",
    drawChance: 16.9,
  },
];

// Function to get color based on rarity
const getRarityColor = (rarity: string): string => {
  switch (rarity) {
    case "Common":
      return "#aa6c39"; // copper
    case "Uncommon":
      return "#b78d4b"; // tan gold
    case "Rare":
      return "#c19a49"; // bronze gold
    case "Epic":
      return "#d4af37"; // darker gold
    case "Legendary":
      return "#e5c687"; // pale gold
    default:
      return "#dfc296"; // default gold
  }
};

// Component styles
const componentStyles = {
  itemNameCell: {
    ...table.cell,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  itemImage: {
    width: "24px",
    height: "24px",
    backgroundColor: "rgba(40, 30, 25, 0.6)",
    borderRadius: "0.25rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.75rem",
    color: colors.text.muted,
  },
  rarityCell: {
    ...table.cell,
    color: colors.secondary,
    fontWeight: 500,
  },
  descriptionCell: {
    ...table.cell,
    maxWidth: "300px",
    fontSize: "0.8rem",
    lineHeight: "1.4",
  },
  drawChanceCell: {
    ...table.cell,
    textAlign: "center" as const,
    fontWeight: "bold",
    color: colors.primary,
  },
};

const EternumRewardsChestTable = () => {
  return (
    <div style={table.container}>
      <div style={table.wrapper}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Item Name</th>
              <th style={table.headerCell}>Epoch Item No.</th>
              <th style={table.headerCell}>Rarity</th>
              <th style={table.headerCell}>Description</th>
              <th style={table.headerCell}>Type</th>
              <th style={table.headerCell}>Troop Type</th>
              <th style={table.headerCell}>Draw Chance (%)</th>
            </tr>
          </thead>
          <tbody>
            {ETERNUM_REWARDS_CHEST_ITEMS.map((item) => {
              const rarityColor = getRarityColor(item.rarity);

              return (
                <tr key={item.epochItemNo}>
                  <td style={componentStyles.itemNameCell}>
                    <div style={componentStyles.itemImage}>🎁</div>
                    <span style={{ color: colors.text.light }}>{item.itemName}</span>
                  </td>
                  <td style={table.cell}>
                    <span style={{ color: colors.text.light }}>{item.epochItemNo}</span>
                  </td>
                  <td
                    style={{
                      ...componentStyles.rarityCell,
                      borderLeft: `3px solid ${rarityColor}`,
                    }}
                  >
                    {item.rarity}
                  </td>
                  <td style={componentStyles.descriptionCell}>
                    <span style={{ color: colors.text.light }}>{item.description}</span>
                  </td>
                  <td style={table.cell}>
                    <span style={{ color: colors.text.light }}>{item.type}</span>
                  </td>
                  <td style={table.cell}>
                    <span style={{ color: colors.text.light }}>{item.troopType}</span>
                  </td>
                  <td style={componentStyles.drawChanceCell}>{item.drawChance}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EternumRewardsChestTable;
