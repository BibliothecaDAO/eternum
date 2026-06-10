// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import {
  beginRealmBuildPlacement,
  clearAllBuildReservationState,
  completeRealmBuildPlacement,
  getBuildReservationState,
  reserveOccupiedBuildSpot,
  reserveVacatedBuildSpot,
  reconcileBuildReservationState,
  toSpotKey,
} from "./build-reservation-store";

describe("build-reservation-store", () => {
  beforeEach(() => {
    clearAllBuildReservationState();
  });

  it("persists reservations per realm across realm switches", () => {
    reserveOccupiedBuildSpot(101, { col: 4, row: 9 }, 1000);

    const realmB = getBuildReservationState(202);
    expect(realmB.occupied.has(toSpotKey({ col: 4, row: 9 }))).toBe(false);

    const realmAAgain = getBuildReservationState(101);
    expect(realmAAgain.occupied.has(toSpotKey({ col: 4, row: 9 }))).toBe(true);
  });

  it("keeps fresh reservations during optimistic settle window", () => {
    reserveOccupiedBuildSpot(303, { col: 1, row: 1 }, 1000);
    reserveVacatedBuildSpot(303, { col: 2, row: 2 }, 1000);

    reconcileBuildReservationState(303, () => true, { now: 2000, settleMs: 3000 });

    const state = getBuildReservationState(303);
    expect(state.occupied.has(toSpotKey({ col: 1, row: 1 }))).toBe(true);
    expect(state.vacated.has(toSpotKey({ col: 2, row: 2 }))).toBe(true);
  });

  it("reconciles settled reservations against occupancy", () => {
    reserveOccupiedBuildSpot(404, { col: 1, row: 1 }, 1000);
    reserveOccupiedBuildSpot(404, { col: 2, row: 2 }, 1000);
    reserveVacatedBuildSpot(404, { col: 3, row: 3 }, 1000);
    reserveVacatedBuildSpot(404, { col: 4, row: 4 }, 1000);

    reconcileBuildReservationState(
      404,
      ({ col, row }) => {
        if (col === 1 && row === 1) return true;
        if (col === 2 && row === 2) return false;
        if (col === 3 && row === 3) return false;
        return true;
      },
      { now: 5000, settleMs: 3000 },
    );

    const state = getBuildReservationState(404);
    expect(state.occupied.has(toSpotKey({ col: 1, row: 1 }))).toBe(false);
    expect(state.occupied.has(toSpotKey({ col: 2, row: 2 }))).toBe(true);
    expect(state.vacated.has(toSpotKey({ col: 3, row: 3 }))).toBe(false);
    expect(state.vacated.has(toSpotKey({ col: 4, row: 4 }))).toBe(true);
  });

  it("drops stale reservations when sync never confirms", () => {
    reserveOccupiedBuildSpot(505, { col: 1, row: 1 }, 1000);
    reserveVacatedBuildSpot(505, { col: 2, row: 2 }, 1000);

    reconcileBuildReservationState(505, ({ col, row }) => (col === 1 && row === 1 ? false : true), {
      now: 120000,
      settleMs: 3000,
      staleMs: 90000,
    });

    const state = getBuildReservationState(505);
    expect(state.occupied.has(toSpotKey({ col: 1, row: 1 }))).toBe(false);
    expect(state.vacated.has(toSpotKey({ col: 2, row: 2 }))).toBe(false);
  });

  it("blocks duplicate build placements synchronously until the placement completes", () => {
    const firstPlacement = beginRealmBuildPlacement(606, 29, 1000);
    const duplicatePlacement = beginRealmBuildPlacement(606, 29, 1000);
    const otherBuildingPlacement = beginRealmBuildPlacement(606, 30, 1000);

    expect(firstPlacement).toEqual({ started: true });
    expect(duplicatePlacement).toEqual({ started: false });
    expect(otherBuildingPlacement).toEqual({ started: true });

    completeRealmBuildPlacement(606, 29);

    expect(beginRealmBuildPlacement(606, 29, 1000)).toEqual({ started: true });
  });

  it("clears stale build placement locks", () => {
    beginRealmBuildPlacement(707, 29, 1000);

    reconcileBuildReservationState(707, () => false, {
      now: 120000,
      settleMs: 3000,
      staleMs: 90000,
    });

    expect(beginRealmBuildPlacement(707, 29, 120000)).toEqual({ started: true });
  });
});
