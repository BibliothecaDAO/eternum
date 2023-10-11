import data from "./hyperstructures.json";

const initialResources = [
  872.17, 685.39, 666.61, 459.65, 385.39, 302.78, 205.04, 166.43, 158.96, 103.3,
  52.17, 42.96, 41.57, 41.57, 29.91, 28.17, 24.17, 19.3, 16.17, 9.57, 6.43, 4,
];

// Function to update completion amounts
function updateCompletionAmounts(data, initialResources) {
  data.forEach((item) => {
    const completion = item.resources.completion;
    completion.forEach((compItem) => {
      const resourceType = compItem.resourceType;
      if (resourceType >= 1 && resourceType <= initialResources.length) {
        const index = resourceType - 1;
        const newAmount = initialResources[index] * 50 * 1000;
        compItem.amount = newAmount;
      }
    });
    const initialization = item.resources.initialization;
    initialization.forEach((initItem) => {
      const resourceType = initItem.resourceType;
      if (resourceType >= 1 && resourceType <= initialResources.length) {
        const index = resourceType - 1;
        const newAmount = initialResources[index] * 2 * 1000;
        initItem.amount = newAmount;
      }
    });
  });
}

// Update the completion amounts
updateCompletionAmounts(data, initialResources);

console.log(JSON.stringify(data, null, 2)); // Output the updated data
