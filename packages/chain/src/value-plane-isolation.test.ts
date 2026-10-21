import { afterEach, expect, it, vi } from "vitest";

import {
  environmentL2,
  ledgerDeploymentBlock,
  valuePlaneAddress,
} from "./value-plane";

const books = vi.hoisted(() => ({
  dev: {
    l2Chain: "SN_MAIN",
    ledger: "0x11",
    ledgerDeploymentBlock: 101 as number | undefined,
    lords: "0x12",
    mmrToken: "0x13",
    lootChests: "0x14",
    cosmetics: "0x15",
  },
  production: {
    l2Chain: "SN_MAIN",
    ledger: "0x21",
    ledgerDeploymentBlock: 201 as number | undefined,
    lords: "0x22",
    mmrToken: "0x23",
    lootChests: "0x24",
    cosmetics: "0x25",
  },
}));
vi.mock("../../../contracts/common/addresses/dev.json", () => ({
  default: books.dev,
}));
vi.mock("../../../contracts/common/addresses/production.json", () => ({
  default: books.production,
}));

const original = structuredClone(books);
afterEach(() => {
  Object.assign(books.dev, original.dev);
  Object.assign(books.production, original.production);
});

it.each(["ledger", "lords", "mmrToken", "lootChests", "cosmetics"] as const)(
  "resolves only its own %s even though both environments share the chain",
  (contract) => {
    expect(valuePlaneAddress(contract, "staging")).toBe(original.dev[contract]);
    expect(valuePlaneAddress(contract, "production")).toBe(
      original.production[contract],
    );
    expect(environmentL2("staging").ledger).toBe(original.dev.ledger);
    expect(environmentL2("production").ledger).toBe(original.production.ledger);
    for (const missing of ["", "0x0"]) {
      books.dev[contract] = missing;
      expect(() => valuePlaneAddress(contract, "staging")).toThrow(
        "contracts/common/addresses/dev.json",
      );
      expect(valuePlaneAddress(contract, "production")).toBe(
        original.production[contract],
      );
      if (contract === "ledger")
        expect(environmentL2("staging").ledger).toBeNull();
      books.dev[contract] = original.dev[contract];
      books.production[contract] = missing;
      expect(() => valuePlaneAddress(contract, "production")).toThrow(
        "contracts/common/addresses/production.json",
      );
      expect(valuePlaneAddress(contract, "staging")).toBe(
        original.dev[contract],
      );
      if (contract === "ledger")
        expect(environmentL2("production").ledger).toBeNull();
      books.production[contract] = original.production[contract];
    }
  },
);

it.each(["mainnet", "sepolia", "dev", "toString", undefined])(
  "refuses network or unknown selection %s",
  (environment) => {
    expect(() => environmentL2(environment as never)).toThrow("ENVIRONMENT");
    expect(() => valuePlaneAddress("lords", environment as never)).toThrow(
      "ENVIRONMENT",
    );
  },
);
it("refuses a dev book naming a different chain", () => {
  books.dev.l2Chain = "SN_SEPOLIA";
  expect(() => environmentL2("staging")).toThrow("must name SN_MAIN");
  expect(environmentL2("production").chain).toBe("SN_MAIN");
});

it("reads each environment's own ledger deployment block, and refuses a ledger named without one", () => {
  expect(ledgerDeploymentBlock("staging")).toBe(101);
  expect(ledgerDeploymentBlock("production")).toBe(201);
  books.dev.ledgerDeploymentBlock = undefined;
  expect(() => ledgerDeploymentBlock("staging")).toThrow(
    "contracts/common/addresses/dev.json names a ledger without its deployment block",
  );
  expect(ledgerDeploymentBlock("production")).toBe(201);
  books.production.ledger = "0x0";
  expect(() => ledgerDeploymentBlock("production")).toThrow("not deployed yet");
});
