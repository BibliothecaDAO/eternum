import { describe, expect, it, vi } from "vitest";
import { rowInGameSyncScope, type GameSyncScope } from "@bibliothecadao/eternum/game-sync-models";

import { setup } from "./native/fixtures";

import { GameSubscription } from "./game-subscription";
import type { WorldFold } from "./world-fold";

const expeditionScope = (): GameSyncScope => ({
  actor: "0x111",
  expedition: {
    day: 0,
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
      setup().decoder.registry,
      undefined,
      "0xbbb",
    );
    subscription.snapshot();
    subscription.project({ type: "head", block: 2, preconfirmed: true, timestamp: 100 });
    expect(subscriptionScope).toHaveBeenCalledTimes(1);
    subscription.project({
      type: "diff",
      block: 2,
      preconfirmed: true,
      del: [],
      set: [{ model: "PlayerEntry", key: "entry", value: { game_id: "1", player: "3003", owner: "11" } }],
    });
    expect(subscriptionScope).toHaveBeenCalledTimes(2);
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
      setup().decoder.registry,
    );
    subscription.snapshot();
    const head = { type: "head" as const, block: 2, preconfirmed: true, timestamp: now };
    for (let index = 0; index < 5; index++) subscription.project(head);
    expect(subscriptionScope).toHaveBeenCalledTimes(1);

    const diff = (row: ReturnType<typeof army>) =>
      subscription.project({ type: "diff", block: 2, preconfirmed: true, set: [row], del: [] });
    diff(army("8", "80"));
    subscription.project(head);
    expect(subscriptionScope).toHaveBeenCalledTimes(1);

    diff(army("7", "70"));
    expect(subscriptionScope).toHaveBeenCalledTimes(2);

    now = 86_400;
    subscription.project(head);
    expect(subscriptionScope).toHaveBeenCalledTimes(3);
  });

  it("rebases once while confirmed and preconfirmed scopes alternate", () => {
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
    const gained = { model: "Structure", key: "2:80", value: { game_id: "2", entity_id: "80" } };
    const scopeKeyRows = vi.fn((_game: string, _spacing: number, keys: ReadonlySet<string>) =>
      keys.has("entities:80") ? [gained] : [],
    );
    const folds = new Map<boolean, WorldFold>(
      [false, true].map((preconfirmed) => [
        preconfirmed,
        {
          subscriptionScope: () => laneScopes.get(preconfirmed)!,
          scopeValidUntil: () => 86_400,
          subscriptionSnapshot,
          scopeKeyRows,
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
      setup().decoder.registry,
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

    // Confirmation does not rebase a scope the overlay already published; the rebase reads only the keys it gains.
    expect(subscriptionSnapshot).toHaveBeenCalledTimes(1);
    expect(scopeKeyRows.mock.calls.filter(([, , keys]) => keys.size > 0)).toHaveLength(1);
    const diffs = published.filter((body) => body.type === "diff");
    expect(diffs.flatMap((body) => (body.type === "diff" ? body.del : []))).toEqual([]);
    const structures = diffs.flatMap((body) =>
      body.type === "diff" ? body.set.filter(({ model }) => model === "Structure").map(({ key }) => key) : [],
    );
    expect(structures).toEqual(["2:80"]);
  });

  it("sends a scope change's gained rows and its diff's own rows, never a row the subscriber holds", () => {
    const initial = expeditionScope();
    let scope = initial;
    const rules = { key: "rules", value: { game_id: "2" } };
    const structure = { key: "2:9", value: { game_id: "2", entity_id: "9" } };
    const subscriptionSnapshot = vi.fn((_game: string, _block: number, _scope: GameSyncScope, only?: string[]) => ({
      confirmed_block: 1,
      game_id: "2",
      models: [
        ...(only === undefined || only.includes("SliceRules") ? [{ model: "SliceRules", rows: [rules] }] : []),
        { model: "Structure", rows: [structure] },
      ],
    }));
    const gained = { model: "Structure", key: "2:80", value: { game_id: "2", entity_id: "80" } };
    const scopeKeyRows = vi.fn((_game: string, _spacing: number, keys: ReadonlySet<string>, models: string[]) => {
      expect(models).toContain("Structure");
      expect(models).not.toContain("SliceRules");
      // The held structure is reached again by a gained key; it is not sent twice.
      return keys.has("entities:80") ? [{ model: "Structure", ...structure }, gained] : [];
    });
    const fold = {
      subscriptionScope: () => scope,
      scopeValidUntil: () => 86_400,
      subscriptionSnapshot,
      scopeKeyRows,
      currentRow: () => undefined,
    } as unknown as WorldFold;
    const subscription = new GameSubscription(
      "2",
      "0x111",
      () => fold,
      () => 1,
      () => 100,
      setup().decoder.registry,
    );
    subscription.snapshot();
    expect(subscriptionSnapshot.mock.calls[0]![3]).toBeUndefined();

    scope = { ...initial, expedition: { ...initial.expedition!, entities: new Set(["7", "70", "80"]) } };
    // An army of the player's own entity moves the scope, so the next projection replaces it; the same diff changes a
    // shared row, which passes through as in any diff.
    const changedRules = { model: "SliceRules", key: "rules", value: { game_id: "2", changed: true } };
    const [replaced] = subscription.project({
      type: "diff",
      block: 2,
      preconfirmed: true,
      set: [army("7", "70"), changedRules],
      del: [],
    });
    expect(subscriptionSnapshot).toHaveBeenCalledTimes(1);
    expect(replaced).toMatchObject({ type: "diff", del: [] });
    expect(replaced!.type === "diff" && replaced!.set.map(({ model, key }) => `${model}:${key}`).sort()).toEqual([
      "ExplorerTroops:0x70",
      "SliceRules:rules",
      "Structure:2:80",
    ]);
  });

  it("deletes a held row that an ordinary diff moves out of the scope", () => {
    const scope = expeditionScope();
    const explorer = (owner: string, x: string) => ({
      model: "ExplorerTroops",
      key: "0x71",
      value: { game_id: "1", explorer_id: "71", owner, coord: { alt: false, x, y: "3" } },
    });
    // Held through its owner and its region, not its entity.
    const held = explorer("273", "3");
    const fold = {
      subscriptionScope: () => scope,
      scopeValidUntil: () => 86_400,
      subscriptionSnapshot: () => ({
        confirmed_block: 1,
        game_id: "2",
        models: [{ model: held.model, rows: [{ key: held.key, value: held.value }] }],
      }),
      currentRow: () => undefined,
    } as unknown as WorldFold;
    const subscription = new GameSubscription(
      "2",
      "0x111",
      () => fold,
      () => 1,
      () => 100,
      setup().decoder.registry,
    );
    subscription.snapshot();
    // The army changes hands and walks off the region; the scope, read again, is the same, but the army's keys no
    // longer meet it.
    const handedOver = explorer("999", "300");
    expect(rowInGameSyncScope(handedOver.model, handedOver.value, scope)).toBe(false);
    expect(
      subscription.project({ type: "diff", block: 2, preconfirmed: false, set: [handedOver], del: [] }),
    ).toMatchObject([{ type: "diff", set: [], del: [{ model: held.model, key: held.key }] }]);
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
      setup().decoder.registry,
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
