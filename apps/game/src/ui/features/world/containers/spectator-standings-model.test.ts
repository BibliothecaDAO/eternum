import { expect, it } from "vitest";
import { selectSpectatorStandings } from "./spectator-standings-model";
const entries = Array.from({ length: 120 }, (_, index) => ({
  address: `0x${(index + 1).toString(16)}`,
  rank: index + 1,
  totalPoints: 1200 - index,
}));
it("keeps every player by rank, past the ten it once showed, and lights only the viewer's row", () => {
  const rows = selectSpectatorStandings(entries.toReversed(), "0x6e");
  expect(rows.map((row) => row.rank)).toEqual(entries.map((entry) => entry.rank));
  expect(rows.filter((row) => row.own).map((row) => row.rank)).toEqual([110]);
  expect(selectSpectatorStandings(entries, null).some((row) => row.own)).toBe(false);
});
