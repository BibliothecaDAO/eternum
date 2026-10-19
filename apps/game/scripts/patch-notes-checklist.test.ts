// @vitest-environment node
import { describe, expect, it } from "vitest";

import { areaOf, diffConstants, diffPresets, featuresOf } from "./patch-notes-checklist.mjs";

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
});
