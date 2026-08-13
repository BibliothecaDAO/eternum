import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/dojo/game-scope", () => ({
  gameModel: (model: string) => `s2-${model}`,
}));

vi.mock("@/dojo/queries", () => ({
  getEntitiesFromTorii: vi.fn(),
}));

import { getEntitiesFromTorii } from "@/dojo/queries";
import { syncExplorerAfterChestOpen } from "./sync-explorer-after-chest-open";

describe("syncExplorerAfterChestOpen", () => {
  beforeEach(() => {
    vi.mocked(getEntitiesFromTorii).mockReset();
  });

  it("writes the explorer and reward resource back into RECS", async () => {
    const toriiClient = {} as never;
    const contractComponents = [] as never;

    await syncExplorerAfterChestOpen({
      toriiClient,
      contractComponents,
      explorerEntityId: 42,
    });

    expect(getEntitiesFromTorii).toHaveBeenCalledWith(
      toriiClient,
      contractComponents,
      [42],
      ["s2-ExplorerTroops", "s2-Resource"],
    );
  });

  it("does nothing until the Torii sync dependencies are ready", async () => {
    await syncExplorerAfterChestOpen({
      toriiClient: undefined,
      contractComponents: undefined,
      explorerEntityId: 42,
    });

    expect(getEntitiesFromTorii).not.toHaveBeenCalled();
  });

  it("keeps the result panel usable when the recovery sync fails", async () => {
    const error = new Error("Torii unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getEntitiesFromTorii).mockRejectedValue(error);

    await expect(
      syncExplorerAfterChestOpen({
        toriiClient: {} as never,
        contractComponents: [] as never,
        explorerEntityId: 42,
      }),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith("[relic-chest] Failed to refresh explorer rewards", error);
    consoleError.mockRestore();
  });
});
