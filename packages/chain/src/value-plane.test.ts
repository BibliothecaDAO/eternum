import { describe, expect, it } from "vitest";

import dev from "../../../contracts/common/addresses/dev.json";
import production from "../../../contracts/common/addresses/mainnet.json";
import { environmentL2, valuePlaneAddress } from "./value-plane";

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

  it.each(["ledger", "lords", "mmrToken", "lootChests", "cosmetics"] as const)(
    "keeps the deployed %s addresses separate without falling back when absent",
    (contract) => {
      const books = { staging: dev, production };
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
