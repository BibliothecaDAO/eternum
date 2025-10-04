import { declareCollectibleTimelockMaker, declareRealmsCollectibleContract } from "./libs/commands.js";

// Pretty console header
console.log("\n\n");
console.log(`╔══════════════════════════════════════════════════════════╗`.green);
console.log(`║                   Declaring Collectible                  ║`.green);
console.log(`╚══════════════════════════════════════════════════════════╝`.green);
console.log("\n");

const toHex = (address) => {
  return address.toString(16);
};

const class_hash = await declareRealmsCollectibleContract();

console.log("\n\n");
console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.yellow);
console.log("    Collectible Class Hash: ".yellow + toHex(class_hash).magenta);
console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.yellow);
console.log("\n\n");


// Pretty console header
console.log("\n\n");
console.log(`╔══════════════════════════════════════════════════════════╗`.green);
console.log(`║   Declaring Collectible  Timelock Maker (Manager)        ║`.green);
console.log(`╚══════════════════════════════════════════════════════════╝`.green);
console.log("\n");


const tl_class_hash = await declareCollectibleTimelockMaker()
console.log("\n\n");
console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.yellow);
console.log("    Collectible Timelock Maker Class Hash: ".yellow + toHex(tl_class_hash).magenta);
console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.yellow);
console.log("\n\n");
