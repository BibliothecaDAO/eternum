import { expect, test } from "bun:test";
import { burst } from "./burst-send";
import { validateWave } from "./burst";

test("warm worker barrier sends one POST invoke per signed account without synthetic client IP headers", async () => {
  let invokes = 0;
  let warms = 0;
  let released = false;
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const body = await request.json();
      expect(request.headers.get("x-forwarded-for")).toBeNull();
      if (body.method === "starknet_chainId") warms++;
      else {
        expect(released).toBe(true);
        expect(body.method).toBe("starknet_addInvokeTransaction");
        invokes++;
      }
      return Response.json({ jsonrpc: "2.0", id: body.id, result: "0x1" });
    },
  });
  try {
    const rows = await burst(
      `http://127.0.0.1:${server.port}`,
      [1, 2, 3, 4].map((id) => ({
        hash: `0x${id}`,
        body: JSON.stringify({ jsonrpc: "2.0", id, method: "starknet_addInvokeTransaction", params: [] }),
      })),
      2,
      () => {
        expect(warms).toBe(4);
        released = true;
      },
    );
    expect(invokes).toBe(4);
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.error === null && BigInt(row.acknowledgedNs!) >= BigInt(row.sentNs))).toBe(true);
  } finally {
    server.stop(true);
  }
});
test("empty or invalid worker waves never release", async () => {
  await expect(burst("http://127.0.0.1:1", [], 4, () => {})).rejects.toThrow("Nonempty burst");
});
test("a 24-player quiet window refuses shared accounts or an absent primary trigger", () => {
  const player = {
    account: { address: "0x1" },
    client: { gameId: 7, shard: { chainId: "0x1", worldAddress: "0x2", rpcUrl: "http://127.0.0.1:1" } },
  };
  const game = {
    kind: "CreateExplorer",
    players: Array(24).fill(player),
    gameId: 7,
    bounds: { chainId: "0x1" },
    games: "0x2",
    rpcUrl: "http://127.0.0.1:1",
  };
  expect(() => validateWave(game as never, { players: 24 } as never)).toThrow("distinct");
  game.players = Array.from({ length: 24 }, (_, index) => ({ ...player, account: { address: String(index + 1) } }));
  expect(() => validateWave(game as never, { players: 24 } as never)).toThrow("primary receipt checkpoint");
});
