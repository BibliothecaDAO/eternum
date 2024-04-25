import { Resource, WEIGHTS } from "@bibliothecadao/eternum";

export const getTotalResourceWeight = (resources: (Resource | undefined)[]) => {
  return resources.reduce(
    (total, resource) => total + (resource ? resource.amount * WEIGHTS[resource.resourceId] || 0 : 0),
    0,
  );
};

export function hasResources(resources: Resource[], selectedBuyResources: number[]) {
  if (selectedBuyResources.length > 0) {
    // Check if every selected resource is in takerGets
    const allSelectedInTakerGets = selectedBuyResources.every((selectedResource) =>
      resources.some((resource) => resource.resourceId === selectedResource),
    );

    // Check if takerGets contains at least one of the selected resources
    const atLeastOneSelectedInTakerGets = resources.some((resource) =>
      selectedBuyResources.includes(resource.resourceId),
    );

    return allSelectedInTakerGets && atLeastOneSelectedInTakerGets;
  } else {
    return true;
  }
}
