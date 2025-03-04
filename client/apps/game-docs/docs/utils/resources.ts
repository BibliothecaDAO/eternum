import { RESOURCE_PRECISION, resources } from "@/utils/constants";

export const findResourceById = (value: number) => {
  return resources.find((e) => e.id === value);
};

export function divideByPrecision(value: number): number {
  return value / RESOURCE_PRECISION;
}
