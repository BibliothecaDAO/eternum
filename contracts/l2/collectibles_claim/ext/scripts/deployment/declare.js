import { declareCosmeticsClaimContract } from "./libs/commands.js";

// Pretty console header
console.log("\n\n");
console.log(`╔══════════════════════════════════════════════════════════╗`.green);
console.log(`║                   Declaring Cosmetics Claim                ║`.green);
console.log(`╚══════════════════════════════════════════════════════════╝`.green);
console.log("\n");

const toHex = (address) => {
  return address.toString(16);
};

const class_hash = await declareCosmeticsClaimContract();

console.log("\n\n");
console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.yellow);
console.log("    Cosmetics Claim Class Hash: ".yellow + toHex(class_hash).magenta);
console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.yellow);
console.log("\n\n");
