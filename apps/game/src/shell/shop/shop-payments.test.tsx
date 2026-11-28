import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdentityRequestError, type ShopPaymentMethods } from "@realms-world/identity";

import { identityClient } from "@/hooks/context/identity-session";
import { FRAGMENTS_PAGE_WORDS } from "@/ui/design-system/kit/words";

import EvmCheckout from "./evm-checkout";
import {
  discoverEip6963Providers,
  encodeErc20Transfer,
  ensureEthereumMainnet,
  ETH_MAINNET_CHAIN_ID,
  EvmChainRefusedError,
  type Eip1193Provider,
} from "./evm-usdc";
import { availableRails, followPayment } from "./fragment-payment";
import SolanaCheckout from "./solana-checkout";
import {
  buildSolanaUsdcTransferTransaction,
  decodeBase58,
  deriveAssociatedTokenAddress,
  encodeBase58,
  encodeSplTransferCheckedData,
  SOLANA_MAINNET_CHAIN,
  SPL_MEMO_PROGRAM_ID,
  SPL_TOKEN_PROGRAM_ID,
  type SolanaStandardWallet,
} from "./solana-usdc";
import StripeCheckout from "./stripe-checkout";

const GAME = { chainId: "0x52", gameId: 7 };
const EVM_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const EVM_TREASURY = "0x1111111111111111111111111111111111111111";
const EVM_PAYER = "0x2222222222222222222222222222222222222222";
const EVM_TX_HASH = `0x${"ab".repeat(32)}`;
const EVM_QUOTE_ID = "123e4567-e89b-12d3-a456-426614174000";
const EVM_QUOTE_MEMO = "123e4567e89b12d3a456426614174000";
const SOL_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_TREASURY = "9JKLWyKA3FrTae4wRcaSK6TDu8n1GNdhJSjpBAPrcpNQ";
const SOL_TREASURY_ATA = "DdNBfMPBox3D6WCwjzahYDKBoD8ZYvHPgBLBkJSC5VW2";
const SOL_PAYER = encodeBase58(new Uint8Array(32).fill(1));
const SOL_SOURCE_ATA = encodeBase58(new Uint8Array(32).fill(2));
const SOL_DEST_ATA = encodeBase58(new Uint8Array(32).fill(4));
const SOL_BLOCKHASH = encodeBase58(new Uint8Array(32).fill(5));
const SOL_SIGNATURE = new Uint8Array(64).fill(9);

const readShortVec = (bytes: Uint8Array, start: number): { value: number; next: number } => {
  let value = 0;
  let shift = 0;
  let offset = start;
  for (;;) {
    const byte = bytes[offset]!;
    offset += 1;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, next: offset };
    shift += 7;
  }
};

const parseLegacySolanaTx = (bytes: Uint8Array) => {
  const sigCount = readShortVec(bytes, 0);
  let offset = sigCount.next + sigCount.value * 64;
  const header = {
    numRequiredSignatures: bytes[offset]!,
    numReadonlySigned: bytes[offset + 1]!,
    numReadonlyUnsigned: bytes[offset + 2]!,
  };
  offset += 3;
  const keyCount = readShortVec(bytes, offset);
  offset = keyCount.next;
  const accountKeys: string[] = [];
  for (let i = 0; i < keyCount.value; i += 1) {
    accountKeys.push(encodeBase58(bytes.slice(offset, offset + 32)));
    offset += 32;
  }
  const recentBlockhash = encodeBase58(bytes.slice(offset, offset + 32));
  offset += 32;
  const ixCount = readShortVec(bytes, offset);
  offset = ixCount.next;
  const instructions: { programId: string; accounts: string[]; data: Uint8Array }[] = [];
  for (let i = 0; i < ixCount.value; i += 1) {
    const programId = accountKeys[bytes[offset]!]!;
    offset += 1;
    const acctLen = readShortVec(bytes, offset);
    offset = acctLen.next;
    const accounts: string[] = [];
    for (let j = 0; j < acctLen.value; j += 1) {
      accounts.push(accountKeys[bytes[offset + j]!]!);
    }
    offset += acctLen.value;
    const dataLen = readShortVec(bytes, offset);
    offset = dataLen.next;
    const data = bytes.slice(offset, offset + dataLen.value);
    offset += dataLen.value;
    instructions.push({ programId, accounts, data });
  }
  return { signatureSlots: sigCount.value, header, accountKeys, recentBlockhash, instructions, byteLength: offset };
};

