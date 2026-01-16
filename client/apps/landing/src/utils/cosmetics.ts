// Enums for asset types
export enum AssetType {
  TroopArmor = "Troop Armor",
  TroopPrimary = "Troop Primary",
  TroopSecondary = "Troop Secondary",
  TroopAura = "Troop Aura",
  TroopBase = "Troop Base",
  RealmSkin = "Realm Skin",
  RealmAura = "Realm Aura",
  RealmTitle = "Realm Title",
}

export enum AssetRarity {
  Legendary = "legendary",
  Epic = "epic",
  Rare = "rare",
  Uncommon = "uncommon",
  Common = "common",
  Mythic = "mythic",
}

// ChestAsset interface for components that display cosmetic items
export interface ChestAsset {
  id: string;
  attributesRaw: string;
  name: string;
  rarity: AssetRarity;
  type: AssetType;
  troopType?: string;
  set?: string;
  imagePath: string;
}

// Cosmetic names mapping for display purposes
export const COSMETIC_NAMES = [
  { id: "1", name: "Legacy Keep", epoch: "Season 1", attributesRaw: "0x3040101" },
  { id: "2", name: "Legacy Guardian", epoch: "Season 1", attributesRaw: "0x107050201" },
  { id: "3", name: "Aura of the Legacy Warrior", epoch: "Season 1", attributesRaw: "0x4050301" },
  { id: "4", name: "Aura of the Legacy Realm", epoch: "Season 1", attributesRaw: "0x2040401" },
  { id: "5", name: "Winterhold", epoch: "Season 1", attributesRaw: "0x3030501" },
  { id: "6", name: "Winter's Palisade", epoch: "Season 1", attributesRaw: "0x2030601" },
  { id: "7", name: "Winter Rider's Battleaxe", epoch: "Season 1", attributesRaw: "0x305020701" },
  { id: "8", name: "Winter Rider's Shield", epoch: "Season 1", attributesRaw: "0x306020801" },
  { id: "9", name: "Hunter's Bow", epoch: "Season 1", attributesRaw: "0x205010901" },
  { id: "10", name: "Hunter's Quiver", epoch: "Season 1", attributesRaw: "0x206010a01" },
  { id: "11", name: "Carved Wooden Base", epoch: "Season 1", attributesRaw: "0x8010b01" },
  { id: "12", name: "Legacy Hunter", epoch: "Season 1", attributesRaw: "0x207050c01" },
  { id: "13", name: "Overgrown Wreath", epoch: "Season 1", attributesRaw: "0x4040d01" },
  { id: "14", name: "Overgrown Foundation", epoch: "Season 1", attributesRaw: "0x8040e01" },
  { id: "15", name: "Winter Vortex", epoch: "Season 1", attributesRaw: "0x4030f01" },
  { id: "16", name: "Winter's Footing", epoch: "Season 1", attributesRaw: "0x8031001" },
  { id: "17", name: "Overgrown Nest", epoch: "Season 1", attributesRaw: "0x3021101" },
  { id: "18", name: "Winter Trooper's Broadaxe", epoch: "Season 1", attributesRaw: "0x105021201" },
  { id: "19", name: "Winter Trooper's Targe", epoch: "Season 1", attributesRaw: "0x106021301" },
  { id: "20", name: "Witness of the Morning Wars", epoch: "Season 1", attributesRaw: "0x1011401" },
  { id: "21", name: "Light Cavalry Sword", epoch: "Season 1", attributesRaw: "0x305011501" },
  { id: "22", name: "Light Cavalry Shield", epoch: "Season 1", attributesRaw: "0x306011601" },
];

// Base path for local NFT images (stored in /public/images/nft-images/)
const NFT_IMAGES_BASE_PATH = "/images/nft-images";

/**
 * Gets the local image path for a given attributesRaw hex string
 * Images are named after their attributesRaw value (e.g., 0x2030601.png)
 * @param attributesRaw - Hex string like "0x2030601"
 * @returns Local image path
 */
export function getLocalImageFromAttributesRaw(attributesRaw: string): string {
  return `${NFT_IMAGES_BASE_PATH}/${attributesRaw}.png`;
}

