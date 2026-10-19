import { expect, it } from "vitest";
import { selectSpectatorStandings } from "./spectator-standings-model";
const entries = Array.from({ length: 12 }, (_, index) => ({
  address: `0x${(index + 1).toString(16)}`,
  rank: index + 1,
  totalPoints: 120 - index,
}));
it("keeps the selected player pinned outside the top ten without duplicating a top player", () => {
  const rows = selectSpectatorStandings(entries, 12n);
  expect(rows).toHaveLength(11);
  expect(rows.at(-1)).toMatchObject({ rank: 12, pinned: true });
  expect(selectSpectatorStandings(entries, 1n)).toHaveLength(10);
});
