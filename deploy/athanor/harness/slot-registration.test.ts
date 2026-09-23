import { describe, expect, it } from "bun:test";
import { registerBotsThroughSlot } from "./slot-registration";

const accounts = Array.from({ length: 30 }, (_, index) => `0x${(index + 1).toString(16)}`);

function fakeLaunchService(behaviour: { failGame?: number } = {}) {
  const requests: Array<{ method: string; path: string; headers: Record<string, string>; body?: unknown }> = [];
  let slotReads = 0;
  let runReads = 0;
  const slot = (frozen: boolean) => ({
    name: "cap-96",
    closesAt: "2026-09-23T10:00:00.000Z",
    frozenAt: frozen ? "2026-09-23T10:01:00.000Z" : null,
    closed: frozen,
    registrations: accounts.map((account, index) => ({
      realmsId: null,
      account: index % 2 === 0 ? account : account.toUpperCase().replace("0X", "0x"),
      position: index + 1,
      gameNumber: frozen ? (index < 15 ? 1 : 2) : null,
    })),
  });
  const run = (gameNumber: number, complete: boolean) => ({
    gameName: `cap-96-${gameNumber}`,
    kind: "game",
    status: behaviour.failGame === gameNumber ? "attention" : complete ? "complete" : "running",
    artifacts: complete ? { gameId: 40 + gameNumber, settlementTransactions: 3 } : {},
    steps: [{ errorMessage: behaviour.failGame === gameNumber ? "Roster settlement did not make the game ready" : undefined }],
  });
  // Once a game is live its result run is listed first under the same name, queued until the game ends.
  const resultRuns = (live: boolean) =>
    live
      ? [1, 2].map((gameNumber) => ({
          gameName: `cap-96-${gameNumber}`,
          kind: "result",
          status: "queued",
          artifacts: {},
          steps: [],
        }))
      : [];
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  const fetchStub = async (input: string, init: RequestInit) => {
    const url = new URL(input);
    const path = `${url.pathname}${url.search}`;
    const headers = Object.fromEntries(Object.entries(init.headers ?? {})) as Record<string, string>;
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method: init.method ?? "GET", path, headers, body });
    if (headers.authorization !== "Bearer secret") return json({ error: "no" }, 401);
    if (path === "/api/slots" && init?.method === "POST") return json(slot(false));
    if (path === "/api/slots/cap-96/register") return json(slot(false));
    if (path === "/api/slots") return json({ slots: [slot(++slotReads > 1)] });
    if (path === "/api/factory/runs?environment=madara.blitz")
      return json({ runs: [...resultRuns(++runReads > 1), run(1, runReads > 1), run(2, runReads > 1)] });
    return json({ error: `unexpected ${path}` }, 404);
  };
  return { requests, fetch: fetchStub };
}

describe("slot registration", () => {
  it("registers every bot, waits for the freeze and reads each game from its game run, not its result run", async () => {
    const service = fakeLaunchService();
    const games = await registerBotsThroughSlot(
      { origin: "https://staging.example", token: "secret", fetch: service.fetch },
      { slotName: "cap-96", accounts, closesInSeconds: 90, pollMs: 1, timeoutMs: 5_000 },
    );
    expect(games.map(({ gameNumber, gameName, gameId, settlementTransactions, accounts }) => [
      gameNumber, gameName, gameId, settlementTransactions, accounts.length,
    ])).toEqual([
      [1, "cap-96-1", 41, 3, 15],
      [2, "cap-96-2", 42, 3, 15],
    ]);
    expect(games[0]!.accounts[0]).toBe("0x1");
    const [create, register] = service.requests;
    expect(create).toMatchObject({ method: "POST", path: "/api/slots", headers: { origin: "https://staging.example" } });
    expect(typeof create!.body).toBe("object");
    expect((create!.body as { name: string }).name).toBe("cap-96");
    expect(register).toMatchObject({ method: "POST", path: "/api/slots/cap-96/register" });
    expect((register!.body as { accounts: string[] }).accounts).toHaveLength(30);
  });

  it("fails the run when the launch service could not launch a game", async () => {
    const service = fakeLaunchService({ failGame: 2 });
    await expect(
      registerBotsThroughSlot(
        { origin: "https://staging.example", token: "secret", fetch: service.fetch },
        { slotName: "cap-96", accounts, closesInSeconds: 90, pollMs: 1, timeoutMs: 5_000 },
      ),
    ).rejects.toThrow("Launch of cap-96-2 failed: Roster settlement did not make the game ready");
  });

  it("refuses a slot name the launch service would not accept", async () => {
    await expect(
      registerBotsThroughSlot({ origin: "https://x", token: "t" }, { slotName: "Cap 96", accounts, closesInSeconds: 1 }),
    ).rejects.toThrow("not [a-z0-9]");
  });
});
