import { afterEach, describe, expect, it, vi } from "vitest";
const { getBlitzConfig } = vi.hoisted(() => ({
  getBlitzConfig: vi.fn(),
}));

vi.mock("../managers", () => ({
  configManager: {
    getBlitzConfig,
  },
}));

import {
  getHyperstructureRealmCheckRadius,
  resolveBlitzMapDistanceProfile,
  resolveHyperstructureRealmCheckRadius,
} from "./hyperstructure";

describe("hyperstructure realm check radius", () => {
  afterEach(() => {
    getBlitzConfig.mockReset();
  });

  it("derives the blitz realm check radius from base distance for three-realm layouts", () => {
    expect(resolveHyperstructureRealmCheckRadius(resolveBlitzMapDistanceProfile(2), false)).toBe(8);
    expect(resolveHyperstructureRealmCheckRadius(resolveBlitzMapDistanceProfile(1), false)).toBe(6);
  });

  it("adds the center tile radius for single-realm layouts", () => {
    expect(resolveHyperstructureRealmCheckRadius(resolveBlitzMapDistanceProfile(2), true)).toBe(10);
    expect(resolveHyperstructureRealmCheckRadius(resolveBlitzMapDistanceProfile(1), true)).toBe(8);
  });

  it("reads the live blitz profile before applying the formula", () => {
    getBlitzConfig.mockReturnValue({
      blitz_mode_on: true,
      blitz_settlement_config: {
        base_distance: 8,
        side: 0,
        step: 1,
        point: 1,
        single_realm_mode: true,
        two_player_mode: false,
      },
      blitz_exploration_config: {
        reward_profile_id: 1,
      },
      blitz_registration_config: {
        fee_amount: BigInt(0),
        fee_token: BigInt(0),
        fee_recipient: BigInt(0),
        entry_token_address: BigInt(0),
        collectibles_cosmetics_max: BigInt(0),
        collectibles_cosmetics_address: BigInt(0),
        collectibles_timelock_address: BigInt(0),
        collectibles_lootchest_address: BigInt(0),
        collectibles_elitenft_address: BigInt(0),
        registration_count: 0,
        registration_count_max: 0,
        registration_start_at: 0,
        registration_end_at: 0,
        creation_start_at: 0,
        creation_end_at: 0,
        assigned_positions_count: 0,
      },
      blitz_num_hyperstructures_left: 0,
      num_spires_left: 0,
      spires_settled_count: 0,
    });

    expect(getHyperstructureRealmCheckRadius()).toBe(8);
  });

  it("falls back to the default multiplayer base distance when blitz config is unavailable", () => {
    getBlitzConfig.mockReturnValue(undefined);

    expect(getHyperstructureRealmCheckRadius()).toBe(8);
  });

  it("treats profile id 0 as the default official 90 profile", () => {
    expect(resolveBlitzMapDistanceProfile(0)).toEqual(resolveBlitzMapDistanceProfile(2));
  });

  it("throws for unknown blitz profile ids", () => {
    expect(() => resolveBlitzMapDistanceProfile(99)).toThrow("unknown blitz map distance profile");
  });
});
