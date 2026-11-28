import { describe, expect, it } from "vitest";

import dev from "../../../contracts/common/addresses/dev.json";
import production from "../../../contracts/common/addresses/production.json";
import { ChainId } from "./chains";
import { LORDS, StakingAddresses, StakingContracts } from "./contracts";
import {
  assertAllowedEvmPaymentChain,
  environmentL2,
  EVM_PAYMENT_CHAIN_ID,
  evmPaymentRail,
  isTestLords,
  ledgerDeploymentBlock,
  raceRewardsBeside,
  SOLANA_PAYMENT_CLUSTER,
  solanaPaymentRail,
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

  it("names no race rewards beside a ledger no environment book holds", () => {
    expect(() => raceRewardsBeside("0x1")).toThrow(
      "No race rewards address is written beside the ledger 0x1",
    );
  });
});

describe("multi-rail payment addresses", () => {
  it("reads veLords reward pool, Ethereum mainnet USDC, and Solana mainnet USDC from the address books", () => {
    const rewardPool =
      StakingAddresses[StakingContracts.REWARD_POOL][ChainId.SN_MAIN]!;
    for (const environment of ["staging", "production"] as const) {
      expect(BigInt(valuePlaneAddress("veLords", environment))).toBe(
        BigInt(rewardPool),
      );
      expect(evmPaymentRail(environment)).toEqual({
        chainId: EVM_PAYMENT_CHAIN_ID,
        usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        treasury: "0x7a57925fAbDD81fc3Ac7e858d45fe9C364ab7688",
      });
      expect(solanaPaymentRail(environment)).toEqual({
        cluster: SOLANA_PAYMENT_CLUSTER,
        usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        treasury: "9JKLWyKA3FrTae4wRcaSK6TDu8n1GNdhJSjpBAPrcpNQ",
      });
    }
  });

  it("allows only Ethereum mainnet (chainId 1) and refuses Base (8453), Arbitrum (42161), and other chains", () => {
    expect(() => assertAllowedEvmPaymentChain(1)).not.toThrow();
    for (const chainId of [8453, 42161, 10, 11155111, 0]) {
      expect(() => assertAllowedEvmPaymentChain(chainId)).toThrow(
        `Unsupported EVM payment chainId ${chainId}`,
      );
    }
  });
});
