import { deploySeasonPassContract } from "./libs/commands.js";

console.log(`   ____          _         `.red);
console.log(`  |    \\ ___ ___| |___ _ _ `.red);
console.log(`  |  |  | -_| . | | . | | |`.red);
console.log(`  |____/|___|  _|_|___|_  |`.red);
console.log(`            |_|       |___|`.red);

// @dev: only run this if deploying to slot otherwise u
// 0x3e64aa2c669ffd66a1c78d120812005d8f7e03b75696dd9c0f06e8def143844
// const testRealmsContractAddress = await deployTestRealmsContract();

// @dev: only run this if deploying to slot otherwise u
// 0x019c92fa87f4d5e3be25c3dd6a284f30282a07e87cd782f5fd387b82c8142017
// const testLordsContractAddress = await deployTestLordsContract();

const seasonPassContractAddress = await deploySeasonPassContract(
  BigInt(0x3e64aa2c669ffd66a1c78d120812005d8f7e03b75696dd9c0f06e8def143844),
  BigInt(0x019c92fa87f4d5e3be25c3dd6a284f30282a07e87cd782f5fd387b82c8142017),
);

// await setSeasonPassAddressTestLordsContract(
//   BigInt(0x019c92fa87f4d5e3be25c3dd6a284f30282a07e87cd782f5fd387b82c8142017),
//   BigInt(0x3e64aa2c669ffd66a1c78d120812005d8f7e03b75696dd9c0f06e8def143844),
// );

console.log(`\n\n********** IMPORTANT **********`.bold.red);
console.log(`** MAKE SURE TO UPDATE THE .ENV.PRODUCTION FILE WITH THESE ADDRESSES **`.bold.red);
console.log(`*******************************\n\n`.bold.red);
console.log(`Realms Contract Address: ${0x3e64aa2c669ffd66a1c78d120812005d8f7e03b75696dd9c0f06e8def143844}`);
console.log(`Lords Contract Address: ${0x019c92fa87f4d5e3be25c3dd6a284f30282a07e87cd782f5fd387b82c8142017}`);
console.log(`Season Pass Contract Address: ${seasonPassContractAddress}`);
