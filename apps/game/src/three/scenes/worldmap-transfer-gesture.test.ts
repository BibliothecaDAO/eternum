import { describe, expect, it } from "vitest";
import { transferGesture } from "./worldmap-transfer-gesture";

const MINE = new Set([101, 102, 103]);
const canTransferBetween = (source: number, destination: number) => MINE.has(source) && MINE.has(destination);

describe("the map's transfer gesture", () => {
  it("opens the transfer from the selected holding to the right-clicked one", () => {
    expect(
      transferGesture({
        selection: { kind: "structure", entityId: 101 },
        clickedId: 102,
        canTransferBetween,
        transfersAllowed: true,
      }),
    ).toEqual({ sourceId: 101, destinationIds: [102] });
  });

  it("leaves the right-click to the holding's menu otherwise", () => {
    const base = { clickedId: 102, canTransferBetween, transfersAllowed: true };
    expect(transferGesture({ ...base, selection: null })).toBeNull();
    expect(transferGesture({ ...base, selection: { kind: "hex", hex: { col: 1, row: 1 } } })).toBeNull();
    expect(transferGesture({ ...base, selection: { kind: "army", entityId: 7, tile: null } })).toBeNull();
    expect(transferGesture({ ...base, selection: { kind: "structure", entityId: 102 } })).toBeNull();
    expect(transferGesture({ ...base, selection: { kind: "structure", entityId: 900 } })).toBeNull();
    expect(
      transferGesture({ ...base, selection: { kind: "structure", entityId: 101 }, transfersAllowed: false }),
    ).toBeNull();
  });
});
