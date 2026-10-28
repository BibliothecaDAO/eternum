import { CallData, uint256 } from "starknet";

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
        settings.end,
        settings.seed,
        uint256.bnToUint256(settings.pool),
      ]),
    },
  ];
}