// IPFS CID mapping from attributesRaw hex values (fallback source)
export const ATTRIBUTES_TO_IPFS: Record<string, string> = {
  "0x3040101": "bafybeifhxkjcyepmn2io6xs6a25d2yend3mvl2acorptgb3fqzweolmuyy",
  "0x107050201": "bafybeih2qvpsnwqaj36poj7a4smwngda3eovkkio6csrapeb2m24fliona",
  "0x4050301": "bafybeidtfplezzaqil2txiuuukre4ul3drkdgtcrt4l4yhxhc66xaz35mu",
  "0x2040401": "bafybeid4dgwragrxvoqfmwop6ny5staifpkfklo3yn5m42ghypp5n5vb6m",
  "0x3030501": "bafybeielcgftzfjoawycb4gvw6om5ij4xbc5qfvxu4t2yriidqcdslv5cq",
  "0x2030601": "bafybeigyzdu3t5zruttd5s6uhb7rdrbdpzu2kvvfjnp5m2davhp64osim4",
  "0x305020701": "bafybeigvb3vspqr6veqrxq72pb7tdw2lduubgrfrhk4klodf5uq6vezdty",
  "0x306020801": "bafybeibeubgezsjnhewhqjqzhnsdfhzakgolqpvkyisq4ac6rci7iccrze",
  "0x205010901": "bafybeib6agbyv47bymhz3aw2hzt25kqrjnca7rrjhgvtrfvtn62vi4dlrq",
  "0x206010a01": "bafybeif5dts3wmed4hun6n2zoqlenqyybvjvfadhvuaromlmeiavnxhrpi",
  "0x8010b01": "bafybeield35i6xi7vpwuq2qklnrt7blaiugeyqiuvox3km6xdnlrpmvv3q",
  "0x207050c01": "bafybeidh2ft7gd7f5tq57pvkdxhmmmxmamb4djhb6bhzffwkfigkihgjwy",
  "0x4040d01": "bafybeicvo6v37qw56rjzwmirxeo6cnqks6whd3bjbs6rdtxvrb3qtg6fyu",
  "0x8040e01": "bafybeiaskp74zuu7ozoalzwn45asqsiqrvpbj7sg7ue67rb7soqe735tqi",
  "0x4030f01": "bafybeihtlpf5lxj3ayvru7kjknhqhny4shakowvydrpjlfeg4qsvksn2ay",
  "0x8031001": "bafybeihfdqzatf5qhz4vcck7emrd3g6qf2rrtmpprdkc3ixfrwv6fkbjzq",
  "0x3021101": "bafybeiam2lsfkkdj4hn5ubva52lt5spoqh3a6gsdgqf5qfwuh3f4vlmn2m",
  "0x105021201": "bafybeibed6y4o55m43atofexwpw5wi2ta24uvdz7wo2nigefdgkrhxngnq",
  "0x106021301": "bafybeifdrpmlmkyq2ojjk3nksir62impkkeswlhey2u3wxiftr6e5js62a",
  "0x1011401": "bafybeieojvjz4pf5xsyrxybbilbyvensrh235ncyie4mogxgxldacgtkna",
  "0x305011501": "bafybeiak2h7oo6fyiuvsx4u2wlgd47rokikz6wdjac4oy2bxanabpwy6qm",
  "0x306011601": "bafybeifzlfccebwoljp3arwip5bbfe4wt4jqkxkgtascjehzyo6lldjuvu",
};

/**
 * Gets the IPFS CID for a given attributesRaw hex string
 * @param attributesRaw - Hex string like "0x2030601"
 * @returns IPFS CID or undefined if not found
 */
export function getIpfsCidFromAttributesRaw(attributesRaw: string): string | undefined {
  return ATTRIBUTES_TO_IPFS[attributesRaw];
}

/**
 * Gets the full IPFS URL for a given attributesRaw hex string
 * @param attributesRaw - Hex string like "0x2030601"
 * @param gateway - IPFS gateway URL (defaults to dweb.link)
 * @returns Full IPFS URL or undefined if not found
 */
export function getIpfsUrlFromAttributesRaw(
  attributesRaw: string,
  gateway: string = "https://dweb.link/ipfs/",
): string | undefined {
  const cid = getIpfsCidFromAttributesRaw(attributesRaw);
  return cid ? `${gateway}${cid}` : undefined;
}

/**
 * Gets the cosmetic name from attributesRaw
 * @param attributesRaw - Hex string like "0x2030601"
 * @returns Cosmetic name or undefined if not found
 */
export function getCosmeticNameFromAttributesRaw(attributesRaw: string): string | undefined {
  const cosmetic = COSMETIC_NAMES.find((c) => c.attributesRaw === attributesRaw);
  return cosmetic?.name;
}

