// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { claimScenario } from "./claim-scenario";
import { installLabChain } from "./lab-chain";

it("answers the settled home's claim with its season-day facts and the same relay transaction", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ shards: [] })),
  );
  const scenario = await installLabChain(claimScenario, Date.now());
  const response = await window.fetch("/api/value/labor", {
    method: "POST",
    body: JSON.stringify({ gameId: 1, home: "7" }),
  });
  const reply = await response.json();
  const sent = window.__labChain!.sent.at(-1)!;
  expect(reply).toEqual({
    day: 0,
    grant: {
      gameId: 1,
      home: "7",
      account: scenario.player,
      amount: "1000000000000",
      essence: "0",
      transactionHash: sent.hash,
    },
  });
  expect(sent.command.kind).toBe("GrantLabor");
  expect(sent.answered.find(({ model }) => model === "LaborGrant")?.value).toEqual({
    game_id: 1,
    home: "7",
    day: 0,
    account: scenario.player,
    amount: "1000000000000",
    essence: "0",
  });
  expect(sent.answered.find(({ model }) => model === "ResourceBalance")?.value).toMatchObject({
    entity_id: "7",
    balance: "1500000000000",
  });
});
