// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  areaOf,
  changeListOf,
  checkCoverage,
  diffConstants,
  diffPresets,
  entriesOf,
  featuresOf,
} from "./patch-notes-checklist.mjs";

describe("the patch notes' checklist", () => {
  it("lists each setting that moved, old → new, and leaves out deployment wiring", () => {
    const before = {
      troop: { stamina: { wheat: 0.03, initial: 30 } },
      rewards: [{ amount: 150 }],
      fee_recipient: "0x1",
    };
    const after = { troop: { stamina: { wheat: 0.05, initial: 30 } }, rewards: [{ percent: 5 }], fee_recipient: "0x2" };
    expect(diffPresets(before, after)).toEqual([
      ["rewards", ["rewards[0].amount: 150 → (none)", "rewards[0].percent: (none) → 5"]],
      ["troop.stamina.wheat", ["troop.stamina.wheat: 0.03 → 0.05"]],
    ]);
  });

  it("names each contract constant added, changed or removed, with its file", () => {
    const constants = (entries) => new Map(entries.map(([name, value, file]) => [name, { value, file }]));
    const before = constants([
      ["SPIRE_FIND_BPS", "100", "a.cairo"],
      ["OLD", "1", "a.cairo"],
    ]);
    const after = constants([
      ["SPIRE_FIND_BPS", "50", "b.cairo"],
      ["LUCKY_CHEST_BPS", "2000", "b.cairo"],
    ]);
    expect(diffConstants(before, after)).toEqual([
      "added LUCKY_CHEST_BPS = 2000 (b.cairo)",
      "changed SPIRE_FIND_BPS: 100 → 50 (b.cairo)",
      "removed OLD = 1 (a.cairo)",
    ]);
  });

  it("reads the feature map's rows and rules under their sections", () => {
    const map =
      "## Shell\n\n| Feature | Route |\n| --- | --- |\n| Market | — |\n\n### Blitz rules\n\n- **Merging armies.** Text\n";
    expect(featuresOf(map)).toEqual(["Shell: Market", "Blitz rules: Merging armies."]);
  });

  it("puts a commit in the first area its files touch", () => {
    expect(areaOf(["apps/game/src/shell/news/news.tsx", "contracts/l3/world-native/src/rules.cairo"])).toBe(
      "Contracts",
    );
    expect(areaOf(["apps/game/scripts/prove-shell.mjs"])).toBe("Client tooling, labs and tests");
    expect(areaOf(["README.md"])).toBe("Repository");
  });
  it("reads the retired change list's entries, joining a title or description split across strings", () => {
    const source = `[
      { date: "2026-10-18", title: "Deploy " + "by column", description: "A column per troop.", icon: "deploy" },
      { date: "2026-10-17", title: "Keys", description: "B opens \\"Build\\"." },
    ]`;
    expect(changeListOf(source)).toEqual([
      { day: "2026-10-18", title: "Deploy by column", description: "A column per troop." },
      { day: "2026-10-17", title: "Keys", description: 'B opens "Build".' },
    ]);
  });

  it("names a note's lines by section and name, with the whole text of a wrapped line", () => {
    const note =
      "## All modes\n\n### New\n\n- {play} **A new app**: Play across the top,\n  and Market.\n\n## Blitz\n\n### Balance\n\n- {camp} **Guards**: 999 to 1,499.\n";
    expect(entriesOf(note)).toEqual([
      { name: "All modes: A new app", text: "Play across the top, and Market." },
      { name: "Blitz: Guards", text: "999 to 1,499." },
    ]);
  });

  it("finds every gap: an unmapped item, a line the note lacks and a line no item sources", () => {
    const items = [
      { id: "commit:aaa", text: "Client in a match · Guards" },
      { id: "commit:bbb", text: "Repository · Format" },
      { id: "commit:ccc", text: "Client in a match · Market" },
      { id: "commit:ddd", text: "Client in a match · Something new" },
    ];
    const coverage = {
      covered: { "commit:aaa": "Blitz: Guards", "commit:ccc": "All modes: Market" },
      out: { "commit:bbb": "formatting" },
    };
    const entries = [
      { name: "Blitz: Guards", text: "999 to 1,499." },
      { name: "Blitz: Paid entry", text: "LORDS." },
    ];
    const result = checkCoverage(items, coverage, entries);
    expect(result.rows.map((row) => [row.id, row.lines[0] ?? row.reason])).toEqual([
      ["commit:aaa", "Blitz: Guards"],
      ["commit:bbb", "formatting"],
      ["commit:ccc", "All modes: Market"],
      ["commit:ddd", undefined],
    ]);
    expect(result.unmapped).toEqual(["commit:ddd"]);
    expect(result.unknownLines).toEqual(["All modes: Market"]);
    expect(result.unsourcedLines).toEqual(["Blitz: Paid entry"]);
  });

  it("sources every line one change moved, from that change's item alone", () => {
    const items = [{ id: "commit:aaa", text: "Contracts · Apply next season's rules" }];
    const coverage = { covered: { "commit:aaa": ["Frontier: Storage", "Frontier: Depths", "Frontier: Missing"] } };
    const entries = [
      { name: "Frontier: Storage", text: "6,000." },
      { name: "Frontier: Depths", text: "100,000." },
    ];
    const result = checkCoverage(items, coverage, entries);
    expect(result.rows[0]!.lines).toEqual(["Frontier: Storage", "Frontier: Depths", "Frontier: Missing"]);
    expect(result.unmapped).toEqual([]);
    expect(result.unsourcedLines).toEqual([]);
    expect(result.unknownLines).toEqual(["Frontier: Missing"]);
  });
});
