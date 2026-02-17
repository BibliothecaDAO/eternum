import { colors, table } from "../styles";

// Data from the Blitz Rewards Chest (Epoch 1, Series 0, items 12-22)
const BLITZ_REWARDS_CHEST_ITEMS = [
  {
    epochItemNumber: 12,
    itemName: "Legacy Hunter",
    rarity: "Legendary",
    description:
      "An exceptional Crossbowman armor set with devilish detail, inspired by the Crossbowman troop models of Eternum Season 1. Part of the First Legacy Set.",
    type: "Troop Armor",
    troopType: "Crossbowman",
    drawChance: 1.21,
    image: "/images/nft-images/0x207050c01.png",
  },
  {
    epochItemNumber: 13,
    itemName: "Overgrown Wreath",
    rarity: "Epic",
    description: "A ring of living vines encircling the armies of the forest. Part of the Overgrown Set.",
    type: "Troop Aura",
    troopType: "N/A",
    drawChance: 3.66,
    image: "/images/nft-images/0x4040d01.png",
  },
  {
    epochItemNumber: 14,
    itemName: "Overgrown Foundation",
    rarity: "Epic",
    description: "A platform covered in growth from the forest floor. Part of the Overgrown Set.",
    type: "Troop Base",
    troopType: "N/A",
    drawChance: 3.66,
    image: "/images/nft-images/0x8040e01.png",
  },
  {
    epochItemNumber: 15,
    itemName: "Winter Vortex",
    rarity: "Rare",
    description:
      "A swirl of ice and frost surrounding armies that have embraced winter. Part of the Winter Lord Set.",
    type: "Troop Aura",
    troopType: "N/A",
    drawChance: 7.32,
    image: "/images/nft-images/0x4030f01.png",
  },
  {
    epochItemNumber: 16,
    itemName: "Winter's Footing",
    rarity: "Rare",
    description: "A frosty foundation for the armies of frozen domains. Part of the Winter Lord Set.",
    type: "Troop Base",
    troopType: "N/A",
    drawChance: 7.32,
    image: "/images/nft-images/0x8031001.png",
  },
  {
    epochItemNumber: 17,
    itemName: "Overgrown Nest",
    rarity: "Uncommon",
    description: "The vine-wrapped domain of a forest Lord. Part of the Overgrown Set.",
    type: "Realm Skin",
    troopType: "N/A",
    drawChance: 10.98,
    image: "/images/nft-images/0x3021101.png",
  },
  {
    epochItemNumber: 18,
    itemName: "Winter Trooper's Broadaxe",
    rarity: "Uncommon",
    description:
      "A sleek, razor-sharp broadaxe wielded by Winter Knights. Part of the Winter Lord Set.",
    type: "Troop Primary",
    troopType: "Knight",
    drawChance: 10.98,
    image: "/images/nft-images/0x105021201.png",
  },
  {
    epochItemNumber: 19,
    itemName: "Winter Trooper's Targe",
    rarity: "Uncommon",
    description:
      "A frost-patterned, reinforced roundshield wielded by Winter Knights. Part of the Winter Lord Set.",
    type: "Troop Secondary",
    troopType: "Knight",
    drawChance: 10.98,
    image: "/images/nft-images/0x106021301.png",
  },
  {
    epochItemNumber: 20,
    itemName: "Witness of the Morning Wars",
    rarity: "Common",
    description:
      "A fitting title for a Realm scarred by some of the earliest wars in recorded history.",
    type: "Realm Title",
    troopType: "N/A",
    drawChance: 14.63,
    image: "/images/nft-images/0x1011401.png",
  },
  {
    epochItemNumber: 21,
    itemName: "Light Cavalry Sword",
    rarity: "Common",
    description: "A long, light horseman's blade.",
    type: "Troop Primary",
    troopType: "Paladin",
    drawChance: 14.63,
    image: "/images/nft-images/0x305011501.png",
  },
  {
    epochItemNumber: 22,
    itemName: "Light Cavalry Shield",
    rarity: "Common",
    description: "A decorative horseman's shield.",
    type: "Troop Secondary",
    troopType: "Paladin",
    drawChance: 14.63,
    image: "/images/nft-images/0x306011601.png",
  },
];

// Function to get color based on rarity
const getRarityColor = (rarity: string): string => {
  switch (rarity) {
    case "Common":
      return "#8e8e8e";
    case "Uncommon":
      return "#64cc6c";
    case "Rare":
      return "#4ebce1";
    case "Epic":
      return "#b12ecb";
    case "Legendary":
      return "#f1b75a";
    default:
      return "#ffffff";
  }
};

const componentStyles = {
  itemNameCell: {
    ...table.cell,
    color: colors.text.light,
    fontWeight: 500,
  },
  itemImageCell: {
    ...table.cell,
    width: "110px",
    textAlign: "center" as const,
  },
  itemImage: {
    width: "72px",
    height: "72px",
    objectFit: "contain" as const,
    borderRadius: "0.35rem",
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
    color: colors.text.light,
  },
  drawChanceCell: {
    ...table.cell,
    textAlign: "center" as const,
    fontWeight: "bold",
    color: colors.primary,
  },
  epochCell: {
    ...table.cell,
    textAlign: "center" as const,
    color: colors.text.light,
  },
};

const BlitzRewardsChestTable = () => {
  return (
    <div style={table.container}>
      <div style={table.wrapper}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Item Name</th>
              <th style={table.headerCell}></th>
              <th style={table.headerCell}>Rarity</th>
              <th style={table.headerCell}>Description</th>
              <th style={table.headerCell}>Type</th>
              <th style={table.headerCell}>Draw Chance</th>
            </tr>
          </thead>
          <tbody>
            {BLITZ_REWARDS_CHEST_ITEMS.map((item) => {
              const rarityColor = getRarityColor(item.rarity);

              return (
                <tr key={item.itemName}>
                  <td style={componentStyles.itemNameCell}>{item.itemName}</td>
                  <td style={componentStyles.itemImageCell}>
                    {item.image ? (
                      <img src={item.image} alt={item.itemName} style={componentStyles.itemImage} />
                    ) : (
                      <span style={{ color: "#666", fontSize: "0.75rem" }}>—</span>
                    )}
                  </td>
                  <td
                    style={{
                      ...componentStyles.rarityCell,
                      borderLeft: `3px solid ${rarityColor}`,
                    }}
                  >
                    {item.rarity}
                  </td>
                  <td style={componentStyles.descriptionCell}>{item.description}</td>
                  <td style={table.cell}>
                    <span style={{ color: colors.text.light }}>
                      {item.type}
                      {item.troopType !== "N/A" ? ` (${item.troopType})` : ""}
                    </span>
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

export default BlitzRewardsChestTable;
