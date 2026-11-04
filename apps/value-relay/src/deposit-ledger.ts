import { Account, CallData } from "starknet";
import { rpcAt } from "@realms-world/value-ledger";
import { depositReader, type DepositAnchors } from "@realms-world/value-ledger/deposits";
import type { DepositSigningRequest } from "@realms-world/value-ledger/deposits";
import type { Cosignature } from "@realms-world/value-ledger";
import type { ledgerReportAdapter } from "./chain";
import type { DepositMutation } from "./deposits";

/** Called under the ledger actor's nonce permit; terminal onchain state, not local acknowledgements, owns retries. */
export async function mutateDeposit(
  credentials: Parameters<typeof ledgerReportAdapter>[0],
  chainId: string,
  request: DepositMutation,
  sign: (request: DepositSigningRequest) => Promise<Cosignature>,
  anchors: DepositAnchors,
  payoutWallet: (account: string) => Promise<string>,
) {
  const provider = rpcAt(credentials.rpcUrl);
  const key = `ledger:${BigInt(chainId)}:${BigInt(credentials.contractAddress)}`;
  const reader = await depositReader(provider, credentials.contractAddress, chainId, await anchors.getAnchor(key));
  await anchors.putAnchor(key, reader.head);
  if (request.kind === "resolve") {
    const payment = await reader.deposit(request.shard, request.id);
    if (payment.status !== "pending") {
      if ((payment.status === "cancelled") !== request.cancelled) throw new Error("deposit_resolution_differs");
      await reader.assertCanonical();
      return;
    }
    const signature = await sign({
      kind: "resolve-deposit",
      shard: request.shard,
      season: payment.gameId,
      id: request.id,
    });
    await submit("resolve_deposit", {
      shard: request.shard,
      id: request.id,
      cancelled: request.cancelled,
      ...signature,
    });
    const result = await (
      await depositReader(provider, credentials.contractAddress, chainId)
    ).deposit(request.shard, request.id);
    if (result.status !== (request.cancelled ? "cancelled" : "delivered"))
      throw new Error("deposit_resolution_pending");
  } else {
    const previous = await reader.principal(request.shard, request.season, request.account);
    if (previous) {
      if (BigInt(previous.amount) !== BigInt(request.amount)) throw new Error("principal_payment_differs");
      await reader.assertCanonical();
      return;
    }
    const wallet = await payoutWallet(request.account);
    const signature = await sign({ ...request, wallet });
    await submit("pay_principal", {
      shard: request.shard,
      game_id: request.season,
      account: request.account,
      wallet,
      amount: request.amount,
      ...signature,
    });
  }

  async function submit(entrypoint: string, args: Record<string, string | number | boolean>) {
    await reader.assertCanonical();
    const account = new Account({ provider, address: credentials.accountAddress, signer: credentials.privateKey });
    const tx = await account.execute({
      contractAddress: credentials.contractAddress,
      entrypoint,
      calldata: CallData.compile(args),
    });
    const receipt = await provider.waitForTransaction(tx.transaction_hash, {
      successStates: ["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"],
      errorStates: [],
    });
    if (receipt.isReverted()) throw new Error("deposit_mutation_reverted", { cause: receipt.revert_reason });
  }
}
