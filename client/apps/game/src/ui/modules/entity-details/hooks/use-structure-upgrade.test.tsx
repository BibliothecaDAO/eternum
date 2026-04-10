import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRealmUpgradeStore } from "@/hooks/store/use-realm-upgrade-store";
import { useStructureUpgrade } from "./use-structure-upgrade";

const mocks = vi.hoisted(() => ({
  currentLevel: 1,
  structureEntityId: 101,
  upgradeRealm: vi.fn(),
  waitForTransactionConfirmation: vi.fn(),
  getStructuresDataFromTorii: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 0,
  useBlockTimestamp: () => ({ currentDefaultTick: 0 }),
}));

vi.mock("@/dojo/queries", () => ({
  getStructuresDataFromTorii: mocks.getStructuresDataFromTorii,
}));

vi.mock("@/ui/utils/transactions", () => ({
  extractTransactionHash: (result: { transaction_hash?: string }) => result.transaction_hash ?? null,
  waitForTransactionConfirmation: mocks.waitForTransactionConfirmation,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({
    setup: {
      components: {
        Structure: { key: "Structure" },
        StructureBuildings: { key: "StructureBuildings" },
        Resource: { key: "Resource" },
      },
      systemCalls: {
        upgrade_realm: mocks.upgradeRealm,
      },
    },
    account: {
      account: {
        address: "0xowner",
      },
    },
    network: {
      provider: {
        waitForTransactionWithCheck: vi.fn(),
      },
      toriiClient: { id: "torii" },
      contractComponents: [],
    },
  }),
}));

vi.mock("@dojoengine/react", () => ({
  useComponentValue: (_component: unknown, realmEntity: unknown) => {
    if (!realmEntity) {
      return null;
    }

    return { version: `${String(realmEntity)}:${mocks.currentLevel}:${Math.random()}` };
  },
}));

vi.mock("@bibliothecadao/eternum", () => ({
  configManager: {
    getMaxLevel: () => 4,
    realmUpgradeCosts: {
      2: [{ resource: 1, amount: 100 }],
      3: [{ resource: 1, amount: 200 }],
      4: [{ resource: 1, amount: 300 }],
    },
  },
  divideByPrecision: (value: number) => value,
  getBalance: () => ({ balance: 150 }),
  getEntityIdFromKeys: ([entityId]: [bigint]) => entityId,
  getRealmInfo: (realmEntity: bigint) => ({
    entityId: Number(realmEntity),
    level: mocks.currentLevel,
    category: 1,
    owner: "0xowner",
    position: { x: 12, y: 34 },
  }),
}));

vi.mock("@bibliothecadao/types", () => ({
  ContractAddress: (value: string) => value,
  getLevelName: (level: number) => `Level ${level}`,
}));

const flushAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
};

const HookProbe = ({ label }: { label: string }) => {
  const upgradeInfo = useStructureUpgrade(mocks.structureEntityId);

  return (
    <div data-testid={`${label}-root`}>
      <div data-testid={`${label}-status`}>{upgradeInfo?.upgradeActionState ?? "null"}</div>
      <div data-testid={`${label}-loading`}>{String(upgradeInfo?.isUpgradeLoading ?? false)}</div>
      <div data-testid={`${label}-locked`}>{String(upgradeInfo?.isUpgradeLocked ?? false)}</div>
      <div data-testid={`${label}-level`}>{String(upgradeInfo?.currentLevel ?? -1)}</div>
      <button
        type="button"
        data-testid={`${label}-upgrade`}
        onClick={() => {
          void upgradeInfo?.handleUpgrade().catch(() => undefined);
        }}
      >
        Upgrade
      </button>
    </div>
  );
};

describe("useStructureUpgrade", () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderProbes = async (labels: string[]) => {
    await act(async () => {
      root.render(
        <>
          {labels.map((label) => (
            <HookProbe key={label} label={label} />
          ))}
        </>,
      );
      await flushAsyncWork();
    });
  };

  const readProbeValue = (label: string, field: string) => {
    return container.querySelector(`[data-testid="${label}-${field}"]`)?.textContent ?? "";
  };

  const clickUpgrade = async (label: string) => {
    const button = container.querySelector(`[data-testid="${label}-upgrade"]`) as HTMLButtonElement | null;
    if (!button) {
      throw new Error(`Could not find upgrade button for probe ${label}`);
    }

    await act(async () => {
      button.click();
      await flushAsyncWork();
    });
  };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    mocks.currentLevel = 1;
    mocks.upgradeRealm.mockReset();
    mocks.waitForTransactionConfirmation.mockReset();
    mocks.getStructuresDataFromTorii.mockReset();
    mocks.toastError.mockReset();
    useRealmUpgradeStore.setState({ upgradesByRealm: {} });

    mocks.upgradeRealm.mockResolvedValue({ transaction_hash: "0xtx" });
    mocks.waitForTransactionConfirmation.mockResolvedValue(undefined);
    mocks.getStructuresDataFromTorii.mockResolvedValue(undefined);

    vi.useFakeTimers();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flushAsyncWork();
    });

    container.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
    useRealmUpgradeStore.setState({ upgradesByRealm: {} });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("shares pending upgrade state across consumers for the same realm", async () => {
    const submissionDeferred = createDeferred<{ transaction_hash: string }>();
    mocks.upgradeRealm.mockReturnValue(submissionDeferred.promise);

    await renderProbes(["first", "second"]);
    await clickUpgrade("first");

    expect(readProbeValue("first", "status")).toBe("submitting");
    expect(readProbeValue("second", "status")).toBe("submitting");
    expect(readProbeValue("second", "loading")).toBe("true");
    expect(readProbeValue("second", "locked")).toBe("true");

    submissionDeferred.reject(new Error("cancelled"));

    await act(async () => {
      await flushAsyncWork();
    });
  });

  it("keeps loading through confirmation until synced realm data advances", async () => {
    await renderProbes(["probe"]);
    await clickUpgrade("probe");

    expect(readProbeValue("probe", "status")).toBe("syncing");
    expect(readProbeValue("probe", "loading")).toBe("true");

    mocks.currentLevel = 2;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
      await flushAsyncWork();
    });

    expect(readProbeValue("probe", "status")).toBe("idle");
    expect(readProbeValue("probe", "loading")).toBe("false");
    expect(readProbeValue("probe", "level")).toBe("2");
  });

  it("clears the shared upgrade state when confirmation fails", async () => {
    mocks.waitForTransactionConfirmation.mockRejectedValue(new Error("transaction reverted"));

    await renderProbes(["probe"]);
    await clickUpgrade("probe");

    expect(readProbeValue("probe", "status")).toBe("idle");
    expect(readProbeValue("probe", "loading")).toBe("false");
    expect(readProbeValue("probe", "locked")).toBe("false");
  });

  it("moves to syncTimeout after the poll window and clears once live data catches up later", async () => {
    await renderProbes(["probe"]);
    await clickUpgrade("probe");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await flushAsyncWork();
    });

    expect(readProbeValue("probe", "status")).toBe("syncTimeout");
    expect(readProbeValue("probe", "loading")).toBe("false");
    expect(readProbeValue("probe", "locked")).toBe("true");
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Realm upgrade confirmed. Waiting for synced realm data before enabling the next upgrade.",
    );

    mocks.currentLevel = 2;
    await renderProbes(["probe"]);

    expect(readProbeValue("probe", "status")).toBe("idle");
    expect(readProbeValue("probe", "level")).toBe("2");
  });
});
