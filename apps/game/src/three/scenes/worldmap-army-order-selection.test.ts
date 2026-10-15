import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const waitForAction = vi.fn();
vi.mock("@/sync/active-game-client", () => ({ requireActiveGameClient: () => ({ waitForAction }) }));

import { inFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";

import { offerSelectedArmyOrdersAtOutcome, sendSelectedArmyTravel } from "./worldmap-army-order-selection";
import { getLiveWorldmapEntityActions, resetWorldmapEntityActions } from "./worldmap-interaction-state";

const APPLIED = { hash: "0x1", block: 9, status: "SUCCEEDED" };
const REFUSED = { hash: "0x1", block: 9, status: "REJECTED", revertReason: "Tile is occupied" };

const send = () => vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
const select = (entityId: number | null) => useUIStore.getState().updateEntityActionSelectedEntityId(entityId);
const selected = () => getLiveWorldmapEntityActions().selectedEntityId;

/** The orders the map offered, with whether the army was still in flight then: orders are only planned for a free one. */
let offered: Array<{ entityId: number; inFlight: boolean }>;
let stopOffering: () => void;

/** The world's answer to the next order, held until the test applies or refuses it. */
const holdTheAnswer = () => {
  let answer: (outcome: unknown) => void = () => {};
  waitForAction.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
  return (outcome: unknown) => answer(outcome);
};

const sendTravel = (entityId: number, order: "explore" | "move", to = { col: 3, row: 4 }) => {
  const outcome = { applied: vi.fn(), refused: vi.fn() };
  const sent = send();
  sendSelectedArmyTravel(entityId, { order, to }, sent, outcome);
  return { ...outcome, sent };
};

beforeEach(() => {
  resetWorldmapEntityActions();
  offered = [];
  stopOffering = offerSelectedArmyOrdersAtOutcome((entityId) =>
    offered.push({ entityId, inFlight: inFlight("army", entityId) !== undefined }),
  );
});

afterEach(() => {
  stopOffering();
  waitForAction.mockReset();
});

describe("the selected army's move or explore", () => {
  it("keeps the army selected through its confirmation, then a second order goes without selecting it again", async () => {
    select(7);
    const answer = holdTheAnswer();
    const move = sendTravel(7, "move");

    expect(inFlight("army", 7)).toEqual({ order: "move", to: { col: 3, row: 4 } });
    expect(selected()).toBe(7);
    expect(offered).toEqual([]);

    answer(APPLIED);
    await vi.waitFor(() => expect(move.applied).toHaveBeenCalled());
    expect(selected()).toBe(7);
    // Offered once it is free, so its orders are planned from the tile the applied move left it on.
    expect(offered).toEqual([{ entityId: 7, inFlight: false }]);

    waitForAction.mockResolvedValueOnce(APPLIED);
    const explore = sendTravel(selected()!, "explore", { col: 4, row: 4 });
    await vi.waitFor(() => expect(explore.applied).toHaveBeenCalled());
    expect(explore.sent).toHaveBeenCalledTimes(1);
    expect(explore.refused).not.toHaveBeenCalled();
    expect(selected()).toBe(7);
    expect(offered).toEqual([
      { entityId: 7, inFlight: false },
      { entityId: 7, inFlight: false },
    ]);
  });

  it("keeps a refused army selected and offers it its orders again from where it stands", async () => {
    select(11);
    waitForAction.mockResolvedValueOnce(REFUSED);
    const move = sendTravel(11, "move");

    await vi.waitFor(() => expect(move.refused).toHaveBeenCalled());
    expect(move.refused.mock.calls[0][0]).toMatchObject({ message: "Tile is occupied" });
    expect(move.applied).not.toHaveBeenCalled();
    expect(selected()).toBe(11);
    expect(offered).toEqual([{ entityId: 11, inFlight: false }]);
  });

  it("keeps the army selected when its order cannot be sent, and offers its orders again", async () => {
    select(12);
    const outcome = { applied: vi.fn(), refused: vi.fn() };
    sendSelectedArmyTravel(
      12,
      { order: "explore", to: { col: 3, row: 4 } },
      () => Promise.reject(new Error("refused by the shard")),
      outcome,
    );

    await vi.waitFor(() => expect(outcome.refused).toHaveBeenCalled());
    expect(selected()).toBe(12);
    expect(offered).toEqual([{ entityId: 12, inFlight: false }]);
  });

  it("offers nothing to an army deselected while its order is in flight, and does not select it again", async () => {
    select(13);
    const answer = holdTheAnswer();
    const move = sendTravel(13, "move");

    select(null);
    answer(APPLIED);
    await vi.waitFor(() => expect(move.applied).toHaveBeenCalled());

    expect(selected()).toBeNull();
    expect(offered).toEqual([]);
  });

  it("offers nothing to an army whose order lands after the player selected another, which stays selected", async () => {
    select(14);
    const answer = holdTheAnswer();
    const move = sendTravel(14, "explore");

    select(15);
    answer(REFUSED);
    await vi.waitFor(() => expect(move.refused).toHaveBeenCalled());

    expect(selected()).toBe(15);
    expect(offered).toEqual([]);
  });
});
