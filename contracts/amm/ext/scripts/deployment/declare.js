import "colors";
import { declareAmmContracts } from "./libs/commands.js";

console.log("\n\n");
console.log("╔══════════════════════════════════════════════════════════╗".green);
console.log("║                    Declaring AMM                        ║".green);
console.log("╚══════════════════════════════════════════════════════════╝".green);
console.log("\n");

const declaration = await declareAmmContracts();

console.log("\n\n");
console.log("╔══════════════════════════════════════════════════════════════════════════════╗".yellow);
console.log("    AMM Class Hash: ".yellow + declaration.ammClassHash.magenta);
console.log("    LP Token Class Hash: ".yellow + declaration.lpTokenClassHash.magenta);
console.log("╚══════════════════════════════════════════════════════════════════════════════╝".yellow);
console.log("\n\n");
