import { rpcAt } from "./rpc";
import { Account, RpcProvider } from "starknet";
import type { RelayPorts } from "./ports";
import { frontierPayment } from "./adapters";
import { relayOperation } from "./ports";

interface LedgerCredentials {
  rpcUrl: string;
  contractAddress: string;
  accountAddress: string;
  privateKey: string;
}

/** The operator signs in the Worker; completion means the ledger transaction was confirmed. */
export const ledgerPaymentAdapter = (credentials: LedgerCredentials): RelayPorts["ledger"]["pay"] => {
  const { provider, account } = ledgerAccountOf(credentials);
  return frontierPayment(async (entrypoint, calldata) => {
    const transaction = await account.execute({
      contractAddress: credentials.contractAddress,
      entrypoint,
      calldata: [...calldata],
    });
    const receipt = await provider.waitForTransaction(transaction.transaction_hash);
    if (receipt.isReverted()) throw new Error("ledger_payment_reverted");
  });
};

/** Read current ERC721 ownership at a confirmed Starknet head for every labor request. */
export const realmsOwnershipAdapter = (rpcUrl: string, contractAddress: string): RelayPorts["realms"] => {
  const provider = rpcAt(rpcUrl);
  return {
    ownerOf: (realmId) =>
      relayOperation("read Realm owner", async () => {
        const id = BigInt(realmId);
        if (id < 0n || id >= 2n ** 256n) throw new Error("invalid_realm_id");
        const owner = await provider.callContract(
          { contractAddress, entrypoint: "owner_of", calldata: [String(id & (2n ** 128n - 1n)), String(id >> 128n)] },
          "latest",
        );
        if (owner.length !== 1) throw new Error("invalid_realm_owner");
        return owner[0]!;
      }),
  };
};

/** Pausing is idempotent at the port, including a retry after the pause transaction landed. */
export const ledgerPauserAdapter = (credentials: LedgerCredentials): (() => import("./ports").RelayEffect<void>) => {
  const { provider, account } = ledgerAccountOf(credentials);
  return () =>
    relayOperation("pause ledger payouts", async () => {
      const paused = await provider.callContract(
        { contractAddress: credentials.contractAddress, entrypoint: "is_paused", calldata: [] },
        "latest",
      );
      if (paused.length !== 1) throw new Error("invalid_pause_state");
      if (BigInt(paused[0]!) === 1n) return;
      if (BigInt(paused[0]!) !== 0n) throw new Error("invalid_pause_state");
      const transaction = await account.execute({
        contractAddress: credentials.contractAddress,
        entrypoint: "pause",
        calldata: [],
      });
      const receipt = await provider.waitForTransaction(transaction.transaction_hash);
      if (receipt.isReverted()) throw new Error("ledger_pause_reverted");
    });
};

const ledgerAccountOf = (credentials: LedgerCredentials) => {
  const provider = rpcAt(credentials.rpcUrl);
  const account = new Account({ provider, address: credentials.accountAddress, signer: credentials.privateKey });
  return { provider, account };
};
