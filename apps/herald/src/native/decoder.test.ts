import { describe, expect, it } from "vitest";
import { hash } from "starknet";
import setFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import memberFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-member-set.json";
import deleteFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-deleted.json";
import foreignFixture from "../../../../contracts/l3/world-native/schema/fixtures/foreign-emitter.json";
import malformedFixture from "../../../../contracts/l3/world-native/schema/fixtures/malformed-row.json";
import { toJsonValue } from "../model-registry";
import { NativeWorldFold as WorldFold } from "./world-fold";

import { schema, manifest, receipt, raw, setup, battleEvent } from "./fixtures";

describe("native row decoder", () => {
  it("consumes the generated fixtures for set, member, deletion and recreation", () => {
    const { native, fold } = setup();
    for (const fixture of [setFixture, memberFixture]) {
      native.applyReceipt(fold, receipt([fixture.raw]), 10, 0);
      const row = fold.modelRows("ExplorerTroops")[0];
      expect(row.value).toEqual({ ...fixture.expected.key, ...fixture.expected.value });
      expect(BigInt(row.key)).toBe(BigInt(hash.computePoseidonHashOnElements([1, 7])));
    }
    native.applyReceipt(fold, receipt([deleteFixture.raw]), 10, 1);
    expect(fold.modelRows("ExplorerTroops")).toEqual([]);
    native.applyReceipt(fold, receipt([setFixture.raw]), 10, 2);
    expect(fold.modelRows("ExplorerTroops")).toHaveLength(1);
  });
  it("rejects the generated wrong-owner and malformed fixtures", () => {
    const { decoder } = setup();
    expect(() => decoder.decode(raw(foreignFixture.raw))).toThrow();
    expect(() => decoder.decode(raw(malformedFixture.raw))).toThrow();
    expect(() => decoder.decode(raw({ ...setFixture.raw, from_address: "0x999" }))).toThrow("Foreign native emitter");
  });
  it("rejects out-of-range values, trailing data and unknown versions", () => {
    const { decoder } = setup();
    const invalid = structuredClone(setFixture.raw);
    invalid.data[4] = String(1n << 32n);
    expect(() => decoder.decode(raw(invalid))).toThrow("exceeds");
    expect(() => decoder.decode(raw({ ...setFixture.raw, data: [...setFixture.raw.data, "0x0"] }))).toThrow("trailing");
    const version = structuredClone(setFixture.raw);
    version.keys[2] = "0x2";
    expect(() => decoder.decode(raw(version))).toThrow("version");
  });
  it("rejects an entire receipt without retaining an earlier valid mutation", () => {
    const { native, fold } = setup();
    expect(() => native.applyReceipt(fold, receipt([setFixture.raw, malformedFixture.raw]), 10, 0)).toThrow();
    expect(fold.modelRows("ExplorerTroops")).toEqual([]);
    native.applyReceipt(fold, { ...receipt([setFixture.raw]), execution_status: "REVERTED" }, 10, 0);
    expect(fold.modelRows("ExplorerTroops")).toEqual([]);
  });
  it("retains complete combat history when the participating explorer is deleted", () => {
    const { native, fold } = setup();
    const result = native.applyReceipt(fold, receipt([setFixture.raw, deleteFixture.raw, battleEvent()]), 10, 0);
    const battle = result.changes.find(({ change }) => change?.event)!.change!.set!;
    expect(battle.value).toMatchObject({
      attacker_id: "0x7",
      defender_id: "0x8",
      attacker: { player: "0x111", before: "0x64", after: "0x5a" },
      defender: { player: "0x222", after: "0x0" },
    });
    expect(fold.modelRows("ExplorerTroops")).toEqual([]);
    expect(fold.checkpoint().models.map(({ model }) => model)).not.toContain("LastBattle");
    expect(() => fold.modelRows("LastBattle")).toThrow("no row collection");
  });
  it("publishes combat as ephemera without mutating persistent rows in either overlay", () => {
    const { native, fold } = setup();
    native.applyReceipt(fold, receipt([setFixture.raw]), 10, 0);
    const before = fold.checkpoint();
    const overlay = fold.overlay();
    const result = native.applyReceipt(overlay, receipt([battleEvent()]), null, 0);
    expect(result.changes.map(({ change }) => change?.set?.model)).toEqual(["BattleEvent"]);
    expect(overlay.checkpoint()).toEqual(before);
    native.applyReceipt(fold, receipt([battleEvent()]), 11, 0);
    expect(fold.checkpoint()).toEqual(before);
  });
  it("keeps repeated native events distinct and their identity stable at confirmation", () => {
    const { native, fold } = setup();
    const changes = native.applyReceipt(fold, receipt([battleEvent(), battleEvent()]), null, 0).changes;
    expect(changes[0].change!.set!.key).not.toBe(changes[1].change!.set!.key);
    expect(changes[0].change!.set!.value.event_position).toEqual({ transaction_hash: "0x55", event_index: 0 });
    const confirmed = native.applyReceipt(fold, receipt([battleEvent(), battleEvent()]), 10, 0).changes;
    expect(confirmed.map(({ change }) => change!.set)).toEqual(changes.map(({ change }) => change!.set));
    const later = native.applyReceipt(fold, receipt([battleEvent()], "0x56"), 11, 0).changes;
    expect(later[0].change!.set!.key).not.toBe(changes[0].change!.set!.key);
  });
  it("binds checkpoints to the schema and deployment identity", () => {
    const { native, fold, decoder } = setup();
    native.applyReceipt(fold, receipt([setFixture.raw]), 10, 0);
    const checkpoint = fold.checkpoint();
    expect(checkpoint.native_schema_identity).toBe(schema.identity);
    expect(WorldFold.restore(decoder.registry, checkpoint).snapshot(1, 10)).toEqual(fold.snapshot(1, 10));
    expect(() => WorldFold.restore(decoder.registry, { ...checkpoint, native_schema_identity: "wrong" })).toThrow(
      "schema identity",
    );
    expect(() => WorldFold.restore(decoder.registry, { ...checkpoint, world_address: "0x999" })).toThrow(
      "does not match",
    );
  });
  it("keeps folding compatible upgrades without registering the new class hash", () => {
    const { native, fold } = setup();
    const lifecycle = schema.domains.troops.events.find((event) => event.name === "RowSet")!;
    const model = schema.models.find((model) => model.name === "DomainClass")!;
    const upgrade = {
      from_address: manifest.native.domains.troops.address,
      keys: [...lifecycle.prefix, "0x1", model.identity],
      data: ["0x1", manifest.native.domains.troops.address, "0x1", "0x456"],
    };
    native.applyReceipt(fold, receipt([setFixture.raw, upgrade, memberFixture.raw]), 10, 0);
    expect(toJsonValue(fold.modelRows("ExplorerTroops")[0].value)).toEqual({
      ...memberFixture.expected.key,
      ...memberFixture.expected.value,
    });
    expect(fold.modelRows("DomainClass")[0].value.class_hash).toBe("0x456");
    const incompatible = structuredClone(memberFixture.raw);
    incompatible.keys[0] = "0x987";
    expect(() => native.applyReceipt(fold, receipt([incompatible]), 11, 0)).toThrow("Unknown native event prefix");
  });
});

