import "dotenv/config";
import * as path from "path";
import { fileURLToPath } from "url";
import { declare, deploy, getContractPath } from "./common.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_PATH = path.join(__dirname, "..", "..", "..", "contracts", "target", "release");

export const deploySeasonPassContract = async (realmsContractAddress) => {
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
  let constructorCalldata = [SEASON_PASS_ADMIN, SEASON_PASS_REALMS_CONTRACT];
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
