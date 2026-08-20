// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Entity as ToriiEntity } from "@dojoengine/torii-wasm/types";

const { getComponentEntitiesMock, getComponentValueMock, removeComponentMock, setEntitiesMock } = vi.hoisted(() => ({
  getComponentEntitiesMock: vi.fn(),
  getComponentValueMock: vi.fn(),
  removeComponentMock: vi.fn(),
  setEntitiesMock: vi.fn(),
}));

vi.mock("@dojoengine/recs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@dojoengine/recs")>()),
  getComponentEntities: getComponentEntitiesMock,
  getComponentValue: getComponentValueMock,
  removeComponent: removeComponentMock,
}));

vi.mock("@dojoengine/state", () => ({ setEntities: setEntitiesMock }));

import { createGamewideSyncSession, GAMEWIDE_SNAPSHOT_PAGE_SIZE } from "./gamewide-sync-adapter";

const createHarness = ({
  onStreamClose,
  pageRetryCount = 0,
  eventModels = ["s2-BattleEvent"],
}: {
  onStreamClose?: (stream: "entity" | "event", reason: string) => void;
  pageRetryCount?: number;
  eventModels?: string[];
} = {}) => {
  getComponentValueMock.mockReturnValue({ x: 2 });
  let onEntity: ((entity: unknown) => void) | null = null;
  let onEvent: ((event: unknown) => void) | null = null;
  const entitySubscription = { cancel: vi.fn(), on: vi.fn(), off: vi.fn() };
  const eventSubscription = { cancel: vi.fn(), on: vi.fn(), off: vi.fn() };
  const positionComponent = { metadata: { namespace: "s2", name: "Position" } };
  const eventComponent = { metadata: { namespace: "s2", name: "BattleEvent" } };
  const client = {
    onEntityUpdated: vi.fn(async (_clause, callback) => {
      onEntity = callback;
      return entitySubscription;
    }),
    onEventMessageUpdated: vi.fn(async (_clause, callback) => {
      onEvent = callback;
      return eventSubscription;
    }),
    getEntities: vi.fn(async ({ pagination }) => ({
      items: [{ hashed_keys: pagination.cursor ?? "first", models: { "s2-Position": { x: 1 } } }],
      next_cursor: pagination.cursor ? undefined : "second-page",
    })),
    getEventMessages: vi.fn(
      async (): Promise<{ items: ToriiEntity[]; next_cursor?: string }> => ({ items: [], next_cursor: undefined }),
    ),
  };
  // Mirrors the production shape: event components are NESTED under `events`,
  // never top-level — the adapter must flatten them or event rows are dropped.
  const setup = {
    components: { Position: positionComponent, events: { BattleEvent: eventComponent } },
    network: {
      toriiClient: client,
      contractComponents: { Position: positionComponent, events: { BattleEvent: eventComponent } },
      world: { deleteEntity: vi.fn() },
    },
  };
  const session = createGamewideSyncSession({
    setup: setup as never,
    entityClause: { Keys: { keys: ["0xd"], pattern_matching: "VariableLen", models: ["s2-Position"] } },
    eventClause: { Keys: { keys: ["0xd"], pattern_matching: "VariableLen", models: ["s2-BattleEvent"] } },
    eventModels,
    entityModels: ["s2-Position"],
    logging: false,
    subscriptionSetupTimeoutMs: 0,
    snapshotPageTimeoutMs: 0,
    eventReplayPageTimeoutMs: 0,
    pageRetryCount,
    onStreamClose,
  });

  return {
    client,
    emitEntity: (entity: unknown) => onEntity?.(entity),
    emitEvent: (event: unknown) => onEvent?.(event),
    entitySubscription,
    eventComponent,
    eventSubscription,
    positionComponent,
    session,
    setup,
  };
};

beforeEach(() => vi.clearAllMocks());

