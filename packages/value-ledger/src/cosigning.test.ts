import { expect, it } from "vitest";
import { cosigningHash, decodeCosignRequest, decodeCosigner, type PayoutTerms } from "./cosigning";

const domain = { chainId: "0x534e5f54455354", ledger: "0x123", epoch: 2 };
const payment: PayoutTerms = {
  kind: "pay",
  shard: "0x456",
  season: 7,
  claim: "0xabc",
  wallet: "0x789",
  amount: String((1n << 128n) + 17n),
  rank: 2,
  count: 3,
};
it("matches the Cairo signing vectors including the high u256 limb", () => {
  expect(cosigningHash(domain, payment)).toBe("0x3d23de542662c1a6a825f074cbe43a026c4f9551dc7bda002adb479e21c5cd8");
  expect(
    cosigningHash(domain, {
      kind: "settle",
      shard: payment.shard,
      season: payment.season,
      chest: payment.amount,
      prize: "99",
      treasuryAmount: "123",
    }),
  ).toBe("0x4645bff34db39e67bf68b8f0186c8589521f1892f4ecc7105ab18540e94901b");
});
it("decodes exact terms and normalizes felt values", () => {
  expect(decodeCosignRequest({ ...payment, wallet: "1929" })).toEqual(payment);
  expect(
    decodeCosignRequest({ kind: "settle", shard: "1110", season: 7, chest: "0", prize: "99", treasuryAmount: "123" }),
  ).toEqual({
    kind: "settle",
    shard: "0x456",
    season: 7,
    chest: "0",
    prize: "99",
    treasuryAmount: "123",
  });
  expect(decodeCosigner(["0x123", "2"])).toEqual({ publicKey: "0x123", epoch: 2 });
});
it.each([
  { wallet: "0" },
  { shard: "-1" },
  { claim: String(2n ** 252n) },
  { amount: "0" },
  { amount: "-1" },
  { amount: String(2n ** 256n) },
  { season: 0 },
  { season: 2 ** 32 },
  { rank: 4 },
  { rank: 0 },
  { count: 101 },
  { count: 2.5 },
  { rpcUrl: "https://attacker.test" },
  { hash: "0x123" },
])("rejects invalid terms or source injection %j", (change) => {
  expect(() => decodeCosignRequest({ ...payment, ...change })).toThrow();
});

it("binds the treasury remainder and rejects requests missing it", () => {
  const terms = { kind: "settle" as const, shard: "0x456", season: 7, chest: "17", prize: "99", treasuryAmount: "123" };
  expect(cosigningHash(domain, terms)).not.toBe(cosigningHash(domain, { ...terms, treasuryAmount: "124" }));
  const { treasuryAmount, ...oldTerms } = terms;
  expect(() => decodeCosignRequest(oldTerms)).toThrow("invalid_cosigning_request");
  expect(() => decodeCosignRequest({ ...terms, treasuryAmount: "-1" })).toThrow();
});
