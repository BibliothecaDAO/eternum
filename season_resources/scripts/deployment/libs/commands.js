import "dotenv/config";
import * as path from "path";
import { fileURLToPath } from "url";
import devManifest from "../../../../contracts/manifest_dev.json";
import productionManifest from "../../../../contracts/manifest_prod.json";
import { declare, deploy, getContractPath, saveResourceAddressesToFile, saveResourceAddressesToLandingFolder } from "./common.js";

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
  // "LORDS": {
  //   "name": "Lords",
  //   "symbol": "LORDS"
  // },
  "STONE": {
    "name": "Stone",
    "symbol": "STONE"
  },
  "COAL": {
    "name": "Coal",
    "symbol": "COAL"
  },
  "WOOD": {
    "name": "Wood",
    "symbol": "WOOD"
  },
  "COPPER": {
    "name": "Copper",
    "symbol": "COPPER"
  },
  "IRONWOOD": {
    "name": "Ironwood",
    "symbol": "IRONWOOD"
  },
  "OBSIDIAN": {
    "name": "Obsidian",
    "symbol": "OBSIDIAN"
  },
  "GOLD": {
    "name": "Gold",
    "symbol": "GOLD"
  },
  "SILVER": {
    "name": "Silver",
    "symbol": "SILVER"
  },
  "MITHRAL": {
    "name": "Mithral",
    "symbol": "MITHRAL"
  },
  "ALCHEMICAL_SILVER": {
    "name": "Alchemical Silver",
    "symbol": "ALCHEMICAL_SILVER"
  },
  "COLD_IRON": {
    "name": "Cold Iron",
    "symbol": "COLD_IRON"
  },
  "DEEP_CRYSTAL": {
    "name": "Deep Crystal",
    "symbol": "DEEP_CRYSTAL"
  },
  "RUBY": {
    "name": "Ruby",
    "symbol": "RUBY"
  },
  "DIAMONDS": {
    "name": "Diamonds",
    "symbol": "DIAMONDS"
  },
  "HARTWOOD": {
    "name": "Hartwood",
    "symbol": "HARTWOOD"
  },
  "IGNIUM": {
    "name": "Ignium",
    "symbol": "IGNIUM"
  },
  "TWILIGHT_QUARTZ": {
    "name": "Twilight Quartz",
    "symbol": "TWILIGHT_QUARTZ"
  },
  "TRUE_ICE": {
    "name": "True Ice",
    "symbol": "TRUE_ICE"
  },
  "ADAMANTINE": {
    "name": "Adamantine",
    "symbol": "ADAMANTINE"
  },
  "SAPPHIRE": {
    "name": "Sapphire",
    "symbol": "SAPPHIRE"
  },
  "ETHEREAL_SILICA": {
    "name": "Ethereal Silica",
    "symbol": "ETHEREAL_SILICA"
  },
  "DRAGONHIDE": {
    "name": "Dragonhide",
    "symbol": "DRAGONHIDE"
  },
  "DEMONHIDE": {
    "name": "Demonhide",
    "symbol": "DEMONHIDE"
  },
  "EARTHEN_SHARD": {
    "name": "Earthen Shard",
    "symbol": "EARTHEN_SHARD"
  },
  "DONKEY": {
    "name": "Donkey",
    "symbol": "DONKEY"
  },
  "KNIGHT": {
    "name": "Knight",
    "symbol": "KNIGHT"
  },
  "CROSSBOWMAN": {
    "name": "Crossbowman",
    "symbol": "CROSSBOWMAN"
  },
  "PALADIN": {
    "name": "Paladin",
    "symbol": "PALADIN"
  },

  "WHEAT": {
    "name": "Wheat",
    "symbol": "WHEAT"
  },
  "FISH": {
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
    ADDRESSES[resource.name.toUpperCase().replace(/\s+/g, '')] = address;
  }

  await saveResourceAddressesToFile(ADDRESSES);
  await saveResourceAddressesToLandingFolder(ADDRESSES);
  return ADDRESSES;
};
