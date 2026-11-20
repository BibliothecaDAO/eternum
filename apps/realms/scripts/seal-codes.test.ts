import { describe, expect, it } from "vitest";

import { codeHashInScope, readCampaignCode } from "../server/campaigns";
import { d1LoadArgs, readEnvironment, readSealCodeOrder, sealCodeFiles } from "./seal-codes";

const SEED = "a seed of at least thirty-two secret characters";
const NOW = Date.UTC(2026, 10, 18, 12);

describe("the operator's free Seal codes", () => {
  it("reads a label, a count and the last day a code works, through the end of that day", () => {
    expect(readSealCodeOrder(["playtest-nov", "3", undefined], NOW)).toEqual({
      label: "playtest-nov",
      count: 3,
      expiresAt: null,
    });
    expect(readSealCodeOrder(["playtest-nov", "3", "2026-12-31"], NOW).expiresAt).toBe(Date.UTC(2027, 0, 1) / 1000);
    expect(readSealCodeOrder(["playtest-nov", "3", "2026-11-18"], NOW).expiresAt).toBe(Date.UTC(2026, 10, 19) / 1000);
  });

  it.each([
    [["Playtest Nov", "3", undefined], "Label the codes"],
    [["playtest", "0", undefined], "at least 1 code"],
    [["playtest", "10001", undefined], "at most 10000"],
    [["playtest", "2.5", undefined], "at least 1 code"],
    [["playtest", "3", "2026-02-30"], "The last day a code works"],
    [["playtest", "3", "31-12-2026"], "The last day a code works"],
    [["playtest", "3", "2026-11-17"], "2026-11-17 has passed"],
  ])("refuses %j", (args, refusal) => {
    expect(() => readSealCodeOrder(args, NOW)).toThrow(refusal);
  });

  it("writes distinct printed codes and only their hashes, the same files again from the same seed and label", async () => {
    const order = { label: "playtest-nov", count: 150, expiresAt: 1_800_000_000 };
    const { codes, sql } = await sealCodeFiles(order, SEED);

    expect(new Set(codes).size).toBe(150);
    expect(codes.every((code) => readCampaignCode(code) === code)).toBe(true);
    for (const code of codes) {
      expect(sql).not.toContain(code);
      expect(sql).toContain(`('${await codeHashInScope("seal", code)}', 'playtest-nov', 1800000000)`);
    }
    expect(sql.match(/ON CONFLICT DO NOTHING;/g)).toHaveLength(2);
    expect(await sealCodeFiles(order, SEED)).toEqual({ codes, sql });
    const other = await sealCodeFiles({ ...order, label: "playtest-dec" }, SEED);
    expect(other.codes.some((code) => codes.includes(code))).toBe(false);
  });

  it("loads the codes into the named environment's database only, and refuses any other name", () => {
    expect(readEnvironment("production")).toBe("production");
    for (const name of [undefined, "dev", "Production"])
      expect(() => readEnvironment(name)).toThrow("Name the environment");
    expect(d1LoadArgs("staging", "/tmp/codes.sql")).toEqual([
      "exec",
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--remote",
      "--env",
      "staging",
      "--file",
      "/tmp/codes.sql",
    ]);
  });
});
