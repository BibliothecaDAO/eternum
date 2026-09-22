import type { Config } from "../../packages/types/src/types/common";
import type { BlitzBalanceProfileId } from "./blitz";

export const nativePresets: Record<
  number,
  {
    gameType: "eternum" | "blitz";
    profile?: BlitzBalanceProfileId;
    spacing: number;
    epochSeconds: number;
    depths: Array<{
      supplyMultiplier: number;
      guardLower: number;
      guardUpper: number;
      mineCapMin: number;
      mineCapMax: number;
      mineRate: number;
      campRewardMin: number;
      campRewardMax: number;
      mineChest: boolean;
      revealSiteNeighbors: boolean;
    }>;
  }
> = {
  1: { gameType: "eternum", spacing: 6, epochSeconds: 0, depths: [] },
  2: { gameType: "blitz", profile: "official-60", spacing: 6, epochSeconds: 0, depths: [] },
  3: { gameType: "blitz", profile: "official-90", spacing: 8, epochSeconds: 0, depths: [] },
};

export function nativePresetForId(id: number) {
  const preset = nativePresets[id];
  if (!preset) throw new Error(`Unsupported native preset ${id}`);
  return preset;
}

export function nativePresetIdFor(gameType: "eternum" | "blitz", profile?: BlitzBalanceProfileId): number {
  const entry = Object.entries(nativePresets).find(
    ([, preset]) => preset.gameType === gameType && preset.profile === profile,
  );
  if (!entry) throw new Error(`No native preset for ${gameType}${profile ? ` profile ${profile}` : ""}`);
  return Number(entry[0]);
}

export function nativePresetForConfig(config: Config) {
  const preset = Object.values(nativePresets).find(({ gameType, profile }) =>
    config.blitz.mode.on
      ? gameType === "blitz" && profile === config.blitz.exploration.rewardProfileId
      : gameType === "eternum",
  );
  if (!preset) throw new Error("Unsupported native preset configuration");
  return preset;
}
