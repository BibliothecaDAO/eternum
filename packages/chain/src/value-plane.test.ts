import { describe, expect, it } from "vitest";

import dev from "../../../contracts/common/addresses/dev.json";
import production from "../../../contracts/common/addresses/production.json";
import { ChainId } from "./chains";
import { LORDS } from "./contracts";
import {
  environmentL2,
  isTestLords,
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

  it("uses canonical LORDS in production and test LORDS in staging", () => {
    expect(BigInt(valuePlaneAddress("lords", "production"))).toBe(
      BigInt(LORDS[ChainId.SN_MAIN]!.address),
    );
    expect(valuePlaneAddress("lords", "staging")).toBe(dev.lords);
    expect(isTestLords(valuePlaneAddress("lords", "staging"))).toBe(true);
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

it("names a deployment block only for a published ledger and refuses undeployed lookups", () => {
  for (const [environment, book] of [
    ["staging", dev],
    ["production", production],
  ] as const) {
    if (BigInt(book.ledger) === BigInt(0)) {
      expect(book).not.toHaveProperty("ledgerDeploymentBlock");
      expect(() => ledgerDeploymentBlock(environment)).toThrow(
        "not deployed yet",
      );
    } else {
      expect(ledgerDeploymentBlock(environment)).toBeGreaterThan(0);
      expect(ledgerDeploymentBlock(environment)).toBe(
        "ledgerDeploymentBlock" in book
          ? book.ledgerDeploymentBlock
          : undefined,
      );
    }
  }
});

describe("test LORDS", () => {
  it("is any token but Starknet's LORDS, however its address is written", () => {
    expect(isTestLords(dev.lords)).toBe(true);
    expect(
      isTestLords(
        "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
      ),
    ).toBe(false);
    expect(
      isTestLords(
        "0x0124AEB495B947201F5FAC96FD1138E326AD86195B98DF6DEC9009158A533B49",
      ),
    ).toBe(false);
  });
});
