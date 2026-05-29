import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { useBlitzRealmProvision } from "./use-blitz-realm-provision";

const mocks = vi.hoisted(() => ({
  currentBlockTimestamp: 200,
  worldMode: "blitz" as "blitz" | "eternum" | "unknown",
  buildings: [] as Array<{ category: number }>,
  structureBuildings: null as Record<string, unknown> | null,
  executeObservedClientTransaction: vi.fn(),
  getStructuresDataFromTorii: vi.fn(),
  toastError: vi.fn(),
  getContractByName: vi.fn(() => ({ address: "0xblitz" })),
  getBuildingCount: vi.fn(() => 0),
}));

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentBlockTimestamp: () => mocks.currentBlockTimestamp,
}));

vi.mock("@/dojo/queries", () => ({
  getStructuresDataFromTorii: mocks.getStructuresDataFromTorii,
}));

vi.mock("@/observability/observed-client-transaction", () => ({
  executeObservedClientTransaction: mocks.executeObservedClientTransaction,
}));

vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useResolvedWorldGameMode: () => mocks.worldMode,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@dojoengine/core", () => ({
  getContractByName: mocks.getContractByName,
}));

vi.mock("../../../../../dojo-config", () => ({
  dojoConfig: {
    manifest: {},
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
    },
    account: {
      account: {
        address: "0xowner",
      },
    },
    network: {
      toriiClient: { id: "torii" },
      contractComponents: [],
    },
  }),
  useBuildings: () => mocks.buildings,
}));

vi.mock("@dojoengine/react", () => ({
  useComponentValue: (component: { key?: string } | undefined, realmEntity: unknown) => {
    if (!realmEntity) {
      return null;
    }

    if (component?.key === "StructureBuildings") {
      return mocks.structureBuildings;
    }

    return { version: String(realmEntity) };
  },
}));

vi.mock("@bibliothecadao/eternum", () => ({
  getBuildingCount: mocks.getBuildingCount,
  getRealmInfo: () => ({
    entityId: 101,
    level: 1,
    category: 1,
    owner: "0xowner",
    position: { x: 12, y: 34 },
  }),
}));

vi.mock("@bibliothecadao/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bibliothecadao/types")>();

  return {
    ...actual,
    ContractAddress: (value: string) => value,
    BuildingType: {
      ...actual.BuildingType,
      ResourceLabor: 28,
    },
    StructureType: {
      ...actual.StructureType,
      Realm: 1,
    },
  };
});

const flushAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const HookProbe = ({ label }: { label: string }) => {
  const provisionInfo = useBlitzRealmProvision(101);

  return (
    <div data-testid={`${label}-root`}>
      <div data-testid={`${label}-canProvision`}>{String(provisionInfo?.canProvision ?? false)}</div>
      <div data-testid={`${label}-isProvisioned`}>{String(provisionInfo?.isProvisioned ?? false)}</div>
      <div data-testid={`${label}-status`}>{provisionInfo?.provisionActionState ?? "null"}</div>
      <div data-testid={`${label}-loading`}>{String(provisionInfo?.isProvisionLoading ?? false)}</div>
      <button
        type="button"
        data-testid={`${label}-provision`}
        onClick={() => {
          void provisionInfo?.handleProvision().catch(() => undefined);
        }}
      >
        Provision
      </button>
    </div>
  );
};

