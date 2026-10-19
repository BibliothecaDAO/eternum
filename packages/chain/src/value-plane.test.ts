import { describe, expect, it } from "vitest";

import dev from "../../../contracts/common/addresses/dev.json";
import mainnet from "../../../contracts/common/addresses/mainnet.json";
import environments from "../../../deploy/first/environments.json";
import {
  environmentL2,
  ownsValueLedger,
  valuePlaneAddress,
} from "./value-plane";

const books: Record<string, Record<string, unknown>> = {
  "dev.json": dev,
  "mainnet.json": mainnet,
};

describe("environment address books", () => {
  it("runs both environments on mainnet with the real Realms collection", () => {
    for (const environment of ["staging", "production"] as const) {
      expect(environmentL2(environment)).toMatchObject({
        network: "mainnet",
        chain: "SN_MAIN",
      });
      expect(valuePlaneAddress("realms", environment)).toBe(mainnet.realms);
    }
  });

  it.each(["ledger", "lords", "mmrToken", "lootChests", "cosmetics"] as const)(
    "reads %s from the book the deploy table names for each environment",
    (contract) => {
      for (const [environment, table] of [
        ["staging", environments.dev],
        ["production", environments.production],
      ] as const) {
        const value = books[table.book]![contract];
        if (typeof value === "string" && value && BigInt(value) !== BigInt(0))
          expect(valuePlaneAddress(contract, environment)).toBe(value);
        else
          expect(() => valuePlaneAddress(contract, environment)).toThrow(
            "not deployed yet",
          );
      }
    },
  );

  it("runs production on dev's test ledger and test LORDS while the deploy table shares dev's book", () => {
    expect(environments.production.book).toBe("dev.json");
    expect(environmentL2("production").ledger).toBe(dev.ledger);
    expect(valuePlaneAddress("lords", "production")).toBe(dev.lords);
    // Production owns the shared ledger: dev pauses nothing and opens no paid Blitz on it.
    expect(ownsValueLedger("production")).toBe(true);
    expect(ownsValueLedger("staging")).toBe(false);
  });
});
