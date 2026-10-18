import { HudTierChip } from "@/ui/design-system/kit/hud-elements";

/** A troop tier ("T2") on the sheet's tier chip; a dash for one this client does not know. */
export const TierChip = ({ tier }: { tier: string | undefined | null }) => {
  const number = tier === "T1" ? 1 : tier === "T2" ? 2 : tier === "T3" ? 3 : null;
  return number === null ? <span className="text-hud-label text-hud-cue">—</span> : <HudTierChip tier={number} />;
};
