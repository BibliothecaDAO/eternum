import { processData } from "./data/process.js";
import {
  deployRealmsCollectibleContract,
  setAttrsRawToIPFSCID,
  setDefaultIPFSCID,
  setTraitTypeName,
  setTraitValueName,
} from "./libs/commands.js";
import { confirmMainnetDeployment, exitIfDeclined } from "./utils.js";

/**
 * Deploy a RealmsCollectible contract with the specified name and symbol
 * All other parameters are read from environment variables
 *
 * @param {string} erc721Name - The name of the ERC721 token
 * @param {string} erc721Symbol - The symbol of the ERC721 token
 * @returns {Promise<bigint>} The deployed contract address
 */
export const deployCollectible = async (dataFileName) => {
  const {
    name,
    symbol,
    description,
    updateContractAddress,
    setDefaultIpfsCidCalldata,
    setTraitTypesNameCalldata,
    setTraitValueNameCalldata,
    setAttrsRawToIPFSCIDCalldata,
  } = processData(dataFileName);

  if (updateContractAddress) {
    throw new Error("Update contract address is not allowed to be set in the data file when deploying a new contract");
  }

  // Pretty console header
  console.log("\n\n");
  console.log(`╔══════════════════════════════════════════════════════════╗`.green);
  console.log(`║ Deploying Realms Collectible [${name} (${symbol})] ║`.green);
  console.log(`╚══════════════════════════════════════════════════════════╝`.green);
  console.log("\n");
  console.log(`╔═════════════════════════════════════════════════════════════════╗`.yellow);
  console.log("  Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚═════════════════════════════════════════════════════════════════╝`.yellow);
  console.log("\n\n");

  // Contract parameters from environment variables
  const defaultAdmin = BigInt(process.env.COLLECTIBLES_DEFAULT_ADMIN);
  const minter = BigInt(process.env.COLLECTIBLES_MINTER);
  const upgrader = BigInt(process.env.COLLECTIBLES_UPGRADER);
  const locker = BigInt(process.env.COLLECTIBLES_LOCKER);
  const metadataUpdater = BigInt(process.env.COLLECTIBLES_METADATA_UPDATER);
  const defaultRoyaltyReceiver = BigInt(process.env.COLLECTIBLES_DEFAULT_ROYALTY_RECEIVER);
  const feeNumerator = BigInt(process.env.COLLECTIBLES_FEE_NUMERATOR);

  console.log(`📝 Contract Configuration:`);
  console.log(`   Name: ${name}`);
  console.log(`   Symbol: ${symbol}`);
  console.log(`   Description: ${description}`);
  console.log(`   Default Admin: ${toHex(defaultAdmin)}`);
  console.log(`   Minter: ${toHex(minter)}`);
  console.log(`   Upgrader: ${toHex(upgrader)}`);
  console.log(`   Locker: ${toHex(locker)}`);
  console.log(`   Metadata Updater: ${toHex(metadataUpdater)}`);
  console.log(`   Royalty Receiver: ${toHex(defaultRoyaltyReceiver)}`);
  console.log(`   Royalty Fee Percentage: ${(Number(feeNumerator) / 10_000) * 100}%\n`);

  exitIfDeclined(await confirmMainnetDeployment());

  // Deploy RealmsCollectible contract
  const collectibleAddress = await deployRealmsCollectibleContract(
    name,
    symbol,
    description,
    defaultAdmin,
    minter,
    upgrader,
    locker,
    metadataUpdater,
    defaultRoyaltyReceiver,
    feeNumerator,
  );

  console.log(`\n\n 🎨 Deployed RealmsCollectible contract: ${toHex(collectibleAddress)}`);

  // Set default IPFS CID if provided
  if (setDefaultIpfsCidCalldata.length > 0) {
    await setDefaultIPFSCID(collectibleAddress, setDefaultIpfsCidCalldata);
    console.log(`\n\n ✔ Set default IPFS CID: ${setDefaultIpfsCidCalldata}`);
  }

  if (setTraitTypesNameCalldata.length > 0) {
    await setTraitTypeName(collectibleAddress, setTraitTypesNameCalldata);
    console.log(`\n\n ✔ Set trait types name: ${setTraitTypesNameCalldata}`);
  }

  if (setTraitValueNameCalldata.length > 0) {
    await setTraitValueName(collectibleAddress, setTraitValueNameCalldata);
    console.log(`\n\n ✔ Set trait value name: ${setTraitValueNameCalldata}`);
  }

  if (setAttrsRawToIPFSCIDCalldata.length > 0) {
    await setAttrsRawToIPFSCID(collectibleAddress, setAttrsRawToIPFSCIDCalldata);
    console.log(`\n\n ✔ Set attrs raw to IPFS CID: ${setAttrsRawToIPFSCIDCalldata}`);
  }

  console.log("\n\n");
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.yellow);
  console.log(`     ${name} Contract: Deployed `.yellow + toHex(collectibleAddress).magenta + " ");
  console.log("    Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.yellow);

  console.log("\n\n\n");

  return collectibleAddress;
};

const toHex = (address) => {
  if (typeof address === "string" && address.startsWith("0x")) {
    return address;
  }
  return "0x" + address.toString(16);
};
