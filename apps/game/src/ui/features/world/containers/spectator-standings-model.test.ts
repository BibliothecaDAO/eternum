import { expect, it } from "vitest";
import { advanceStandingsTick, selectSpectatorStandings } from "./spectator-standings-model";
const entries = Array.from({ length: 12 }, (_, index) => ({
  address: `0x${(index + 1).toString(16)}`,
  rank: index + 1,
  totalPoints: 120 - index,
}));
it("keeps the selected player pinned outside the top ten without duplicating a top player", () => {
  const rows = selectSpectatorStandings(entries, 12n, null);
  expect(rows).toHaveLength(11);
  expect(rows.at(-1)).toMatchObject({ rank: 12, pinned: true });
  expect(selectSpectatorStandings(entries, 1n, null)).toHaveLength(10);
});
it("compares against the previous tick, not the previous refresh", () => {
  let history = advanceStandingsTick(null, 10, entries);
  const scored = entries.map((entry) => ({ ...entry, totalPoints: entry.totalPoints + 5 }));
  history = advanceStandingsTick(history, 11, scored);
  history = advanceStandingsTick(
    history,
    11,
    scored.map((entry) => ({ ...entry, totalPoints: entry.totalPoints + 2 })),
  );
  expect(
    selectSpectatorStandings(
      scored.map((entry) => ({ ...entry, totalPoints: entry.totalPoints + 2 })),
      undefined,
      history,
    )[0].delta,
  ).toBe(7);
  history = advanceStandingsTick(history, 12, scored);
  expect(selectSpectatorStandings(scored, undefined, history)[0].delta).toBe(-2);
  expect(selectSpectatorStandings(entries, undefined, advanceStandingsTick(null, 10, entries))[0].delta).toBe(0);
});
