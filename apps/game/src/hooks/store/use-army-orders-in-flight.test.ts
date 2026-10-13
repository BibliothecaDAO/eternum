import { afterEach, describe, expect, it, vi } from "vitest";

const waitForAction = vi.fn();
vi.mock("@/sync/active-game-client", () => ({ requireActiveGameClient: () => ({ waitForAction }) }));

import { armyOrderInFlight, orderArmy } from "./use-army-orders-in-flight";

afterEach(() => waitForAction.mockReset());

const APPLIED = { hash: "0x1", block: 9, status: "SUCCEEDED" };
const send = () => vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));

describe("an army's order", () => {
  it("is one at a time: a second order for the army sends nothing until the first one's outcome arrives", async () => {
    let apply: (outcome: unknown) => void = () => {};
    waitForAction.mockReturnValueOnce(new Promise((resolve) => (apply = resolve)));
    const explore = send();
    const first = orderArmy(7, "explore", explore);
    expect(armyOrderInFlight(7)).toBe("explore");

    const attack = send();
    expect(await orderArmy(7, "attack", attack)).toBe(false);
    expect(attack).not.toHaveBeenCalled();
    // Another army is not held by it.
    waitForAction.mockResolvedValueOnce(APPLIED);
    expect(await orderArmy(8, "move", send())).toBe(true);

    apply(APPLIED);
    expect(await first).toBe(true);
    expect(explore).toHaveBeenCalledTimes(1);
    expect(armyOrderInFlight(7)).toBeUndefined();
  });

  it("frees the army when the game refuses the order or it cannot be sent, and passes the reason on", async () => {
    waitForAction.mockResolvedValueOnce({
      hash: "0x1",
      block: 9,
      status: "REJECTED",
      revertReason: "Tile is occupied",
    });
    await expect(orderArmy(7, "move", send())).rejects.toThrow("Tile is occupied");
    expect(armyOrderInFlight(7)).toBeUndefined();

    await expect(orderArmy(7, "move", () => Promise.reject(new Error("refused by the shard")))).rejects.toThrow(
      "refused by the shard",
    );
    expect(armyOrderInFlight(7)).toBeUndefined();
  });
});
