import { ResourcesIds } from ".";
import { resources } from "./resources";

export const findResourceById = (value: number) => {
  return resources.find((e) => e.id === value);
};

export const findResourceIdByTrait = (trait: string) => {
  // @ts-ignore
  return resources.find((e) => e?.trait === trait).id;
};

export const getLaborIdFromResourceId = (resourceType: ResourcesIds) => {
  return 255 - resourceType;
}

export const getResourceIdFromLaborId = (laborType: ResourcesIds) => {
  return 255 - laborType;
}

export const RESOURCE_PRECISION = 1_000_000_000;
export const RESOURCE_MULTIPLIER = 1000;
