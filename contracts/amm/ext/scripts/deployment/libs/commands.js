import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { declareContract, deployContract, getContractPath, readJsonFile, writeJsonFile } from "./common.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_PATH = path.join(__dirname, "..", "..", "..", "..", "target", "release");
const COMMON_ADDRESSES_DIR = path.join(__dirname, "..", "..", "..", "..", "..", "common", "addresses");

function toBigIntAddress(value) {
  return BigInt(value);
}

async function readCommonAddresses() {
  const network = process.env.STARKNET_NETWORK;
  const fileName = path.join(COMMON_ADDRESSES_DIR, `${network}.json`);

  try {
    return await readJsonFile(fileName);
  } catch (error) {
    throw new Error(`Unable to read common address file at ${fileName}`);
  }
}

export async function resolveAmmLordsContractAddress() {
  const presetLordsAddress = process.env.AMM_PRESET_LORDS_ADDRESS;

  if (presetLordsAddress && presetLordsAddress !== "0") {
    return toBigIntAddress(presetLordsAddress);
  }

  const commonAddresses = await readCommonAddresses();

  if (!commonAddresses.lords || commonAddresses.lords === "0" || commonAddresses.lords === "0x0") {
    throw new Error("LORDS address is missing. Set AMM_PRESET_LORDS_ADDRESS or populate contracts/common/addresses.");
  }

  return toBigIntAddress(commonAddresses.lords);
}

export async function declareAmmContracts() {
  const projectName = "eternum_amm";
  const lpTokenClassHash = (await declareContract(getContractPath(TARGET_PATH, projectName, "LPToken"), "amm_lp_token"))
    .class_hash;
  const ammClassHash = (await declareContract(getContractPath(TARGET_PATH, projectName, "EternumAMM"), "amm"))
    .class_hash;

  return {
    ammClassHash,
    lpTokenClassHash,
  };
}

export async function deployAmmContract({ feeRecipient, lordsAddress, owner }) {
  const { ammClassHash, lpTokenClassHash } = await declareAmmContracts();

  const constructorCalldata = [owner, lordsAddress, feeRecipient, lpTokenClassHash];
  const ammAddress = await deployContract("amm", ammClassHash, constructorCalldata);

  return {
    ammAddress,
    ammClassHash,
    lpTokenClassHash,
  };
}

export async function saveAmmAddressesToCommonFolder({
  ammAddress,
  ammClassHash,
  feeRecipient,
  lordsAddress,
  lpTokenClassHash,
  owner,
}) {
  const network = process.env.STARKNET_NETWORK;
  const fileName = path.join(COMMON_ADDRESSES_DIR, `${network}.json`);

  let existingData = {};
  try {
    existingData = await readJsonFile(fileName);
  } catch (error) {
    existingData = {};
  }

  const nextData = {
    ...existingData,
    amm: ammAddress,
    ammClassHash,
    ammFeeRecipient: feeRecipient,
    ammLpTokenClassHash: lpTokenClassHash,
    ammOwner: owner,
    lords: lordsAddress,
  };

  await fs.mkdir(COMMON_ADDRESSES_DIR, { recursive: true });
  await writeJsonFile(fileName, nextData);
  console.log(`"${fileName}" has been saved or overwritten`);
}
