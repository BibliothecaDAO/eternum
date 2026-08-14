import { describe, expect, it } from "vitest";
import { SqlApi } from "./api";
import { SQL_API_FACT_OWNERSHIP } from "./fact-ownership";

describe("SQL_API_FACT_OWNERSHIP", () => {
  it("classifies every public SqlApi operation", () => {
    const apiMethods = Object.getOwnPropertyNames(SqlApi.prototype)
      .filter((name) => name !== "constructor" && name.startsWith("fetch"))
      .sort();

    const retainedAuditMethods = Object.entries(SQL_API_FACT_OWNERSHIP)
      .filter(([, decision]) => decision.disposition !== "deleted-s4")
      .map(([name]) => name)
      .sort();

    expect(retainedAuditMethods).toEqual(apiMethods);
  });

  it("keeps history separate from current live facts", () => {
    expect(SQL_API_FACT_OWNERSHIP.fetchStoryEvents.disposition).toBe("keep-history");
    expect(SQL_API_FACT_OWNERSHIP.fetchBattleLogs.disposition).toBe("keep-history");
    expect(SQL_API_FACT_OWNERSHIP.fetchAllTiles.disposition).toBe("keep-external-snapshot");
    expect(SQL_API_FACT_OWNERSHIP.fetchResourceBalances.disposition).toBe("keep-external-snapshot");
  });

  it("records S4 deletions and final aggregate decisions", () => {
    expect(SQL_API_FACT_OWNERSHIP.fetchSurroundingWonderBonus.disposition).toBe("deleted-s4");
    expect(SQL_API_FACT_OWNERSHIP.fetchHyperstructuresWithRealmCount.disposition).toBe("deleted-s4");
    expect(SQL_API_FACT_OWNERSHIP.fetchRegisteredPlayerPoints.disposition).toBe("keep-aggregate");
    expect(SQL_API_FACT_OWNERSHIP.fetchPlayerLeaderboard.disposition).toBe("keep-aggregate");
    expect(SQL_API_FACT_OWNERSHIP.fetchPlayerLeaderboardByAddress.disposition).toBe("keep-aggregate");
  });
});
