import { toJsonValue } from "../model-registry";
import bindings from "../../../../contracts/l3/world-native/schema/bindings.json";
import { CallData, CairoCustomEnum } from "starknet";
import { describe, expect, it } from "vitest";
import {
  structureValue,
  explorerValue,
  raw,
  seedDerivedRows,
  receipt,
  rowEvent,
  rulesEvent,
  schema,
  setup,
  manifest,
} from "./fixtures";

/** A surviving story as the chain emits it: a structure's level-up, its variant found in the compiled Story enum. */
function levelUpStory() {
  const layout = schema.games.events.find((event) => event.name === "StoryEvent")!;
  const story = schema.types["world_native::ownership::Story"];
  if (story.type !== "enum") throw new Error("Missing compiled story enum");
  const variant = story.variants.findIndex(({ name }) => name === "StructureLevelUpStory");
  const keys = [...layout.prefix, "2", "1", "1", "0", "3", "0x55"];
  return raw({ from_address: manifest.world.address, keys, data: [String(variant), "2", "1860"] });
}

describe("native ownership projections", () => {
  it("decodes a structure level-up into its story payload", () => {
    const { decoder, fold } = setup();
    const decoded = decoder.decode(levelUpStory());
    expect(decoded.kind).toBe("event");
    expect(decoded.model.name).toBe("StoryEvent");
    if (decoded.kind !== "event") throw new Error("Expected history event");
    expect(toJsonValue(decoded.key)).toMatchObject({ game_id: "0x1", tx_hash: "0x55" });
    expect(toJsonValue(decoded.value)).toMatchObject({
      timestamp: "0x744",
      story: { StructureLevelUpStory: { new_level: "0x2" } },
    });
    expect(fold.retainedRowCount()).toBe(0);
  });

  it("rejects malformed history and history emitted outside Games", () => {
    const { decoder } = setup();
    const event = levelUpStory();
    expect(() => decoder.decode({ ...event, data: event.data.slice(0, -1) })).toThrow();
    expect(() => decoder.decode({ ...event, from_address: "0x999" })).toThrow();
  });

  it("leaves the structure gift out of the generated command ABI, so it cannot encode", () => {
    const commands = bindings.commandAbi.find(
      (item) => item.type === "enum" && item.name === "world_native::commands::Command",
    );
    const names = (commands as { variants: { name: string }[] }).variants.map(({ name }) => name);
    expect(names).not.toContain("TransferStructureOwnership");
    const codec = new CallData(bindings.commandAbi);
    const command = new CairoCustomEnum({ TransferStructureOwnership: { entity_id: 3, new_owner: "0x456" } });
    expect(() => codec.compile("command_commitment", { command })).toThrow();
  });
  it("narrows a snapshot to one account's rows: its structures, their armies, and every model without an owner", () => {
    const { fold, native, decoder } = setup();
    const structure = (id: string, owner: string) => rowEvent("Structure", ["1", id], { ...structureValue, owner });
    const army = (id: string, home: string) => rowEvent("ExplorerTroops", ["1", id], explorerValue(home));
    native.applyReceipt(
      fold,
      receipt(
        seedDerivedRows(fold, decoder, [
          rulesEvent(),
          structure("7", "0xaaa"),
          structure("8", "0xbbb"),
          army("70", "7"),
          army("80", "8"),
        ]),
      ),
      10,
      0,
    );
    const snapshot = fold.snapshot("1", 10, ["SliceRules", "Structure", "ExplorerTroops"]);
    const owned = fold.ownedBy("1", snapshot, "0xaaa");
    const ids = (model: string, field: string) =>
      owned.models.find((entry) => entry.model === model)!.rows.map(({ value }) => Number(value[field]));
    expect(ids("Structure", "entity_id")).toEqual([7]);
    expect(ids("ExplorerTroops", "explorer_id")).toEqual([70]);
    expect(owned.models.find((entry) => entry.model === "SliceRules")!.rows).toHaveLength(1);
    expect(() => fold.ownedBy("1", snapshot, "0x0")).toThrow("Invalid owner account");
  });
});
