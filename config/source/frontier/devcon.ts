import { nativeResearchConstants as research } from "../../../contracts/l3/world-native/schema/client.gen";
import type { NativePreset } from "../common/native-preset";
import { FRONTIER_DEVCON_PRESET_ID } from "../common/native-preset-modes";
import { frontierPreset } from "./native";

if (!frontierPreset.labor) throw new Error("Devcon requires Frontier's home Labor grant");

export const frontierDevconPreset: NativePreset = {
  ...frontierPreset,
  id: FRONTIER_DEVCON_PRESET_ID,
  clockScale: 3,
  research: [
    ...frontierPreset.research.filter(({ row }) => row !== research.ROW_DEPTH),
    ...[20_000, 50_000, 100_000].map((essenceCost, index) => ({
      row: research.ROW_DEPTH,
      tier: index + 1,
      essenceCost,
      laborCost: 0,
    })),
  ],
};
