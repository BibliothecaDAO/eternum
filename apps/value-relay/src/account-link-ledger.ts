import { RecordedSigner } from "./recorded-signer";
import { Account } from "starknet";
import { rpcAt } from "@realms-world/value-ledger";
import type { LedgerAccountLinkWrite } from "@realms-world/identity";

interface Credentials {
  rpcUrl: string;
  contractAddress: string;
  accountAddress: string;
  privateKey: string;
}
/** Every comparison reads both directions at one confirmed block. Confirmation is followed by the same comparison. */
export const accountLinkLedger = (credentials: Credentials) => {
  let cached: ReturnType<typeof rpcAt> | undefined;
  const providerOf = () => (cached ??= rpcAt(credentials.rpcUrl));
  const readAt = async (wallet: string | null, account: string | null) => {
    const provider = providerOf();
    const head = await provider.getBlock("latest");
    if (
      !("block_number" in head) ||
      !("status" in head) ||
      !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(head.status ?? "")
    )
      throw new Error("account_link_head_unconfirmed");
    const scalar = async (entrypoint: string, value: string) => {
      const result = await provider.callContract(
        { contractAddress: credentials.contractAddress, entrypoint, calldata: [value] },
        head.block_number,
      );
      if (result.length !== 1 || BigInt(result[0]!) < 0n || BigInt(result[0]!) >= 2n ** 251n)
        throw new Error("invalid_account_link_view");
      return result[0]!;
    };
    return {
      account: wallet ? await scalar("account_of_wallet", wallet) : "0x0",
      wallet: account ? await scalar("wallet_of_account", account) : "0x0",
    };
  };
  return {
    read: readAt,
    paused: async () => {
      const result = await providerOf().callContract(
        { contractAddress: credentials.contractAddress, entrypoint: "is_paused", calldata: [] },
        "latest",
      );
      if (result.length !== 1 || ![0n, 1n].includes(BigInt(result[0]!))) throw new Error("invalid_pause_state");
      return BigInt(result[0]!) === 1n;
    },
    set: async (
      wallet: string,
      account: string,
      onSigning: (write: LedgerAccountLinkWrite) => Promise<void>,
    ): Promise<LedgerAccountLinkWrite> => {
      const previous = await readAt(wallet, BigInt(account) === 0n ? null : account);
      const provider = providerOf();
      const signing = new RecordedSigner(credentials.privateKey, (transactionHash) =>
        onSigning({
          wallet,
          account,
          previousAccount: previous.account,
          previousWallet: previous.wallet,
          transactionHash,
        }),
      );
      const signer = new Account({ provider, address: credentials.accountAddress, signer: signing });
      const tx = await signer.execute({
        contractAddress: credentials.contractAddress,
        entrypoint: "set_account_link",
        calldata: [wallet, account],
      });
      return {
        wallet,
        account,
        previousAccount: previous.account,
        previousWallet: previous.wallet,
        transactionHash: tx.transaction_hash,
      };
    },
    confirm: async (transactionHash: string) => {
      const receipt = await providerOf().waitForTransaction(transactionHash, { errorStates: [] });
      return !receipt.isReverted();
    },
    chainId: () => providerOf().getChainId(),
  };
};
