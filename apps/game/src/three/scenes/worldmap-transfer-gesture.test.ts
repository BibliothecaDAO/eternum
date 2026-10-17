import { describe, expect, it } from "vitest";
import { transferGesture } from "./worldmap-transfer-gesture";

const MINE = new Set([101, 102, 103]);
const canTransferBetween = (source: number, destination: number) => MINE.has(source) && MINE.has(destination);
const base = {
  selectedHoldingId: 101,
  armySelected: false,
  clickedId: 102,
  canTransferBetween,
  transfersAllowed: true,
};

describe("the map's transfer gesture", () => {
  it("opens the transfer from the selected holding to the right-clicked one", () => {
    expect(transferGesture(base)).toEqual({ sourceId: 101, destinationIds: [102] });
  });

  it("leaves the right-click to an army's order, the holding itself, or a pair that cannot trade goods", () => {
    expect(transferGesture({ ...base, armySelected: true })).toBeNull();
    expect(transferGesture({ ...base, selectedHoldingId: 0 })).toBeNull();
    expect(transferGesture({ ...base, clickedId: 101 })).toBeNull();
    expect(transferGesture({ ...base, clickedId: 900 })).toBeNull();
    expect(transferGesture({ ...base, selectedHoldingId: 900 })).toBeNull();
    expect(transferGesture({ ...base, transfersAllowed: false })).toBeNull();
  });
});
