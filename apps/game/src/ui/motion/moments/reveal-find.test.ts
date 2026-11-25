import { describe, expect, it } from "vitest";

import { type ArmyAtReveal, classifyRevealFind } from "./reveal-find";

const STANDS = { col: 10, row: 4, alt: false };
const sent: ArmyAtReveal = {
  tile: STANDS,
  stamina: 48,
  revealCost: 20,
  oathPick: 0,
  revealed: false,
  occupied: false,
};
const landed = (change: Partial<ArmyAtReveal>): ArmyAtReveal => ({ ...sent, revealed: true, ...change });

describe("a reveal's find", () => {
  it("is a Well when the army stayed, the tile came up bare and its stamina did not drop, the refill counted whole", () => {
    expect(classifyRevealFind(sent, landed({ stamina: 120 }))).toEqual({ kind: "well", gain: 120 - 48 + 20 });
    expect(classifyRevealFind(sent, landed({ stamina: 48 }))).toEqual({ kind: "well", gain: 20 });
  });

  it("is a Shrine otherwise, and offers an Oath only when the army's pick turned up", () => {
    expect(classifyRevealFind(sent, landed({ stamina: 28, oathPick: 5 }))).toEqual({ kind: "shrine", offered: true });
    expect(classifyRevealFind(sent, landed({ stamina: 28 }))).toEqual({ kind: "shrine", offered: false });
  });

  it("is nothing when the army moved on, the tile was already known, a structure stands on it or the order was refused", () => {
    expect(classifyRevealFind(sent, landed({ tile: { ...STANDS, col: 11 } }))).toBeNull();
    expect(classifyRevealFind({ ...sent, revealed: true }, landed({ stamina: 120 }))).toBeNull();
    expect(classifyRevealFind(sent, landed({ occupied: true }))).toBeNull();
    expect(classifyRevealFind(sent, { ...sent })).toBeNull();
  });
});
