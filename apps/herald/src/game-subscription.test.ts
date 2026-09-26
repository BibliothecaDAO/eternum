import { describe, expect, it, vi } from "vitest";
import type { GameSyncScope } from "@bibliothecadao/eternum/game-sync-models";

import { GameSubscription } from "./game-subscription";
import type { WorldFold } from "./world-fold";

const expeditionScope = (): GameSyncScope => ({
  actor: "0x111",
  expedition: {
    absoluteEpoch: 0,
    spacing: 21,
    owners: new Set(["273"]),
    realms: new Set(["7"]),
    realmTraits: new Set(["1"]),
    regions: new Set(["0:0"]),
    entities: new Set(["7", "70"]),
  },
});

const army = (owner: string, explorer: string) => ({
  model: "ExplorerTroops",
  key: `0x${explorer}`,
  value: { game_id: "1", explorer_id: explorer, owner, coord: { alt: false, x: "3", y: "3" } },
});

describe("GameSubscription", () => {
  it("invalidates a visit when its player entry resolves to an owner", () => {
    const subscriptionScope = vi.fn(() => ({ ...expeditionScope(), visit: "0xbbb" }));
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
      () => 100,
      undefined,
      "0xbbb",
    );
    subscription.snapshot();
    subscription.project({ type: "head", block: 2, preconfirmed: true, timestamp: 100 });
    expect(subscriptionScope).toHaveBeenCalledTimes(2);
    subscription.project({
      type: "diff",
      block: 2,
      preconfirmed: true,
      del: [],
      set: [{ model: "PlayerEntry", key: "entry", value: { game_id: "1", player: "3003", owner: "11" } }],
    });
    expect(subscriptionScope).toHaveBeenCalledTimes(3);
    expect(subscriptionScope).toHaveBeenLastCalledWith("1", "0x111", 100, "0xbbb");
  });

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

  it("rebases once per lane scope change while confirmed and preconfirmed scopes alternate", () => {
    const initial = expeditionScope();
    const mustered = { ...initial, expedition: { ...initial.expedition!, entities: new Set(["7", "70", "80"]) } };
    const laneScopes = new Map<boolean, GameSyncScope>([
      [false, initial],
      [true, initial],
    ]);
    const structure = { key: "2:9", value: { game_id: "2", entity_id: "9" } };
    const subscriptionSnapshot = vi.fn(() => ({
      confirmed_block: 1,
      game_id: "2",
      models: [{ model: "Structure", rows: [structure] }],
    }));
    const folds = new Map<boolean, WorldFold>(
      [false, true].map((preconfirmed) => [
        preconfirmed,
        {
          subscriptionScope: () => laneScopes.get(preconfirmed)!,
          scopeValidUntil: () => 86_400,
          subscriptionSnapshot,
          currentRow: () => undefined,
        } as unknown as WorldFold,
      ]),
    );
    const subscription = new GameSubscription(
      "2",
      "0x111",
      (preconfirmed) => {
        return folds.get(preconfirmed)!;
      },
      () => 1,
      () => 100,
    );
    subscription.snapshot();
    const published = [] as ReturnType<GameSubscription["project"]>;
    const rebase = (preconfirmed: boolean) => {
      published.push(
        ...subscription.project({
          type: "diff",
          block: 2,
          preconfirmed,
          set: [{ model: "SliceRules", key: "rules", value: {} }],
          del: [],
        }),
      );
    };

    laneScopes.set(true, mustered);
    rebase(true);
    rebase(true); // same lane, same scope: ordinary diff only
    laneScopes.set(false, mustered);
    rebase(false);
    rebase(true);
    rebase(false);

    // Only the initial snapshot and the two actual lane transitions rebuild a full scope snapshot.
    expect(subscriptionSnapshot).toHaveBeenCalledTimes(3);
    const diffs = published.filter((body) => body.type === "diff");
    expect(diffs.flatMap((body) => (body.type === "diff" ? body.del : []))).toEqual([]);
    expect(
      diffs.some(
        (body) => body.type === "diff" && body.set.some(({ model, key }) => model === "Structure" && key === "2:9"),
      ),
    ).toBe(true);
  });

  it("shows a home-ring tile once, and the chain writing the same tile changes nothing until it differs", () => {
    const tile = (data: string) => ({
      model: "TileOpt",
      key: "0x77",
      value: { game_id: "1", alt: false, col: "3", row: "3", data },
    });
    const ringRow = tile("0xa0000000000");
    const fold = {
      subscriptionScope: expeditionScope,
      scopeValidUntil: () => 86_400,
      subscriptionSnapshot: () => ({ confirmed_block: 1, game_id: "1", models: [] }),
      currentRow: () => undefined,
    } as unknown as WorldFold;
    const ring = { rows: () => [ringRow], row: (key: string) => (key === ringRow.key ? ringRow : undefined) };
    const subscription = new GameSubscription(
      "1",
      "0x111",
      () => fold,
      () => 1,
      () => 100,
      ring,
    );
    const snapshot = subscription.snapshot();
    expect(snapshot.models).toEqual([{ model: "TileOpt", rows: [{ key: ringRow.key, value: ringRow.value }] }]);

    const chainWrites = (row: ReturnType<typeof tile>) =>
      subscription.project({ type: "diff", block: 2, preconfirmed: false, set: [row], del: [] });
    expect(chainWrites(tile("0xa0000000000"))).toEqual([]);
    expect(chainWrites(tile("0xa0000000201"))).toHaveLength(1);
  });
});
