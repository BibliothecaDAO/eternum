import { grantMinterRoleToInGameBridge } from "./libs/commands";

// Pretty console header
console.log("\n\n");
console.log(`╔══════════════════════════════════════════════════════════╗`.green);
console.log(`║    Granting Minter Role to In-Game Bridge              ║`.green);
console.log(`╚══════════════════════════════════════════════════════════╝`.green);
console.log("\n");
await grantMinterRoleToInGameBridge();

console.log("\n");
