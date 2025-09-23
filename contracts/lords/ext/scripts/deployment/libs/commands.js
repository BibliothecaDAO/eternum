import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { declare, deploy, getContractPath } from "./common.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_PATH = path.join(__dirname, "..", "..", "..", "..", "target", "release");

export const declareLordsContract = async () => {
  ///////////////////////////////////////////
  ////////   Lords Contract  //////////
  ///////////////////////////////////////////

  // declare contract
  let casualName = "test_lords";
  let projectName = "lords"; // eternum season pass
  let contractName = "TestLords";
  (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;
};

export const deployLordsContract = async () => {
  ///////////////////////////////////////////
  ////////   Lords Contract  //////////
  ///////////////////////////////////////////

  // declare contract
  let casualName = "test_lords";
  let projectName = "lords"; // eternum season pass
  let contractName = "TestLords";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;
  
  // deploy contract
  let constructorCalldata = [];
  let address = await deploy(casualName, class_hash, constructorCalldata);
  return address;
};

export const saveContractAddressToCommonFolder = async (name, addr) => {
  try {
    const folderPath = path.join("..", "..", "..", "..", "..", "common", "lords", "addresses");

    const mkdirAsync = promisify(fs.mkdir);
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
      [name]: addr,
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
    const writeFileAsync = promisify(fs.writeFile);
    await writeFileAsync(fileName, jsonString);
    console.log(`"${fileName}" has been saved or overwritten`);
  } catch (err) {
    console.error("Error writing file", err);
    throw err;
  }
};
