import { deploySeasonPassContract } from "./libs/commands.js";

console.log(`   ____          _         `.red);
console.log(`  |    \\ ___ ___| |___ _ _ `.red);
console.log(`  |  |  | -_| . | | . | | |`.red);
console.log(`  |____/|___|  _|_|___|_  |`.red);
console.log(`            |_|       |___|`.red);

const realmsContractAddress = BigInt(0); // set the address here
const seasonPassContractAddress = await deploySeasonPassContract(BigInt(realmsContractAddress));

console.log(`Realms Contract Address: ${testRealmsContractAddress}`);
console.log(`Season Pass Contract Address: ${seasonPassContractAddress}`);
