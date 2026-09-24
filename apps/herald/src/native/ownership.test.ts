import { toJsonValue } from "../model-registry";
import bindings from "../../../../contracts/l3/world-native/schema/bindings.json";
import { CallData, CairoCustomEnum } from "starknet";
import { describe, expect, it } from "vitest";
import { raw, receipt, rowEvent, rulesEvent, schema, setup, manifest } from "./fixtures";

function faithStory() {
  const layout = schema.domains.prizes.events.find((event) => event.name === "StoryEvent")!;
  const keys = [...layout.prefix, "1", "1", "7", "1", "0", "3", "0x55"];
  const values = ["0", "3", "30000", "30000", "1860"];
  return raw({ from_address: manifest.world.address, keys, data: values });
}

describe("native ownership projections", () => {
  it("decodes faith accrual into the legacy story payload", () => {
    const { decoder, fold } = setup();
    const decoded = decoder.decode(faithStory());
    expect(decoded.kind).toBe("event");
    expect(decoded.model.name).toBe("StoryEvent");
    if (decoded.kind !== "event") throw new Error("Expected history event");
    expect(toJsonValue(decoded.key)).toMatchObject({ game_id: "0x1", id: "0x7", tx_hash: "0x55" });
    expect(toJsonValue(decoded.value)).toMatchObject({
      timestamp: "0x744",
      story: { FaithPointsClaimedStory: { wonder_id: "0x3", new_points: "0x7530", total_points: "0x7530" } },
    });
    expect(fold.retainedRowCount()).toBe(0);
  });

  it("rejects malformed history and history emitted outside Games", () => {
    const { decoder } = setup();
    const event = faithStory();
    expect(() => decoder.decode({ ...event, data: event.data.slice(0, -1) })).toThrow();
    expect(() => decoder.decode({ ...event, from_address: "0x999" })).toThrow();
  });

  it("exposes both ownership commands through the generated command ABI", () => {
    const codec = new CallData(bindings.commandAbi);
    for (const kind of ["TransferStructureOwnership"]) {
      const command = new CairoCustomEnum({ [kind]: { entity_id: 3, new_owner: "0x456" } });
      const values = codec.compile("command_commitment", { command });
      expect(values.slice(1)).toEqual(["3", "1110"]);
    }
  });
  it("narrows a snapshot to one account's rows: its structures, their armies, and every model without an owner", () => {
    const { fold, native } = setup();
    const structure = (id: string, owner: string) =>
      rowEvent("Structure", ["1", id], [owner, ...Array.from({ length: 19 }, () => "0")]);
    const army = (id: string, home: string) =>
      rowEvent("ExplorerTroops", ["1", id], [home, ...Array.from({ length: 17 }, () => "0")]);
    native.applyReceipt(
      fold,
      receipt([rulesEvent(), structure("7", "0xaaa"), structure("8", "0xbbb"), army("70", "7"), army("80", "8")]),
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
