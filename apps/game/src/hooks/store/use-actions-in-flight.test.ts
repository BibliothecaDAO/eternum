import { afterEach, describe, expect, it, vi } from "vitest";

const waitForAction = vi.fn();
vi.mock("@/sync/active-game-client", () => ({ requireActiveGameClient: () => ({ waitForAction }) }));

import { inFlight, onOutcome, sendOnce } from "./use-actions-in-flight";

afterEach(() => waitForAction.mockReset());

const APPLIED = { hash: "0x1", block: 9, status: "SUCCEEDED" };
const send = () => vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));

describe("an action in flight", () => {
  it("is one at a time: a second order for the army sends nothing until the first one's outcome arrives", async () => {
    let apply: (outcome: unknown) => void = () => {};
    waitForAction.mockReturnValueOnce(new Promise((resolve) => (apply = resolve)));
    const explore = send();
    const first = sendOnce("army", 7, { order: "explore" }, explore);
    expect(inFlight("army", 7)).toEqual({ order: "explore" });

    const attack = send();
    expect(await sendOnce("army", 7, { order: "attack" }, attack)).toBeNull();
    expect(inFlight("army", 7)).toEqual({ order: "explore" });
    // Another army is not held by it.
    waitForAction.mockResolvedValueOnce(APPLIED);
    expect(await sendOnce("army", 8, { order: "move" }, send())).toBe("0x1");

    apply(APPLIED);
    expect(await first).toBe("0x1");
    expect(explore).toHaveBeenCalledTimes(1);
    expect(inFlight("army", 7)).toBeUndefined();
  });

  it("frees the army when the game refuses the order or it cannot be sent, and passes the reason on", async () => {
    waitForAction.mockResolvedValueOnce({
      hash: "0x1",
      block: 9,
      status: "REJECTED",
      revertReason: "Tile is occupied",
    });
    await expect(sendOnce("army", 7, { order: "move" }, send())).rejects.toThrow("Tile is occupied");
    expect(inFlight("army", 7)).toBeUndefined();

    await expect(
      sendOnce("army", 7, { order: "move" }, () => Promise.reject(new Error("refused by the shard"))),
    ).rejects.toThrow("refused by the shard");
    expect(inFlight("army", 7)).toBeUndefined();
  });

  it("carries the tile a move takes the army to, and tells its surface each army's outcome once it is free", async () => {
    const heard: Array<{ key: string; stillInFlight: boolean }> = [];
    const stop = onOutcome("army", (key) => heard.push({ key, stillInFlight: inFlight("army", key) !== undefined }));
    let apply: (outcome: unknown) => void = () => {};
    waitForAction.mockReturnValueOnce(new Promise((resolve) => (apply = resolve)));
    const moved = sendOnce("army", 7, { order: "move", to: { col: 3, row: 4 } }, send());
    expect(inFlight("army", 7)).toEqual({ order: "move", to: { col: 3, row: 4 } });
    expect(heard).toEqual([]);
    apply(APPLIED);
    await moved;

    waitForAction.mockResolvedValueOnce({
      hash: "0x1",
      block: 9,
      status: "REJECTED",
      revertReason: "Tile is occupied",
    });
    await expect(sendOnce("army", 8, { order: "explore" }, send())).rejects.toThrow("Tile is occupied");
    // Another kind of subject is not an army's outcome.
    waitForAction.mockResolvedValueOnce(APPLIED);
    await sendOnce("deploy", 7, true, send());
    expect(heard).toEqual([
      { key: "7", stillInFlight: false },
      { key: "8", stillInFlight: false },
    ]);

    stop();
    waitForAction.mockResolvedValueOnce(APPLIED);
    await sendOnce("army", 7, { order: "move" }, send());
    expect(heard).toEqual([
      { key: "7", stillInFlight: false },
      { key: "8", stillInFlight: false },
    ]);
  });

  it("holds each subject on its own: a plot, a realm's next army, a research row, a castle", async () => {
    waitForAction.mockReturnValue(new Promise(() => {}));
    const building = { type: 1, plot: { col: 11, row: 10 } };
    void sendOnce("plot", "7:11,10", building, send());
    void sendOnce("deploy", 7, true, send());
    expect(inFlight("plot", "7:11,10")).toBe(building);
    expect(inFlight("plot", "7:12,10")).toBeUndefined();
    expect(inFlight("deploy", 7)).toBe(true);
    // A second press of each sends nothing; another plot, and the same realm's castle, are free.
    const again = send();
    expect(await sendOnce("plot", "7:11,10", building, again)).toBeNull();
    expect(await sendOnce("deploy", 7, true, again)).toBeNull();
    expect(again).not.toHaveBeenCalled();
    expect(inFlight("castle", 7)).toBeUndefined();
  });

  it("frees the subject, with the client's own message, when no answer came for the action", async () => {
    const noAnswer = new Error("No answer yet. This action may still apply. You can try another action.");
    waitForAction.mockRejectedValueOnce(noAnswer);
    await expect(sendOnce("research", "7:3", true, send())).rejects.toBe(noAnswer);
    expect(inFlight("research", "7:3")).toBeUndefined();
  });
});
