import { configManager, WorldUpdateListener } from "@bibliothecadao/eternum";
import { NativeFactStore, type GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";
import { afterEach, expect, it, vi } from "vitest";

import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";

import { rowsOf } from "./lab-chain";
import { ruinFightScenario } from "./ruin-fight-scenario";

afterEach(() => vi.restoreAllMocks());

it("answers the attack on the ruin as the chain clears it, and its payout story pairs with its winning battle", () => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  const scenario = ruinFightScenario();
  const chain = new NativeFactStore();
  chain.applyFacts(rowsOf(scenario.store) as never);
  const army = chain.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  const staminaBefore = (army.troops.stamina as { Inline: { amount: bigint } }).Inline.amount;
  const paid = vi.fn();
  new WorldUpdateListener({ store: chain } as unknown as GameClientSetup).SitePayouts.onSitePayout(paid);

  const answered = scenario.answer(
    { kind: "BattleGuard", fields: { attacker_id: String(SPIRE_ARMY), defender_id: String(SITE) }, calldata: [] },
    chain,
    scenario.startsAt + 10,
  );
  const isEvent = (model: string) => model === "StoryEvent" || model === "BattleEvent";
  chain.applyFacts(answered.filter((fact) => !isEvent(fact.model)) as never);
  // Herald stamps each event with its place in the transaction, as the lab's Herald does.
  answered
    .filter((fact) => isEvent(fact.model))
    .forEach((event, index) =>
      chain.applyEvent({
        model: event.model,
        key: event.key,
        value: {
          ...(event.value as Record<string, unknown>),
          event_position: { block_number: 2, transaction_hash: "0x1ab0000", transaction_index: 0, event_index: index },
        },
      }),
    );

  const after = chain.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  expect(after.troops.count).toBe(4_011n * 1_000_000_000n);
  expect((after.troops.stamina as { Inline: { amount: bigint } }).Inline.amount).toBe(staminaBefore - 50n);
  expect(chain.get("Structure", { game_id: 1, entity_id: SITE })).toBeUndefined();
  expect(chain.require("ExpeditionSite", { game_id: 1, entity_id: BigInt(SITE) }).clear?.reward?.amount).toBe(
    100n * 1_000_000_000n,
  );
  expect(paid.mock.calls).toEqual([
    [
      expect.objectContaining({
        siteId: SITE,
        kind: "Ruin",
        reward: { resourceId: ResourcesIds.Lords, amount: 100 },
        troopsLost: 4,
      }),
    ],
  ]);
});
