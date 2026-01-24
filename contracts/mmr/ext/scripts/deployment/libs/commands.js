import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { declare, deploy, getCasualName, getContractPath } from "./common.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_PATH = path.join(__dirname, "..", "..", "..", "..", "target", "release");

export const declareMMRToken = async () => {
  ////////////////////////////////////////////////
  ////////   MMR Token Contract
  /////////////////////////////////////////////////

  // declare contract
  let casualName = "MMR Token";
  let projectName = "mmr";
  let contractName = "MMRToken";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;
  return class_hash;
};

export const deployMMRTokenContract = async (defaultAdmin, gameContract, upgrader) => {
  //////////////////////////////////////////////////////////
  ////////  Deploy MMR Token Contract
  ///////////////////////////////////////////////////////////

  // declare contract
  let casualName = getCasualName("Token");
  let projectName = "mmr";
  let contractName = "MMRToken";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;

  // Constructor: default_admin, game_contract, upgrader
  let constructorCalldata = [BigInt(defaultAdmin), BigInt(gameContract), BigInt(upgrader)];
  let address = await deploy(casualName, class_hash, constructorCalldata);
  await saveContractAddressToCommonFolder("mmrToken", address);
  console.log(
    `\n\n 💾 Saved contract address to common folder (contracts/common/addresses/${process.env.STARKNET_NETWORK}.json)`,
  );
  return address;
};

export const saveContractAddressToCommonFolder = async (contractName, contractAddress) => {
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

    // Convert contractAddress to hex string if it's a bigint
    const addressValue =
      typeof contractAddress === "bigint" ? "0x" + contractAddress.toString(16) : contractAddress;

    // Use regex to replace existing key or add new key
    const keyPattern = new RegExp(`"${contractName}"\\s*:\\s*"[^"]*"`);

    if (existingData.hasOwnProperty(contractName)) {
      // Replace existing key-value pair, preserving indentation
      fileContent = fileContent.replace(keyPattern, `"${contractName}": "${addressValue}"`);
    } else {
      // Add new key-value pair after the opening brace
      const firstLineBreak = fileContent.indexOf("\n");
      if (firstLineBreak > 0) {
        // Insert after opening brace with proper formatting
        fileContent = fileContent.replace(/^(\s*\{\s*\n)/, `$1  "${contractName}": "${addressValue}",\n`);
      } else {
        // Empty or single-line JSON, reformat as multi-line
        fileContent = `{\n  "${contractName}": "${addressValue}"\n}`;
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
