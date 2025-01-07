import { deploySeasonPassContract } from "./libs/commands.js";

console.log(`   ____          _         `.red);
console.log(`  |    \\ ___ ___| |___ _ _ `.red);
console.log(`  |  |  | -_| . | | . | | |`.red);
console.log(`  |____/|___|  _|_|___|_  |`.red);
console.log(`            |_|       |___|`.red);

const realmsContractAddress = "0x07ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809";
const lordsContractAddress = "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";
const seasonPassContractAddress = await deploySeasonPassContract(
  BigInt(realmsContractAddress),
  BigInt(lordsContractAddress),
);

console.log(`\n\n********** IMPORTANT **********`.bold.red);
console.log(`** MAKE SURE TO UPDATE THE .ENV.PRODUCTION FILE WITH THESE ADDRESSES **`.bold.red);
console.log(`*******************************\n\n`.bold.red);
console.log(`Realms Contract Address: ${realmsContractAddress}`);
console.log(`Lords Contract Address: ${lordsContractAddress}`);
console.log(`Season Pass Contract Address: ${seasonPassContractAddress}`);
