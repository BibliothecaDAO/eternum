import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { shortString } from "starknet";
import { fileURLToPath } from "url";
import { declare, getContractPath, getResourceAddressesFromFile, saveResourceAddressesToFile } from "./common.js";
import { getAccount, getNetwork } from "./network.js";
import resourceNames from "./resources.json";
const gameManifest = await import(`../../../../../game/manifest_${process.env.STARKNET_NETWORK}.json`, {
  assert: { type: "json" },
}).then((module) => module.default);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_PATH = path.join(__dirname, "..", "..", "..", "..", "target", "release");

const colors = {
  title: "\x1b[1m\x1b[38;5;105m", // Bold Purple
  success: "\x1b[38;5;83m", // Bright Green
  info: "\x1b[38;5;39m", // Bright Blue
  hash: "\x1b[38;5;214m", // Orange
  address: "\x1b[38;5;147m", // Light Purple
  reset: "\x1b[0m", // Reset
};

export const getJSONFile = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      // If file doesn't exist, create it with empty object
      fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
      return {};
    }
    throw error;
  }
};

export const getSeasonAddressesPath = () => {
  const addressPath = path.join(__dirname, "..", "..", "..", "..", "..", "common", "addresses");
  return path.join(addressPath, `${process.env.STARKNET_NETWORK}.json`);
};

export const getSeasonAddresses = () => {
  console.log(getSeasonAddressesPath());
  return getJSONFile(getSeasonAddressesPath());
};

export const getContractByName = (name) => {
  const contract = gameManifest.contracts.find((contract) => contract.tag === name);
  if (!contract) {
    throw new Error(`Contract ${name} not found in manifest`);
  }
  return contract.address;
};

const NAMESPACE = "s1_eternum";
const RESOURCE_BRIDGE_SYSTEMS_CONTRACT = getContractByName(`${NAMESPACE}-resource_bridge_systems`);
const RESOURCE_NAMES = resourceNames;
const LORDS_RESOURCE_ID = 37;

const displayResourceTable = (addresses) => {
  const TABLE_WIDTH = {
    name: 15,
    id: 7, // Increased to allow for padding
    address: 42,
  };

  // Top border with title
  console.log(`${colors.title}📍 Deployed Resource Addresses${colors.reset}`);

  // Header row with proper spacing
  console.log(
    `${colors.title}╔══════════════════╤════════╤════════════════════════════════════════════════════════════════════╗${colors.reset}`,
  );
  console.log(
    `${colors.title}║ Resource Name    │   ID   │  Address                                                           ║${colors.reset}`,
  );
  console.log(
    `${colors.title}╠══════════════════╪════════╪════════════════════════════════════════════════════════════════════╣${colors.reset}`,
  );

  // Content rows with proper alignment
  Object.entries(addresses).forEach(([name, [id, address]], index, array) => {
    // Center-align the ID column
    const paddedId = String(id)
      .padStart(Math.floor((TABLE_WIDTH.id + String(id).length) / 2))
      .padEnd(TABLE_WIDTH.id);

    console.log(
      `${colors.title}║${colors.reset}${colors.info}${name.padEnd(TABLE_WIDTH.name + 2)}${colors.reset}${colors.title} │${colors.reset} ${colors.address}${paddedId}${colors.reset}${colors.title}│${colors.reset} ${colors.address}${address.padEnd(TABLE_WIDTH.address)}${colors.reset}${colors.title}  ║${colors.reset}`,
    );

    // Separator between rows (except last)
    if (index !== array.length - 1) {
      console.log(
        `${colors.title}╟────────────────────────────────────────────────────────────────────────────────────────────────╢${colors.reset}`,
      );
    }
  });

  // Bottom border
  console.log(
    `${colors.title}╚════════════════════════════════════════════════════════════════════════════════════════════════╝${colors.reset}`,
  );
};
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
  let SEASON_RESOURCE_UPGRADER = BigInt(process.env.SEASON_RESOURCE_ADMIN);

  console.log(`\n`);
  console.log(
    `${colors.info}╔════════════════════════════════════════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(
    `${colors.info}  Default Admin${colors.reset}    : ${colors.address}0x${SEASON_RESOURCE_DEFAULT_ADMIN.toString(16)}${colors.reset}`,
  );
  console.log(
    `${colors.info}  Upgrader Admin${colors.reset}   : ${colors.address}0x${SEASON_RESOURCE_UPGRADER.toString(16)}${colors.reset}`,
  );
  console.log(
    `${colors.info}═════════════════════════════════════════════════════════════════════════════════════════╝${colors.reset}`,
  );
  console.log(`\n`);

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

    let constructorCalldata = [
      SEASON_RESOURCE_DEFAULT_ADMIN,
      SEASON_RESOURCE_UPGRADER,
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
  console.log(`\n${colors.title}📦 Deploying ${casualName}...${colors.reset}\n`);
  const contract = await account.execute(account.buildUDCContractPayload(payload));

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log(
    `${colors.info}Transaction Hash${colors.reset} : ${colors.hash}${network.explorer_url}/tx/${contract.transaction_hash}${colors.reset}\n`,
  );

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

  displayResourceTable(ADDRESSES);
  console.log(`\n${colors.success}✨ Deployment Complete!${colors.reset}\n`);

  await saveResourceAddressesToFile(ADDRESSES);
  return ADDRESSES;
};

export const grantMinterRoleToInGameBridge = async () => {
  ////// GRANT MINTER ROLE TO ALL SEASON RESOURCE CONTRACTS //////
  console.log(`\n Granting minter role to the in-game bridge system for  all season resource contracts... \n\n`.green);

  let resourceAddresses = await getResourceAddressesFromFile();
  let resourceAddressesArray = Object.values(resourceAddresses)
    .filter(([resourceId, resourceAddress]) => resourceId !== LORDS_RESOURCE_ID)
    .map(([resourceId, resourceAddress]) => resourceAddress);

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

export const revokeMinterRoleFromAllSeasonResourceContracts = async () => {
  console.log(`\n${colors.title}🔒 Revoking Minter Role from Season Resource Contracts${colors.reset}\n`);

  console.log(
    `${colors.info}╔════════════════════════════════════════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(
    `${colors.info}  In-Game Bridge System${colors.reset} : ${colors.address}${RESOURCE_BRIDGE_SYSTEMS_CONTRACT}${colors.reset}`,
  );
  console.log(
    `${colors.info}═════════════════════════════════════════════════════════════════════════════════════════╝${colors.reset}`,
  );
  console.log(`\n`);

  let resourceAddresses = await getResourceAddressesFromFile();
  let resourceAddressesArray = Object.values(resourceAddresses)
    .filter(([resourceId, resourceAddress]) => resourceId !== LORDS_RESOURCE_ID)
    .map(([resourceId, resourceAddress]) => resourceAddress);

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
      entrypoint: "revoke_role",
      calldata: [MINTER_ROLE, RESOURCE_BRIDGE_SYSTEMS_CONTRACT],
    });
  }

  const contract = await account.execute(executionArray);

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log(
    `${colors.info}Transaction Hash${colors.reset} : ${colors.hash}${network.explorer_url}/tx/${contract.transaction_hash}${colors.reset}\n`,
  );
  await account.waitForTransaction(contract.transaction_hash);

  console.log(
    `${colors.success}✨ Successfully revoked minter role from all season resource contracts!${colors.reset}\n`,
  );
};
