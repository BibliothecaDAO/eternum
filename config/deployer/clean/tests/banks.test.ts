import { describe, expect, test } from "bun:test";
import { buildDefaultBanks } from "../eternum/banks";

describe("buildDefaultBanks", () => {
  test("uses the legacy six-direction bank ring", () => {
    const banks = buildDefaultBanks();

    expect(banks).toHaveLength(6);
    expect(banks.map((bank) => bank.coord)).toEqual([
      { alt: false, x: 2147483961, y: 2147483646 },
      { alt: false, x: 2147483804, y: 2147483961 },
      { alt: false, x: 2147483489, y: 2147483961 },
      { alt: false, x: 2147483331, y: 2147483646 },
      { alt: false, x: 2147483489, y: 2147483331 },
      { alt: false, x: 2147483804, y: 2147483331 },
    ]);
  });
});
