import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BuildingType } from "@bibliothecadao/types";
const state = vi.hoisted(() => ({ game: 1, place: vi.fn(), error: vi.fn(), occupied: false }));
vi.mock("@bibliothecadao/eternum/game-client", () => ({ getScopedGameId: () => state.game }));
vi.mock("@bibliothecadao/eternum/automation", () => ({
  generateBuildablePositions: () => [
    { col: 1, row: 1 },
    { col: 2, row: 2 },
  ],
  resolveConstructionBuildability: () => ({ canSubmit: true }),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  buildableRadius: () => 1,
  OccupiedSpaceError: class OccupiedSpaceError extends Error {},
}));
vi.mock("@/ui/features/event-feed/notify", () => ({ toast: { error: state.error } }));
vi.mock("@/sync/active-game-client", () => ({
  requireActiveGameClient: () => ({
    setup: { store: {} },
    actions: { placeBuilding: state.place },
    views: { buildingTiles: () => ({ getRealmLevel: () => 1, isHexOccupied: () => state.occupied }) },
  }),
}));
import { OccupiedSpaceError } from "@bibliothecadao/eternum";
import { buildRealmBuilding } from "./realm-build-actions";
const options = (entityId = 1) => ({
  entityId,
  realmPosition: { x: 1, y: 1 },
  target: { type: BuildingType.ResourceLabor },
  useSimpleCost: true,
});
beforeEach(() => {
  state.game = 1;
  state.occupied = false;
  state.place.mockReset().mockResolvedValue(undefined);
  state.error.mockReset();
});
afterEach(() => vi.restoreAllMocks());
it("serializes one realm while another realm proceeds", async () => {
  let finish!: () => void;
  state.place.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
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
it("releases a failed build and selects another spot only for the occupied-space tag", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.place.mockRejectedValueOnce(new OccupiedSpaceError()).mockResolvedValueOnce(undefined);
  expect(await buildRealmBuilding(options())).toBe(true);
  expect(state.place.mock.calls.map(([input]) => input.hex)).toEqual([
    { col: 1, row: 1 },
    { col: 2, row: 2 },
  ]);
  state.place.mockRejectedValueOnce(new Error("cannot pay"));
  expect(await buildRealmBuilding(options())).toBe(false);
  expect(await buildRealmBuilding(options())).toBe(true);
  expect(state.place).toHaveBeenCalledTimes(4);
});
it("cancels a queued build without sending it or dropping another waiter's lock", async () => {
  let finish!: () => void;
  state.place.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
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
      new Promise<void>((resolve) => {
        finish = resolve;
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
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const first = buildRealmBuilding(options());
  const queued = expect(buildRealmBuilding(options())).rejects.toThrow("active game changed");
  state.game = 2;
  finish();
  await first;
  await queued;
  expect(state.place).toHaveBeenCalledOnce();
});

it("does not try another tile if the scope ends while the occupied-space rejection is pending", async () => {
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
  reject(new OccupiedSpaceError());
  await result;
  expect(state.place).toHaveBeenCalledOnce();
});
