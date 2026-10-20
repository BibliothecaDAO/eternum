import { expect, it } from "vitest";
import { selectSpectatorStandings } from "./spectator-standings-model";
const entries = Array.from({ length: 12 }, (_, index) => ({
  address: `0x${(index + 1).toString(16)}`,
  rank: index + 1,
  totalPoints: 120 - index,
}));
it("keeps the selected player outside the top ten without duplicating a top player, and lights no one else", () => {
  const rows = selectSpectatorStandings(entries, { viewer: null, selected: 12n });
  expect(rows.map((row) => [row.rank, row.own])).toEqual([
    ...Array.from({ length: 10 }, (_, index) => [index + 1, false]),
    [12, false],
  ]);
  expect(selectSpectatorStandings(entries, { viewer: null, selected: 1n })).toHaveLength(10);
});
it("keeps the viewer's own row outside the top ten, as Results does, and lights only it", () => {
  const rows = selectSpectatorStandings(entries, { viewer: "0xb", selected: 12n });
  expect(rows.slice(10).map((row) => [row.rank, row.own])).toEqual([
    [11, true],
    [12, false],
  ]);
  expect(rows.filter((row) => row.own)).toHaveLength(1);
  expect(selectSpectatorStandings(entries, { viewer: "0x2", selected: undefined }).map((row) => row.own)).toEqual(
    Array.from({ length: 10 }, (_, index) => index === 1),
  );
});
