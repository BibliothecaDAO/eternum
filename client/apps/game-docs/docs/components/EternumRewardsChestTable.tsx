import { colors, table } from "./styles";

// Data from the Eternum Rewards Chest (Epoch 1, items 2-11)
const ETERNUM_REWARDS_CHEST_ITEMS = [
  {
    epochItemNumber: 2,
    itemName: "Legacy Guardian",
    rarity: "Legendary",
    description:
      "An impressive and timeless Knight armor set, inspired by the Knight troop models of Eternum Season 1. Part of the First Legacy Set.",
    type: "Troop Armor",
    troopType: "Knight",
    drawChance: 1.41,
    image: "/images/nft-images/0x107050201.png",
  },
  {
    epochItemNumber: 3,
    itemName: "Aura of the Legacy Warrior",
    rarity: "Legendary",
    description: "An aura of golden magnificence for troops of a distinguished Realm. Part of the First Legacy Set.",
    type: "Troop Aura",
    troopType: "N/A",
    drawChance: 1.41,
    image: "/images/nft-images/0x4050301.png",
  },
  {
    epochItemNumber: 4,
    itemName: "Aura of the Legacy Realm",
    rarity: "Epic",
    description: "An aura of golden magnificence for a distinguished Realm. Part of the First Legacy Set.",
    type: "Realm Aura",
    troopType: "N/A",
    drawChance: 4.22,
    image: "/images/nft-images/0x2040401.png",
  },
  {
    epochItemNumber: 5,
    itemName: "Winterhold",
    rarity: "Rare",
    description: "The icy domain of a Lord that has withstood the fiercest of winters. Part of the Winter Lord Set.",
    type: "Realm Skin",
    troopType: "N/A",
    drawChance: 8.45,
    image: "/images/nft-images/0x3030501.png",
  },
  {
    epochItemNumber: 6,
    itemName: "Winter's Palisade",
    rarity: "Rare",
    description: "A ring of razor-sharp ice spikes to deter a Lord's foes. Part of the Winter Lord Set.",
    type: "Realm Aura",
    troopType: "N/A",
    drawChance: 8.45,
    image: "/images/nft-images/0x2030601.png",
  },
  {
    epochItemNumber: 7,
    itemName: "Winter Rider's Battleaxe",
    rarity: "Uncommon",
    description: "A frosty, spiked battleaxe wielded by Winter Paladins. Part of the Winter Lord Set.",
    type: "Troop Primary",
    troopType: "Paladin",
    drawChance: 12.68,
    image: "/images/nft-images/0x305020701.png",
  },
  {
    epochItemNumber: 8,
    itemName: "Winter Rider's Shield",
    rarity: "Uncommon",
    description:
      "An elegant, snowflake-patterned cavalry shield wielded by Winter Paladins. Part of the Winter Lord Set.",
    type: "Troop Secondary",
    troopType: "Paladin",
    drawChance: 12.68,
    image: "/images/nft-images/0x306020801.png",
  },
  {
    epochItemNumber: 9,
    itemName: "Hunter's Bow",
    rarity: "Common",
    description: "A wooden hunting bow.",
    type: "Troop Primary",
    troopType: "Crossbowman",
    drawChance: 16.9,
    image: "/images/nft-images/0x205010901.png",
  },
  {
    epochItemNumber: 10,
    itemName: "Hunter's Quiver",
    rarity: "Common",
    description: "A leather quiver filled with hunting arrows.",
    type: "Troop Secondary",
    troopType: "Crossbowman",
    drawChance: 16.9,
    image: "/images/nft-images/0x206010a01.png",
  },
  {
    epochItemNumber: 11,
    itemName: "Carved Wooden Base",
    rarity: "Common",
    description: "A basic-but-sturdy wooden platform.",
    type: "Troop Base",
    troopType: "N/A",
    drawChance: 16.9,
    image: "/images/nft-images/0x8010b01.png",
  },
];

// Function to get color based on rarity
const getRarityColor = (rarity: string): string => {
  switch (rarity) {
    case "Common":
      return "#8e8e8e"; // grey
    case "Uncommon":
      return "#64cc6c"; // grass green
    case "Rare":
      return "#4ebce1"; // royal blue
    case "Epic":
      return "#b12ecb"; // deep purple
    case "Legendary":
      return "#f1b75a"; // orange gold
    default:
      return "#ffffff"; // white
  }
};

// Component styles
const componentStyles = {
  itemNameCell: {
    ...table.cell,
    color: colors.text.light,
    fontWeight: 500,
  },
  itemImageCell: {
    ...table.cell,
    width: "80px",
    textAlign: "center" as const,
  },
  itemImage: {
    width: "48px",
    height: "48px",
    objectFit: "contain" as const,
    borderRadius: "0.25rem",
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
};

const EternumRewardsChestTable = () => {
  return (
    <div style={table.container}>
      <div style={table.wrapper}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>#</th>
              <th style={table.headerCell}>Item Name</th>
              <th style={table.headerCell}></th>
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
                <tr key={item.itemName}>
                  <td style={table.cell}>{item.epochItemNumber}</td>
                  <td style={componentStyles.itemNameCell}>{item.itemName}</td>
                  <td style={componentStyles.itemImageCell}>
                    <img src={item.image} alt={item.itemName} style={componentStyles.itemImage} />
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
