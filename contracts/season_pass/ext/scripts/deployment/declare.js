import {
  declareOnlySeasonPassContract
} from "./libs/commands.js";

// Pretty console header
console.log("\n\n");
console.log(`╔══════════════════════════════════════════════════════════╗`.green);
console.log(`║                   Declaring Season Pass                  ║`.green);
console.log(`╚══════════════════════════════════════════════════════════╝`.green);
console.log("\n");

const toHex = (address) => {
  return address.toString(16);
};

const class_hash = await declareOnlySeasonPassContract();

console.log("\n\n");
console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.yellow);
console.log("    Season Pass Class Hash: ".yellow + toHex(class_hash).magenta);
console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.yellow);
console.log("\n\n");
