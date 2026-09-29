import { describe, expect, it } from "vitest";

import { nativePresetForId, nativePresetIdFor } from "../../../../config/source/native";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import { enabledHelpTransfers } from "./army-help";

const enabledIn = (game: "frontier" | "blitz" | "eternum") => {
  const mask = nativePresetForId(nativePresetIdFor(game)).commandMask;
  return (command: keyof typeof nativeCommandBits) => (mask & BigInt(nativeCommandBits[command])) !== 0n;
};

describe("army help transfers", () => {
  it("offers what each game's command mask allows: Frontier merges armies, the arena and Eternum move relics too", () => {
    expect(enabledHelpTransfers(enabledIn("frontier"), false, false)).toEqual(["troops"]);
    expect(enabledHelpTransfers(enabledIn("blitz"), false, true)).toEqual(["troops", "relics"]);
    expect(enabledHelpTransfers(enabledIn("eternum"), true, true)).toEqual(["troops", "relics"]);
  });

  it("moves troops to or from a structure only where it has guard slots, so a Frontier realm offers no Help", () => {
    expect(enabledHelpTransfers(enabledIn("frontier"), true, false)).toEqual([]);
    expect(enabledHelpTransfers(enabledIn("blitz"), true, false)).toEqual(["relics"]);
  });

  it("offers no Help where no transfer command is enabled", () => {
    expect(enabledHelpTransfers(() => false, false, true)).toEqual([]);
  });
});
