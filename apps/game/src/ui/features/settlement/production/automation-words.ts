import { REALM_PRESETS, type RealmPresetId } from "@bibliothecadao/eternum/automation";

/** A preset's line on hover: "Smart: Production runs itself, spread across the realm's buildings." */
export const presetLine = (id: RealmPresetId): string => {
  const preset = REALM_PRESETS.find((entry) => entry.id === id);
  if (!preset) throw new Error(`Unknown automation preset ${id}`);
  return `${preset.label}: ${preset.description}`;
};

/** Why the realm's automation cannot be changed now; null when it can. */
export const automationRefusal = (ordersAllowed: boolean, hydrated: boolean): string | null => {
  if (!ordersAllowed) return "Only the realm's player can change its automation";
  if (!hydrated) return "Loading the realm's automation";
  return null;
};
