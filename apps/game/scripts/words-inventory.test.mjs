import { describe, expect, it } from "vitest";

import { scanSource } from "./words-inventory.mjs";

const context = {
  nouns: new Set(["Wheat", "Knight", "City"]),
  voiceRules: [
    { rule: "Points are points", forbidden: /\b(?:VP|pts)\b/ },
    { rule: "A rank by its name", forbidden: /\b(?:Level|Lvl|Lv\.?) ?\d/ },
  ],
};
const scan = (source, fileName = "probe.tsx") =>
  scanSource(source, fileName, context).map(({ category, line }) => `${line} ${category}`);

describe("the words inventory", () => {
  it("finds each kind of number, time and naming work, and the function that does it", () => {
    const source = [
      "const formatGold = (n: number) => n.toLocaleString();", // 1
      "const compact = new Intl.NumberFormat('en-US');", // 2
      "const clock = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m`;", // 3
      "const big = (n: number) => `${(n / 1_000).toFixed(1)}K`;", // 4
      "const when = (d: Date) => d.toLocaleTimeString();", // 5
      "const label = ResourcesIds[id];", // 6
      "const name = findResourceById(id)?.trait;", // 7
      "const rank = getLevelName(level);", // 8
      "const army = getEntityName(id, store, false);", // 9
      "const crop = 'Wheat';", // 10
    ].join("\n");
    expect(scan(source, "probe.ts")).toEqual([
      "1 formatter",
      "1 number.locale",
      "2 number.intl",
      "3 formatter",
      "3 time.units",
      "4 formatter",
      "4 number.suffix",
      "4 number.fixed",
      "5 formatter",
      "5 time.locale",
      "6 name.enumKey",
      "7 name.trait",
      "8 name.table",
      "9 name.entity",
      "10 name.literal",
    ]);
  });

  it("checks the voice only in what a player reads", () => {
    const source = [
      "export const Score = () => <p title='+250 VP'>Level 2</p>;", // 1
      "const key = 'Level 2';", // 2: a variable's value a player may read
      "const css = <div className='pts-2 lvl-3' data-kind='VP' />;", // 3: code
      "if (mode === 'Level 2') {}", // 4: a comparison is code
      "const tag = `Level ${level}`;", // 5
    ].join("\n");
    expect(scan(source)).toEqual([
      "1 voice: Points are points",
      "1 voice: A rank by its name",
      "2 voice: A rank by its name",
      "5 voice: A rank by its name",
    ]);
  });

  it("leaves arithmetic rounding, SVG coordinates, console lines and components alone", () => {
    const source = [
      "const round = (n: number) => Number(n.toFixed(3));",
      "const path = `M ${x.toFixed(1)} ${y.toFixed(1)} L 0 0`;",
      "console.info(`took ${ms.toFixed(1)}ms`);",
      "export function GoldRow({ n }) { return <span>{n}</span>; }",
      "if (troop === 'Knight') {}",
    ].join("\n");
    expect(scan(source)).toEqual([]);
  });
});
