// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getComponentEntitiesMock, removeComponentMock, setEntitiesMock } = vi.hoisted(() => ({
  getComponentEntitiesMock: vi.fn(),
  removeComponentMock: vi.fn(),
  setEntitiesMock: vi.fn(),
}));

vi.mock("@dojoengine/recs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@dojoengine/recs")>()),
  getComponentEntities: getComponentEntitiesMock,
  removeComponent: removeComponentMock,
}));

vi.mock("@dojoengine/state", () => ({ setEntities: setEntitiesMock }));

import { createGamewideSyncSession, GAMEWIDE_SNAPSHOT_PAGE_SIZE } from "./gamewide-sync-adapter";

const createHarness = () => {
  let onEntity: ((entity: unknown) => void) | null = null;
  let onEvent: ((event: unknown) => void) | null = null;
  const entitySubscription = { cancel: vi.fn() };
  const eventSubscription = { cancel: vi.fn() };
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
  };
  const setup = {
    network: {
      toriiClient: client,
      contractComponents: { Position: positionComponent, BattleEvent: eventComponent },
      world: { deleteEntity: vi.fn() },
    },
  };
  const session = createGamewideSyncSession({
    setup: setup as never,
    entityClause: { Keys: { keys: ["0xd"], pattern_matching: "VariableLen", models: ["s2-Position"] } },
    eventClause: { Keys: { keys: ["0xd"], pattern_matching: "VariableLen", models: ["s2-BattleEvent"] } },
    entityModels: ["s2-Position"],
    logging: false,
    subscriptionSetupTimeoutMs: 0,
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
    const handlers = { onEntity: vi.fn(), onEvent: vi.fn() };
    const writer = await harness.session.transport.subscribe(handlers);
    const entity = { hashed_keys: "entity", models: { "s2-Position": { x: 2 } } };
    const event = { hashed_keys: "event", models: { "s2-BattleEvent": { winner: 1 } } };

    harness.emitEntity(entity);
    harness.emitEvent(event);
    writer.cancel();

    expect(handlers.onEntity).toHaveBeenCalledWith(entity);
    expect(handlers.onEvent).toHaveBeenCalledWith(event);
    expect(harness.entitySubscription.cancel).toHaveBeenCalledOnce();
    expect(harness.eventSubscription.cancel).toHaveBeenCalledOnce();
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
});
