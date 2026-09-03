import { describe, expect, test } from "bun:test";
import { validatePresetBalanceProfile } from "../registrar/preset-profile";

describe("preset balance profiles", () => {
  test("allows the shared Blitz profiles on Madara", () => {
    expect(() => validatePresetBalanceProfile("madara.blitz", "official-60")).not.toThrow();
    expect(() => validatePresetBalanceProfile("madara.blitz", "official-90")).not.toThrow();
  });
});
