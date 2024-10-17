import { deploySeasonPassContract, deployTestRealmsContract } from "./libs/commands.js";

console.log(`   ____          _         `.red);
console.log(`  |    \\ ___ ___| |___ _ _ `.red);
console.log(`  |  |  | -_| . | | . | | |`.red);
console.log(`  |____/|___|  _|_|___|_  |`.red);
console.log(`            |_|       |___|`.red);

const testRealmsContractAddress = await deployTestRealmsContract();
await deploySeasonPassContract(BigInt(testRealmsContractAddress));
