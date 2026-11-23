import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { frontierSeasonOnePreset } from "../../../../../config/source/frontier/season-one";
import { wire } from "./lab-chain";

export function seasonOneResearchPrices(store: NativeFactStore) {
  return frontierSeasonOnePreset.research.map(({ row, tier, essenceCost, laborCost }) => ({
    model: "ResearchPrice",
    key: store.wireKeyOf("ResearchPrice", { game_id: 1, row, tier }) ?? `0x751${row.toString(16)}${tier}`,
    value: wire({
      game_id: 1,
      row,
      tier,
      essence: BigInt(essenceCost) * BigInt(RESOURCE_PRECISION),
      labor: BigInt(laborCost) * BigInt(RESOURCE_PRECISION),
    }),
  }));
}
