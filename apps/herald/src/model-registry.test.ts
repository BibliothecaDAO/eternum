import { GAME_SYNC_MODEL_MANIFEST } from "@bibliothecadao/eternum/game-sync-models";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { createModelRegistry, readWorldManifest } from "./model-registry";

describe("createModelRegistry", () => {
  it("builds a decoder for every executable sync model from the Madara manifest", async () => {
    const manifestPath = resolve(import.meta.dirname, "../../../contracts/l3/game/manifest_madara.json");
    const registry = createModelRegistry(await readWorldManifest(manifestPath));

    expect(registry.bySelector.size).toBe(GAME_SYNC_MODEL_MANIFEST.length);
    expect(registry.persistent).toHaveLength(45);
    expect(registry.events.map(({ definition }) => definition.name)).toEqual([
      "SeasonEnded",
      "OpenRelicChestEvent",
      "ExplorerRewardEvent",
      "BattleEvent",
      "StoryEvent",
      "SwapEvent",
    ]);
  });
});
