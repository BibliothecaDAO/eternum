import { decodeGameLedgerGame, resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum";
import { Account, RpcProvider, uint256, type Call } from "starknet";
import { PoisonedRelayMessageError } from "./relay-errors";
import type { LedgerRegistrationMessage, LedgerResultsMessage, RegistrationWriter, ResultsWriter } from "./types";

export function createOperatorAccount(rpcUrl: string, address: string, privateKey: string): Account {
  return new Account({
    provider: new RpcProvider({ nodeUrl: rpcUrl }),
    address,
    signer: privateKey,
  });
}

export class S2RegistrationWriter implements RegistrationWriter {
  public constructor(
    private readonly account: Account,
    private readonly entrySystemAddress: string,
    private readonly chain: "madara" | "appchain",
  ) {}

  public async write(message: LedgerRegistrationMessage): Promise<string> {
    const realmId = uint256.bnToUint256(message.realmId);
    try {
      return await executeAndWait(
        this.account,
        {
          contractAddress: this.entrySystemAddress,
          entrypoint: "register_from_l2",
          calldata: [
            message.gameId.toString(),
            message.owner,
            realmId.low.toString(),
            realmId.high.toString(),
            ...message.metadata,
            message.passKind.toString(),
          ],
        },
        this.chain === "madara"
          ? { version: 3 as const, tip: 0, resourceBounds: resolveGameTransactionResourceBounds("madara") }
          : { version: 3 as const, tip: 0 },
        50,
      );
    } catch (error) {
      throw poisonIfPermanent(error, "registration", message.gameId);
    }
  }
}

export class MainnetResultsWriter implements ResultsWriter {
  private readonly provider: RpcProvider;

  public constructor(
    private readonly account: Account,
    private readonly ledgerAddress: string,
    rpcUrl: string,
  ) {
    this.provider = new RpcProvider({ nodeUrl: rpcUrl });
  }

  public async isFinalized(gameId: number): Promise<boolean> {
    const result = await this.provider.callContract(
      { contractAddress: this.ledgerAddress, entrypoint: "get_game", calldata: [gameId.toString()] },
      "latest",
    );
    return decodeGameLedgerGame(result).finalized;
  }

  public async write(message: LedgerResultsMessage): Promise<string> {
    const ranked = message.rows.flatMap(({ owner, rank, chests }) => [owner, rank.toString(), chests.toString()]);
    try {
      return await executeAndWait(
        this.account,
        {
          contractAddress: this.ledgerAddress,
          entrypoint: "apply_results",
          calldata: [message.gameId.toString(), message.rows.length.toString(), ...ranked],
        },
        { version: 3 as const, tip: 0 },
        1_000,
      );
    } catch (error) {
      throw poisonIfPermanent(error, "results", message.gameId);
    }
  }
}

async function executeAndWait(
  account: Account,
  call: Call,
  details: Parameters<Account["execute"]>[1],
  retryInterval: number,
): Promise<string> {
  const transaction = await account.execute(call, details);
  const receipt = await account.waitForTransaction(transaction.transaction_hash, { retryInterval });
  const status = receipt as { execution_status?: string; isSuccess?: () => boolean };
  const succeeded =
    typeof status.isSuccess === "function" ? status.isSuccess() : status.execution_status === "SUCCEEDED";
  if (!succeeded) {
    throw new PermanentTransactionError(`${call.entrypoint} reverted in transaction ${transaction.transaction_hash}`);
  }
  return transaction.transaction_hash;
}

class PermanentTransactionError extends Error {}

function poisonIfPermanent(error: unknown, direction: "registration" | "results", gameId: number): unknown {
  if (error instanceof PermanentTransactionError || looksLikeExecutionRevert(error)) {
    return new PoisonedRelayMessageError(direction, gameId, errorMessage(error));
  }
  return error;
}

function looksLikeExecutionRevert(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return ["execution reverted", "transaction execution error", "revert reason", "reverted in transaction"].some(
    (marker) => message.includes(marker),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
