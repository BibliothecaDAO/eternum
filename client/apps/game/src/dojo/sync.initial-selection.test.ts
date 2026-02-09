import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchPlayerStructuresMock,
  fetchFirstStructureMock,
  getStructuresDataFromToriiMock,
  getBankStructuresFromToriiMock,
  getConfigFromToriiMock,
  getAddressNamesFromToriiMock,
  getGuildsFromToriiMock,
  mapRefreshMock,
  mapGetInstanceMock,
  onEntityUpdatedMock,
  onEventMessageUpdatedMock,
  testRuntimeState,
} = vi.hoisted(() => {
  const mapRefresh = vi.fn();

  return {
    fetchPlayerStructuresMock: vi.fn(),
    fetchFirstStructureMock: vi.fn(),
    getStructuresDataFromToriiMock: vi.fn(),
    getBankStructuresFromToriiMock: vi.fn(),
    getConfigFromToriiMock: vi.fn(),
    getAddressNamesFromToriiMock: vi.fn(),
    getGuildsFromToriiMock: vi.fn(),
    mapRefreshMock: mapRefresh,
    mapGetInstanceMock: vi.fn(() => ({ refresh: mapRefresh })),
    onEntityUpdatedMock: vi.fn(async () => ({ cancel: vi.fn() })),
    onEventMessageUpdatedMock: vi.fn(async () => ({ cancel: vi.fn() })),
    testRuntimeState: {
      accountAddress: "0xabc",
      spectateFromUrl: false,
    },
  };
});

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: {
    getState: () => ({
      account: { address: testRuntimeState.accountAddress },
    }),
  },
}));

vi.mock("@/utils/spectate-url", () => ({
  readSpectateFromWindow: () => testRuntimeState.spectateFromUrl,
}));

vi.mock("@/services/api", () => ({
  sqlApi: {
    fetchPlayerStructures: fetchPlayerStructuresMock,
    fetchFirstStructure: fetchFirstStructureMock,
  },
}));

vi.mock("./queries", () => ({
  getAddressNamesFromTorii: getAddressNamesFromToriiMock,
  getBankStructuresFromTorii: getBankStructuresFromToriiMock,
  getConfigFromTorii: getConfigFromToriiMock,
  getGuildsFromTorii: getGuildsFromToriiMock,
  getStructuresDataFromTorii: getStructuresDataFromToriiMock,
}));

vi.mock("@bibliothecadao/eternum", () => ({
  MAP_DATA_REFRESH_INTERVAL: 1000,
  MapDataStore: {
    getInstance: mapGetInstanceMock,
  },
}));

import { initialSync } from "./sync";

describe("initialSync initial structure selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testRuntimeState.accountAddress = "0xabc";
    testRuntimeState.spectateFromUrl = false;

    fetchPlayerStructuresMock.mockResolvedValue([]);
    fetchFirstStructureMock.mockResolvedValue({
      entity_id: 101,
      coord_x: 7,
      coord_y: -3,
    });

    getStructuresDataFromToriiMock.mockResolvedValue(undefined);
    getBankStructuresFromToriiMock.mockResolvedValue(undefined);
    getConfigFromToriiMock.mockResolvedValue(undefined);
    getAddressNamesFromToriiMock.mockResolvedValue(undefined);
    getGuildsFromToriiMock.mockResolvedValue(undefined);
    mapRefreshMock.mockResolvedValue(undefined);
  });

  it("forces spectator mode when player owns zero structures", async () => {
    const setStructureEntityId = vi.fn();
    const setInitialSyncProgress = vi.fn();

    const setup = {
      network: {
        toriiClient: {
          onEntityUpdated: onEntityUpdatedMock,
          onEventMessageUpdated: onEventMessageUpdatedMock,
        },
        contractComponents: [],
        world: {
          components: [],
          deleteEntity: vi.fn(),
        },
      },
    } as any;

    const state = {
      structureEntityId: 0,
      isSpectating: false,
      setStructureEntityId,
    } as any;

    await initialSync(setup, state, setInitialSyncProgress, {
      logging: false,
      reportProgress: false,
    });

    expect(fetchPlayerStructuresMock).toHaveBeenCalledWith("0xabc");
    expect(fetchFirstStructureMock).toHaveBeenCalledTimes(1);
    expect(setStructureEntityId).toHaveBeenCalledWith(101, {
      spectator: true,
      worldMapPosition: { col: 7, row: -3 },
    });
  });
});
