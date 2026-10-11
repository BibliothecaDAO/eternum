import { CallData, uint256 } from "starknet";

// Dev deployment uses ledger IDs 1/2; production registration preserves the native preset ID.
export const frontierLedgerPresetId = (environment, nativePresetId) => (environment === "dev" ? 2 : nativePresetId);

export function buildFrontierFundingCalls(ledger, lords, settings) {
  return [
    {
      contractAddress: lords,
      entrypoint: "approve",
      calldata: CallData.compile([ledger, uint256.bnToUint256(settings.pool)]),
    },
    {
      contractAddress: ledger,
      entrypoint: "fund_frontier",
      calldata: CallData.compile([
        settings.shard,
        settings.frontierSeasonId,
        settings.presetId,
        settings.start,
        settings.seed,
        uint256.bnToUint256(settings.pool),
      ]),
    },
  ];
}
