// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveArmyDetailTroopsSource } from "./army-detail-troops-source";

describe("resolveArmyDetailTroopsSource", () => {
  it("prefers live explorer troops over the query snapshot", () => {
    const queryTroops = { count: 10n, stamina: { amount: 25n, updated_tick: 10n } };
    const liveTroops = { count: 10n, stamina: { amount: 40n, updated_tick: 12n } };

    expect(
      resolveArmyDetailTroopsSource({
        liveExplorerTroops: liveTroops,
        queryExplorerTroops: queryTroops,
      }),
    ).toBe(liveTroops);
  });

  it("falls back to the query snapshot when live explorer troops are unavailable", () => {
    const queryTroops = { count: 10n, stamina: { amount: 25n, updated_tick: 10n } };

    expect(
      resolveArmyDetailTroopsSource({
        liveExplorerTroops: undefined,
        queryExplorerTroops: queryTroops,
      }),
    ).toBe(queryTroops);
  });

  it("returns undefined when neither live nor query troops are available", () => {
    expect(
      resolveArmyDetailTroopsSource({
        liveExplorerTroops: undefined,
        queryExplorerTroops: undefined,
      }),
    ).toBeUndefined();
  });
});
