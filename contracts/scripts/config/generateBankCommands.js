let bankHexPositions = require("../../../client/src/geodata/hex/bankHexPositions.json");

let next_bank_id = 0;

const wheatTargetPrice = 10;
const fishTargetPrice = 5;
// 100
const priceUpdateInterval = 100000;
// 100
const perTimeUnit = 100000;

let commands = "";

Object.values(bankHexPositions).forEach((bank) => {
  const { col: coordX, row: coordY } = bank[0];

  // Constructing the command
  commands += `"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,${coordX},${coordY},2,253,1,254,${wheatTargetPrice},253,1,255,${fishTargetPrice}"\n`;
  commands += `"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,${next_bank_id},2,253,0,253,1,1844674407370955161,${perTimeUnit},${priceUpdateInterval}"\n`;
  commands += `\n`;

  next_bank_id = next_bank_id + 3;
});

console.log(commands);