const unmounts: (() => Promise<void>)[] = [];

const render = async (node: ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(node));
  unmounts.push(async () => {
    await act(async () => root.unmount());
    host.remove();
  });
  return host;
};

afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await unmount();
  delete (window as { Stripe?: unknown }).Stripe;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("available payment rails", () => {
  it("lists enabled rails in checkout order and refuses non-mainnet EVM", () => {
    const allEnabled: ShopPaymentMethods = {
      starknet: true,
      evm: { chainId: 1 },
      solana: { cluster: "mainnet-beta" },
      stripe: { publishableKey: "pk_test_123" },
    };
    expect(availableRails(allEnabled)).toEqual(["stripe", "starknet", "evm", "solana"]);
    expect(availableRails(undefined)).toEqual(["starknet"]);

    const wrongChain: ShopPaymentMethods = {
      starknet: true,
      evm: { chainId: 11155111 as 1 },
      solana: null,
      stripe: null,
    };
    expect(availableRails(wrongChain)).toEqual(["starknet"]);
  });
});

describe("EVM mainnet USDC checkout", () => {
  it("encodes ERC-20 transfer(address,uint256) calldata with the trailing 16-byte quote UUID suffix", () => {
    const data = encodeErc20Transfer(EVM_TREASURY, 10_000_000n, EVM_QUOTE_MEMO);
    expect(data).toBe(`0xa9059cbb${"0".repeat(24)}${"1".repeat(40)}${"0".repeat(58)}989680${EVM_QUOTE_MEMO}`);
    expect(() => encodeErc20Transfer(EVM_TREASURY, 10_000_000n, "bad-memo")).toThrow();
  });

  it("requests wallet_switchEthereumChain to 0x1 and refuses any non-mainnet chain", async () => {
    let chainId = "0xaa36a7";
    const request = vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === "eth_chainId") return chainId;
      if (method === "wallet_switchEthereumChain") {
        chainId = (params?.[0] as { chainId: string }).chainId;
        return null;
      }
      return null;
    });
    await expect(ensureEthereumMainnet({ request })).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ETH_MAINNET_CHAIN_ID }],
    });

    const stuckProvider: Eip1193Provider = {
      request: vi.fn(async ({ method }) => {
        if (method === "eth_chainId") return "0x89";
        return null;
      }),
    };
    await expect(ensureEthereumMainnet(stuckProvider)).rejects.toBeInstanceOf(EvmChainRefusedError);
  });

  it("discovers EIP-6963 wallets, switches to Ethereum mainnet, sends USDC transfer with quote memo, and submits via identityClient", async () => {
    const requests: { method: string; params?: unknown[] }[] = [];
    let chainId = "0x89";
    const provider: Eip1193Provider = {
      request: vi.fn(async (args) => {
        requests.push(args);
        if (args.method === "eth_requestAccounts") return [EVM_PAYER];
        if (args.method === "eth_chainId") return chainId;
        if (args.method === "wallet_switchEthereumChain") {
          chainId = ETH_MAINNET_CHAIN_ID;
          return null;
        }
        if (args.method === "eth_sendTransaction") return EVM_TX_HASH;
        return null;
      }),
    };

    const announce = () => {
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: { uuid: "mm-1", name: "MetaMask", icon: "", rdns: "io.metamask" },
            provider,
          },
        }),
      );
    };
    window.addEventListener("eip6963:requestProvider", announce);
    try {
      const discovered = await discoverEip6963Providers(window, 10);
      expect(discovered.map((item) => item.info.name)).toEqual(["MetaMask"]);

      const quoteSpy = vi.spyOn(identityClient, "quoteExternalPayment").mockResolvedValue({
        fragments: 1_000,
        cents: 1_000,
        quote: {
          id: EVM_QUOTE_ID,
          rail: "evm",
          chainId: 1,
          token: EVM_USDC,
          treasury: EVM_TREASURY,
          usdcUnits: "10000000",
          memo: EVM_QUOTE_MEMO,
          recentBlockhash: null,
          expiresAt: 9999999999,
        },
      });
      const paySpy = vi
        .spyOn(identityClient, "payExternalPayment")
        .mockResolvedValue({ state: "delivering", fragments: 1_000 });

      const onPaid = vi.fn();
      const host = await render(<EvmCheckout game={GAME} fragments={1_000} onPaid={onPaid} onCancel={() => {}} />);

      await vi.waitFor(() => expect(host.querySelector("[data-evm-wallets]")).not.toBeNull());
      const payButton = [...host.querySelectorAll("button")].find((button) =>
        button.textContent?.includes(FRAGMENTS_PAGE_WORDS.usdcPay(1_000)),
      )!;
      await act(async () => payButton.click());
      await vi.waitFor(() => expect(onPaid).toHaveBeenCalledOnce());

      expect(quoteSpy).toHaveBeenCalledWith({
        chainId: GAME.chainId,
        gameId: GAME.gameId,
        fragments: 1_000,
        rail: "evm",
        networkChainId: 1,
      });
      expect(requests.find((call) => call.method === "eth_sendTransaction")?.params).toEqual([
        {
          from: EVM_PAYER,
          to: EVM_USDC,
          data: encodeErc20Transfer(EVM_TREASURY, 10_000_000n, EVM_QUOTE_MEMO),
          value: "0x0",
        },
      ]);
      expect(paySpy).toHaveBeenCalledWith(EVM_QUOTE_ID, EVM_TX_HASH);
      expect(onPaid).toHaveBeenCalledWith({
        quoteId: EVM_QUOTE_ID,
        hash: EVM_TX_HASH,
        fragments: 1_000,
        rail: "evm",
      });
    } finally {
      window.removeEventListener("eip6963:requestProvider", announce);
    }
  });
});

