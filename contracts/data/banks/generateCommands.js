let banks = require("../../../client/src/data/banks.json");

let commands = "";

banks.forEach((bank) => {
  const { x, z: y } = bank;

  // Formatting the coords
  const coordX = parseInt(x * 10000 + 1800000);
  const coordY = parseInt(y * 10000 + 1800000);

  // Constructing the command
  commands += `"sozo execute --world $world create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata ${coordX},${coordY}"\n`;
});

console.log(commands);
