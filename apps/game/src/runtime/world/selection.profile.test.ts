import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../env", () => ({ env: { VITE_PUBLIC_CHAIN: "madara" } }));
vi.mock("@/ui/layouts/game-entry-timeline", () => ({
  markGameEntryMilestone: vi.fn(),
  recordGameEntryDuration: vi.fn(),
}));

const { deployment } = vi.hoisted(() => ({
  deployment: {
    id: "blitz",
    chain: "madara",
    namespace: "s2",
    heraldBaseUrl: "https://herald.realms.test",
    rpcUrl: "https://rpc.realms.test",
    worldAddress: "0x222",
    contractsBySelector: { "0x1": "0x333" },
    playerAccountClassHash: "0x4",
    playerRegistryAddress: "0x5",
    bindingAuthorityAddress: "0x6",
  },
}));

vi.mock("./world-directory", () => ({
  getDefaultWorld: () => deployment,
  getWorldById: () => deployment,
  getWorldDirectory: () => [deployment],
}));

import { applyWorldSelection } from "./selection";
import { getActiveWorldName, getWorldProfile, saveWorldProfile, setActiveWorldName } from "./store";

describe("game entry profile resolution", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () =>
        Response.json({
          chain: "madara",
          confirmed_block: 500629,
          games: [
            { name: "blitz-daily-0001", game_id: 3, preset_id: 2 },
            { name: "eternum-fresh-01", game_id: 2, preset_id: 1 },
          ],
        }),
      ),
    );
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it.each([
    { worldAddress: "0x111", gameId: 54, presetId: 4 },
    { worldAddress: deployment.worldAddress, gameId: 54, presetId: 4 },
    { worldAddress: deployment.worldAddress, gameId: 3, presetId: undefined },
  ])("replaces a stale Blitz profile before bootstrap: %j", async (staleIdentity) => {
    saveWorldProfile({
      ...deployment,
      chain: "madara",
      worldId: deployment.id,
      name: "blitz-daily-0001",
      fetchedAt: 1,
      contractsBySelector: { "0x1": "0x999" },
      ...staleIdentity,
    });

    const { profile } = await applyWorldSelection({ name: "blitz-daily-0001", chain: "madara" }, "madara");

    expect(profile).toMatchObject({
      gameId: 3,
      presetId: 2,
      worldAddress: deployment.worldAddress,
      contractsBySelector: deployment.contractsBySelector,
    });
    expect(getWorldProfile("blitz-daily-0001")).toEqual(profile);
    expect(getActiveWorldName()).toBe("blitz-daily-0001");
  });

  it("resolves a first-time Eternum entry from the same directory", async () => {
    const { profile } = await applyWorldSelection({ name: "eternum-fresh-01", chain: "madara" }, "madara");

    expect(profile).toMatchObject({ gameId: 2, presetId: 1, worldAddress: deployment.worldAddress });
    expect(getWorldProfile("eternum-fresh-01")).toEqual(profile);
  });

  it("does not enter a saved game when its directory is unavailable", async () => {
    saveWorldProfile({
      ...deployment,
      chain: "madara",
      name: "blitz-daily-0001",
      gameId: 54,
      presetId: 4,
      fetchedAt: 1,
    });
    setActiveWorldName("eternum-fresh-01");
    vi.mocked(fetch).mockRejectedValue(new Error("Herald unavailable"));

    await expect(applyWorldSelection({ name: "blitz-daily-0001", chain: "madara" }, "madara")).rejects.toThrow(
      "Herald unavailable",
    );
    expect(getActiveWorldName()).toBe("eternum-fresh-01");
  });

  it("rejects a saved game that no longer exists in the current world", async () => {
    saveWorldProfile({
      ...deployment,
      chain: "madara",
      name: "retired-blitz-game",
      gameId: 54,
      presetId: 4,
      fetchedAt: 1,
    });

    await expect(applyWorldSelection({ name: "retired-blitz-game", chain: "madara" }, "madara")).rejects.toThrow(
      'Game "retired-blitz-game" not found',
    );
    expect(getActiveWorldName()).toBeNull();
  });
});