describe("Solana Wallet Standard USDC checkout", () => {
  it("derives the canonical Solana USDC ATA and serializes header, account keys, blockhash, transferChecked, and Memo accurately", () => {
    const sample = new Uint8Array([0, 0, 1, 2, 3, 255]);
    expect(decodeBase58(encodeBase58(sample))).toEqual(sample);
    expect(deriveAssociatedTokenAddress(SOL_TREASURY, SOL_USDC_MINT)).toBe(SOL_TREASURY_ATA);
    const expectedTransferData = encodeSplTransferCheckedData(10_000_000n);
    expect([...expectedTransferData]).toEqual([12, 0x80, 0x96, 0x98, 0x00, 0, 0, 0, 0, 6]);

    const tx = buildSolanaUsdcTransferTransaction({
      payer: SOL_PAYER,
      sourceAta: SOL_SOURCE_ATA,
      mint: SOL_USDC_MINT,
      destinationAta: SOL_DEST_ATA,
      amount: 10_000_000n,
      quoteId: "sol-quote-42",
      recentBlockhash: SOL_BLOCKHASH,
    });
    const parsed = parseLegacySolanaTx(tx);
    expect(parsed.byteLength).toBe(tx.length);
    expect(parsed.signatureSlots).toBe(1);
    expect(parsed.header).toEqual({ numRequiredSignatures: 1, numReadonlySigned: 0, numReadonlyUnsigned: 3 });
    expect(parsed.accountKeys[0]).toBe(SOL_PAYER);
    expect(parsed.recentBlockhash).toBe(SOL_BLOCKHASH);
    expect(parsed.instructions).toHaveLength(2);
    expect(parsed.instructions[0]).toEqual({
      programId: SPL_TOKEN_PROGRAM_ID,
      accounts: [SOL_SOURCE_ATA, SOL_USDC_MINT, SOL_DEST_ATA, SOL_PAYER],
      data: expectedTransferData,
    });
    expect(parsed.instructions[1]).toEqual({
      programId: SPL_MEMO_PROGRAM_ID,
      accounts: [SOL_PAYER],
      data: new TextEncoder().encode("sol-quote-42"),
    });
  });

  it("discovers a Wallet Standard Solana wallet, uses server quote blockhash, signs exact transferChecked + Memo on solana:mainnet, and submits via identityClient", async () => {
    let signedTx: Uint8Array | null = null;
    const signAndSend = vi.fn(async (input: { transaction: Uint8Array; chain: string }) => {
      signedTx = input.transaction;
      return [{ signature: SOL_SIGNATURE }];
    });
    const wallet: SolanaStandardWallet = {
      name: "Phantom",
      accounts: [],
      features: {
        "standard:connect": {
          connect: async () => ({
            accounts: [{ address: SOL_PAYER, publicKey: decodeBase58(SOL_PAYER) }],
          }),
        },
        "solana:signAndSendTransaction": {
          signAndSendTransaction: signAndSend,
        },
      },
    };
    const onAppReady = (event: Event) => {
      (event as CustomEvent<{ register: (...wallets: unknown[]) => void }>).detail.register(wallet);
    };
    window.addEventListener("wallet-standard:app-ready", onAppReady);
    try {
      const quoteSpy = vi.spyOn(identityClient, "quoteExternalPayment").mockResolvedValue({
        fragments: 1_000,
        cents: 1_000,
        quote: {
          id: "sol-q-9",
          rail: "solana",
          chainId: null,
          token: SOL_USDC_MINT,
          treasury: SOL_TREASURY,
          usdcUnits: "10000000",
          memo: "sol-q-9",
          recentBlockhash: SOL_BLOCKHASH,
          expiresAt: 9999999999,
        },
      });
      const paySpy = vi
        .spyOn(identityClient, "payExternalPayment")
        .mockResolvedValue({ state: "delivering", fragments: 1_000 });

      const onPaid = vi.fn();
      const host = await render(<SolanaCheckout game={GAME} fragments={1_000} onPaid={onPaid} onCancel={() => {}} />);

      await vi.waitFor(() => expect(host.querySelector("[data-solana-wallets]")).not.toBeNull());
      const payButton = [...host.querySelectorAll("button")].find((button) =>
        button.textContent?.includes(FRAGMENTS_PAGE_WORDS.usdcPay(1_000)),
      )!;
      await act(async () => payButton.click());
      await vi.waitFor(() => expect(onPaid).toHaveBeenCalledOnce());

      expect(quoteSpy).toHaveBeenCalledWith({
        chainId: GAME.chainId,
        gameId: GAME.gameId,
        fragments: 1_000,
        rail: "solana",
      });
      expect(signAndSend).toHaveBeenCalledWith(expect.objectContaining({ chain: SOLANA_MAINNET_CHAIN }));
      expect(signedTx).not.toBeNull();
      const parsed = parseLegacySolanaTx(signedTx!);
      const expectedSourceAta = deriveAssociatedTokenAddress(SOL_PAYER, SOL_USDC_MINT);
      expect(parsed.recentBlockhash).toBe(SOL_BLOCKHASH);
      expect(parsed.instructions[0]).toEqual({
        programId: SPL_TOKEN_PROGRAM_ID,
        accounts: [expectedSourceAta, SOL_USDC_MINT, SOL_TREASURY_ATA, SOL_PAYER],
        data: encodeSplTransferCheckedData(10_000_000n),
      });
      expect(parsed.instructions[1]).toEqual({
        programId: SPL_MEMO_PROGRAM_ID,
        accounts: [SOL_PAYER],
        data: new TextEncoder().encode("sol-q-9"),
      });
      expect(paySpy).toHaveBeenCalledWith("sol-q-9", encodeBase58(SOL_SIGNATURE));
      expect(onPaid).toHaveBeenCalledWith({
        quoteId: "sol-q-9",
        hash: encodeBase58(SOL_SIGNATURE),
        fragments: 1_000,
        rail: "solana",
      });
    } finally {
      window.removeEventListener("wallet-standard:app-ready", onAppReady);
    }
  });
});

