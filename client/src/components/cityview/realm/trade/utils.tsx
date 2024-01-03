import { Resource, WEIGHTS } from "@bibliothecadao/eternum";

export const getTotalResourceWeight = (resources: (Resource | undefined)[]) => {
  return resources.reduce(
    (total, resource) => total + (resource ? resource.amount * WEIGHTS[resource.resourceId] : 0),
    0,
  );
};
