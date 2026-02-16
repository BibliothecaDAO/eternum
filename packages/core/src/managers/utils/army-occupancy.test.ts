import { describe, expect, it } from "vitest";
import { resolveArmyOccupancyAtContractHex } from "./army-occupancy";

describe("resolveArmyOccupancyAtContractHex", () => {
  it("treats self-occupancy as empty for pathing decisions", () => {
    const center = 100;
    const armyHexes = new Map([
      [
        5,
        new Map([
          [
            7,
            {
              id: 42,
              owner: 999n,
            },
          ],
        ]),
      ],
    ]);

    const result = resolveArmyOccupancyAtContractHex({
      armyHexes: armyHexes as any,
      contractCol: 105,
      contractRow: 107,
      feltCenter: center,
      selectedArmyId: 42,
      playerAddress: 999n as any,
    });

    expect(result.hasArmy).toBe(false);
    expect(result.isArmyMine).toBe(false);
    expect(result.isSelfArmy).toBe(true);
  });

  it("keeps enemy occupancy as blocking", () => {
    const center = 100;
    const armyHexes = new Map([
      [
        5,
        new Map([
          [
            7,
            {
              id: 84,
              owner: 111n,
            },
          ],
        ]),
      ],
    ]);

    const result = resolveArmyOccupancyAtContractHex({
      armyHexes: armyHexes as any,
      contractCol: 105,
      contractRow: 107,
      feltCenter: center,
      selectedArmyId: 42,
      playerAddress: 999n as any,
    });

    expect(result.hasArmy).toBe(true);
    expect(result.isArmyMine).toBe(false);
    expect(result.isSelfArmy).toBe(false);
  });
});