describe("Stripe Payment Element checkout", () => {
  it("creates a Stripe intent via identityClient, mounts Payment Element with server publishableKey, and hands off to server polling", async () => {
    const mount = vi.fn();
    const unmount = vi.fn();
    const confirmPayment = vi.fn(async () => ({ paymentIntent: { id: "pi_123", status: "succeeded" } }));
    const stripeCtor = vi.fn(() => ({
      elements: vi.fn(() => ({ create: vi.fn(() => ({ mount, unmount })) })),
      confirmPayment,
    }));
    (window as { Stripe?: unknown }).Stripe = stripeCtor;

    const intentSpy = vi.spyOn(identityClient, "createStripeIntent").mockResolvedValue({
      intentId: "pi_123",
      clientSecret: "pi_123_secret_abc",
      fragments: 1_000,
      cents: 1_000,
    });

    const onPaid = vi.fn();
    const host = await render(
      <StripeCheckout
        game={GAME}
        fragments={1_000}
        publishableKey="pk_live_from_server"
        onPaid={onPaid}
        onCancel={() => {}}
      />,
    );

    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce());
    expect(intentSpy).toHaveBeenCalledWith({ chainId: GAME.chainId, gameId: GAME.gameId, fragments: 1_000 });
    expect(stripeCtor).toHaveBeenCalledWith("pk_live_from_server");
    expect(host.querySelector("[data-stripe-element]")).not.toBeNull();

    await act(async () => {
      host.querySelector<HTMLFormElement>("[data-stripe-checkout]")!.requestSubmit();
    });
    await vi.waitFor(() => expect(onPaid).toHaveBeenCalledOnce());
    expect(confirmPayment).toHaveBeenCalledOnce();
    expect(onPaid).toHaveBeenCalledWith({
      quoteId: "pi_123",
      hash: "pi_123",
      fragments: 1_000,
      rail: "stripe",
    });
  });
});

