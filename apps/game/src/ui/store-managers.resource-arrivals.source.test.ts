// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/ui/store-managers.tsx"), "utf8");

describe("resource arrival store managers", () => {
  it("centralizes streamed RECS arrival formatting", () => {
    const start = source.indexOf("const useFormattedResourceArrivals");
    const end = source.indexOf("const ResourceArrivalsStoreManager", start);
    const body = source.slice(start, end);

    expect(body).toContain("useEntityQuery([Has(components.ResourceArrival)])");
    expect(body).toContain("formatArrivals(");
  });

  it("derives player arrivals from streamed RECS updates instead of polling queries", () => {
    const start = source.indexOf("const ResourceArrivalsStoreManager");
    const end = source.indexOf("const PublicTroopArrivalsStoreManager", start);
    const body = source.slice(start, end);

    expect(body).toContain("useFormattedResourceArrivals(components)");
    expect(body).toContain("playerResourceArrivals");
    expect(body).not.toContain("getAllArrivals");
    expect(body).not.toContain("setInterval");
  });

  it("publishes public arrival changes without a whole-world chain-clock recomputation", () => {
    const start = source.indexOf("const PublicTroopArrivalsStoreManager");
    const end = source.indexOf("const RelicsStoreManager", start);
    const body = source.slice(start, end);

    expect(body).toContain("useFormattedResourceArrivals(components)");
    expect(body).toContain("useChainTimeStore.getState().getNowSeconds()");
    expect(body).not.toContain("useChainTimeStore((state) => state.nowMs)");
  });
});
