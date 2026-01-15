import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { declare, deploy, getContractPath } from "./common.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_PATH = path.join(__dirname, "..", "..", "..", "..", "target", "release");

export const declareCosmeticsClaimContract = async () => {
  ///////////////////////////////////////////
  ////////   Cosmetics Claim Contract  //////////
  ///////////////////////////////////////////

  // declare contract
  let casualName = "Cosmetics Claim";
  let projectName = "collectibles_claim";
  let contractName = "CosmeticCollectiblesClaim";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;
  return class_hash;
};

export const deployCosmeticsClaimContract = async (
  cosmeticsContract,
  paymentContract,
  vrfProvider,
  defaultAdmin,
  upgrader,
) => {
  ///////////////////////////////////////////
  ////////   Collectible Contract  //////////
  ///////////////////////////////////////////

  // declare contract
  let casualName = "Cosmetics Claim";
  let projectName = "collectibles_claim";
  let contractName = "CosmeticCollectiblesClaim";
  const class_hash = (await declare(getContractPath(TARGET_PATH, projectName, contractName), casualName)).class_hash;

  // deploy contract
  let COSMETICS_CLAIM_COSMETICS_CONTRACT = BigInt(cosmeticsContract);
  let COSMETICS_CLAIM_PAYMENT_CONTRACT = BigInt(paymentContract);
  let COSMETICS_CLAIM_VRF_PROVIDER = BigInt(vrfProvider);
  let COSMETICS_CLAIM_DEFAULT_ADMIN = BigInt(defaultAdmin);
  let COSMETICS_CLAIM_UPGRADER = BigInt(upgrader);

  let constructorCalldata = [
    COSMETICS_CLAIM_COSMETICS_CONTRACT,
    COSMETICS_CLAIM_PAYMENT_CONTRACT,
    COSMETICS_CLAIM_VRF_PROVIDER,
    COSMETICS_CLAIM_DEFAULT_ADMIN,
    COSMETICS_CLAIM_UPGRADER,
  ];

  let address = await deploy(casualName, class_hash, constructorCalldata);
  await saveContractAddressToCommonFolder("cosmetics_claim", address);
  console.log(
    `\n\n 💾 Saved contract address to common folder (contracts/common/collectibles/addresses/${process.env.STARKNET_NETWORK}.json)`,
  );
  return address;
};

export const saveContractAddressToCommonFolder = async (contractName, contractAddress) => {
  try {
    const folderPath = path.join("..", "..", "..", "..", "..", "common", "collectibles_claim", "addresses");

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
      [contractName]: contractAddress,
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