describe("rail-aware payment delivery polling", () => {
  it("routes EVM, Solana, and Stripe payments to their server status endpoints and never calls Starknet payFragments", async () => {
    const starknetGet = vi.spyOn(identityClient, "fragmentPayment");
    const starknetPay = vi.spyOn(identityClient, "payFragments");
    const externalGet = vi
      .spyOn(identityClient, "externalPayment")
      .mockRejectedValueOnce(new IdentityRequestError(404, "unknown_payment"));
    const externalPay = vi
      .spyOn(identityClient, "payExternalPayment")
      .mockResolvedValueOnce({ state: "delivered", fragments: 1_000 });
    const stripeGet = vi
      .spyOn(identityClient, "stripePayment")
      .mockResolvedValueOnce({ state: "delivering", fragments: 1_000 })
      .mockResolvedValueOnce({ state: "delivered", fragments: 1_000 });

    await expect(
      followPayment({ quoteId: EVM_QUOTE_ID, hash: EVM_TX_HASH, fragments: 1_000, rail: "evm" }),
    ).resolves.toEqual({ state: "delivered", fragments: 1_000 });
    expect(externalGet).toHaveBeenCalledWith(EVM_TX_HASH);
    expect(externalPay).toHaveBeenCalledWith(EVM_QUOTE_ID, EVM_TX_HASH);
    expect(starknetGet).not.toHaveBeenCalled();
    expect(starknetPay).not.toHaveBeenCalled();

    await expect(
      followPayment({ quoteId: "pi_123", hash: "pi_123", fragments: 1_000, rail: "stripe" }),
    ).resolves.toEqual({ state: "delivering", fragments: 1_000 });
    await expect(
      followPayment({ quoteId: "pi_123", hash: "pi_123", fragments: 1_000, rail: "stripe" }),
    ).resolves.toEqual({ state: "delivered", fragments: 1_000 });
    expect(stripeGet).toHaveBeenCalledTimes(2);
    expect(stripeGet).toHaveBeenCalledWith("pi_123");
    expect(starknetGet).not.toHaveBeenCalled();
    expect(starknetPay).not.toHaveBeenCalled();
  });
});
