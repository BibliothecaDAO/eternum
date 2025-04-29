import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { declare, deploy, getContractPath } from "./common.js";
import { getAccount, getNetwork } from "./network.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_PATH = path.join(__dirname, "..", "..", "..", "..", "target", "release");

export const declareOnlySeasonPassContract = async () => {
  ///////////////////////////////////////////
  ////////   Season Pass Contract  //////////
  ///////////////////////////////////////////

  // declare contract
  let casualName = "season_pass";
  let projectName = "esp"; // eternum season pass
  let contractName = "EternumSeasonPass";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;
  return class_hash;
};

export const deploySeasonPassContract = async (realmsContractAddress, lordsContractAddress) => {
  ///////////////////////////////////////////
  ////////   Season Pass Contract  //////////
  ///////////////////////////////////////////

  // declare contract
  let casualName = "season_pass";
  let projectName = "esp"; // eternum season pass
  let contractName = "EternumSeasonPass";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;

  // deploy contract
  let SEASON_PASS_ADMIN = BigInt(process.env.SEASON_PASS_ADMIN);
  let SEASON_PASS_REALMS_CONTRACT = BigInt(realmsContractAddress);
  let SEASON_PASS_LORDS_CONTRACT = BigInt(lordsContractAddress);

  let constructorCalldata = [SEASON_PASS_ADMIN, SEASON_PASS_REALMS_CONTRACT, SEASON_PASS_LORDS_CONTRACT];
  let address = await deploy(casualName, class_hash, constructorCalldata);
  return address;
};

export const deployTestRealmsContract = async () => {
  ///////////////////////////////////////////
  ////////   Test Realms Contract    ////////
  ///////////////////////////////////////////

  // declare contract
  let casualName = "test_realms";
  let projectName = "esp"; // eternum season pass
  let contractName = "TestRealm";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;

  // deploy contract
  let TEST_REALMS_ADMIN = BigInt(process.env.SEASON_PASS_ADMIN);
  let constructorCalldata = [TEST_REALMS_ADMIN];

  let address = await deploy(casualName, class_hash, constructorCalldata);
  return address;
};

export const deployTestLordsContract = async () => {
  ///////////////////////////////////////////
  ////////   Test Lords Contract    ////////
  ///////////////////////////////////////////

  // declare contract
  let casualName = "test_lords";
  let projectName = "esp"; // eternum season pass
  let contractName = "TestLords";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;

  // deploy contract
  let constructorCalldata = [];
  let address = await deploy(casualName, class_hash, constructorCalldata);
  return address;
};

export const setSeasonPassAddressTestLordsContract = async (lordsContractAddress, seasonPassAddress) => {
  ///////////////////////////////////////////
  // Set Season Pass Addr in TLords Contract
  ///////////////////////////////////////////

  const account = getAccount();
  console.log(`\n Setting Season Pass Addr in Test Lords Contract ... \n\n`.green);

  const contract = await account.execute([
    {
      contractAddress: lordsContractAddress,
      entrypoint: "set_season_pass",
      calldata: [seasonPassAddress],
    },
  ]);

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash})`);
  await account.waitForTransaction(contract.transaction_hash);

  console.log(
    `Successfully season pass address to ${seasonPassAddress} in test lords contract ${lordsContractAddress}`.green,
    "\n\n",
  );
};

const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
export const saveRelevantAddressesToCommonFolder = async (seasonPassAddress, realmsAddress, lordsAddress) => {
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
      seasonPass: seasonPassAddress,
      realms: realmsAddress,
      lords: lordsAddress,
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
