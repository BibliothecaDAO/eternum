import { processData } from "./data/process.js";
import {
  setMintCollectible
} from "./libs/commands.js";
import { confirmMainnetDeployment, exitIfDeclined } from "./utils.js";


/**
 * Generate mint calldata for a RealmsCollectible contract
 * after updating the "generateMintCalldata" section of the 
 * dataFile json
 * 
 * @param {string} dataFileName - The name of the data file
 */
export const mintCollectible = async (dataFileName) => {

  const { 
    name, 
    symbol, 
    updateContractAddress,
    setMintCalldata
  } = processData(dataFileName);

  const collectibleAddress = updateContractAddress;
  if (!collectibleAddress) {
    throw new Error("Collectible address is required to be set in `updateContractAddress` in the data file");
  }

  // Pretty console header
  console.log("\n\n");
  console.log(`╔══════════════════════════════════════════════════════════╗`.green);
  console.log(`║ Minting [${name} (${symbol})] ║`.green);
  console.log(`╚══════════════════════════════════════════════════════════╝`.green);
  console.log("\n");
  console.log(`╔═════════════════════════════════════════════════════════════════╗`.yellow);
  console.log("  Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚═════════════════════════════════════════════════════════════════╝`.yellow);
  console.log("\n\n");

  exitIfDeclined(await confirmMainnetDeployment());


  if (setMintCalldata.length > 0) {
    await setMintCollectible(collectibleAddress, setMintCalldata);
    console.log(`\n\n ✔ Minted collectible: ${setMintCalldata}`);
  }

  if (setMintCalldata.length ==0) {
    console.log("\n\nNo data to mint\n\n\n\n");
    return;
  } else {
    console.log("\n\n");
    console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.yellow);
    console.log(`     ${name} Contract: Updated`.yellow + toHex(collectibleAddress).magenta);
    console.log("    Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
    console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.yellow);

    console.log("\n\n\n");
  }

  return collectibleAddress;
};


const toHex = (address) => {
  return "0x" + address.toString(16);
};
