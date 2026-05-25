import type { RealmAutomationConfig, ResourceAutomationPercentages } from "@/hooks/store/use-automation-store";

const isManagedEntity = (realm: RealmAutomationConfig) =>
  realm.entityType === "realm" || realm.entityType === "village";

const encodePercentages = (percentages: Record<number, ResourceAutomationPercentages> | undefined): string => {
  if (!percentages) return "";
  return Object.entries(percentages)
    .toSorted(([a], [b]) => Number(a) - Number(b))
    .map(([resourceId, value]) => {
      const r2r = Number.isFinite(value?.resourceToResource) ? value!.resourceToResource : 0;
      const l2r = Number.isFinite(value?.laborToResource) ? value!.laborToResource : 0;
      return `${resourceId}:${r2r}:${l2r}`;
    })
    .join(",");
};

export const computeAutomationConfigSignature = (realms: Record<string, RealmAutomationConfig>): string =>
  Object.entries(realms)
    .filter(([, realm]) => isManagedEntity(realm))
    .map(([realmId, realm]) => {
      const presetId = realm.presetId ?? "smart";
      const balance = realm.autoBalance ? "A" : "a";
      const percentages = encodePercentages(realm.customPercentages);
      return `${realmId}:${presetId}:${balance}:${percentages}`;
    })
    .toSorted()
    .join("|");
