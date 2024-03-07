let hyperstructuresHexPositions = require("../../../client/src/geodata/hex/hyperstructuresHexPositions.json");
const { RESOURCE_WEIGHTS } = require("./constants.js");

let commands = "";

const WOOD_BASE_AMOUNT = 9450000;
const WHEAT_AMOUNT = 45000000;
const FISH_AMOUNT = 15000000;

const weightArray = [];
for (let i = 0; i < RESOURCE_WEIGHTS.length; i += 2) {
  const combinedElement = [
    [
      i + 1,
      Math.round(
        (RESOURCE_WEIGHTS[i][1] * WOOD_BASE_AMOUNT) / RESOURCE_WEIGHTS[0][1]
      ),
    ],
    [
      i + 2,
      Math.round(
        (RESOURCE_WEIGHTS[i + 1][1] * WOOD_BASE_AMOUNT) / RESOURCE_WEIGHTS[0][1]
      ),
    ],
  ];
  weightArray.push(combinedElement);
}

Object.values(hyperstructuresHexPositions).forEach((structure, i) => {
  // const { x, z: y } = structure;
  const { col: coordX, row: coordY } = structure[0];

  let resourceAmounts = `4,${weightArray[i][0][0]},${weightArray[i][0][1]},${weightArray[i][1][0]},${weightArray[i][1][1]},254,${WHEAT_AMOUNT},255,${FISH_AMOUNT}`;

  const resource1Amount =
    // Constructing the command
    (commands += `"sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,${coordX},${coordY},${resourceAmounts}"\n`);
});

console.log(commands);
