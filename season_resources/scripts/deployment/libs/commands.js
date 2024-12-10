import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { shortString } from "starknet";
import { fileURLToPath } from "url";
import devManifest from "../../../../contracts/manifest_dev.json";
import productionManifest from "../../../../contracts/manifest_mainnet.json";
import {
  declare,
  getContractPath,
  getResourceAddressesFromFile,
  saveResourceAddressesToFile,
  saveResourceAddressesToLanding,
} from "./common.js";
import { getAccount, getNetwork } from "./network.js";
import resourceNames from "./resources.json";

const VITE_PUBLIC_DEV = process.env.VITE_PUBLIC_DEV;
if (VITE_PUBLIC_DEV === undefined) {
  throw new Error("VITE_PUBLIC_DEV environment variable is not defined");
}
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
const LORDS_RESOURCE_ID = 253;

export const deployAllSeasonResourceContract = async () => {
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
  let SEASON_RESOURCE_UPGRADER_CONTRACT = BigInt(process.env.SEASON_RESOURCE_ADMIN);

  const ADDRESSES = {};
  const payload = [];

  for (const resource of Object.values(RESOURCE_NAMES)) {
    const resourceName = resource.name;
    if (resourceName.length > 31) {
      throw new Error("Resource name must be less than or equal to 32 characters");
    }
    const resourceSymbol = resource.symbol;
    if (resourceSymbol.length > 31) {
      throw new Error("Resource symbol must be less than or equal to 32 characters");
    }
    console.log({ resourceName, resourceSymbol });

    let constructorCalldata = [
      SEASON_RESOURCE_DEFAULT_ADMIN,
      SEASON_RESOURCE_UPGRADER_CONTRACT,
      0,
      resourceName,
      resourceName.length,
      0,
      resourceSymbol,
      resourceSymbol.length,
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

  ADDRESSES["LORDS"] = [LORDS_RESOURCE_ID, getSeasonAddresses().lords];

  console.log(ADDRESSES);

  await saveResourceAddressesToFile(ADDRESSES);
  await saveResourceAddressesToLanding(ADDRESSES, process.env.STARKNET_NETWORK.toLowerCase());
  return ADDRESSES;
};

export const grantMinterRoleToAllSeasonResourceContracts = async () => {
  ////// GRANT MINTER ROLE TO ALL SEASON RESOURCE CONTRACTS //////
  console.log(`\n Granting minter role to all season resource contracts ... \n\n`.green);

  let resourceAddresses = await getResourceAddressesFromFile();
  let resourceAddressesArray = Object.values(resourceAddresses)
    .filter(([resourceId, resourceAddress]) => resourceId !== LORDS_RESOURCE_ID)
    .map(([resourceId, resourceAddress]) => resourceAddress);

  console.log(resourceAddressesArray);

  if (!Array.isArray(resourceAddressesArray)) {
    throw new Error("resourceAddressesArray must be an array");
  }

  const account = getAccount();

  //selector!("MINTER_ROLE")
  const MINTER_ROLE = "0x032df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

  const executionArray = [];
  for (const resourceAddress of resourceAddressesArray) {
    executionArray.push({
      contractAddress: resourceAddress,
      entrypoint: "grant_role",
      calldata: [MINTER_ROLE, RESOURCE_BRIDGE_SYSTEMS_CONTRACT],
    });
  }

  const contract = await account.execute(executionArray);

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash})`);
  await account.waitForTransaction(contract.transaction_hash);

  console.log(`Successfully granted minter role to all season resource contracts`.green, "\n\n");
};
