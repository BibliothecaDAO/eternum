import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BuildingType } from "@bibliothecadao/types";
const state = vi.hoisted(() => ({
  game: 1,
  place: vi.fn(),
  error: vi.fn(),
  /** Plots with a building standing in the store, as "col,row". */
  standing: new Set<string>(),
  /** The game's outcome for each sent build. */
  outcome: vi.fn(),
}));
/** What the provider resolves a sent build with: the transaction, before the game has applied it. */
const SENT = { statusReceipt: "PENDING", transaction_hash: "0x1" };
let activeClient: ReturnType<typeof createClient> | null = null;
const createClient = (worldAddress = "0xa", chainId = "0x1") => ({
  gameId: state.game,
  shard: { chainId, worldAddress },
  setup: { store: { worldAddress } },
  actions: { placeBuilding: state.place },
  waitForAction: state.outcome,
  views: {
    buildingTiles: vi.fn(() => ({
      getRealmLevel: () => 1,
      isHexOccupied: ({ col, row }: { col: number; row: number }) => state.standing.has(`${col},${row}`),
    })),
  },
});
vi.mock("@bibliothecadao/eternum/automation", () => ({
  generateBuildablePositions: () => [
    { col: 1, row: 1 },
    { col: 2, row: 2 },
  ],
  resolveConstructionBuildability: () => ({ canSubmit: true }),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  buildableRadius: () => 1,
}));
vi.mock("@/ui/features/event-feed/notify", () => ({ toast: { error: state.error, failed: state.error } }));
vi.mock("@/sync/active-game-client", () => ({
  requireActiveGameClient: () => activeClient,
  getActiveGameStore: () => activeClient?.setup.store ?? null,
}));
import { buildRealmBuilding } from "./realm-build-actions";
const options = (entityId = 1) => ({
  entityId,
  realmPosition: { x: 1, y: 1 },
  target: { type: BuildingType.ResourceLabor },
  useSimpleCost: true,
});
beforeEach(() => {
  state.game = 1;
  state.standing.clear();
  activeClient = createClient();
  state.place.mockReset().mockResolvedValue(SENT);
  state.outcome.mockReset().mockResolvedValue({ status: "SUCCEEDED" });
  state.error.mockReset();
});
afterEach(() => vi.restoreAllMocks());
it("serializes one realm while another realm proceeds", async () => {
  let finish!: () => void;
  state.place.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(SENT);
      }),
  );
  const first = buildRealmBuilding(options());
  const second = buildRealmBuilding(options());
  const other = buildRealmBuilding(options(2));
  expect(state.place.mock.calls.map(([input]) => input.structureId)).toEqual([1, 2]);
  await other;
  finish();
  expect(await first).toBe(true);
  expect(await second).toBe(true);
  expect(state.place.mock.calls.map(([input]) => input.structureId)).toEqual([1, 2, 1]);
});
it("holds a realm until its build stands, so the next quick build takes another free plot", async () => {
  let applied!: () => void;
  state.outcome.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        applied = () => resolve({ status: "SUCCEEDED" });
      }),
  );
  const first = buildRealmBuilding(options());
  const second = buildRealmBuilding(options());
  await vi.waitFor(() => expect(state.place).toHaveBeenCalledOnce());
  // The first build is sent but not applied yet: the second press waits, and sends nothing to the same plot.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(state.place).toHaveBeenCalledOnce();
  state.standing.add("1,1");
  applied();
  expect(await first).toBe(true);
  expect(await second).toBe(true);
  expect(state.place.mock.calls.map(([input]) => input.hex)).toEqual([
    { col: 1, row: 1 },
    { col: 2, row: 2 },
  ]);
});
it("reports a build the game refused and sends nothing more for that press", async () => {
  state.outcome.mockResolvedValueOnce({ status: "REVERTED", revertReason: "building location occupied" });
  expect(await buildRealmBuilding(options())).toBe(false);
  expect(state.place).toHaveBeenCalledOnce();
  expect(state.error).toHaveBeenCalledOnce();
  state.place.mockRejectedValueOnce(new Error("cannot pay"));
  expect(await buildRealmBuilding(options())).toBe(false);
  expect(await buildRealmBuilding(options())).toBe(true);
  expect(state.place).toHaveBeenCalledTimes(3);
});
it("cancels a queued build without sending it or dropping another waiter's lock", async () => {
  let finish!: () => void;
  state.place.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(SENT);
      }),
  );
  const first = buildRealmBuilding(options());
  const controller = new AbortController();
  const cancelled = expect(buildRealmBuilding({ ...options(), signal: controller.signal })).rejects.toThrow();
  const last = buildRealmBuilding(options());
  controller.abort();
  await cancelled;
  expect(state.place).toHaveBeenCalledOnce();
  finish();
  await first;
  expect(await last).toBe(true);
  expect(state.place).toHaveBeenCalledTimes(2);
});
it("keeps an unabortable submitted build locked until settlement and suppresses its late callback", async () => {
  let finish!: () => void;
  state.place.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(SENT);
      }),
  );
  const controller = new AbortController();
  const onBuildSuccess = vi.fn();
  const cancelled = expect(
    buildRealmBuilding({ ...options(), signal: controller.signal, onBuildSuccess }),
  ).rejects.toThrow();
  controller.abort();
  const next = buildRealmBuilding(options());
  expect(state.place).toHaveBeenCalledOnce();
  finish();
  await cancelled;
  expect(await next).toBe(true);
  expect(onBuildSuccess).not.toHaveBeenCalled();
  expect(state.place).toHaveBeenCalledTimes(2);
});
it("does not submit a queued build into a different game", async () => {
  let finish!: () => void;
  state.place.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(SENT);
      }),
  );
  const first = buildRealmBuilding(options());
  const queued = expect(buildRealmBuilding(options())).rejects.toThrow("active game changed");
  state.game = 2;
  activeClient = createClient();
  finish();
  await first;
  await queued;
  expect(state.place).toHaveBeenCalledOnce();
});

