// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  BLITZ_SETTLE_GRANT_STARTING_TROOPS_STORAGE_KEY,
  resolveBlitzGrantStartingTroops,
} from "./blitz-settlement-options";

const buildStorage = (value: string | null) => ({
  getItem: (key: string) => (key === BLITZ_SETTLE_GRANT_STARTING_TROOPS_STORAGE_KEY ? value : null),
});

describe("resolveBlitzGrantStartingTroops", () => {
  it("always returns true outside dev mode", () => {
    expect(resolveBlitzGrantStartingTroops({ isDev: false, storage: buildStorage("0") })).toBe(true);
  });

  it("defaults to true in dev mode when the override is unset", () => {
    expect(resolveBlitzGrantStartingTroops({ isDev: true, storage: buildStorage(null) })).toBe(true);
  });

  it("returns false in dev mode when the override is set to zero", () => {
    expect(resolveBlitzGrantStartingTroops({ isDev: true, storage: buildStorage("0") })).toBe(false);
  });

  it("treats non-zero override values as enabled", () => {
    expect(resolveBlitzGrantStartingTroops({ isDev: true, storage: buildStorage("1") })).toBe(true);
  });
});
