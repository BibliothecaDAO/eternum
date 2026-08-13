import { describe, expect, it } from "vitest";
import { GAME_SYNC_MODEL_MANIFEST, getGameSyncModel, getGameSyncModelsForChannel } from "./model-manifest";

describe("GAME_SYNC_MODEL_MANIFEST", () => {
  it("classifies each model exactly once", () => {
    const names = GAME_SYNC_MODEL_MANIFEST.map(({ name }) => name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("derives current global model availability", () => {
    const legacyNames = getGameSyncModelsForChannel("global-entity").map(({ name }) => name);
    const s2Names = getGameSyncModelsForChannel("global-entity", { includeS2Only: true }).map(({ name }) => name);

    expect(legacyNames).not.toContain("GameRegistry");
    expect(s2Names).toContain("GameRegistry");
    expect(s2Names).not.toContain("Structure");
  });

  it("records the S1 Structure ownership hole explicitly", () => {
    const structure = getGameSyncModel("Structure");
    expect(structure.channels).toEqual(["bounded-spatial", "player-entity"]);
    expect(structure.recovery).toBe("legacy-targeted");
    expect(getGameSyncModelsForChannel("spatial-bootstrap").map(({ name }) => name)).not.toContain("Structure");
  });

  it("owns game scoping for every sync model", () => {
    expect(getGameSyncModel("AddressName").s2Scope).toBe("chain");
    expect(getGameSyncModel("WorldConfig").s2Scope).toBe("game");
    expect(getGameSyncModel("TileOpt").s2Scope).toBe("game");
  });

  it("forces S2 adjudication for events currently delivered through two paths", () => {
    const pending = GAME_SYNC_MODEL_MANIFEST.filter(({ pendingChannelAdjudication }) => pendingChannelAdjudication);
    expect(pending.map(({ name }) => name).sort()).toEqual(["BattleEvent", "ExplorerRewardEvent"]);
    pending.forEach(({ channels }) =>
      expect(channels).toEqual(["spatial-bootstrap", "bounded-spatial", "global-event"]),
    );
  });

  it("records the S2 event-retention decision without claiming S1 already implements it", () => {
    const events = getGameSyncModelsForChannel("global-event");

    events.forEach((event) => {
      expect(event.plannedEventRetention).toEqual({
        retainRecsRows: false,
        dedupeIdentityLimit: 512,
        replayEffectsOnRecovery: false,
      });
    });
    expect(getGameSyncModel("OpenRelicChestEvent").recovery).toBe("subscription-only");
    expect(getGameSyncModel("BattleEvent").recovery).toBe("legacy-dual-channel");
  });
});
