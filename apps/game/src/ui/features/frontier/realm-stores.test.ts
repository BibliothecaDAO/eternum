import { readExpeditionRules, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { afterEach, describe, expect, it } from "vitest";

import { frontierDay } from "./deploy/deploy-fixture";
import { readRealmStore, realmDot } from "./realm-stores";

afterEach(() => setBlockTimestampSource(null));

describe("the realm's stores", () => {
  it("reads troops against the store's limit, ember at the limit, and the Realm dot follows the worst store", () => {
    const { store, row } = frontierDay();
    const rules = readExpeditionRules(store, 1)!;
    const clock = { now: 350, tick: 3 };
    const troops = readRealmStore(store, row, rules, "troops", clock);
    expect(troops.amount).toBe(420);
    // The castle stores castle_store_deploys of its level's full deploys.
    const limit = 2 * store.require("SliceRules", { game_id: 1 }).troop_limit_config.settlement_deployment_cap;
    expect(troops.limit).toBe(limit);
    expect(troops.tone).toBe("calm");
    expect(readRealmStore(store, row, rules, ResourcesIds.Essence, clock).limit).toBeUndefined();

    store.applyFacts([
      {
        model: "ResourceBalance",
        key: "0x8",
        value: {
          game_id: 1,
          entity_id: 7,
          resource_type: 26,
          balance: String(BigInt(limit) * BigInt(RESOURCE_PRECISION)),
        },
      },
    ] as never);
    const full = readRealmStore(store, row, rules, "troops", clock);
    expect(full).toMatchObject({ amount: limit, fullIn: 0, tone: "ember" });
    expect(realmDot([{ tone: "calm" }, full])).toBe("ember");
    expect(realmDot([{ tone: "calm" }, { tone: "amber" }])).toBe("amber");
    expect(realmDot([{ tone: "calm" }])).toBeUndefined();
  });
});
