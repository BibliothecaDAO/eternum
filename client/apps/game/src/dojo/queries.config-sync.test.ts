import { beforeEach, describe, expect, it, vi } from "vitest";

const { andComposeClauseMock, getEntitiesMock, memberClauseMock } = vi.hoisted(() => ({
  andComposeClauseMock: vi.fn((clauses: unknown[]) => ({
    build: () => ({ operator: "And", clauses }),
  })),
  getEntitiesMock: vi.fn(async (..._args: unknown[]) => []),
  memberClauseMock: vi.fn((model: string, member: string, operator: string, value: unknown) => ({
    build: () => ({ model, member, operator, value }),
  })),
}));

vi.mock("@dojoengine/state", () => ({
  getEntities: getEntitiesMock,
}));

vi.mock("@dojoengine/sdk", () => ({
  AndComposeClause: andComposeClauseMock,
  MemberClause: memberClauseMock,
}));

import { getConfigFromTorii } from "./queries";

describe("getConfigFromTorii", () => {
  beforeEach(() => {
    getEntitiesMock.mockClear();
    getEntitiesMock.mockImplementation(async () => []);
    window.sessionStorage.clear();
  });

  it("continues when optional config model groups are unsupported", async () => {
    getEntitiesMock.mockImplementation(async (...args: unknown[]) => {
      const query = args[1] as { Keys?: { models?: string[] } } | undefined;
      const models = query?.Keys?.models ?? [];

      if (models.includes("s1_eternum-BlitzRealmPlayerRegister")) {
        throw new Error("no such table: s1_eternum-BlitzRealmPlayerRegister");
      }

      if (models.includes("s1_eternum-SeasonPrize")) {
        throw new Error("no rows returned by a query that expected to return at least one row");
      }

      return [];
    });

    await expect(getConfigFromTorii({} as never, [] as never)).resolves.toEqual(expect.any(Array));
    expect(getEntitiesMock).toHaveBeenCalled();
  });

  it("still rejects when a core config model fails", async () => {
    getEntitiesMock.mockImplementation(async (...args: unknown[]) => {
      const query = args[1] as { Keys?: { models?: string[] } } | undefined;
      const models = query?.Keys?.models ?? [];

      if (models.includes("s1_eternum-WorldConfig")) {
        throw new Error("world config unavailable");
      }

      return [];
    });

    await expect(getConfigFromTorii({} as never, [] as never)).rejects.toThrow("world config unavailable");
  });
});
