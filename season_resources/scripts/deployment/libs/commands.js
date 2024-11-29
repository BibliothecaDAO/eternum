import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { shortString } from "starknet";
import { fileURLToPath } from "url";
import devManifest from "../../../../contracts/manifest_dev.json";
import productionManifest from "../../../../contracts/manifest_prod.json";
import { declare, getContractPath, saveResourceAddressesToFile, saveResourceAddressesToLanding } from "./common.js";
import { getAccount, getNetwork } from "./network.js";
import resourceNames from "./resources.json";

const VITE_PUBLIC_DEV = process.env.VITE_PUBLIC_DEV;
const manifest = VITE_PUBLIC_DEV === "true" ? devManifest : productionManifest;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_PATH = path.join(__dirname, "..", "..", "..", "contracts", "target", "release");

export const getJSONFile = (filePath) => {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

export const getSeasonAddressesPath = () => {
  return path.join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "common",
    "addresses",
    `addresses.${process.env.STARKNET_NETWORK}.json`,
  );
};

export const getSeasonAddresses = () => {
  return getJSONFile(getSeasonAddressesPath());
};

export const getContractByName = (name) => {
  const contract = manifest.contracts.find((contract) => contract.tag === name);
  if (!contract) {
    throw new Error(`Contract ${name} not found in manifest`);
  }
  return contract.address;
};

const NAMESPACE = "s0_eternum";
const RESOURCE_BRIDGE_SYSTEMS_CONTRACT = getContractByName(`${NAMESPACE}-resource_bridge_systems`);
const RESOURCE_NAMES = resourceNames;

export const deployAllSeasonResourceContract = async () => {
  const seasonAddresses = getSeasonAddresses();
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

  const ADDRESSES = {};
  const payload = [];
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
      resource.symbol.length,
    ];
    payload.push({
      classHash: class_hash,
      salt: `${resource.name}-${Math.random().toString(36).substring(2, 5)}`,
      unique: true,
      constructorCalldata: constructorCalldata,
    });
  }

  const account = getAccount();
  console.log(`\n Deploying ${casualName} ... \n\n`.green);
  const contract = await account.execute(account.buildUDCContractPayload(payload));

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash})`);

  let tx = await account.waitForTransaction(contract.transaction_hash);
  for (const event of tx.value.events) {
    // ContractDeployed key
    if (event.keys[0] === "0x26b160f10156dea0639bec90696772c640b9706a47f5b8c52ea1abe5858b34d") {
      const resourceName = shortString.decodeShortString(event.data[event.data.length - 6]);
      const resourceAddress = event.data[0];
      const resourceId = Object.values(RESOURCE_NAMES).find((resource) => resource.name === resourceName)?.id;
      ADDRESSES[resourceName.toUpperCase().replace(/\s+/g, "")] = [resourceId, resourceAddress];
    }
  }

  ADDRESSES["LORDS"] = [253, getSeasonAddresses().lords];

  console.log(ADDRESSES);

  await saveResourceAddressesToFile(ADDRESSES);
  await saveResourceAddressesToLanding(ADDRESSES, process.env.STARKNET_NETWORK.toLowerCase());
  return ADDRESSES;
};
