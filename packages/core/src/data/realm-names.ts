import realmNamesJson from "../../../../client/public/jsons/realm-names.json";

const realmNames = realmNamesJson as Record<string, string>;

export const getRealmNameById = (realmId: number | string): string => {
  return realmNames[String(realmId)] ?? "";
};

export const getRealmNameMap = (): Record<string, string> => realmNames;
