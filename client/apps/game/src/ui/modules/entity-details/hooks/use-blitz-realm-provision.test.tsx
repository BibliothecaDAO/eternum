import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { useBlitzRealmProvision } from "./use-blitz-realm-provision";

const mocks = vi.hoisted(() => ({
  currentBlockTimestamp: 200,
  worldMode: "blitz" as "blitz" | "eternum" | "unknown",
  buildings: [] as Array<{ category: number }>,
  executeObservedClientTransaction: vi.fn(),
  getStructuresDataFromTorii: vi.fn(),
  toastError: vi.fn(),
  getContractByName: vi.fn(() => ({ address: "0xblitz" })),
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
  useComponentValue: (_component: unknown, realmEntity: unknown) => {
    if (!realmEntity) {
      return null;
    }

    return { version: String(realmEntity) };
  },
}));

vi.mock("@bibliothecadao/eternum", () => ({
  getRealmInfo: (realmEntity: bigint) => ({
    entityId: Number(realmEntity),
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
    mocks.executeObservedClientTransaction.mockReset();
    mocks.executeObservedClientTransaction.mockResolvedValue({ transaction_hash: "0xtx" });
    mocks.getStructuresDataFromTorii.mockReset();
    mocks.getStructuresDataFromTorii.mockResolvedValue(undefined);
    mocks.toastError.mockReset();
    mocks.getContractByName.mockReset();
    mocks.getContractByName.mockReturnValue({ address: "0xblitz" });

    useUIStore.setState({
      gameStartMainAt: 100,
      gameEndAt: 1_000,
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
});