// Centralized rarity styling configuration
export const RARITY_STYLES = {
  common: {
    text: "text-rarity-common",
    bg: "bg-rarity-common",
    border: "border-rarity-common",
    glow: "border-2 border-rarity-common bg-rarity-common/15 shadow-[0_0_15px_rgba(132,132,132,0.4)]",
    hex: "#848484",
  },
  uncommon: {
    text: "text-rarity-uncommon",
    bg: "bg-rarity-uncommon",
    border: "border-rarity-uncommon",
    glow: "border-2 border-rarity-uncommon bg-rarity-uncommon/20 shadow-[0_0_18px_rgba(108,201,94,0.5)]",
    hex: "#6cc95e",
  },
  rare: {
    text: "text-rarity-rare",
    bg: "bg-rarity-rare",
    border: "border-rarity-rare",
    glow: "border-2 border-rarity-rare bg-rarity-rare/20 shadow-[0_0_22px_rgba(86,200,218,0.6)]",
    hex: "#56c8da",
  },
  epic: {
    text: "text-rarity-epic",
    bg: "bg-rarity-epic",
    border: "border-rarity-epic",
    glow: "border-2 border-rarity-epic bg-rarity-epic/20 shadow-[0_0_28px_rgba(186,55,212,0.6)]",
    hex: "#ba37d4",
  },
  legendary: {
    text: "text-rarity-legendary",
    bg: "bg-rarity-legendary",
    border: "border-rarity-legendary",
    glow: "border-2 border-rarity-legendary bg-rarity-legendary/20 shadow-[0_0_35px_rgba(233,176,98,0.7)]",
    hex: "#e9b062",
  },
  mythic: {
    text: "text-rarity-mythic",
    bg: "bg-rarity-mythic",
    border: "border-rarity-mythic",
    glow: "border-2 border-rarity-mythic bg-rarity-mythic/20 shadow-[0_0_40px_rgba(255,100,150,0.8)]",
    hex: "#ff6496",
  },
} as const;

// Trait type names by ID (0-4)
const TRAIT_TYPES = ["Epoch", "Epoch Item", "Rarity", "Type", "Troop Type"] as const;

// Trait value names by trait type ID and value ID
const TRAIT_VALUES: Record<number, Record<number, string>> = {
  0: { 1: "Season 1" },
  1: {
    1: "1",
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "10",
    11: "11",
    12: "12",
    13: "13",
    14: "14",
    15: "15",
    16: "16",
    17: "17",
    18: "18",
    19: "19",
    20: "20",
    21: "21",
    22: "22",
  },
  2: { 1: "Common", 2: "Uncommon", 3: "Rare", 4: "Epic", 5: "Legendary", 6: "Mythic" },
  3: {
    1: "Realm Title",
    2: "Realm Aura",
    3: "Realm Skin",
    4: "Troop Aura",
    5: "Troop Primary",
    6: "Troop Secondary",
    7: "Troop Armor",
    8: "Troop Base",
  },
  4: { 1: "Knight", 2: "Crossbowman", 3: "Paladin" },
};

export interface TraitAttribute {
  trait_type: string;
  value: string;
}

/**
 * Decodes an attributesRaw hex string into an array of trait attributes.
 *
 * The hex value encodes trait values in bytes, arranged from last to first trait type (right to left).
 * For example: 0x2030601 decodes to:
 *   - Byte 0 (rightmost): 01 -> Epoch value 1 = "Season 1"
 *   - Byte 1: 06 -> Epoch Item value 6 = "6"
 *   - Byte 2: 03 -> Rarity value 3 = "Rare"
 *   - Byte 3: 02 -> Type value 2 = "Realm Aura"
 *
 * @param attributesRaw - Hex string like "0x2030601" or "2030601"
 * @returns Array of trait attributes with trait_type and value
 */
export function getTraitValuesFromAttributesRaw(attributesRaw: string): TraitAttribute[] {
  // Remove "0x" prefix if present and parse as BigInt
  const cleanHex = attributesRaw.startsWith("0x") ? attributesRaw.slice(2) : attributesRaw;
  const rawValue = BigInt("0x" + cleanHex);

  const attributes: TraitAttribute[] = [];

  // Extract each byte from right to left (trait type 0 is rightmost)
  for (let traitTypeId = 0; traitTypeId < TRAIT_TYPES.length; traitTypeId++) {
    // Shift right by (traitTypeId * 8) bits and mask with 0xFF to get the byte
    const valueId = Number((rawValue >> BigInt(traitTypeId * 8)) & BigInt(0xff));

    // Skip if value ID is 0 (no value for this trait type)
    if (valueId === 0) continue;

    const traitType = TRAIT_TYPES[traitTypeId];
    const value = TRAIT_VALUES[traitTypeId]?.[valueId];

    if (value) {
      attributes.push({ trait_type: traitType, value });
    }
  }

  return attributes;
}

