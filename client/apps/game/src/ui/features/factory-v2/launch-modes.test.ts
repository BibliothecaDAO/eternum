import { describe, expect, it } from "vitest";

import {
  resolveLaunchModesForMode,
  supportsBlitzRegistrationModes,
  toggleSingleRealmLaunchMode,
  toggleTwoPlayerLaunchMode,
} from "./launch-modes";

describe("factory launch mode toggles", () => {
  it("turns single realm off when two player is enabled", () => {
    expect(toggleTwoPlayerLaunchMode({ twoPlayerMode: false, singleRealmMode: true })).toEqual({
      twoPlayerMode: true,
      singleRealmMode: false,
    });
  });

  it("turns two player off when single realm is enabled", () => {
    expect(toggleSingleRealmLaunchMode({ twoPlayerMode: true, singleRealmMode: false })).toEqual({
      twoPlayerMode: false,
      singleRealmMode: true,
    });
  });

  it("lets each mode turn itself back off", () => {
    expect(toggleTwoPlayerLaunchMode({ twoPlayerMode: true, singleRealmMode: false })).toEqual({
      twoPlayerMode: false,
      singleRealmMode: false,
    });
    expect(toggleSingleRealmLaunchMode({ twoPlayerMode: false, singleRealmMode: true })).toEqual({
      twoPlayerMode: false,
      singleRealmMode: false,
    });
  });

  it("only keeps these launch modes for blitz", () => {
    expect(supportsBlitzRegistrationModes("blitz")).toBe(true);
    expect(supportsBlitzRegistrationModes("eternum")).toBe(false);
    expect(resolveLaunchModesForMode("eternum", { twoPlayerMode: true, singleRealmMode: true })).toEqual({
      twoPlayerMode: false,
      singleRealmMode: false,
    });
  });
});
