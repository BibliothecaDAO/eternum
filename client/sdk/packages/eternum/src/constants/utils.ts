import { resources } from "./resources";

export const findResourceById = (value: number) => {
  return resources.find((e) => e.id === value);
};

export const findResourceIdByTrait = (trait: string) => {
  // @ts-ignore
  return resources.find((e) => e?.trait === trait).id;
};

// if it's labor, then remove 28 to get the icon resource id
export const getIconResourceId = (resourceId: number, isLabor: boolean) => {
  return isLabor ? resourceId - 28 : resourceId;
};
