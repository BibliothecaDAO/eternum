import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTransferAutomationStore } from "./store/use-transfer-automation-store";
import { useTransferAutomationRunner } from "./use-transfer-automation-runner";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

const mocks = vi.hoisted(() => {
  const balances = new Map<string, number>();
  return {
    account: { address: "0xabc" },
    balances,
    sendResourcesMultiple: vi.fn(),
    scheduleNext: vi.fn(),
    update: vi.fn(),
    pruneForGame: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
  };
});

const balanceKey = (entityId: number, resourceId: number) => `${entityId}:${resourceId}`;

vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({
    setup: {
      components: { Resource: { key: "Resource" } },
      systemCalls: {
        send_resources_multiple: mocks.sendResourcesMultiple,
      },
    },
    account: {
      account: mocks.account,
    },
  }),
}));

vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ id: "eternum" }),
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (selector: (state: { gameEndAt?: number; gameWinner?: string }) => unknown) =>
    selector({ gameEndAt: undefined, gameWinner: undefined }),
}));

vi.mock("@/utils/entity-ownership", () => ({
  isEntityOwnedByAccount: () => true,
}));

vi.mock("@/ui/lib/structure-capabilities", () => ({
  canTransferMilitaryInventoryBetweenStructureIds: () => true,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    warning: mocks.toastWarning,
  },
}));

vi.mock("@bibliothecadao/eternum", () => ({
  calculateDonkeysNeeded: () => 0,
  getTotalResourceWeightKg: () => 0,
  getAutomationProjectionTick: () => ({ currentDefaultTick: 100 }),
  getBlockTimestamp: () => ({ currentBlockTimestamp: 100 }),
  isMilitaryResource: () => false,
  configManager: {
    getSeasonConfig: () => ({ startSettlingAt: 1, startMainAt: 2, endAt: 3 }),
  },
  ResourceManager: class {
    constructor(
      private readonly _components: unknown,
      private readonly entityId: number,
    ) {}

    balanceWithProduction(_tick: number, resourceId: ResourcesIds) {
      const balance = mocks.balances.get(balanceKey(this.entityId, resourceId)) ?? 0;
      return { balance: balance * 1_000_000_000 };
    }

    async submitProvisionalResourceTransaction<T>(
      resourceChanges: Array<{ resourceId: ResourcesIds; amount: number }>,
      _waiterSource: unknown,
      submit: () => Promise<T>,
    ) {
      for (const resourceChange of resourceChanges) {
        const key = balanceKey(this.entityId, resourceChange.resourceId);
        mocks.balances.set(key, (mocks.balances.get(key) ?? 0) + resourceChange.amount);
      }

      return submit();
    }
  },
}));

vi.mock("./store/use-transfer-automation-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store/use-transfer-automation-store")>();
  return {
    ...actual,
    useTransferAutomationStore: Object.assign(
      (selector: (state: ReturnType<typeof actual.useTransferAutomationStore.getState>) => unknown) =>
        selector({
          ...actual.useTransferAutomationStore.getState(),
          update: mocks.update,
          scheduleNext: mocks.scheduleNext,
          pruneForGame: mocks.pruneForGame,
        }),
      {
        getState: actual.useTransferAutomationStore.getState,
        setState: actual.useTransferAutomationStore.setState,
      },
    ),
  };
});

function HookHarness() {
  useTransferAutomationRunner();
  return null;
}

describe("useTransferAutomationRunner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(99_750);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.balances.clear();
    mocks.balances.set(balanceKey(1, ResourcesIds.Wood), 100);
    mocks.balances.set(balanceKey(1, ResourcesIds.Donkey), 100);
    mocks.sendResourcesMultiple.mockResolvedValue({ transaction_hash: "0xtx" });
    mocks.scheduleNext.mockClear();
    mocks.update.mockClear();
    mocks.pruneForGame.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.toastError.mockClear();
    mocks.toastWarning.mockClear();
    useTransferAutomationStore.setState({
      entries: {
        first: buildDueEntry("first"),
        second: buildDueEntry("second"),
      },
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("plans later due transfers against successful debits from earlier transfers in the same pass", async () => {
    await act(async () => {
      root.render(<HookHarness />);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(mocks.sendResourcesMultiple).toHaveBeenCalledTimes(2);
    expect(sentWoodAmount(1)).toBe(80);
    expect(sentWoodAmount(2)).toBe(20);
    expect(mocks.balances.get(balanceKey(1, ResourcesIds.Wood))).toBe(0);
  });
});

function buildDueEntry(id: string) {
  return {
    id,
    active: true,
    createdAt: 0,
    gameId: "1-2-3",
    sourceEntityId: "1",
    destinationEntityId: id === "first" ? "2" : "3",
    resourceIds: [ResourcesIds.Wood],
    resourceConfigs: [{ resourceId: ResourcesIds.Wood, amount: 80 }],
    intervalMinutes: 1,
    nextRunAt: 100_000,
  };
}

function sentWoodAmount(callNumber: number) {
  const call = mocks.sendResourcesMultiple.mock.calls[callNumber - 1]?.[0];
  const amount = call?.calls?.[0]?.resources?.[1] as bigint | undefined;
  return amount ? Number(amount / BigInt(RESOURCE_PRECISION)) : undefined;
}
