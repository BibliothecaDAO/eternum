import { describe, expect, it } from "vitest";

import dev from "../../../contracts/common/addresses/dev.json";
import production from "../../../contracts/common/addresses/production.json";
import {
  environmentL2,
  ledgerDeploymentBlock,
  valuePlaneAddress,
} from "./value-plane";

describe("environment address books", () => {
  it("runs both environments on mainnet with the real Realms collection", () => {
    for (const environment of ["staging", "production"] as const) {
      expect(environmentL2(environment)).toMatchObject({
        network: "mainnet",
        chain: "SN_MAIN",
      });
      expect(valuePlaneAddress("realms", environment)).toBe(production.realms);
    }
  });

  it("runs production on dev's test LORDS until the LORDS launch, and only that contract is shared", () => {
    expect(valuePlaneAddress("lords", "production")).toBe(dev.lords);
    expect(valuePlaneAddress("lords", "staging")).toBe(dev.lords);
  });

  it.each(["ledger", "mmrToken", "lootChests", "cosmetics"] as const)(
    "keeps each environment's own %s separate without falling back when absent",
    (contract) => {
      const books: Record<
        "staging" | "production",
        Partial<Record<typeof contract, string>>
      > = {
        staging: dev,
        // Production's own contracts are published by its setup; until then its book names none of them.
        production: production as Partial<Record<typeof contract, string>>,
      };
      for (const environment of ["staging", "production"] as const) {
        const value = books[environment][contract];
        if (value && BigInt(value) !== BigInt(0)) {
          expect(valuePlaneAddress(contract, environment)).toBe(value);
          const other =
            books[environment === "staging" ? "production" : "staging"][
              contract
            ];
          if (other) expect(BigInt(value)).not.toBe(BigInt(other));
        } else
          expect(() => valuePlaneAddress(contract, environment)).toThrow(
            "not deployed yet",
          );
      }
    },
  );
});

it("names, beside every published ledger, the block it was deployed in", () => {
  for (const environment of ["staging", "production"] as const)
    expect(ledgerDeploymentBlock(environment)).toBeGreaterThan(0);
});
