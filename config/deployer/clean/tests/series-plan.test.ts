import { describe, expect, test } from "bun:test";
import { resolveSeriesLaunchStepIds } from "../launch/series-plan";

describe("series launch plans", () => {
  test("keeps only registrar creation and GameRegistry indexing on appchain", () => {
    expect(resolveSeriesLaunchStepIds("appchain.blitz")).toEqual([
      "create-series",
      "create-worlds",
      "wait-for-factory-indexes",
    ]);
  });

  test("keeps the mainnet Blitz factory plan", () => {
    expect(resolveSeriesLaunchStepIds("mainnet.blitz")).toEqual([
      "create-series",
      "create-worlds",
      "wait-for-factory-indexes",
      "configure-worlds",
      "reserve-blitz-hyperstructures",
      "grant-lootchest-roles",
      "create-indexers",
      "sync-paymaster",
    ]);
  });
});
