import { describe, expect, it } from "vitest";

import { shouldRefreshSelectedArmyActionPaths } from "./worldmap-action-refresh";

describe("shouldRefreshSelectedArmyActionPaths", () => {
  it("returns true when an army is selected and armies tick advanced", () => {
    expect(
      shouldRefreshSelectedArmyActionPaths({
        selectedEntityId: 123,
        selectedEntityIsArmy: true,
        previousArmiesTick: 99,
        currentArmiesTick: 100,
        isChunkTransitioning: false,
        hasPendingMovement: false,
      }),
    ).toBe(true);
  });

  it("returns false when armies tick has not advanced", () => {
    expect(
      shouldRefreshSelectedArmyActionPaths({
        selectedEntityId: 123,
        selectedEntityIsArmy: true,
        previousArmiesTick: 100,
        currentArmiesTick: 100,
        isChunkTransitioning: false,
        hasPendingMovement: false,
      }),
    ).toBe(false);
  });

  it("returns false when no entity is selected", () => {
    expect(
      shouldRefreshSelectedArmyActionPaths({
        selectedEntityId: null,
        selectedEntityIsArmy: false,
        previousArmiesTick: 99,
        currentArmiesTick: 100,
        isChunkTransitioning: false,
        hasPendingMovement: false,
      }),
    ).toBe(false);
  });

  it("returns false when selected entity is not an army", () => {
    expect(
      shouldRefreshSelectedArmyActionPaths({
        selectedEntityId: 321,
        selectedEntityIsArmy: false,
        previousArmiesTick: 99,
        currentArmiesTick: 100,
        isChunkTransitioning: false,
        hasPendingMovement: false,
      }),
    ).toBe(false);
  });

  it("returns false while chunk transition is running", () => {
    expect(
      shouldRefreshSelectedArmyActionPaths({
        selectedEntityId: 123,
        selectedEntityIsArmy: true,
        previousArmiesTick: 99,
        currentArmiesTick: 100,
        isChunkTransitioning: true,
        hasPendingMovement: false,
      }),
    ).toBe(false);
  });

  it("returns false while selected army has pending movement", () => {
    expect(
      shouldRefreshSelectedArmyActionPaths({
        selectedEntityId: 123,
        selectedEntityIsArmy: true,
        previousArmiesTick: 99,
        currentArmiesTick: 100,
        isChunkTransitioning: false,
        hasPendingMovement: true,
      }),
    ).toBe(false);
  });
});
