import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useTransferAutomationRunner } from "./use-transfer-automation-runner";
import type { TransferAutomationEntry } from "./store/use-transfer-automation-store";

const state = vi.hoisted(() => ({
  entries: {} as Record<string, TransferAutomationEntry>,
  account: { address: "0x1" },
  store: {},
  systemCalls: { send_resources_multiple: vi.fn() },
  update: vi.fn(),
  scheduleNext: vi.fn(),
  pruneForGame: vi.fn(),
  balance: vi.fn(),
  over: false,
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: { store: state.store, systemCalls: state.systemCalls },
    account: { account: state.account },
  }),
}));
vi.mock("@/hooks/store/use-account-store", () => ({ accountAddress: () => 1n }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({ id: "blitz" }) }));
vi.mock("@/ui/features/event-feed/notify", () => ({ toast: state.toast }));
vi.mock("@/utils/entity-ownership", () => ({ isEntityOwnedByAccount: () => true }));
vi.mock("./store/use-transfer-automation-store", () => ({
  useTransferAutomationStore: (selector: (s: typeof state) => unknown) => selector(state),
}));
vi.mock("@bibliothecadao/eternum/game-client", () => ({ safeInteger: Number, getScopedGameId: () => 1 }));
vi.mock("@bibliothecadao/eternum", () => ({
  configManager: {
    getSeasonConfig: () => ({ startSettlingAt: 1, startMainAt: 2, endAt: 3 }),
    isGameOver: () => state.over,
  },
  getBlockTimestamp: () => ({ currentBlockTimestamp: 100, currentDefaultTick: 1 }),
  isMilitaryResource: () => false,
  ResourceManager: class {
    balanceWithProduction = state.balance;
  },
  calculateDonkeysNeeded: () => 1,
  getTotalResourceWeightKg: () => 10,
}));
const roots: Root[] = [];
let signerId = 100;
const mount = async () => {
  const root = createRoot(document.createElement("div"));
  roots.push(root);
  function Runner() {
    useTransferAutomationRunner();
    return null;
  }
  await act(async () => root.render(<Runner />));
  return root;
};
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.clearAllMocks();
  state.over = false;
  state.account = { address: `0x${++signerId}` };
  state.balance.mockReturnValue({ balance: 100 * RESOURCE_PRECISION });
  state.systemCalls.send_resources_multiple.mockReset().mockResolvedValue(undefined);
  state.entries = {
    one: {
      id: "one",
      active: true,
      createdAt: 0,
      gameId: "1-2-3",
      sourceEntityId: "1",
      destinationEntityId: "2",
      resourceIds: [ResourcesIds.Wood],
      resourceConfigs: [{ resourceId: ResourcesIds.Wood, amount: 10 }],
      intervalMinutes: 1,
      nextRunAt: 0,
    },
  };
  state.scheduleNext.mockImplementation((id) => {
    state.entries[id].nextRunAt = 200_000;
  });
});
afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount());
  vi.useRealTimers();
});
const tick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(1_001);
  });

it("sends the planned payload once and records the confirmed transfer", async () => {
  await mount();
  await tick();
  await tick();
  expect(state.systemCalls.send_resources_multiple).toHaveBeenCalledTimes(1);
  expect(state.systemCalls.send_resources_multiple).toHaveBeenCalledWith({
    signer: state.account,
    calls: [
      {
        sender_entity_id: 1n,
        recipient_entity_id: 2n,
        resources: [ResourcesIds.Wood, BigInt(10 * RESOURCE_PRECISION)],
      },
    ],
  });
  expect(state.update).toHaveBeenCalledTimes(1);
  expect(state.update).toHaveBeenCalledWith("one", { lastRunAt: 100_000 });
  expect(state.toast.success).toHaveBeenCalledTimes(1);
});
it("keeps a canceled submission for the remounted runner without late updates or another send", async () => {
  let resolve!: () => void;
  state.systemCalls.send_resources_multiple.mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const first = await mount();
  await tick();
  await act(async () => first.unmount());
  roots.splice(roots.indexOf(first), 1);
  resolve();
  await tick();
  expect(state.update).not.toHaveBeenCalled();
  expect(state.toast.success).not.toHaveBeenCalled();
  await mount();
  await tick();
  expect(state.systemCalls.send_resources_multiple).toHaveBeenCalledTimes(1);
  expect(state.update).toHaveBeenCalledTimes(1);
  expect(state.update).toHaveBeenCalledWith("one", { lastRunAt: 100_000 });
});
it("blocks a missing balance rather than sending from a fabricated zero", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.balance.mockReturnValue(undefined);
  await mount();
  await tick();
  expect(state.systemCalls.send_resources_multiple).not.toHaveBeenCalled();
  expect(state.toast.error).toHaveBeenCalledTimes(1);
  expect(state.update).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
it("pauses the remaining entries after a signer failure and permits a later eligible retry", async () => {
  state.entries.two = { ...state.entries.one, id: "two" };
  state.systemCalls.send_resources_multiple.mockRejectedValueOnce(new Error("invalid transaction nonce"));
  await mount();
  await tick();
  expect(state.systemCalls.send_resources_multiple).toHaveBeenCalledTimes(1);
  expect(state.update).not.toHaveBeenCalled();
  expect(state.scheduleNext).not.toHaveBeenCalled();
  await tick();
  expect(state.systemCalls.send_resources_multiple).toHaveBeenCalledTimes(3);
  expect(state.update.mock.calls.map(([id]) => id)).toEqual(["one", "two"]);
});
