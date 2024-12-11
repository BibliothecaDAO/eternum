import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import devManifest from "../../../../contracts/manifest_dev.json";
import productionManifest from "../../../../contracts/manifest_prod.json";
import {
  declare,
  getContractPath
} from "./common.js";
import { getAccount, getNetwork } from "./network.js";

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


export const deployAncientFragContract = async () => {
  ///////////////////////////////////////////
  ////////   Season Pass Contract  //////////
  ///////////////////////////////////////////

  // declare contract

  let casualName = "Ancient Fragment Resource";
  let projectName = "season_resources"; // eternum season pass
  let contractName = "SeasonResourceERC20";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;

  // deploy contract
  let SEASON_RESOURCE_DEFAULT_ADMIN = BigInt(process.env.SEASON_RESOURCE_ADMIN);
  let SEASON_RESOURCE_UPGRADER_CONTRACT = BigInt(process.env.SEASON_RESOURCE_ADMIN);

  const payload = [];

  const resourceName = "Ancient Fragment";
  if (resourceName.length > 31) {
    throw new Error("Resource name must be less than or equal to 32 characters");
  }
  const resourceSymbol = "ANCIENT_FRAGMENT";
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
  const account = getAccount();
  console.log(`\n Deploying ${casualName} ... \n\n`.green);
  const contract = await account.execute(account.buildUDCContractPayload(payload));

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash})`);

  let tx = await account.waitForTransaction(contract.transaction_hash);
};

export const grantMinterRoleToAncientFragContracts = async (resourceAddress) => {
  ////// GRANT MINTER ROLE TO Ancient Frag RESOURCE CONTRACTS //////
  console.log(`\n Granting minter role to ancient fragments contract ... \n\n`.green);


  const account = getAccount();

  //selector!("MINTER_ROLE")
  const MINTER_ROLE = "0x032df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

  const executionArray = [
    {
      contractAddress: resourceAddress,
      entrypoint: "grant_role",
      calldata: [MINTER_ROLE, RESOURCE_BRIDGE_SYSTEMS_CONTRACT],
    }
  ];

  const contract = await account.execute(executionArray);

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash})`);
  await account.waitForTransaction(contract.transaction_hash);

  console.log(`Successfully granted minter role to ancient fragments contract`.green, "\n\n");
};

export const revokeMinterRoleFromEarthenshardContracts = async () => {
  console.log(`\n Revoking minter role from earthen shard contract ... \n\n`.green);


  const earthenShardAddress = "0x01cd5b8dd341dc43a97b821bc3cdc524f941142397b787a977fbd14078cf12a4"
  const account = getAccount();

  //selector!("MINTER_ROLE")
  const MINTER_ROLE = "0x032df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

  const executionArray = [];
  executionArray.push({
    contractAddress: earthenShardAddress,
    entrypoint: "revoke_role",
    calldata: [MINTER_ROLE, RESOURCE_BRIDGE_SYSTEMS_CONTRACT],
  });
  const contract = await account.execute(executionArray);

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash})`);
  await account.waitForTransaction(contract.transaction_hash);

  console.log(`Successfully revoked minter role from earthenshards contract`.green, "\n\n");
};
