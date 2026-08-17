// @vitest-environment node

import { ProvisionalWriteManager } from "@bibliothecadao/eternum/game-sync";
import {
  createWorld,
  defineComponent,
  getComponentValue,
  overridableComponent,
  Type as RecsType,
  type Entity,
} from "@dojoengine/recs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGamewideSyncSession } from "./gamewide-sync-adapter";

const CAPTURED_WRAPPED_ENTITY = {
  hashed_keys: "0x1",
  models: {
    "s2-TestState": {
      amount: { key: false, type: "primitive", type_name: "u128", value: "30" },
      coord: {
        key: false,
        type: "struct",
        type_name: "Coord",
        value: {
          x: { key: false, type: "primitive", type_name: "u32", value: "12" },
          y: { key: false, type: "primitive", type_name: "u32", value: "9" },
        },
      },
    },
  },
};

const CAPTURED_WRAPPED_BASELINE_ENTITY = {
  ...CAPTURED_WRAPPED_ENTITY,
  models: {
    "s2-TestState": {
      ...CAPTURED_WRAPPED_ENTITY.models["s2-TestState"],
      amount: { key: false, type: "primitive", type_name: "u128", value: "40" },
      coord: {
        ...CAPTURED_WRAPPED_ENTITY.models["s2-TestState"].coord,
        value: {
          ...CAPTURED_WRAPPED_ENTITY.models["s2-TestState"].coord.value,
          x: { key: false, type: "primitive", type_name: "u32", value: "11" },
        },
      },
    },
  },
};

afterEach(() => vi.useRealTimers());

describe("game-wide sync reconciliation adapter", () => {
  it("settles baseline-delta evidence from parsed Torii values while an override is active", async () => {
    vi.useFakeTimers();
    const world = createWorld();
    const authoritativeComponent = defineComponent(
      world,
      { amount: RecsType.BigInt, coord: { x: RecsType.Number, y: RecsType.Number } },
      { metadata: { namespace: "s2", name: "TestState", types: ["u128", "u32", "u32"], customTypes: ["Coord"] } },
    );
    const provisionalComponent = overridableComponent(authoritativeComponent);
    const session = createGamewideSyncSession({
      setup: {
        components: { TestState: provisionalComponent },
        network: {
          contractComponents: { TestState: authoritativeComponent },
          toriiClient: {},
          world,
        },
      } as never,
      entityClause: { Keys: { keys: ["0x1"], pattern_matching: "VariableLen", models: ["s2-TestState"] } },
      eventClause: { Keys: { keys: ["0x1"], pattern_matching: "VariableLen", models: [] } },
      eventModels: [],
      entityModels: ["s2-TestState"],
      logging: false,
      subscriptionSetupTimeoutMs: 0,
      snapshotPageTimeoutMs: 0,
      eventReplayPageTimeoutMs: 0,
      pageRetryCount: 0,
    });
    await session.store.applyEntityOperations([{ type: "upsert", entities: [CAPTURED_WRAPPED_BASELINE_ENTITY] }]);
    const manager = new ProvisionalWriteManager(session.store);
    const intent = manager.createIntent([
      {
        entityId: "0x1",
        model: "TestState",
        patch: { amount: 29n, coord: { x: 12, y: 9 } },
        baselineDeltaFields: ["amount"],
      },
    ]);
    const outcomes: string[] = [];
    intent.subscribe((outcome) => outcomes.push(outcome));
    intent.bindTransaction("0xtx");
    intent.confirm();

    const observations = await session.store.applyEntityOperations([
      { type: "upsert", entities: [CAPTURED_WRAPPED_ENTITY] },
    ]);
    if (!observations) throw new Error("Expected authoritative observations from the RECS adapter");
    manager.observeAuthoritativeObservations(observations);

    expect(getComponentValue(authoritativeComponent, "0x1" as Entity)).toEqual({ amount: 30n, coord: { x: 12, y: 9 } });
    expect(getComponentValue(provisionalComponent, "0x1" as Entity)).toEqual({ amount: 29n, coord: { x: 12, y: 9 } });
    expect(observations).toEqual([
      {
        type: "model",
        entityId: "0x1",
        model: "s2-TestState",
        value: { amount: 30n, coord: { x: 12, y: 9 } },
      },
    ]);

    vi.advanceTimersByTime(2_500);
    expect(outcomes).toEqual(["settled"]);
    expect(getComponentValue(provisionalComponent, "0x1" as Entity)).toEqual({ amount: 30n, coord: { x: 12, y: 9 } });
  });
});