it("decodes every declared row and member shape from each owning domain", () => {
  const { decoder } = setup();
  const value = (type: string): string[] => {
    if (type === "()") return [];
    if (/^core::array::(?:Span|Array)::</.test(type)) return ["0"];
    const definition = schema.types[type];
    if (definition?.type === "struct") return definition.members.flatMap((member) => value(member.type));
    if (definition?.type === "enum") return ["0", ...value(definition.variants[0].type)];
    return ["1"];
  };
  for (const model of schema.models) {
    for (const domain of model.owners) {
      const from_address = manifest.native.domains[domain].address;
      const keys = model.keys.flatMap((member) =>
        member.name === model.emitterKey ? [from_address] : value(member.type),
      );
      const frame = (kind: string, values: string[], member?: string) => {
        const layout = schema.domains[domain].events.find((event) => event.name === kind)!;
        return raw({
          from_address,
          keys: [...layout.prefix, "1", model.identity, ...(member ? [member] : [])],
          data: [String(keys.length), ...keys, ...(kind === "RowDeleted" ? [] : [String(values.length), ...values])],
        });
      };
      expect(
        decoder.decode(
          frame(
            "RowSet",
            model.members.flatMap((member) => value(member.type)),
          ),
        ),
      ).toMatchObject({ kind: "set", model: { name: model.name } });
      if (schema.domains[domain].events.some(({ name }) => name === "RowDeleted"))
        expect(decoder.decode(frame("RowDeleted", []))).toMatchObject({ kind: "delete", model: { name: model.name } });
      for (const member of schema.domains[domain].events.some(({ name }) => name === "RowMemberSet")
        ? model.members
        : []) {
        expect(decoder.decode(frame("RowMemberSet", value(member.type), member.id))).toMatchObject({
          kind: "update-member",
          member: member.name,
          model: { name: model.name },
        });
      }
    }
  }
});
