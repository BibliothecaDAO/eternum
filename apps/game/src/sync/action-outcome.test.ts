import { afterEach, describe, expect, it, vi } from "vitest";

const waitForAction = vi.fn();
vi.mock("./active-game-client", () => ({ requireActiveGameClient: () => ({ waitForAction }) }));

import { ActionNotAppliedError, untilApplied } from "./action-outcome";

afterEach(() => waitForAction.mockReset());

const sent = Promise.resolve({ transaction_hash: "0xabc", statusReceipt: "PENDING" });

describe("a sent command's own outcome", () => {
  it("waits past the send for the game to apply the action", async () => {
    let apply: (outcome: unknown) => void = () => {};
    waitForAction.mockReturnValue(new Promise((resolve) => (apply = resolve)));
    const settled = vi.fn();
    const applied = untilApplied(sent).then(settled);
    await sent;
    await Promise.resolve();
    expect(waitForAction).toHaveBeenCalledWith("0xabc");
    expect(settled).not.toHaveBeenCalled();
    apply({ hash: "0xabc", block: 7, status: "SUCCEEDED" });
    await applied;
    // It names the action it followed, for whoever reads that action's own record.
    expect(settled).toHaveBeenCalledWith("0xabc");
  });

  it("rejects with the game's reason when the action was refused or reverted", async () => {
    waitForAction.mockResolvedValueOnce({
      hash: "0xabc",
      block: 7,
      status: "REJECTED",
      revertReason: "Not enough stamina",
    });
    await expect(untilApplied(sent)).rejects.toThrow(new ActionNotAppliedError("Not enough stamina"));
    waitForAction.mockResolvedValueOnce({ hash: "0xabc", block: 7, status: "REVERTED" });
    await expect(untilApplied(sent)).rejects.toBeInstanceOf(ActionNotAppliedError);
  });

  it("rejects with the send's own error when the command was never sent, and asks for no outcome", async () => {
    await expect(untilApplied(Promise.reject(new Error("refused before forwarding")))).rejects.toThrow(
      "refused before forwarding",
    );
    expect(waitForAction).not.toHaveBeenCalled();
  });
});
