import { resources } from "./resources";

export const findResourceById = (value: number) => {
  return resources.find((e) => e.id === value);
};

export const RESOURCE_PRECISION = 1_000_000_000;
