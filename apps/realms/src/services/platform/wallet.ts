import { Context, Effect, Layer, Option, SubscriptionRef } from "effect";
import type { Call, TypedData } from "starknet";
import { stark, WalletAccount } from "starknet";
import { normalizeStarknetAddress } from "@realms-world/identity";

import { NoWalletFound, TransactionFailed, WalletNotConnected, WalletRequestFailed } from "./errors";
import { Rpc } from "./rpc";

const LAST_WALLET_KEY = "realms:last-wallet";

/** An injected Starknet wallet extension found on the page. */
export interface DiscoveredWallet {
  readonly id: string;
  readonly name: string;
  readonly icon: string | null;
}

/** The connected identity wallet, as the rest of the app sees it. */
interface WalletSession {
  readonly address: string;
  readonly walletId: string;
  readonly walletName: string;
}

interface InjectedProvider {
  id?: string;
  name?: string;
  icon?: string | { dark: string; light: string };
  request?: (...args: unknown[]) => unknown;
}

const injectedProviders = (): Map<string, InjectedProvider> => {
  const wallets = new Map<string, InjectedProvider>();
  for (const [key, value] of Object.entries(window as unknown as Record<string, unknown>)) {
    if (!key.startsWith("starknet_")) continue;
    const provider = value as InjectedProvider | null;
    if (provider && typeof provider.request === "function") {
      wallets.set(key.slice("starknet_".length), provider);
    }
  }
  return wallets;
};

const toDiscovered = (id: string, provider: InjectedProvider): DiscoveredWallet => ({
  id,
  name: provider.name ?? id,
  icon: typeof provider.icon === "string" ? provider.icon : (provider.icon?.dark ?? null),
});

const rememberWallet = (id: string): void => {
  try {
    localStorage.setItem(LAST_WALLET_KEY, id);
  } catch {
    // Remembering the last wallet is a convenience, never a requirement.
  }
};

const recallWallet = (): string | null => {
  try {
    return localStorage.getItem(LAST_WALLET_KEY);
  } catch {
    return null;
  }
};

/**
 * The identity wallet boundary: discovery of injected extensions, the connected
 * session, message signing for SIWS, and transaction execution. This is the
 * only place a write leaves the app.
 */
const makeWallet = Effect.gen(function* () {
  const rpc = yield* Rpc;
  const session = yield* SubscriptionRef.make<WalletSession | null>(null);
  let connectedAccount: WalletAccount | null = null;

  const discover = Effect.sync(() =>
    [...injectedProviders().entries()].map(([id, provider]) => toDiscovered(id, provider)),
  );

  const establishSession = (id: string, provider: InjectedProvider, account: WalletAccount) =>
    Effect.gen(function* () {
      connectedAccount = account;
      const established: WalletSession = {
        address: normalizeStarknetAddress(account.address),
        walletId: id,
        walletName: provider.name ?? id,
      };
      yield* SubscriptionRef.set(session, established);
      rememberWallet(id);
      return established;
    });

  const connect = (walletId: string) =>
    Effect.gen(function* () {
      const provider = injectedProviders().get(walletId);
      if (!provider) return yield* new NoWalletFound();
      const account = yield* Effect.tryPromise({
        try: () => WalletAccount.connect(rpc.provider, provider as never),
        catch: (cause) => new WalletRequestFailed({ action: "connect", cause }),
      });
      return yield* establishSession(walletId, provider, account);
    });

  const reconnect = Effect.gen(function* () {
    const walletId = recallWallet();
    if (!walletId) return Option.none<WalletSession>();
    const provider = injectedProviders().get(walletId);
    if (!provider) return Option.none<WalletSession>();
    const account = yield* Effect.tryPromise({
      try: () => WalletAccount.connectSilent(rpc.provider, provider as never),
      catch: (cause) => new WalletRequestFailed({ action: "connect", cause }),
    }).pipe(Effect.option);
    if (Option.isNone(account) || !account.value.address) return Option.none<WalletSession>();
    return Option.some(yield* establishSession(walletId, provider, account.value));
  });

  const disconnect = Effect.gen(function* () {
    connectedAccount = null;
    yield* SubscriptionRef.set(session, null);
  });

  const requireAccount = Effect.gen(function* () {
    if (!connectedAccount) return yield* new WalletNotConnected();
    return connectedAccount;
  });

  const signTypedData = (typedData: TypedData) =>
    Effect.gen(function* () {
      const account = yield* requireAccount;
      const signature = yield* Effect.tryPromise({
        try: () => account.signMessage(typedData),
        catch: (cause) => new WalletRequestFailed({ action: "sign", cause }),
      });
      return stark.formatSignature(signature);
    });

  const execute = (calls: Call[]) =>
    Effect.gen(function* () {
      const account = yield* requireAccount;
      const { transaction_hash } = yield* Effect.tryPromise({
        try: () => account.execute(calls),
        catch: (cause) => new WalletRequestFailed({ action: "execute", cause }),
      });
      const receipt = yield* Effect.tryPromise({
        try: () => rpc.provider.waitForTransaction(transaction_hash),
        catch: (cause) => new TransactionFailed({ transactionHash: transaction_hash, cause }),
      });
      if (!receipt.isSuccess()) {
        return yield* new TransactionFailed({ transactionHash: transaction_hash, cause: receipt });
      }
      return transaction_hash;
    });

  return { session, discover, connect, reconnect, disconnect, signTypedData, execute };
});

type WalletShape = Effect.Success<typeof makeWallet>;

export class Wallet extends Context.Service<Wallet, WalletShape>()("platform/Wallet") {
  static readonly layerWithoutDependencies = Layer.effect(Wallet, makeWallet);
  static readonly layer = this.layerWithoutDependencies.pipe(Layer.provide(Rpc.layer));
}