describe("game-wide sync adapter", () => {
  it("translates cursor pagination into the static Torii entity query", async () => {
    const harness = createHarness();

    const first = await harness.session.transport.fetchSnapshotPage();
    const second = await harness.session.transport.fetchSnapshotPage(first.nextCursor);

    expect(first.nextCursor).toBe("second-page");
    expect(second.nextCursor).toBeUndefined();
    expect(harness.client.getEntities).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        models: ["s2-Position"],
        pagination: expect.objectContaining({ cursor: "second-page", limit: GAMEWIDE_SNAPSHOT_PAGE_SIZE }),
      }),
    );
  });

  it("bridges subscriptions and cancels the complete entity/event pair", async () => {
    const harness = createHarness();
    const handlers = { onEntity: vi.fn(), onEvent: vi.fn(), onEventGapFill: vi.fn() };
    const writer = await harness.session.transport.subscribe(handlers);
    const entity = { hashed_keys: "entity", models: { "s2-Position": { x: 2 } } };
    const event = { hashed_keys: "event", models: { "s2-BattleEvent": { timestamp: 1, winner: 1 } } };

    harness.emitEntity(entity);
    harness.emitEvent(event);
    writer.cancel();

    expect(handlers.onEntity).toHaveBeenCalledWith(entity);
    expect(handlers.onEvent).toHaveBeenCalledWith(event);
    expect(harness.entitySubscription.cancel).toHaveBeenCalledOnce();
    expect(harness.eventSubscription.cancel).toHaveBeenCalledOnce();
  });

  it("routes both subscription lifecycle failures through the session recovery callback", async () => {
    const onStreamClose = vi.fn();
    const harness = createHarness({ onStreamClose });
    const writer = await harness.session.transport.subscribe({
      onEntity: vi.fn(),
      onEvent: vi.fn(),
      onEventGapFill: vi.fn(),
    });
    const emitError = (subscription: { on: ReturnType<typeof vi.fn> }, error: Error) => {
      const handler = subscription.on.mock.calls.find(([event]) => event === "error")?.[1] as
        | ((error: Error) => void)
        | undefined;
      handler?.(error);
    };

    emitError(harness.entitySubscription, new Error("entity failed"));
    emitError(harness.eventSubscription, new Error("event failed"));

    expect(onStreamClose).toHaveBeenNthCalledWith(1, "entity", "entity failed");
    expect(onStreamClose).toHaveBeenNthCalledWith(2, "event", "event failed");
    writer.cancel();
  });

  it("arms event replay after entry without awaiting the history baseline", async () => {
    const harness = createHarness();
    let resolveBaseline!: (page: { items: []; next_cursor: undefined }) => void;
    harness.client.getEventMessages.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveBaseline = resolve;
        }),
    );

    const writer = await harness.session.transport.subscribe({
      onEntity: vi.fn(),
      onEvent: vi.fn(),
      onEventGapFill: vi.fn(),
    });

    expect(harness.client.getEventMessages).toHaveBeenCalledOnce();
    resolveBaseline({ items: [], next_cursor: undefined });
    writer.cancel();
  });

  it("preserves the event replay watermark across a recovered subscription", async () => {
    const harness = createHarness();
    const baselineEvent: ToriiEntity = {
      hashed_keys: "baseline",
      models: {
        "s2-BattleEvent": {
          timestamp: { type: "primitive", type_name: "u64", key: false, value: "100" },
        },
      },
    };
    const missedEvent: ToriiEntity = {
      hashed_keys: "missed",
      models: {
        "s2-BattleEvent": {
          timestamp: { type: "primitive", type_name: "u64", key: false, value: "101" },
        },
      },
    };
    harness.client.getEventMessages
      .mockResolvedValueOnce({ items: [baselineEvent], next_cursor: undefined })
      .mockResolvedValueOnce({ items: [missedEvent, baselineEvent], next_cursor: undefined });

    const firstWriter = await harness.session.transport.subscribe({
      onEntity: vi.fn(),
      onEvent: vi.fn(),
      onEventGapFill: vi.fn(),
    });
    await vi.waitFor(() => expect(harness.client.getEventMessages).toHaveBeenCalledOnce());
    firstWriter.cancel();

    const recoveredHandlers = { onEntity: vi.fn(), onEvent: vi.fn(), onEventGapFill: vi.fn() };
    const recoveredWriter = await harness.session.transport.subscribe(recoveredHandlers);

    expect(recoveredHandlers.onEvent).toHaveBeenCalledWith(missedEvent);
    expect(recoveredHandlers.onEventGapFill).toHaveBeenCalledWith(1);
    recoveredWriter.cancel();
  });

  it("retries a failed snapshot page without restarting the session", async () => {
    const harness = createHarness({ pageRetryCount: 1 });
    harness.client.getEntities
      .mockRejectedValueOnce(new Error("transient page failure"))
      .mockResolvedValueOnce({ items: [], next_cursor: undefined });

    await expect(harness.session.transport.fetchSnapshotPage()).resolves.toEqual({
      items: [],
      nextCursor: undefined,
    });
    expect(harness.client.getEntities).toHaveBeenCalledTimes(2);
  });

  it("names the unmatched models in the stalled-intent error message", () => {
    const harness = createHarness();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      harness.session.onProvisionalIntentStalled?.({
        intentId: "intent-1",
        transactionHash: "0x123",
        unmatchedWrites: [{ entityId: "army-1", model: "ExplorerTroops", matchPatch: { coord: { x: 2 } } }],
      });

      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("(unmatched: ExplorerTroops)"),
        expect.objectContaining({ intentId: "intent-1" }),
      );
    } finally {
      error.mockRestore();
    }
  });

  it("applies component removal without deleting siblings and removes event rows immediately", async () => {
    const harness = createHarness();
    getComponentEntitiesMock.mockReturnValue(["entity"]);

    await harness.session.store.applyEntityOperations([
      { type: "upsert", entities: [{ hashed_keys: "entity", models: { "s2-Position": { x: 2 } } }] },
      { type: "remove-components", entityId: "entity", models: ["s2-Position"] },
    ]);
    await harness.session.store.applyEvent({
      hashed_keys: "event",
      models: { "s2-BattleEvent": { winner: 1 } },
    });

    expect(setEntitiesMock).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), false);
    expect(removeComponentMock).toHaveBeenCalledWith(harness.positionComponent, "entity");
    expect(removeComponentMock).toHaveBeenCalledWith(harness.eventComponent, "event");
    expect(harness.setup.network.world.deleteEntity).not.toHaveBeenCalled();
    expect([...harness.session.store.listModelEntityIds("s2-Position")]).toEqual(["entity"]);
  });

  it("hands event components from the nested contract-components record to setEntities", async () => {
    const harness = createHarness();

    await harness.session.store.applyEvent({
      hashed_keys: "event",
      models: { "s2-BattleEvent": { winner: 1 } },
    });

    const [, componentsPassedToSetEntities] = setEntitiesMock.mock.calls.at(-1) as [unknown, unknown[]];
    expect(componentsPassedToSetEntities).toContain(harness.eventComponent);
    expect(componentsPassedToSetEntities).toContain(harness.positionComponent);
  });

  it("reports an unparsed authoritative model as one line with its identity", async () => {
    const harness = createHarness();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getComponentValueMock.mockReturnValue(undefined);

    try {
      await harness.session.store.applyEntityOperations([
        { type: "upsert", entities: [{ hashed_keys: "entity-1", models: { "s2-Position": { x: 2 } } }] },
      ]);

      expect(error).toHaveBeenCalledWith(
        '[GameSync] authoritative Torii model did not parse into RECS entity_id="entity-1" model="s2-Position"',
      );
    } finally {
      error.mockRestore();
    }
  });

  it("reports an early authoritative echo as one line with reconciliation identity", () => {
    const harness = createHarness();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      harness.session.onProvisionalIntentPhase?.({
        phase: "baseline_delta_before_hash",
        intentId: "intent-1",
        model: "ExplorerTroops",
        elapsedSinceCreatedMs: 12.6,
      });

      expect(warn).toHaveBeenCalledWith(
        '[GameSync] authoritative echo observed before the transaction hash bound intent_id="intent-1" model="ExplorerTroops" elapsed_ms=13',
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("reports loudly when a sync model has no RECS component", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      createHarness({ eventModels: ["s2-UnregisteredEvent"] });
      expect(error).toHaveBeenCalledWith(expect.stringMatching(/dropped silently.*s2-UnregisteredEvent/));
    } finally {
      error.mockRestore();
    }
  });
});
