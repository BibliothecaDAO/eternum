import type { Config } from "../../packages/types/src/types/common";
import type { BlitzBalanceProfileId } from "./blitz";

export const nativePresets: Record<
  number,
  { gameType: "eternum" | "blitz"; profile?: BlitzBalanceProfileId; rewardProfile?: number }
> = {
  1: { gameType: "eternum" },
  2: { gameType: "blitz", profile: "official-60", rewardProfile: 1 },
  3: { gameType: "blitz", profile: "official-90", rewardProfile: 2 },
};

export function nativePresetForId(id: number) {
  const preset = nativePresets[id];
  if (!preset) throw new Error(`Unsupported native preset ${id}`);
  return preset;
}

export function resolveBlitzProfileId(config: Config): number {
  const preset = Object.values(nativePresets).find(
    ({ profile }) => profile === config.blitz.exploration.rewardProfileId,
  );
  if (!preset?.rewardProfile)
    throw new Error(`Unsupported Blitz reward profile "${config.blitz.exploration.rewardProfileId}"`);
  return preset.rewardProfile;
}