describe("useBlitzRealmProvision", () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderProbe = async () => {
    await act(async () => {
      root.render(<HookProbe label="probe" />);
      await flushAsyncWork();
    });
  };

  const rerenderProbe = async () => {
    await act(async () => {
      root.render(<HookProbe label="probe" />);
      await flushAsyncWork();
    });
  };

  const readProbeValue = (field: string) => {
    return container.querySelector(`[data-testid="probe-${field}"]`)?.textContent ?? "";
  };

  const clickProvision = async () => {
    const button = container.querySelector(`[data-testid="probe-provision"]`) as HTMLButtonElement | null;
    if (!button) {
      throw new Error("Could not find provision button");
    }

    await act(async () => {
      button.click();
      await flushAsyncWork();
    });
  };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    mocks.currentBlockTimestamp = 200;
    mocks.worldMode = "blitz";
    mocks.buildings = [];
    mocks.structureBuildings = null;
    mocks.executeObservedClientTransaction.mockReset();
    mocks.executeObservedClientTransaction.mockResolvedValue({ transaction_hash: "0xtx" });
    mocks.getStructuresDataFromTorii.mockReset();
    mocks.getStructuresDataFromTorii.mockResolvedValue(undefined);
    mocks.toastError.mockReset();
    mocks.getContractByName.mockReset();
    mocks.getContractByName.mockReturnValue({ address: "0xblitz" });
    mocks.getBuildingCount.mockReset();
    mocks.getBuildingCount.mockReturnValue(0);

    useUIStore.setState({
      gameStartMainAt: 100,
      gameEndAt: 1_000,
      devModeOn: false,
    });

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
    useUIStore.setState({
      gameStartMainAt: null,
      gameEndAt: null,
      devModeOn: false,
    });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("allows provisioning only for blitz realms after the main phase starts", async () => {
    await renderProbe();

    expect(readProbeValue("canProvision")).toBe("true");
    expect(readProbeValue("isProvisioned")).toBe("false");
  });

  it("blocks provisioning before main start", async () => {
    useUIStore.setState({ gameStartMainAt: 500 });
    await renderProbe();

    expect(readProbeValue("canProvision")).toBe("false");
  });

  it("allows provisioning before main start when dev mode is on (sandbox)", async () => {
    // currentBlockTimestamp (200) < gameStartMainAt (500), so the main phase has
    // not started — but dev_mode worlds bypass the chain's time gate.
    useUIStore.setState({ gameStartMainAt: 500, devModeOn: true });
    await renderProbe();

    expect(readProbeValue("canProvision")).toBe("true");
  });

  it("uses StructureBuildings as the primary provisioned signal", async () => {
    mocks.structureBuildings = {
      packed_counts_1: "1",
      packed_counts_2: "0",
      packed_counts_3: "0",
    };
    mocks.getBuildingCount.mockReturnValue(1);

    await renderProbe();

    expect(readProbeValue("isProvisioned")).toBe("true");
    expect(readProbeValue("canProvision")).toBe("false");
    expect(mocks.getBuildingCount).toHaveBeenCalledWith(28, [1n, 0n, 0n]);
  });

  it("falls back to Building rows when StructureBuildings is not available", async () => {
    mocks.buildings = [{ category: 28 }];

    await renderProbe();

    expect(readProbeValue("isProvisioned")).toBe("true");
    expect(readProbeValue("canProvision")).toBe("false");
  });

  it("submits the provision call and clears once the labor building appears", async () => {
    await renderProbe();
    await clickProvision();

    expect(mocks.executeObservedClientTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "settlement",
        operation: "blitz_realm_systems.provision_realm",
        calls: expect.objectContaining({
          contractAddress: "0xblitz",
          entrypoint: "provision_realm",
        }),
      }),
    );
    expect(readProbeValue("status")).toBe("syncing");

    mocks.buildings = [{ category: 28 }];
    await rerenderProbe();

    expect(readProbeValue("isProvisioned")).toBe("true");
    expect(readProbeValue("status")).toBe("idle");
  });

  it("recovers duplicate already-provisioned errors by refreshing synced realm data", async () => {
    mocks.executeObservedClientTransaction.mockRejectedValueOnce(new Error("realm is already provisioned"));

    await renderProbe();
    await clickProvision();

    expect(mocks.getStructuresDataFromTorii).toHaveBeenCalledWith(
      { id: "torii" },
      [],
      [{ entityId: 101, position: { col: 12, row: 34 } }],
    );
    expect(readProbeValue("status")).toBe("syncing");
    expect(readProbeValue("loading")).toBe("true");
  });
});
