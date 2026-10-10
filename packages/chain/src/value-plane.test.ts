import { describe, expect, it } from "vitest";

import { environmentL2 } from "./value-plane";

describe("environmentL2", () => {
  it("runs dev on Sepolia and production on mainnet, each from its own address book", () => {
    expect(environmentL2("staging")).toMatchObject({
      network: "sepolia",
      chain: "SN_SEPOLIA",
    });
    expect(environmentL2("production")).toMatchObject({
      network: "mainnet",
      chain: "SN_MAIN",
    });
  });

  it("reads a ledger not yet deployed on an environment's network as null, never as address zero", () => {
    // mainnet.json names the ledger with an empty value until its deploy writes it.
    expect(environmentL2("production").ledger).toBeNull();
  });
});
