// @vitest-environment node

import { describe, expect, it } from "vitest";

import { assertPublicEnvConsistency, resolvePublicEnvConsistencyErrors } from "./public-env-consistency";

const mainnetEnv = {
  VITE_PUBLIC_CHAIN: "mainnet" as const,
  VITE_PUBLIC_SLOT: "eternum-resources-mainnet-5",
  VITE_PUBLIC_TORII: "https://api.cartridge.gg/x/eternum-game-mainnet-38-pro/torii",
};

describe("resolvePublicEnvConsistencyErrors", () => {
  it("accepts the mainnet deployment values used by the checked-in mainnet env", () => {
    expect(resolvePublicEnvConsistencyErrors(mainnetEnv)).toEqual([]);
  });

  it("rejects a mainnet build with a slot Torii endpoint", () => {
    expect(
      resolvePublicEnvConsistencyErrors({
        ...mainnetEnv,
        VITE_PUBLIC_TORII: "https://api.cartridge.gg/x/eternum-blitz-slot-test/torii",
      }),
    ).toEqual([
      "VITE_PUBLIC_TORII points to a slot deployment: https://api.cartridge.gg/x/eternum-blitz-slot-test/torii",
    ]);
  });

  it("rejects a mainnet build with a slot deployment name", () => {
    expect(
      resolvePublicEnvConsistencyErrors({
        ...mainnetEnv,
        VITE_PUBLIC_SLOT: "eternum-blitz-slot-4",
      }),
    ).toEqual(["VITE_PUBLIC_SLOT points to a slot deployment: eternum-blitz-slot-4"]);
  });

  it("allows slot deployments for slot-chain builds", () => {
    expect(
      resolvePublicEnvConsistencyErrors({
        VITE_PUBLIC_CHAIN: "slot",
        VITE_PUBLIC_SLOT: "eternum-blitz-slot-4",
        VITE_PUBLIC_TORII: "https://api.cartridge.gg/x/eternum-blitz-slot-4/torii",
      }),
    ).toEqual([]);
  });
});

describe("assertPublicEnvConsistency", () => {
  it("throws a clear error for contradictory mainnet env values", () => {
    expect(() =>
      assertPublicEnvConsistency({
        ...mainnetEnv,
        VITE_PUBLIC_SLOT: "eternum-blitz-slot-4",
        VITE_PUBLIC_TORII: "https://api.cartridge.gg/x/eternum-blitz-slot-test/torii",
      }),
    ).toThrow(
      [
        "Invalid public environment configuration:",
        "- VITE_PUBLIC_TORII points to a slot deployment: https://api.cartridge.gg/x/eternum-blitz-slot-test/torii",
        "- VITE_PUBLIC_SLOT points to a slot deployment: eternum-blitz-slot-4",
      ].join("\n"),
    );
  });
});
