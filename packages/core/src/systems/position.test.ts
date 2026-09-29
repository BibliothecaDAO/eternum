import { afterEach, describe, expect, it, vi } from "vitest";
import { configManager } from "../managers/config-manager";
import { Position } from "./position";

const MAP_CENTER = 2147483646;

describe("Position", () => {
  afterEach(() => vi.restoreAllMocks());

  it("round-trips a Frontier site far from the map centre exactly", () => {
    vi.spyOn(configManager, "getMapCenter").mockReturnValue(MAP_CENTER);
    const site = { x: 570850, y: 1250 };
    const normalized = Position.fromContract(site).getNormalized();
    expect(normalized).toEqual({ x: 570850 - MAP_CENTER, y: 1250 - MAP_CENTER });
    expect(Position.fromNormalized(normalized).getContract()).toEqual(site);
  });

  it("round-trips a Blitz hex beside the map centre exactly", () => {
    vi.spyOn(configManager, "getMapCenter").mockReturnValue(MAP_CENTER);
    const hex = { x: MAP_CENTER + 12, y: MAP_CENTER - 7 };
    expect(Position.fromContract(hex).getNormalized()).toEqual({ x: 12, y: -7 });
    expect(Position.fromNormalized({ x: 12, y: -7 }).getContract()).toEqual(hex);
  });
});
