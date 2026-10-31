import type { CosignRequest, Cosignature } from "@realms-world/value-ledger";
import type { Withdrawal } from "./ports";
import type { FrontierSettlement } from "./frontier-sweep";

export interface PayoutCosigner {
  pay(withdrawal: Withdrawal, wallet: string): Promise<Cosignature>;
  settle(settlement: FrontierSettlement): Promise<Cosignature>;
}
export function cosignerClient(url: string, token: string, network: typeof fetch = fetch): PayoutCosigner {
  if (new URL(url).protocol !== "https:" || !token) throw new Error("cosigner_configuration_invalid");
  const sign = async (terms: CosignRequest): Promise<Cosignature> => {
    const response = await network(new URL("/sign", url), {
      method: "POST",
      redirect: "manual",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(terms),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("cosigner_unavailable");
    const result = (await response.json()) as Cosignature;
    if (
      !result ||
      typeof result.r !== "string" ||
      typeof result.s !== "string" ||
      BigInt(result.r) <= 0n ||
      BigInt(result.s) <= 0n
    )
      throw new Error("cosigner_signature_invalid");
    return { r: result.r, s: result.s };
  };
  return {
    pay: (withdrawal, wallet) =>
      sign({
        kind: "pay",
        shard: withdrawal.chainId,
        season: withdrawal.seasonId,
        claim: withdrawal.transactionHash,
        wallet,
        amount: withdrawal.amount,
        rank: withdrawal.prizeRank,
        count: withdrawal.prizeCount,
      }),
    settle: (settlement) =>
      sign({
        kind: "settle",
        shard: settlement.chainId,
        season: settlement.gameId,
        chest: settlement.chestWithdrawn,
        prize: settlement.prizeWithdrawn,
      }),
  };
}
