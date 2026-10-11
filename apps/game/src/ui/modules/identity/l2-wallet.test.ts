import { constants } from "starknet";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { SN_MAIN, SN_SEPOLIA } = constants.StarknetChainId;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_PUBLIC_ENVIRONMENT", "staging");
});
afterEach(() => vi.unstubAllEnvs());

it("connects, signs the link proof and reads its own ledger on Starknet mainnet, in a dev build", async () => {
  const { L2_WALLET_CHAIN, assertWalletOnL2 } = await import("./l2-wallet");
  const { walletProofForAccount } = await import("./wallet-proof");
  const { failureSentence, WrongNetworkError } = await import("./identity-failures");
  const { L2_CHAIN, L2_LEDGER } = await import("@/runtime/l2-rpc");
  const { environmentL2 } = await import("@realms-world/chain");

  // The wallet connectors know one chain, and a wallet on any other is refused before it signs.
  expect(L2_WALLET_CHAIN.id).toBe(BigInt(SN_MAIN));
  expect(() => assertWalletOnL2(BigInt(SN_MAIN))).not.toThrow();
  expect(() => assertWalletOnL2(BigInt(SN_SEPOLIA))).toThrow(WrongNetworkError);
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(failureSentence("link", new WrongNetworkError())).toBe("Switch this wallet to Starknet mainnet.");

  // The link proof is signed for mainnet.
  const account = { address: "0x4a1", signMessage: vi.fn(async () => ["0x1", "0x2"]) };
  const deployed = { getClassHashAt: vi.fn(async () => "0x1") };
  expect((await walletProofForAccount(account as never, deployed as never, "braavos")).chainId).toBe("SN_MAIN");

  // Dev shares the chain with production and nothing else: the ledger is the dev book's, never production's, and
  // never an address a service reply names.
  expect(L2_CHAIN.name).toBe("SN_MAIN");
  expect(L2_CHAIN.explorer).toBe("https://voyager.online");
  expect(L2_LEDGER).toBe(environmentL2("staging").ledger);
});
