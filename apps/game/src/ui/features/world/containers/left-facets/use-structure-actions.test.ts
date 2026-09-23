import { describe, expect, it, vi } from "vitest";
import { nativeCommandBits } from "../../../../../../../../contracts/l3/world-native/schema/commands.gen";
import { nativePresetIdFor, nativePresetForId } from "../../../../../../../../config/source/native";

vi.mock("@/ui/features/economy/trading", () => ({ MarketModal: () => null }));
vi.mock("@/ui/features/settlement", () => ({ ProductionModal: () => null }));

const { isStructureActionEnabled } = await import("./use-structure-actions");

const ACTIONS = ["build", "production", "military", "transfer", "trade"] as const;

const offeredIn = (mode: "frontier" | "blitz" | "eternum") => {
  const mask = nativePresetForId(nativePresetIdFor(mode)).commandMask;
  return ACTIONS.filter((id) =>
    isStructureActionEnabled(id, (command) => (mask & BigInt(nativeCommandBits[command])) !== 0n),
  );
};

describe("realm actions follow the game's command mask", () => {
  it("drops every action whose commands Frontier leaves out", () => {
    expect(offeredIn("frontier")).toEqual(["build", "military"]);
  });

  it("keeps Blitz's actions and leaves its market out", () => {
    expect(offeredIn("blitz")).toEqual(["build", "production", "military", "transfer"]);
  });

  it("offers Eternum's market", () => {
    expect(offeredIn("eternum")).toEqual(["build", "production", "military", "transfer", "trade"]);
  });
});
