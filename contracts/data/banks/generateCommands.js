let banks = require("../../../client/src/data/banks.json");

let next_bank_id = 0;

const wheatTargetPrice = 10;
const fishTargetPrice = 5;
// 100
const priceUpdateInterval = 100000;
// 100
const perTimeUnit = 100000;

let commands = "";

banks.forEach((bank) => {
  const { x, z: y } = bank;

  // Formatting the coords
  const coordX = parseInt(x * 10000 + 1800000);
  const coordY = parseInt(y * 10000 + 1800000);

  // Constructing the command
  commands += `"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,${coordX},${coordY},2,253,1,254,${wheatTargetPrice},253,1,255,${fishTargetPrice}"\n`;
  commands += `"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,${next_bank_id},2,253,0,253,1,1844674407370955161,${perTimeUnit},${priceUpdateInterval}"\n`;
  commands += `\n`;

  next_bank_id = next_bank_id + 3;
});

console.log(commands);
