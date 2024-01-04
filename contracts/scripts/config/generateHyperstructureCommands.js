let structures = require("../../data/hyperstructures/hyperstructures.json");

let commands = "";

structures.forEach((structure) => {
  const { x, z: y, order } = structure;

  // Formatting the coords
  const coordX = parseInt(x * 10000 + 1800000);
  const coordY = parseInt(y * 10000 + 1800000);

  // Constructing the command
  commands += `"sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,${coordX},${coordY},${order}"\n`;
});

console.log(commands);
