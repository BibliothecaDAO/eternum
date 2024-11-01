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
const testLordsContractAddress = await deployTestLordsContract();

const seasonPassContractAddress = await deploySeasonPassContract(
  BigInt(testRealmsContractAddress),
  BigInt(testLordsContractAddress),
);

await setSeasonPassAddressTestLordsContract(BigInt(testLordsContractAddress), BigInt(seasonPassContractAddress));

console.log(`Realms Contract Address: ${testRealmsContractAddress}`);
console.log(`Lords Contract Address: ${testLordsContractAddress}`);
console.log(`Season Pass Contract Address: ${seasonPassContractAddress}`);
