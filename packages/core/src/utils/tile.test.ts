import { describe, expect, it } from "vitest";
import { BiomeType } from "@bibliothecadao/types";

import type { NativeFactStore } from "../client/native-fact-store";
import { storedBiomeAt } from "./tile";

// A far-east tile a playtest army stood on (shard C game 1, realm 7,603's column): the chain stored Shrubland (9) where
// the client's own noise said Ocean, and drew the army as a boat.
const FAR_EAST = { col: 760245, row: 52, data: 0x20017336a0000006812000000aa1en };
const storeWith = (row: object | undefined) => ({ get: () => row }) as unknown as NativeFactStore;

describe("stored biome", () => {
  it("reads a revealed tile's biome from the row the chain stored", () => {
    const store = storeWith({ game_id: 1, alt: false, col: FAR_EAST.col, row: FAR_EAST.row, data: FAR_EAST.data });
    expect(storedBiomeAt(store, false, FAR_EAST.col, FAR_EAST.row, 1)).toBe(BiomeType.Shrubland);
  });

  it("names no biome for a tile no command has revealed", () => {
    expect(storedBiomeAt(storeWith(undefined), false, FAR_EAST.col, FAR_EAST.row, 1)).toBeUndefined();
  });
});
