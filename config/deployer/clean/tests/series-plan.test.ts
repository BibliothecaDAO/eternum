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

  test("uses the same persistent registrar plan on Madara", () => {
    expect(resolveSeriesLaunchStepIds("madara.blitz")).toEqual([
      "create-series",
      "create-worlds",
      "wait-for-factory-indexes",
    ]);
  });
});
