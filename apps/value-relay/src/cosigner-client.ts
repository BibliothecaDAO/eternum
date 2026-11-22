import type { CosignRequest, Cosignature, RacePayTerms, RacePostTerms } from "@realms-world/value-ledger";
import type { Withdrawal } from "./ports";

export interface PayoutCosigner {
  pay(withdrawal: Withdrawal, wallet: string): Promise<Cosignature>;
}
export interface RaceCosigner {
  postRace(terms: Omit<RacePostTerms, "kind">): Promise<Cosignature>;
  payRace(terms: Omit<RacePayTerms, "kind">): Promise<Cosignature>;
}
export function cosignerClient(
  url: string,
  token: string,
  network: typeof fetch = fetch,
): PayoutCosigner & RaceCosigner {
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
    postRace: (terms) => sign({ kind: "race-post", ...terms }),
    payRace: (terms) => sign({ kind: "race-pay", ...terms }),
  };
}
