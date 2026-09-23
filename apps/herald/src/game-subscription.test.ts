import { describe, expect, it, vi } from "vitest";
import type { GameSyncScope } from "@bibliothecadao/eternum/game-sync-models";

import { GameSubscription } from "./game-subscription";
import type { WorldFold } from "./world-fold";

const expeditionScope = (): GameSyncScope => ({
  actor: "0x111",
  expedition: {
    epoch: 0,
    spacing: 21,
    owners: new Set(["273"]),
    realms: new Set(["7"]),
    realmTraits: new Set(["1"]),
    regions: new Set(["0:0"]),
    entities: new Set(["7", "70"]),
    productionSources: new Set(),
  },
});

const army = (owner: string, explorer: string) => ({
  model: "ExplorerTroops",
  key: `0x${explorer}`,
  value: { game_id: "1", explorer_id: explorer, owner, coord: { alt: false, x: "3", y: "3" } },
});

describe("GameSubscription", () => {
  it("takes a scope once, and again only when a change touches it or the expedition rolls over", () => {
    let now = 100;
    const subscriptionScope = vi.fn(expeditionScope);
    const fold = {
      subscriptionScope,
      scopeValidUntil: () => 86_400,
      subscriptionSnapshot: () => ({ confirmed_block: 1, game_id: "1", models: [] }),
      currentRow: () => undefined,
    } as unknown as WorldFold;
    const subscription = new GameSubscription(
      "1",
      "0x111",
      () => fold,
      () => 1,
      () => now,
    );
    subscription.snapshot();
    const head = { type: "head" as const, block: 2, preconfirmed: true, timestamp: now };
    for (let index = 0; index < 5; index++) subscription.project(head);
    expect(subscriptionScope).toHaveBeenCalledTimes(2);

    const diff = (row: ReturnType<typeof army>) =>
      subscription.project({ type: "diff", block: 2, preconfirmed: true, set: [row], del: [] });
    diff(army("8", "80"));
    subscription.project(head);
    expect(subscriptionScope).toHaveBeenCalledTimes(2);

    diff(army("7", "70"));
    expect(subscriptionScope).toHaveBeenCalledTimes(3);

    now = 86_400;
    subscription.project(head);
    expect(subscriptionScope).toHaveBeenCalledTimes(4);
  });
});
