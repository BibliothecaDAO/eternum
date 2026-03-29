import { describe, expect, it, vi } from "vitest";

const { getRealmNameByIdMock } = vi.hoisted(() => ({
  getRealmNameByIdMock: vi.fn((realmId: number) => `Realm #${realmId}`),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  getRealmNameById: getRealmNameByIdMock,
  toHexString: (value: bigint) => `0x${value.toString(16)}`,
}));

import { buildPlannerRealmSelectionDetails, resolvePlannerOwnerLabel } from "./settlement-planner-selection";

describe("buildPlannerRealmSelectionDetails", () => {
  it("prefers live realm metadata for selected village and realm targets", () => {
    const details = buildPlannerRealmSelectionDetails({
      sourceRealm: {
        realmId: 7,
        ownerAddress: "0x0",
        ownerName: null,
      },
      liveRealm: {
        realmId: 7n,
        owner: "0x1234567890",
        ownerName: "Ayla",
        resources: [1, 3],
      },
    });

    expect(details).toEqual({
      realmId: 7,
      realmName: getRealmNameByIdMock(7) || "Realm #7",
      ownerAddress: "0x1234567890",
      ownerName: "Ayla",
      resourceIds: [1, 3],
    });
  });

  it("keeps snapshot ownership when live realm lookup resolves to zero", () => {
    const details = buildPlannerRealmSelectionDetails({
      sourceRealm: {
        realmId: 11,
        ownerAddress: "0xabcdef1234",
        ownerName: null,
      },
      liveRealm: {
        realmId: 11,
        owner: "0x0000000000",
        ownerName: "",
        resources: [],
      },
    });

    expect(details).toEqual(
      expect.objectContaining({
        ownerAddress: "0xabcdef1234",
        realmName: getRealmNameByIdMock(11) || "Realm #11",
      }),
    );
  });
});

describe("resolvePlannerOwnerLabel", () => {
  it("avoids rendering the zero address", () => {
    expect(resolvePlannerOwnerLabel(null, "0x0000000000")).toBe("Owner unavailable");
  });
});
