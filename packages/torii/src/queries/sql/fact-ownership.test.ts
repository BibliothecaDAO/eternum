import { describe, expect, it } from "vitest";
import { SqlApi } from "./api";
import { SQL_API_FACT_OWNERSHIP } from "./fact-ownership";

describe("SQL_API_FACT_OWNERSHIP", () => {
  it("classifies every public SqlApi operation", () => {
    const apiMethods = Object.getOwnPropertyNames(SqlApi.prototype)
      .filter((name) => name !== "constructor" && name.startsWith("fetch"))
      .sort();

    expect(Object.keys(SQL_API_FACT_OWNERSHIP).sort()).toEqual(apiMethods);
  });

  it("keeps history separate from current live facts", () => {
    expect(SQL_API_FACT_OWNERSHIP.fetchStoryEvents.disposition).toBe("keep-history");
    expect(SQL_API_FACT_OWNERSHIP.fetchBattleLogs.disposition).toBe("keep-history");
    expect(SQL_API_FACT_OWNERSHIP.fetchAllTiles.disposition).toBe("delete-live-state-s4");
    expect(SQL_API_FACT_OWNERSHIP.fetchResourceBalances.disposition).toBe("delete-live-state-s4");
  });

  it("records the phase for every deferred ownership decision", () => {
    expect(SQL_API_FACT_OWNERSHIP.fetchSurroundingWonderBonus.disposition).toBe("review-in-s3");
    expect(SQL_API_FACT_OWNERSHIP.fetchHyperstructuresWithRealmCount.disposition).toBe("review-in-s3");
    expect(SQL_API_FACT_OWNERSHIP.fetchRegisteredPlayerPoints.disposition).toBe("review-in-s2-s3");
    expect(SQL_API_FACT_OWNERSHIP.fetchPlayerLeaderboard.disposition).toBe("review-in-s2-s3");
    expect(SQL_API_FACT_OWNERSHIP.fetchPlayerLeaderboardByAddress.disposition).toBe("review-in-s2-s3");
  });
});
