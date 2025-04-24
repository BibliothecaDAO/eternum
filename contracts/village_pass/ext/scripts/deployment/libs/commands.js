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

  // declare contract
  let casualName = "village_pass";
  let projectName = "evp"; // eternum season pass
  let contractName = "EternumVillagePass";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;

  let VILLAGE_PASS_ADMIN = BigInt(process.env.SEASON_PASS_ADMIN);
  let VILLAGE_PASS_UPGRADER = VILLAGE_PASS_ADMIN;
  let VILLAGE_PASS_MINTER = await getContractByNameFromManifest("realm_systems");
  let VILLAGE_PASS_DISTRIBUTORS = [
    await getContractByNameFromManifest("village_systems"),
    BigInt(process.env.VILLAGE_PASS_DISTRIBUTOR),
  ];

  let constructorCalldata = [
    VILLAGE_PASS_ADMIN,
    VILLAGE_PASS_UPGRADER,
    VILLAGE_PASS_MINTER,
    VILLAGE_PASS_DISTRIBUTORS.length,
    ...VILLAGE_PASS_DISTRIBUTORS,
  ];

  let address = await deploy(casualName, class_hash, constructorCalldata);
  return address;
};

const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
export const saveVillagePassAddressToCommonFolder = async (villagePassAddress) => {
  try {
    const folderPath = path.join("..", "..", "..", "..", "common", "addresses");
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

export const getContractByNameFromManifest = async (systemName) => {
  const network = process.env.STARKNET_NETWORK;
  const folderPath = path.join("..", "..", "..", "..", "game");
  const fileName = path.join(folderPath, `manifest_${network}.json`);

  // Read file content
  const fileContent = await fs.promises.readFile(fileName, "utf8");
  const manifest = JSON.parse(fileContent);

  const contractSystemName = `${process.env.ETERNUM_CONTRACTS_NAMESPACE}-${systemName}`;
  const contract = manifest.contracts.find((contract) => contract.tag === contractSystemName);
  if (!contract) {
    throw new Error(`Contract ${contractSystemName} not found in manifest`);
  }
  return contract.address;
};
