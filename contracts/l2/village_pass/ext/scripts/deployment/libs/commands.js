import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { declare, deploy, getContractPath } from "./common.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_PATH = path.join(__dirname, "..", "..", "..", "..", "target", "release");

export const deployVillagePassContract = async () => {
  ///////////////////////////////////////////
  ///////   Village Pass Contract  //////////
  ///////////////////////////////////////////

  const minter = requiredAddress("VILLAGE_PASS_MINTER");
  const gameDistributor = requiredAddress("VILLAGE_PASS_GAME_DISTRIBUTOR");
  const distributor = requiredAddress("VILLAGE_PASS_DISTRIBUTOR");

  // declare contract
  let casualName = "village_pass";
  let projectName = "evp"; // eternum season pass
  let contractName = "EternumVillagePass";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;

  let VILLAGE_PASS_ADMIN = BigInt(process.env.SEASON_PASS_ADMIN);
  let VILLAGE_PASS_UPGRADER = VILLAGE_PASS_ADMIN;
  const distributors = [...new Set([gameDistributor, distributor])];

  let constructorCalldata = [VILLAGE_PASS_ADMIN, VILLAGE_PASS_UPGRADER, minter, distributors.length, ...distributors];

  let address = await deploy(casualName, class_hash, constructorCalldata);
  return address;
};

const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
export const saveVillagePassAddressToCommonFolder = async (villagePassAddress) => {
  try {
    const folderPath = path.join("..", "..", "..", "..", "..", "common", "addresses");
    await mkdirAsync(folderPath, { recursive: true });
    const network = process.env.STARKNET_NETWORK;
    const fileName = path.join(folderPath, `${network}.json`);

    // Try to read existing data
    let existingData = {};
    try {
      const fileContent = await fs.promises.readFile(fileName, "utf8");
      existingData = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist or is invalid JSON, start with empty object
    }

    // Merge new addresses with existing data
    const updatedData = {
      ...existingData,
      villagePass: villagePassAddress,
    };

    const jsonString = JSON.stringify(
      updatedData,
      (key, value) => {
        if (typeof value === "bigint") {
          return "0x" + value.toString(16);
        }
        return value;
      },
      2,
    );

    await writeFileAsync(fileName, jsonString);
    console.log(`"${fileName}" has been saved or overwritten`);
  } catch (err) {
    console.error("Error writing file", err);
    throw err;
  }
};

const requiredAddress = (name) => {
  const value = process.env[name];
  if (!value || !/^0x[0-9a-f]+$/i.test(value) || BigInt(value) === 0n) {
    throw new Error(`${name} must be a non-zero contract address`);
  }
  return BigInt(value);
};
