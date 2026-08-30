import { resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum";
import { Account, RpcProvider, constants, uint256, type Call } from "starknet";
import type {
  LedgerRegistrationMessage,
  LedgerResultsMessage,
  RegistrationWriter,
  ResultsWriter,
} from "./types";

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
    return executeAndWait(
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
        ],
      },
      this.chain === "madara"
        ? { version: 3 as const, tip: 0, resourceBounds: resolveGameTransactionResourceBounds("madara") }
        : { version: 3 as const, tip: 0 },
      50,
    );
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
    const finalized = result[8];
    if (finalized === undefined || (finalized !== "0x0" && finalized !== "0x1")) {
      throw new Error(`GameLedger.get_game returned an invalid finalized flag for game ${gameId}`);
    }
    return finalized === "0x1";
  }

  public write(message: LedgerResultsMessage): Promise<string> {
    const ranked = message.rows.flatMap(({ owner, rank, chests }) => [owner, rank.toString(), chests.toString()]);
    return executeAndWait(
      this.account,
      {
        contractAddress: this.ledgerAddress,
        entrypoint: "apply_results",
        calldata: [message.gameId.toString(), message.rows.length.toString(), ...ranked],
      },
      { version: 3 as const, tip: 0 },
      1_000,
    );
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
  const succeeded = typeof status.isSuccess === "function" ? status.isSuccess() : status.execution_status === "SUCCEEDED";
  if (!succeeded) throw new Error(`${call.entrypoint} failed for transaction ${transaction.transaction_hash}`);
  return transaction.transaction_hash;
}

export const MAINNET_CHAIN_ID = constants.StarknetChainId.SN_MAIN;
