import { expect, it, vi } from "vitest";
import { cosignerClient } from "./cosigner-client";

it("requests only exact payment and settlement terms from the independent host", async () => {
  const network = vi.fn<typeof fetch>(async () => Response.json({ r: "0x12", s: "0x34" }));
  const client = cosignerClient("https://cosigner.test", "token", network);
  expect(
    await client.pay(
      {
        chainId: "0x1",
        seasonId: 7,
        transactionHash: "0x123",
        realmsId: "0xa",
        confirmedAt: 1,
        amount: "6000000000000000000000",
        prizeRank: 1,
        prizeCount: 2,
      },
      "0xb",
    ),
  ).toEqual({ r: "0x12", s: "0x34" });
  expect(await client.settle({ chainId: "0x1", gameId: 7, chestWithdrawn: "42", prizeWithdrawn: "9" })).toEqual({
    r: "0x12",
    s: "0x34",
  });
  expect(
    network.mock.calls.map(([url, options]) => ({
      url: String(url),
      headers: options?.headers,
      redirect: options?.redirect,
      body: JSON.parse(String(options?.body)),
    })),
  ).toEqual([
    {
      url: "https://cosigner.test/sign",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      redirect: "manual",
      body: {
        kind: "pay",
        shard: "0x1",
        season: 7,
        claim: "0x123",
        wallet: "0xb",
        amount: "6000000000000000000000",
        rank: 1,
        count: 2,
      },
    },
    {
      url: "https://cosigner.test/sign",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      redirect: "manual",
      body: { kind: "settle", shard: "0x1", season: 7, chest: "42", prize: "9" },
    },
  ]);
});
it.each([
  new Response(null, { status: 503 }),
  Response.json({ r: "0", s: "1" }),
  Response.json({ r: "1" }),
  Response.json(null),
])("refuses unavailable or malformed signatures", async (response) => {
  const client = cosignerClient("https://cosigner.test", "token", async () => response);
  await expect(
    client.settle({ chainId: "0x1", gameId: 7, chestWithdrawn: "0", prizeWithdrawn: "0" }),
  ).rejects.toThrow();
});
