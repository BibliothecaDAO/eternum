import { describe, expect, it } from "vitest";
import { GAME_SYNC_MODEL_MANIFEST, getGameSyncModel, getGameSyncModelsForChannel } from "./model-manifest";

describe("GAME_SYNC_MODEL_MANIFEST", () => {
  it("classifies each model exactly once", () => {
    const names = GAME_SYNC_MODEL_MANIFEST.map(({ name }) => name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("puts all current entity truth in the gamewide channel", () => {
    const names = getGameSyncModelsForChannel("gamewide-entity", { includeS2Only: true }).map(({ name }) => name);

    expect(names).toEqual(expect.arrayContaining(["GameRegistry", "Structure", "Resource", "ExplorerTroops"]));
    expect(names).not.toEqual(expect.arrayContaining(["OpenRelicChestEvent", "ExplorerRewardEvent", "BattleEvent"]));
  });

  it("has one current-entity channel", () => {
    ["Structure", "Building", "Resource", "ExplorerTroops"].forEach((name) => {
      expect(getGameSyncModel(name).channels).toEqual(["gamewide-entity"]);
    });
  });

  it("owns game scoping for every sync model", () => {
    expect(getGameSyncModel("AddressName").s2Scope).toBe("chain");
    expect(getGameSyncModel("WorldConfig").s2Scope).toBe("game");
    expect(getGameSyncModel("TileOpt").s2Scope).toBe("game");
  });

  it("adjudicates manifest event messages as events only", () => {
    ["SeasonEnded", "OpenRelicChestEvent", "BattleEvent", "ExplorerRewardEvent", "StoryEvent"].forEach((name) => {
      const event = getGameSyncModel(name);
      expect(event.channels).toEqual(["global-event"]);
      expect(event.recovery).toBe("event-deduped");
      expect(event.deletion).toBe("event-ephemeral");
    });
    expect(getGameSyncModelsForChannel("gamewide-entity").map(({ name }) => name)).not.toEqual(
      expect.arrayContaining([
        "SeasonEnded",
        "OpenRelicChestEvent",
        "BattleEvent",
        "ExplorerRewardEvent",
        "StoryEvent",
      ]),
    );
  });

  it("enforces bounded event identities without retaining event rows", () => {
    getGameSyncModelsForChannel("global-event").forEach((event) => {
      expect(event.eventRetention).toEqual({
        retainRecsRows: false,
        dedupeIdentityLimit: 512,
        replayEffectsOnRecovery: true,
      });
    });
  });
});
