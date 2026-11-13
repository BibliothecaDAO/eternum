import { describe, expect, it } from "vitest";

import { nativePresetForId, nativePresetIdFor } from "../../../../config/source/native";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import { enabledHelpTransfers } from "./army-help";

const enabledIn = (game: "frontier" | "blitz") => {
  const mask = nativePresetForId(nativePresetIdFor(game)).commandMask;
  return (command: keyof typeof nativeCommandBits) => (mask & BigInt(nativeCommandBits[command])) !== 0n;
};

describe("army help transfers", () => {
  it("offers what each game's command mask allows: Frontier merges armies, Blitz moves relics too", () => {
    expect(enabledHelpTransfers(enabledIn("frontier"), "armies", false)).toEqual(["troops"]);
    expect(enabledHelpTransfers(enabledIn("blitz"), "armies", true)).toEqual(["troops", "relics"]);
    expect(enabledHelpTransfers(enabledIn("blitz"), "to-structure", true)).toEqual(["troops", "relics"]);
  });

  it("moves troops into a structure only where it has guard slots, so a Frontier realm takes none", () => {
    expect(enabledHelpTransfers(enabledIn("frontier"), "to-structure", false)).toEqual([]);
    expect(enabledHelpTransfers(enabledIn("blitz"), "to-structure", false)).toEqual(["relics"]);
  });

  it("sends troops out of a structure's stock without guard slots, so a Frontier realm reinforces its army", () => {
    expect(enabledHelpTransfers(enabledIn("frontier"), "from-structure", false)).toEqual(["troops"]);
    expect(enabledHelpTransfers(enabledIn("blitz"), "from-structure", false)).toEqual(["troops", "relics"]);
  });

  it("offers no Help where no transfer command is enabled", () => {
    expect(enabledHelpTransfers(() => false, "armies", true)).toEqual([]);
  });
});
