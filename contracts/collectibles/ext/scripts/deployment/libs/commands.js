import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { byteArray } from "starknet";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { declare, deploy, getCasualName, getContractPath } from "./common.js";
import { getAccount, getNetwork } from "./network.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_PATH = path.join(__dirname, "..", "..", "..", "..", "target", "release");

export const declareCollectibleTimelockMaker = async () => {
  ////////////////////////////////////////////////
  ////////   Collectible Timelock Maker Contract
  /////////////////////////////////////////////////

  // declare contract
  let casualName = "Collectibles: Timelock Maker";
  let projectName = "collectibles";
  let contractName = "CollectibleTimeLockMaker";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;
  return class_hash;
};

export const deployTimelockMakerContract = async () => {
  //////////////////////////////////////////////////////////
  ////////  Deploy Collectible Timelock Maker Contract
  ///////////////////////////////////////////////////////////

  // declare contract
  let casualName = getCasualName("Timelock Maker");
  let projectName = "collectibles";
  let contractName = "CollectibleTimeLockMaker";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;

  let constructorCalldata = [];
  let address = await deploy(casualName, class_hash, constructorCalldata);
  await saveContractAddressToCommonFolder(casualName, address);
  console.log(
    `\n\n 💾 Saved contract address to common folder (contracts/common/collectibles/addresses/${process.env.STARKNET_NETWORK}.json)`,
  );
  return address;
};

export const declareRealmsCollectibleContract = async () => {
  ///////////////////////////////////////////
  ////////   Collectible Contract  //////////
  ///////////////////////////////////////////

  // declare contract
  let casualName = "collectibles";
  let projectName = "collectibles";
  let contractName = "RealmsCollectible";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;
  return class_hash;
};

export const deployRealmsCollectibleContract = async (
  erc721Name,
  erc721Symbol,
  description,
  defaultAdmin,
  minter,
  upgrader,
  locker,
  metadataUpdater,
  defaultRoyaltyReceiver,
  feeNumerator,
) => {
  ///////////////////////////////////////////
  ////////   Collectible Contract  //////////
  ///////////////////////////////////////////

  // declare contract
  let casualName = getCasualName(erc721Name);
  let projectName = "collectibles";
  let contractName = "RealmsCollectible";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;

  // deploy contract
  let COLLECTIBLE_ERC721_NAME = byteArray.byteArrayFromString(erc721Name);
  let COLLECTIBLE_ERC721_SYMBOL = byteArray.byteArrayFromString(erc721Symbol);
  let COLLECTIBLE_ERC721_BASE_URI = byteArray.byteArrayFromString("");
  let COLLECTIBLE_DESCRIPTION = byteArray.byteArrayFromString(description);
  let COLLECTIBLE_DEFAULT_ADMIN = BigInt(defaultAdmin);
  let COLLECTIBLE_MINTER = BigInt(minter);
  let COLLECTIBLE_UPGRADER = BigInt(upgrader);
  let COLLECTIBLE_LOCKER = BigInt(locker);
  let COLLECTIBLE_METADATA_UPDATER = BigInt(metadataUpdater);
  let COLLECTIBLE_DEFAULT_ROYALTY_RECEIVER = BigInt(defaultRoyaltyReceiver);
  let COLLECTIBLE_FEE_NUMERATOR = BigInt(feeNumerator);

  let constructorCalldata = [
    COLLECTIBLE_ERC721_NAME,
    COLLECTIBLE_ERC721_SYMBOL,
    COLLECTIBLE_ERC721_BASE_URI,
    COLLECTIBLE_DESCRIPTION,
    COLLECTIBLE_DEFAULT_ADMIN,
    COLLECTIBLE_MINTER,
    COLLECTIBLE_UPGRADER,
    COLLECTIBLE_LOCKER,
    COLLECTIBLE_METADATA_UPDATER,
    COLLECTIBLE_DEFAULT_ROYALTY_RECEIVER,
    COLLECTIBLE_FEE_NUMERATOR,
  ];
  let address = await deploy(casualName, class_hash, constructorCalldata);
  await saveContractAddressToCommonFolder(casualName, address);
  console.log(
    `\n\n 💾 Saved contract address to common folder (contracts/common/collectibles/addresses/${process.env.STARKNET_NETWORK}.json)`,
  );
  return address;
};

export const setDefaultIPFSCID = async (collectibleAddress, calldata) => {
  ///////////////////////////////////////////
  // Set Default IPFS CID in Collectible Contract
  ///////////////////////////////////////////

  const account = getAccount();
  console.log(`\n Setting Default IPFS CID in Collectible Contract ... \n\n`.green);

  const contract = await account.execute([
    {
      contractAddress: collectibleAddress,
      entrypoint: "set_default_ipfs_cid",
      calldata: calldata,
    },
  ]);

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash})`);
  await account.waitForTransaction(contract.transaction_hash);

  console.log(`Successfully set default IPFS CID in collectible contract ${collectibleAddress}`.green, "\n\n");
};

export const setAttrsRawToIPFSCID = async (collectibleAddress, calldataArray) => {
  ///////////////////////////////////////////
  // Set Attrs Raw to IPFS CID in Collectible Contract
  ///////////////////////////////////////////

  const account = getAccount();
  console.log(`\n Setting Attrs Raw to IPFS CID in Collectible Contract ... \n\n`.green);

  const calldatas = calldataArray.map((calldata) => ({
    contractAddress: collectibleAddress,
    entrypoint: "set_attrs_raw_to_ipfs_cid",
    calldata: calldata,
  }));

  const contract = await account.execute(calldatas);

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash})`);
  await account.waitForTransaction(contract.transaction_hash);

  console.log(`Successfully set attrs raw in collectible contract ${collectibleAddress}`.green, "\n\n");
};