it("does not try another tile if the scope ends while a refused send is pending", async () => {
  let reject!: (error: Error) => void;
  state.place.mockImplementationOnce(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
  );
  const controller = new AbortController();
  const result = expect(buildRealmBuilding({ ...options(), signal: controller.signal })).rejects.toThrow();
  controller.abort();
  reject(new Error("building location occupied"));
  await result;
  expect(state.place).toHaveBeenCalledOnce();
});

it.each(["world", "chain"])(
  "isolates %s queues and refuses obsolete queued work with equal game and realm IDs",
  async (change) => {
    let finish!: () => void;
    const firstClient = activeClient!;
    const firstConfirmed = vi.fn();
    state.place.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(SENT);
        }),
    );
    const first = buildRealmBuilding({ ...options(), onBuildSuccess: firstConfirmed });
    const queued = expect(buildRealmBuilding(options())).rejects.toThrow("active game changed");
    const secondClient = createClient(change === "world" ? "0xb" : "0xa", change === "chain" ? "0x2" : "0x1");
    const otherWorldPlace = vi.fn().mockResolvedValue(SENT);
    secondClient.actions.placeBuilding = otherWorldPlace;
    activeClient = secondClient;
    const other = buildRealmBuilding(options());
    expect(otherWorldPlace).toHaveBeenCalledTimes(1);
    expect(await other).toBe(true);
    finish();
    expect(await first).toBe(true);
    await queued;
    expect(state.place).toHaveBeenCalledTimes(1);
    expect(otherWorldPlace).toHaveBeenCalledTimes(1);
    expect(firstClient.views.buildingTiles).toHaveBeenCalledTimes(1);
    expect(secondClient.views.buildingTiles).toHaveBeenCalledTimes(1);
    expect(firstConfirmed).not.toHaveBeenCalled();
  },
);

it("does not try another tile in an obsolete world without a caller signal", async () => {
  let reject!: (error: Error) => void;
  state.place.mockImplementationOnce(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
  );
  const result = buildRealmBuilding(options());
  activeClient = createClient("0xb");
  reject(new Error("building location occupied"));
  expect(await result).toBe(false);
  expect(state.place).toHaveBeenCalledTimes(1);
});
