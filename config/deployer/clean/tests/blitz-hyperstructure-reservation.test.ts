import { describe, expect, test } from "bun:test";
import {
  BLITZ_HYPERSTRUCTURE_RESERVATION_BATCH_SIZE,
  buildReserveBlitzHyperstructuresCall,
  resolveBlitzHyperstructureReservationCallCount,
  shouldReserveBlitzHyperstructures,
} from "../blitz/hyperstructure-reservation";

describe("blitz hyperstructure reservation helpers", () => {
  test("detects whether a blitz launch needs hyperstructure reservation", () => {
    expect(
      shouldReserveBlitzHyperstructures({
        blitz: {
          mode: { on: true },
          registration: { registration_count_max: 24 },
        },
        settlement: { two_player_mode: false },
      } as any),
    ).toBe(true);

    expect(
      shouldReserveBlitzHyperstructures({
        blitz: {
          mode: { on: false },
          registration: { registration_count_max: 24 },
        },
        settlement: { two_player_mode: false },
      } as any),
    ).toBe(false);
  });

  test("computes the fixed-size reservation loop count from registration settings", () => {
    expect(
      resolveBlitzHyperstructureReservationCallCount({
        blitz: {
          mode: { on: true },
          registration: { registration_count_max: 24 },
        },
        settlement: { two_player_mode: false },
      } as any),
    ).toBe(1);

    expect(
      resolveBlitzHyperstructureReservationCallCount({
        blitz: {
          mode: { on: true },
          registration: { registration_count_max: 2 },
        },
        settlement: { two_player_mode: true },
      } as any),
    ).toBe(1);

    expect(
      resolveBlitzHyperstructureReservationCallCount({
        blitz: {
          mode: { on: true },
          registration: { registration_count_max: 60 },
        },
        settlement: { two_player_mode: false },
      } as any),
    ).toBe(4);
  });

  test("builds a fixed-size reserve_hyperstructures call from the patched manifest", () => {
    const call = buildReserveBlitzHyperstructuresCall({
      contracts: [{ tag: "s1_eternum-hyperstructure_create_systems", address: "0xhyper" }],
    } as any);

    expect(call).toMatchObject({
      contractAddress: "0xhyper",
      entrypoint: "reserve_hyperstructures",
      calldata: [String(BLITZ_HYPERSTRUCTURE_RESERVATION_BATCH_SIZE)],
    });
  });
});
