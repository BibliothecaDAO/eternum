import type { NativePreset } from "../common/native-preset";
import { FRONTIER_DEVCON_PRESET_ID } from "../common/native-preset-modes";
import { frontierPreset } from "./native";

if (!frontierPreset.labor) throw new Error("Devcon requires Frontier's home Labor grant");

export const frontierDevconPreset = {
  ...frontierPreset,
  id: FRONTIER_DEVCON_PRESET_ID,
  clockScale: { days: 2, activity: 3 },
  chests: { ...frontierPreset.chests, topN: 3 },
  labor: { ...frontierPreset.labor, campaignEssence: 1000, goldenAmount: 2000, goldenEssence: 2000 },
} satisfies NativePreset;