export const setTraitTypeName = async (collectibleAddress, calldataArray) => {
  ///////////////////////////////////////////
  // Set Trait Type Name in Collectible Contract
  ///////////////////////////////////////////

  const account = getAccount();
  console.log(`\n Setting Trait Type Name in Collectible Contract ... \n\n`.green);

  const calldatas = calldataArray.map((calldata) => ({
    contractAddress: collectibleAddress,
    entrypoint: "set_trait_type_name",
    calldata: calldata,
  }));

  const contract = await account.execute(calldatas);

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash})`);
  await account.waitForTransaction(contract.transaction_hash);

  console.log(`Successfully set trait type name in collectible contract ${collectibleAddress}`.green, "\n\n");
};

export const setMintCollectible = async (collectibleAddress, calldataArray) => {
  ///////////////////////////////////////////
  // Mint Collectible in Collectible Contract
  ///////////////////////////////////////////

  const account = getAccount();
  console.log(`\n Minting Collectible in Collectible Contract ... \n\n`.green);
  calldataArray.forEach((calldata) => console.log(calldata));

  const calldatas = calldataArray.map((calldata) => ({
    contractAddress: collectibleAddress,
    entrypoint: "safe_mint_many",
    calldata: calldata,
  }));

  const contract = await account.execute(calldatas);

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash})`);
  await account.waitForTransaction(contract.transaction_hash);

  console.log(`Successfully minted collectible in collectible contract ${collectibleAddress}`.green, "\n\n");
};

export const setTraitValueName = async (collectibleAddress, calldataArray) => {
  ///////////////////////////////////////////
  // Set Trait Value Name in Collectible Contract
  ///////////////////////////////////////////

  const account = getAccount();
  console.log(`\n Setting Trait Value Name in Collectible Contract ... \n\n`.green);

  const calldatas = calldataArray.map((calldata) => ({
    contractAddress: collectibleAddress,
    entrypoint: "set_trait_value_name",
    calldata: calldata,
  }));

  const contract = await account.execute(calldatas);

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash})`);
  await account.waitForTransaction(contract.transaction_hash);

  console.log(`Successfully set trait value name in collectible contract ${collectibleAddress}`.green, "\n\n");
};

export const createOrUpdateLockState = async (collectibleAddress, lockId, unlockAtTimestamp) => {
  ///////////////////////////////////////////
  // Create Lock in Collectible Contract
  ///////////////////////////////////////////

  const account = getAccount();
  console.log(
    `\n Creating Lock ID ${lockId} to be unlocked at ${new Date(unlockAtTimestamp * 1000).toLocaleString()} in Collectible Contract ... \n\n`
      .green,
  );

  const contract = await account.execute([
    {
      contractAddress: collectibleAddress,
      entrypoint: "lock_state_update",
      calldata: [lockId, unlockAtTimestamp],
    },
  ]);

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash})`);
  await account.waitForTransaction(contract.transaction_hash);

  console.log(`Successfully created lock in collectible contract ${collectibleAddress}`.green, "\n\n");
};

export const saveContractAddressToCommonFolder = async (erc721Name, collectibleAddress) => {
  try {
    const folderPath = path.join("..", "..", "..", "..", "common", "addresses");

    const mkdirAsync = promisify(fs.mkdir);
    await mkdirAsync(folderPath, { recursive: true });
    const network = process.env.STARKNET_NETWORK;
    const fileName = path.join(folderPath, `${network}.json`);

    // Read existing file content as text to preserve formatting
    let fileContent = "";
    try {
      fileContent = await fs.promises.readFile(fileName, "utf8");
    } catch (error) {
      // File doesn't exist, start with empty object
      fileContent = "{}";
    }

    // Parse to check if key exists
    const existingData = JSON.parse(fileContent);

    // Convert collectibleAddress to hex string if it's a bigint
    const addressValue =
      typeof collectibleAddress === "bigint" ? "0x" + collectibleAddress.toString(16) : collectibleAddress;

    // Use regex to replace existing key or add new key
    const keyPattern = new RegExp(`"${erc721Name}"\\s*:\\s*"[^"]*"`);

    if (existingData.hasOwnProperty(erc721Name)) {
      // Replace existing key-value pair, preserving indentation
      fileContent = fileContent.replace(keyPattern, `"${erc721Name}": "${addressValue}"`);
    } else {
      // Add new key-value pair after the opening brace
      const firstLineBreak = fileContent.indexOf("\n");
      if (firstLineBreak > 0) {
        // Insert after opening brace with proper formatting
        fileContent = fileContent.replace(/^(\s*\{\s*\n)/, `$1  "${erc721Name}": "${addressValue}",\n`);
      } else {
        // Empty or single-line JSON, reformat as multi-line
        fileContent = `{\n  "${erc721Name}": "${addressValue}"\n}`;
      }
    }

    const writeFileAsync = promisify(fs.writeFile);
    await writeFileAsync(fileName, fileContent);
    console.log(`"${fileName}" has been saved or overwritten`);
  } catch (err) {
    console.error("Error writing file", err);
    throw err;
  }
};

export const getContractAddressFromCommonFolder = async (key) => {
  const folderPath = path.join("..", "..", "..", "..", "common", "addresses");
  const network = process.env.STARKNET_NETWORK;
  if (!network) {
    throw new Error("STARKNET_NETWORK env variable is not set");
  }

  const fileName = path.join(folderPath, `${network}.json`);
  try {
    const fileContent = await fs.promises.readFile(fileName, "utf8");
    if (!fileContent.trim()) {
      return null;
    }

    const data = JSON.parse(fileContent);
    return data[key] ?? null;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};
