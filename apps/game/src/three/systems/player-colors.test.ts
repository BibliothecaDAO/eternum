import { expect, it } from "vitest";
import { playerColorManager } from "./player-colors";

it("uses green for self, blue for allies and red for every enemy, including agents", () => {
  for (const agent of [false, true]) {
    expect(playerColorManager.getProfileForUnit(true, false, agent, 1n).primary.getHexString()).toBe("4ade80");
    expect(playerColorManager.getProfileForUnit(false, true, agent, 2n).primary.getHexString()).toBe("60a5fa");
    for (const owner of [3n, 4n, 999n]) {
      expect(playerColorManager.getProfileForUnit(false, false, agent, owner).primary.getHexString()).toBe("ef4444");
    }
  }
});
it("changes the relation colour immediately without retaining an address-based colour assignment", () => {
  const enemy = playerColorManager.getProfileForUnit(false, false, false, 3n);
  const captured = playerColorManager.getProfileForUnit(true, false, false, 3n);
  const allied = playerColorManager.getProfileForUnit(false, true, false, 3n);
  expect(enemy.primary.equals(captured.primary)).toBe(false);
  expect(allied.primary.equals(captured.primary)).toBe(false);
  expect(playerColorManager.getProfileForUnit(false, false, false, 4n)).toBe(enemy);
});
