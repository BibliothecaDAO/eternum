// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/ui/action-runners.tsx"), "utf8");

describe("resource arrival auto-claim runner", () => {
  it("reads arrivals from the bridge slice instead of its own RECS query or a poll", () => {
    const start = source.indexOf("const ResourceArrivalAutoClaim");
    const end = source.indexOf("const AUTO_REGISTER_POINTS_DEBUG", start);
    const body = source.slice(start, end);

    expect(body).toContain("useWorldSlicesStore((state) => state.resourceArrivals)");
    expect(body).toContain("playerResourceArrivals");
    expect(body).not.toContain("useEntityQuery");
    expect(body).not.toContain("getAllArrivals");
    expect(body).not.toContain("setInterval");
  });

  it("keeps the arrival claim timer as the only recurring work in the runner", () => {
    const start = source.indexOf("const ResourceArrivalAutoClaim");
    const end = source.indexOf("const AUTO_REGISTER_POINTS_DEBUG", start);
    const body = source.slice(start, end);

    expect(body).toContain("window.setTimeout");
    expect(body).toContain("useChainTimeStore((state) => state.nowMs)");
  });
});
