import { revokeMinterRoleFromAllSeasonResourceContracts } from "./libs/commands";

// Pretty console header
console.log("\n\n");
console.log(`╔══════════════════════════════════════════════════════════╗`.green);
console.log(`║    Revoking Minter Role from In-Game Bridge              ║`.green);
console.log(`╚══════════════════════════════════════════════════════════╝`.green);
console.log("\n");
await revokeMinterRoleFromAllSeasonResourceContracts();
console.log("\n");
