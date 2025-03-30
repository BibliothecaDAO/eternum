import { resources } from "./resources";

export const findResourceById = (value: number) => {
  return resources.find((e) => e.id === value);
};

export const findResourceIdByTrait = (trait: string) => {
  // @ts-ignore
  return resources.find((e) => e?.trait === trait).id;
};

// if it's labor, then remove 28 to get the icon resource id
export const getIconResourceId = (resourceId: number) => {
  return resourceId;
};

export const RESOURCE_PRECISION = 1_000_000_000;
export const RESOURCE_MULTIPLIER = 1000;
// Bridge Fees (using 10_000 precision)
export const BRIDGE_FEE_DENOMINATOR = 10_000;
