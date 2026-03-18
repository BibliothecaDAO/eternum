import { describe, expect, it } from "vitest";

import {
  getBlitzPlayStyleOptions,
  resolveLaunchModesForMode,
  resolveSelectedBlitzPlayStyleId,
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

  it("describes blitz play styles in player and realm terms using the current max player cap", () => {
    expect(getBlitzPlayStyleOptions("24")).toEqual([
      {
        id: "multiple-players-three-realms",
        label: "24 players, 3 Realms",
      },
      {
        id: "two-players-three-realms",
        label: "2 players, 3 Realms",
      },
      {
        id: "multiple-players-one-realm",
        label: "24 players, 1 Realm",
      },
    ]);
  });

  it("falls back to generic multiplayer wording when the max player draft is invalid", () => {
    expect(getBlitzPlayStyleOptions("")).toEqual([
      {
        id: "multiple-players-three-realms",
        label: "Players, 3 Realms",
      },
      {
        id: "two-players-three-realms",
        label: "2 players, 3 Realms",
      },
      {
        id: "multiple-players-one-realm",
        label: "Players, 1 Realm",
      },
    ]);
  });

  it("maps blitz launch toggles onto the matching play style", () => {
    expect(resolveSelectedBlitzPlayStyleId({ twoPlayerMode: false, singleRealmMode: false })).toBe(
      "multiple-players-three-realms",
    );
    expect(resolveSelectedBlitzPlayStyleId({ twoPlayerMode: true, singleRealmMode: false })).toBe(
      "two-players-three-realms",
    );
    expect(resolveSelectedBlitzPlayStyleId({ twoPlayerMode: false, singleRealmMode: true })).toBe(
      "multiple-players-one-realm",
    );
  });
});
