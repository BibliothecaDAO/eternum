import { CallData, uint256 } from "starknet";

export function buildFrontierFundingCall(ledger, settings) {
  return {
    contractAddress: ledger,
    entrypoint: "fund_frontier",
    calldata: CallData.compile([
      settings.shard,
      1,
      2,
      settings.start,
      settings.seed,
      uint256.bnToUint256(settings.pool),
    ]),
  };
}

export function frontierSeasonManifest(abi, response) {
  const season = new CallData(abi).parse("get_frontier", response);
  return Object.fromEntries(
    Object.entries(season).map(([field, value]) => [field, typeof value === "bigint" ? value.toString() : value]),
  );
}