// Mapping from type trait value to AssetType enum
const TYPE_VALUE_TO_ASSET_TYPE: Record<string, AssetType> = {
  "Realm Title": AssetType.RealmTitle,
  "Realm Aura": AssetType.RealmAura,
  "Realm Skin": AssetType.RealmSkin,
  "Troop Aura": AssetType.TroopAura,
  "Troop Primary": AssetType.TroopPrimary,
  "Troop Secondary": AssetType.TroopSecondary,
  "Troop Armor": AssetType.TroopArmor,
  "Troop Base": AssetType.TroopBase,
};

// Mapping from rarity trait value to AssetRarity enum
const RARITY_VALUE_TO_ASSET_RARITY: Record<string, AssetRarity> = {
  Common: AssetRarity.Common,
  Uncommon: AssetRarity.Uncommon,
  Rare: AssetRarity.Rare,
  Epic: AssetRarity.Epic,
  Legendary: AssetRarity.Legendary,
  Mythic: AssetRarity.Mythic,
};

/**
 * Creates a ChestAsset from an attributesRaw hex string
 * Uses local image path as primary source, IPFS metadata URL as fallback
 * @param attributesRaw - Hex string like "0x2030601"
 * @returns ChestAsset object or undefined if not found
 */
export function getChestAssetFromAttributesRaw(attributesRaw: string): ChestAsset | undefined {
  const traits = getTraitValuesFromAttributesRaw(attributesRaw);
  const cosmetic = COSMETIC_NAMES.find((c) => c.attributesRaw === attributesRaw);

  if (!cosmetic) return undefined;

  const rarityTrait = traits.find((t) => t.trait_type === "Rarity");
  const typeTrait = traits.find((t) => t.trait_type === "Type");
  const troopTypeTrait = traits.find((t) => t.trait_type === "Troop Type");

  const rarity = rarityTrait ? RARITY_VALUE_TO_ASSET_RARITY[rarityTrait.value] : AssetRarity.Common;
  const type = typeTrait ? TYPE_VALUE_TO_ASSET_TYPE[typeTrait.value] : AssetType.TroopBase;

  // Primary: local image path, Fallback: IPFS metadata URL (will be resolved to image in reveal-stage)
  const localImage = getLocalImageFromAttributesRaw(attributesRaw);
  const ipfsMetadataUrl = getIpfsUrlFromAttributesRaw(attributesRaw, "https://gateway.pinata.cloud/ipfs/");
  const imagePath = localImage || ipfsMetadataUrl || "";

  return {
    id: cosmetic.id,
    attributesRaw,
    name: cosmetic.name,
    rarity,
    type,
    troopType: troopTypeTrait?.value,
    imagePath,
  };
}

/**
 * Get all chest assets as ChestAsset objects
 * @returns Array of all ChestAsset objects
 */
export function getAllChestAssets(): ChestAsset[] {
  return COSMETIC_NAMES.map((cosmetic) => getChestAssetFromAttributesRaw(cosmetic.attributesRaw)).filter(
    (asset): asset is ChestAsset => asset !== undefined,
  );
}

// Rarity order from lowest to highest
const RARITY_ORDER: AssetRarity[] = [
  AssetRarity.Common,
  AssetRarity.Uncommon,
  AssetRarity.Rare,
  AssetRarity.Epic,
  AssetRarity.Legendary,
  AssetRarity.Mythic,
];

/**
 * Get the highest rarity from an array of chest assets.
 * Used to determine chest rarity based on its contents.
 * @param assets - Array of ChestAsset objects
 * @returns The highest AssetRarity found, or Common if empty
 */
export function getHighestRarity(assets: ChestAsset[]): AssetRarity {
  if (assets.length === 0) return AssetRarity.Common;

  let highestIndex = 0;
  for (const asset of assets) {
    const index = RARITY_ORDER.indexOf(asset.rarity);
    if (index > highestIndex) {
      highestIndex = index;
    }
  }

  return RARITY_ORDER[highestIndex];
}
