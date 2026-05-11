import { beforeEach, describe, expect, it, vi } from "vitest";

const { getEntitiesMock, memberClauseMock, andComposeClauseMock } = vi.hoisted(() => ({
  getEntitiesMock: vi.fn(async () => []),
  memberClauseMock: vi.fn((model: string, member: string, operator: string, value: unknown) => ({
    build: () => ({ model, member, operator, value }),
  })),
  andComposeClauseMock: vi.fn((clauses: unknown[]) => ({
    build: () => ({ operator: "And", clauses }),
  })),
}));

vi.mock("@dojoengine/state", () => ({
  getEntities: getEntitiesMock,
}));

vi.mock("@dojoengine/sdk", () => ({
  AndComposeClause: andComposeClauseMock,
  MemberClause: memberClauseMock,
}));

import { getExplorerTroopsFromToriiExact, getMapFromToriiExact } from "./queries";

describe("layer-aware Torii queries", () => {
  beforeEach(() => {
    getEntitiesMock.mockClear();
    memberClauseMock.mockClear();
    andComposeClauseMock.mockClear();
  });

  it("filters exact tile fetches to the requested map layer", async () => {
    await getMapFromToriiExact({} as never, [] as never, 10, 12, 20, 22, true);

    expect(memberClauseMock).toHaveBeenCalledWith("s1_eternum-TileOpt", "alt", "Eq", true);
  });

  it("defaults exact tile fetches to the world layer", async () => {
    await getMapFromToriiExact({} as never, [] as never, 10, 12, 20, 22);

    expect(memberClauseMock).toHaveBeenCalledWith("s1_eternum-TileOpt", "alt", "Eq", false);
  });

  it("filters explorer troop bounds to the requested map layer", async () => {
    await getExplorerTroopsFromToriiExact({} as never, [] as never, 10, 12, 20, 22, true);

    expect(memberClauseMock).toHaveBeenCalledWith("s1_eternum-ExplorerTroops", "coord.alt", "Eq", true);
  });
});
