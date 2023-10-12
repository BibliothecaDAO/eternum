let structures = require("./hyperstructures.json");

let commands = "";

structures.forEach((structure) => {
  const { x, z: y, resources } = structure;
  const initialization = resources.initialization;
  const completion = resources.completion;

  // Extracting values for initialization
  const numInitializationResources = initialization.length;
  const initializationStrings = initialization
    .map((res) => `${res.resourceType},${parseInt(res.amount)}`)
    .join(",");

  // Extracting values for completion
  const numCompletionResources = completion.length;
  const completionStrings = completion
    .map((res) => `${res.resourceType},${parseInt(res.amount)}`)
    .join(",");

  // Formatting the coords
  const coordX = parseInt(x * 10000 + 1800000);
  const coordY = parseInt(y * 10000 + 1800000);

  // Constructing the command
  commands += `"sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,${numInitializationResources},${initializationStrings},${numCompletionResources},${completionStrings},${coordX},${coordY}"\n`;
});

console.log(commands);
