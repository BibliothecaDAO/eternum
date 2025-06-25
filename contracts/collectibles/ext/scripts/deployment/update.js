import { processData } from "./data/process.js";
import { setAttrsRawToIPFSCID, setDefaultIPFSCID, setTraitTypeName, setTraitValueName } from "./libs/commands.js";
import { confirmMainnetDeployment, exitIfDeclined } from "./utils.js";

/**
 * Update a RealmsCollectible contract
 *
 * @param {string} dataFileName - The name of the data file
 */
export const updateCollectible = async (dataFileName) => {
  const {
    name,
    symbol,
    updateContractAddress,
    setDefaultIpfsCidCalldata,
    setTraitTypesNameCalldata,
    setTraitValueNameCalldata,
    setAttrsRawToIPFSCIDCalldata,
  } = processData(dataFileName);

  const collectibleAddress = updateContractAddress;
  if (!collectibleAddress) {
    throw new Error("Collectible address is required to be set in `updateContractAddress` in the data file");
  }

  // Pretty console header
  console.log("\n\n");
  console.log(`╔══════════════════════════════════════════════════════════╗`.green);
  console.log(`║ Updating Realms Collectible [${name} (${symbol})] ║`.green);
  console.log(`╚══════════════════════════════════════════════════════════╝`.green);
  console.log("\n");
  console.log(`╔═════════════════════════════════════════════════════════════════╗`.yellow);
  console.log("  Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚═════════════════════════════════════════════════════════════════╝`.yellow);
  console.log("\n\n");

  exitIfDeclined(await confirmMainnetDeployment());

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

  if (
    setAttrsRawToIPFSCIDCalldata.length == 0 &&
    setTraitValueNameCalldata.length == 0 &&
    setTraitTypesNameCalldata.length == 0 &&
    setDefaultIpfsCidCalldata.length == 0
  ) {
    console.log("\n\nNo data to update\n\n\n\n");
    return;
  } else {
    console.log("\n\n");
    console.log(
      `╔════════════════════════════════════════════════════════════════════════════════════════════╗`.yellow,
    );
    console.log(`     ${name} Contract: Updated`.yellow + toHex(collectibleAddress).magenta);
    console.log("    Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
    console.log(
      `╚════════════════════════════════════════════════════════════════════════════════════════════╝`.yellow,
    );

    console.log("\n\n\n");
  }

  return collectibleAddress;
};

const toHex = (address) => {
  return "0x" + address.toString(16);
};
