import "dotenv/config";
import * as path from "path";
import { fileURLToPath } from "url";
import devManifest from "../../../../contracts/manifest_dev.json";
import productionManifest from "../../../../contracts/manifest_prod.json";
import { declare, deploy, getContractPath, saveResourceAddressesToFile, saveResourceAddressesToLanding } from "./common.js";

const VITE_PUBLIC_DEV = process.env.VITE_PUBLIC_DEV;
const manifest = VITE_PUBLIC_DEV === "true" ? devManifest : productionManifest;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_PATH = path.join(__dirname, "..", "..", "..", "contracts", "target", "release");

export const getContractByName = (name) => {
  const contract = manifest.contracts.find((contract) => contract.tag === name);
  if (!contract) {
    throw new Error(`Contract ${name} not found in manifest`);
  }
  return contract.address;
};

const NAMESPACE = "eternum";
const RESOURCE_BRIDGE_SYSTEMS_CONTRACT = getContractByName(`${NAMESPACE}-resource_bridge_systems`);
const RESOURCE_NAMES = {
  "STONE": {
    "id": 1,
    "name": "Stone",
    "symbol": "STONE"
  },
  "COAL": {
    "id": 2,
    "name": "Coal",
    "symbol": "COAL"
  },
  "WOOD": {
    "id": 3,
    "name": "Wood",
    "symbol": "WOOD"
  },
  "COPPER": {
    "id": 4,
    "name": "Copper",
    "symbol": "COPPER"
  },
  "IRONWOOD": {
    "id": 5,
    "name": "Ironwood",
    "symbol": "IRONWOOD"
  },
  "OBSIDIAN": {
    "id": 6,
    "name": "Obsidian",
    "symbol": "OBSIDIAN"
  },
  "GOLD": {
    "id": 7,
    "name": "Gold",
    "symbol": "GOLD"
  },
  "SILVER": {
    "id": 8,
    "name": "Silver",
    "symbol": "SILVER"
  },
  "MITHRAL": {
    "id": 9,
    "name": "Mithral",
    "symbol": "MITHRAL"
  },
  "ALCHEMICAL_SILVER": {
    "id": 10,
    "name": "Alchemical Silver",
    "symbol": "ALCHEMICAL_SILVER"
  },
  "COLD_IRON": {
    "id": 11,
    "name": "Cold Iron",
    "symbol": "COLD_IRON"
  },
  "DEEP_CRYSTAL": {
    "id": 12,
    "name": "Deep Crystal",
    "symbol": "DEEP_CRYSTAL"
  },
  "RUBY": {
    "id": 13,
    "name": "Ruby",
    "symbol": "RUBY"
  },
  "DIAMONDS": {
    "id": 14,
    "name": "Diamonds",
    "symbol": "DIAMONDS"
  },
  "HARTWOOD": {
    "id": 15,
    "name": "Hartwood",
    "symbol": "HARTWOOD"
  },
  "IGNIUM": {
    "id": 16,
    "name": "Ignium",
    "symbol": "IGNIUM"
  },
  "TWILIGHT_QUARTZ": {
    "id": 17,
    "name": "Twilight Quartz",
    "symbol": "TWILIGHT_QUARTZ"
  },
  "TRUE_ICE": {
    "id": 18,
    "name": "True Ice",
    "symbol": "TRUE_ICE"
  },
  "ADAMANTINE": {
    "id": 19,
    "name": "Adamantine",
    "symbol": "ADAMANTINE"
  },
  "SAPPHIRE": {
    "id": 20,
    "name": "Sapphire",
    "symbol": "SAPPHIRE"
  },
  "ETHEREAL_SILICA": {
    "id": 21,
    "name": "Ethereal Silica",
    "symbol": "ETHEREAL_SILICA"
  },
  "DRAGONHIDE": {
    "id": 22,
    "name": "Dragonhide",
    "symbol": "DRAGONHIDE"
  },
  "DEMONHIDE": {
    "id": 28,
    "name": "Demonhide",
    "symbol": "DEMONHIDE"
  },
  "EARTHEN_SHARD": {
    "id": 29,
    "name": "Earthen Shard",
    "symbol": "EARTHEN_SHARD"
  },
  "DONKEY": {
    "id": 249,
    "name": "Donkey",
    "symbol": "DONKEY"
  },
  "KNIGHT": {
    "id": 250,
    "name": "Knight",
    "symbol": "KNIGHT"
  },
  "CROSSBOWMAN": {
    "id": 251,
    "name": "Crossbowman",
    "symbol": "CROSSBOWMAN"
  },
  "PALADIN": {
    "id": 252,
    "name": "Paladin",
    "symbol": "PALADIN"
  },
  "WHEAT": {
    "id": 254,
    "name": "Wheat",
    "symbol": "WHEAT"
  },
  "FISH": {
    "id": 255,
    "name": "Fish",
    "symbol": "FISH"
  }
}
export const deploySeasonResourceContract = async () => {
  ///////////////////////////////////////////
  ////////   Season Pass Contract  //////////
  ///////////////////////////////////////////

  // declare contract

  let casualName = "Season Resources";
  let projectName = "season_resources"; // eternum season pass
  let contractName = "SeasonResourceERC20";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;

  // deploy contract
  let SEASON_RESOURCE_DEFAULT_ADMIN = BigInt(process.env.SEASON_RESOURCE_ADMIN);
  let SEASON_RESOURCE_MINTER_CONTRACT = BigInt(RESOURCE_BRIDGE_SYSTEMS_CONTRACT);
  let SEASON_RESOURCE_UPGRADER_CONTRACT = BigInt(process.env.SEASON_RESOURCE_ADMIN);

  const ADDRESSES = {}
  for (const resource of Object.values(RESOURCE_NAMES)) { 
    let constructorCalldata = [
          SEASON_RESOURCE_DEFAULT_ADMIN,
          SEASON_RESOURCE_MINTER_CONTRACT,
          SEASON_RESOURCE_UPGRADER_CONTRACT,
          0,
          resource.name,
          resource.name.length,
          0,
          resource.symbol,
          resource.symbol.length
    ];
    let address = await deploy(`${resource.name.toLowerCase()} resource`, class_hash, constructorCalldata);
    console.log(`\n${resource.name.toUpperCase()} deployed at ${address}\n`);
    ADDRESSES[resource.name.toUpperCase().replace(/\s+/g, '')] = [resource.id, address];
  }

  ADDRESSES["LORDS"] = [253, process.env.VITE_LORDS_ADDRESS];
  await saveResourceAddressesToFile(ADDRESSES);
  await saveResourceAddressesToLanding(ADDRESSES, process.env.STARKNET_NETWORK.toLowerCase());
  return ADDRESSES;
};
