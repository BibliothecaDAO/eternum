import { constants } from "starknet";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { SN_MAIN, SN_SEPOLIA } = constants.StarknetChainId;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_PUBLIC_L2_CHAIN", "SN_SEPOLIA");
});
afterEach(() => vi.unstubAllEnvs());

it("connects, signs the link proof and reads the ledger on Sepolia only, in a Sepolia build", async () => {
  const { L2_WALLET_CHAIN, assertWalletOnL2 } = await import("./l2-wallet");
  const { walletProofForAccount } = await import("./wallet-proof");
  const { failureSentence, WrongNetworkError } = await import("./identity-failures");
  const { ledgerOf } = await import("@/shell/value/game-entry");

  // The wallet connectors know one chain, and a wallet on any other is refused before it signs.
  expect(L2_WALLET_CHAIN.id).toBe(BigInt(SN_SEPOLIA));
  expect(() => assertWalletOnL2(BigInt(SN_SEPOLIA))).not.toThrow();
  expect(() => assertWalletOnL2(BigInt(SN_MAIN))).toThrow(WrongNetworkError);
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(failureSentence("link", new WrongNetworkError())).toBe("Switch this wallet to Starknet Sepolia.");

  // The link proof is signed for Sepolia.
  const account = { address: "0x4a1", signMessage: vi.fn(async () => ["0x1", "0x2"]) };
  const deployed = { getClassHashAt: vi.fn(async () => "0x1") };
  expect((await walletProofForAccount(account as never, deployed as never, "braavos")).chainId).toBe("SN_SEPOLIA");

  // The ledger is read only on Sepolia: one the entry places on mainnet is refused.
  const ledger = { address: "0xl", chainId: SN_SEPOLIA, feeToken: "0xf", shard: "0x52", gameId: 7 };
  expect(() => ledgerOf(ledger)).not.toThrow();
  expect(() => ledgerOf({ ...ledger, chainId: SN_MAIN })).toThrow("this build reads SN_SEPOLIA");
});
