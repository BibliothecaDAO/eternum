let banks = require("../../../client/src/data/banks.json");

let next_bank_id = 0;

let commands = "";

banks.forEach((bank) => {
  const { x, z: y } = bank;

  // Formatting the coords
  const coordX = parseInt(x * 10000 + 1800000);
  const coordY = parseInt(y * 10000 + 1800000);

  // Constructing the command
  commands += `"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,${coordX},${coordY},1,253,2,254,10000,255,10000"\n`;
  commands += `"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,${next_bank_id},1,253,1844674407370955161,960,10"\n`;
  commands += `\n`;

  next_bank_id = next_bank_id + 2;
});

console.log(commands);
