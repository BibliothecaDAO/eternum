import { Account, AccountInterface, AllowArray, Call } from "starknet";
import { BatchedTransactionDetail, TransactionType } from "./types";

export interface ExecutionOptions {
  waitForConfirmation?: boolean;
  transactionType?: TransactionType;
}

export interface TransactionExecutor {
  executeAndCheckTransaction(
    signer: Account | AccountInterface,
    transactionDetails: AllowArray<Call>,
    batchDetails?: BatchedTransactionDetail[],
    options?: ExecutionOptions,
  ): Promise<any>;
}
