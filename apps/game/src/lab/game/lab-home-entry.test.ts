// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { registerHomeSource } from "@/services/realm-entry";
import { installLabChain, LAB_GAME } from "./lab-chain";
import { aspectSettleScenario } from "./aspect-settle-scenario";

it("answers a free home's source registration locally and refuses a source the fixture does not hold", async () => {
  const network = vi.fn(async () => Response.json({ error: "unexpected_network" }, { status: 500 }));
  vi.stubGlobal("fetch", network);
  try {
    const scenario = await installLabChain(aspectSettleScenario, Date.now());
    await expect(registerHomeSource(LAB_GAME, null)).resolves.toBeUndefined();
    await expect(registerHomeSource(LAB_GAME, 1)).rejects.toThrow("Link your Realm's wallet in Settings.");
    await expect(registerHomeSource({ ...LAB_GAME, gameId: 2 }, null)).rejects.toThrow(
      "This source cannot be attached to your home.",
    );
    expect(network).not.toHaveBeenCalled();
    expect(scenario.store.get("HomeAspect", { game_id: 1, home: 7 })).toBeUndefined();
    expect(window.__labChain?.sent).toEqual([]);
  } finally {
    vi.unstubAllGlobals();
  }
});
