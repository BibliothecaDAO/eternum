import { readFileSync } from "node:fs";
import { isCampaignKey } from "@realms-world/identity";

/** Draw first, then register through the relay. Both operations resume their recorded result after interruption. */
async function recoverHomes() {
  const [affectedPath, baseUrl, chainId, game, campaign] = process.argv.slice(2);
  const tokenPath = process.env.OPERATOR_TOKEN_FILE;
  if (!affectedPath || !baseUrl || !chainId || !game || !isCampaignKey(campaign) || !tokenPath)
    throw new Error("invalid_arguments");
  const origin = new URL(baseUrl);
  const gameId = Number(game);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    !/^0x[0-9a-f]{1,64}$/i.test(chainId) ||
    !Number.isSafeInteger(gameId) ||
    gameId < 1 ||
    gameId > 0xffffffff
  )
    throw new Error("invalid_target");
  const affected = JSON.parse(readFileSync(affectedPath, "utf8")) as { accounts: { realmsId: string; home: string }[] };
  const accounts = affected.accounts.filter((row) => row.home === "free").map((row) => row.realmsId);
  if (
    accounts.length !== 22 ||
    new Set(accounts.map((id) => BigInt(id).toString())).size !== 22 ||
    accounts.some((id) => !/^0x[0-9a-f]{1,64}$/i.test(id))
  )
    throw new Error("invalid_recovery_list");
  const token = readFileSync(tokenPath, "utf8").trim();
  const counts = { selected: accounts.length, drawn: 0, registered: 0, failed: 0 };
  for (const realmsId of accounts) {
    try {
      const ticket = await post("/api/operator/campaign-draw", { campaign, realmsId });
      if (ticket.campaign !== campaign || !["regular", "golden"].includes(String(ticket.tier)))
        throw new Error("invalid_ticket");
      counts.drawn++;
      const entry = await post("/api/value/operator/campaign-entry", { chainId, gameId, realmsId });
      if (entry.campaign !== ticket.campaign || entry.tier !== ticket.tier) throw new Error("registration_differs");
      counts.registered++;
    } catch {
      counts.failed++;
    }
  }
  console.log(JSON.stringify(counts));
  if (counts.failed) process.exitCode = 1;

  async function post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await fetch(new URL(path, origin), {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(120_000),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("recovery_refused");
    return (await response.json()) as Record<string, unknown>;
  }
}

recoverHomes().catch(() => {
  console.log(JSON.stringify({ failed: 1 }));
  process.exitCode = 1;
});
