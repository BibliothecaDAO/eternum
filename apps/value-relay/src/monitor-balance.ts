import mainnetAddresses from "../../../contracts/common/addresses/mainnet.json";
import { ledgerU256, readConfirmedLedgerHead, rpcAt } from "@realms-world/value-ledger";

// Replenish before the initial one-STRK funding falls to its final tenth; this is not a fee estimate.
const LOW_STRK_WEI = 10n ** 17n;
export interface MonitorFeeBalance {
  account: string;
  token: string;
  balance_wei: string;
  low_balance_threshold_wei: string;
  warning: "monitor_strk_low" | null;
  block_number: number;
}

/** Both deployed environments use mainnet; the caller checks the RPC against identity's chain. */
export async function readMonitorFeeBalance(rpcUrl: string, account: string): Promise<MonitorFeeBalance> {
  if (BigInt(account) === 0n) throw new Error("monitor_account_missing");
  const provider = rpcAt(rpcUrl);
  const head = await readConfirmedLedgerHead(provider);
  const fields = await provider.callContract(
    {
      contractAddress: mainnetAddresses.strk,
      entrypoint: "balance_of",
      calldata: [account],
    },
    head.number,
  );
  if (fields.length !== 2) throw new Error("invalid_monitor_strk_balance");
  const balance = ledgerU256(fields[0]!, fields[1]!);
  return {
    account,
    token: mainnetAddresses.strk,
    balance_wei: balance,
    low_balance_threshold_wei: String(LOW_STRK_WEI),
    warning: BigInt(balance) < LOW_STRK_WEI ? "monitor_strk_low" : null,
    block_number: head.number,
  };
}
