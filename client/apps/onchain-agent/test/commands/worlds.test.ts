import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/world/discovery", () => ({
  discoverAllWorlds: vi.fn().mockResolvedValue([
    { name: "eternum-s1", chain: "slot", status: "ongoing" },
    { name: "eternum-s2", chain: "sepolia", status: "upcoming" },
  ]),
}));

import { runWorlds } from "../../src/commands/worlds";

describe("axis worlds", () => {
  it("outputs JSON array when --json", async () => {
    const output: string[] = [];
    const code = await runWorlds({ json: true, write: (s) => output.push(s) });
    expect(code).toBe(0);
    const parsed = JSON.parse(output.join(""));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("eternum-s1");
    expect(parsed[1].chain).toBe("sepolia");
  });

  it("outputs human-readable when no --json", async () => {
    const output: string[] = [];
    const code = await runWorlds({ json: false, write: (s) => output.push(s) });
    expect(code).toBe(0);
    expect(output.some((l) => l.includes("eternum-s1"))).toBe(true);
    expect(output.some((l) => l.includes("slot"))).toBe(true);
  });
});
