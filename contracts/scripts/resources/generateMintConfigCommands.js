const initialResourcesProd = [
  872.17, 685.39, 666.61, 459.65, 385.39, 302.78, 205.04, 166.43, 158.96, 103.3,
  52.17, 42.96, 41.57, 41.57, 29.91, 28.17, 24.17, 19.3, 16.17, 9.57, 6.43, 4,
];

let resourcesProd = initialResourcesProd.flatMap((resource, i) => [
  i + 1,
  Math.round(resource * 1000),
]);

resourcesProd = resourcesProd += [, 254, 7560 * 1000, 255, 2520 * 1000];

let resourcesDev = Array.from({ length: 22 }, (_, i) => [i + 1, 1000000000]);
resourcesDev = resourcesDev += [
  ,
  253,
  1000000000,
  254,
  1000000000,
  255,
  1000000000,
];

let commandProd = `"sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,24,${resourcesProd}"`;
console.log(commandProd);
console.log("\n");

let commandDev = `"sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,25,${resourcesDev}"`;
console.log(commandDev);
