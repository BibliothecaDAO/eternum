// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  resolveHyperstructureReservationBatchSize,
  resolveHyperstructureReservationCount,
} from "./blitz-hyperstructure-reservation";

describe("blitz hyperstructure reservation helpers", () => {
  it("reserves twenty-five hyperstructures per transaction by default", () => {
    expect(resolveHyperstructureReservationBatchSize()).toBe(25);
  });

  it("falls back to the default batch size when landing summary counts are unavailable", () => {
    expect(resolveHyperstructureReservationCount({ remainingReservations: null, batchSize: 25 })).toBe(25);
  });

  it("still reserves the default batch when the landing summary reports zero remaining", () => {
    expect(resolveHyperstructureReservationCount({ remainingReservations: 0, batchSize: 25 })).toBe(25);
  });

  it("caps the next reservation to the remaining count", () => {
    expect(resolveHyperstructureReservationCount({ remainingReservations: 3, batchSize: 25 })).toBe(3);
  });
});
