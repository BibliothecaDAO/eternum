import {
  deploySeasonPassContract,
  deployTestLordsContract,
  deployTestRealmsContract,
  setSeasonPassAddressTestLordsContract,
} from "./libs/commands.js";

console.log(`   ____          _         `.red);
console.log(`  |    \\ ___ ___| |___ _ _ `.red);
console.log(`  |  |  | -_| . | | . | | |`.red);
console.log(`  |____/|___|  _|_|___|_  |`.red);
console.log(`            |_|       |___|`.red);

const testRealmsContractAddress = await deployTestRealmsContract();
let testLordsContractAddress = await deployTestLordsContract();
let seasonPassAddress = await deploySeasonPassContract(
  BigInt(testRealmsContractAddress),
  BigInt(testLordsContractAddress),
);
await setSeasonPassAddressTestLordsContract(BigInt(testLordsContractAddress), BigInt(seasonPassAddress));
