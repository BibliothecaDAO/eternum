import { expect, it } from "vitest";
import {
  cosigningHash,
  decodeCosignRequest,
  decodeCosigner,
  raceCosigningHash,
  type PayoutTerms,
  type RacePayTerms,
  type RacePostTerms,
} from "./cosigning";

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
});
it("decodes exact terms and normalizes felt values", () => {
  expect(decodeCosignRequest({ ...payment, wallet: "1929" })).toEqual(payment);
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

const raceDomain = { chainId: domain.chainId, rewards: "0x123", epoch: 2 };
const racePost: RacePostTerms = { kind: "race-post", shard: "0x456", season: 7, total: String((1n << 128n) + 17n) };
const racePay: RacePayTerms = {
  kind: "race-pay",
  shard: "0x456",
  season: 7,
  home: "99",
  wallet: "0x789",
  amount: String((1n << 128n) + 17n),
};
it("matches the race rewards class's signing vectors", () => {
  expect(raceCosigningHash(raceDomain, racePost)).toBe(
    "0x2ebe8455f4383ba73e746fbd44791199c7947a9ffc6b669cc5c54fe81bb1d5d",
  );
  expect(raceCosigningHash(raceDomain, racePay)).toBe(
    "0x83622bef47143aadf665cc91179038cd781cc9ebbea1ae741afc2e9bedb460",
  );
});
it("decodes exact race terms", () => {
  expect(decodeCosignRequest({ ...racePost })).toEqual(racePost);
  expect(decodeCosignRequest({ ...racePost, total: "0" })).toEqual({ ...racePost, total: "0" });
  expect(decodeCosignRequest({ ...racePay, wallet: "1929" })).toEqual(racePay);
});
it.each([
  [racePost, { total: "-1" }],
  [racePost, { total: String(2n ** 256n) }],
  [racePost, { season: 0 }],
  [racePost, { rewards: "0x999" }],
  [racePay, { home: "0" }],
  [racePay, { home: "0x63" }],
  [racePay, { home: 99 }],
  [racePay, { home: String(2n ** 64n) }],
  [racePay, { wallet: "0" }],
  [racePay, { amount: "0" }],
  [racePay, { total: "17" }],
])("rejects invalid race terms %j %j", (terms, change) => {
  expect(() => decodeCosignRequest({ ...terms, ...change })).toThrow();
});
