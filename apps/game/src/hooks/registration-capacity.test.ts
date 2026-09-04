import { describe, expect, it } from "vitest";

import { isRegistrationCapacityReached, resolveEffectiveRegistrationCountMax } from "./registration-capacity";

describe("registration-capacity", () => {
  it("forces blitz two-player worlds to capacity 2", () => {
    expect(
      resolveEffectiveRegistrationCountMax({
        mode: "blitz",
        registrationCountMax: 24,
        twoPlayerMode: true,
      }),
    ).toBe(2);
  });

  it("uses configured max for non-two-player blitz worlds", () => {
    expect(
      resolveEffectiveRegistrationCountMax({
        mode: "blitz",
        registrationCountMax: 24,
        twoPlayerMode: false,
      }),
    ).toBe(24);
  });

  it("returns null when max capacity is not known", () => {
    expect(
      resolveEffectiveRegistrationCountMax({
        mode: "blitz",
        registrationCountMax: null,
        twoPlayerMode: false,
      }),
    ).toBeNull();
  });

  it("detects when registration reaches capacity", () => {
    expect(isRegistrationCapacityReached(2, 2)).toBe(true);
    expect(isRegistrationCapacityReached(1, 2)).toBe(false);
    expect(isRegistrationCapacityReached(5, null)).toBe(false);
  });
});
