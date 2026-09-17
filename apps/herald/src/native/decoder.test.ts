import { describe, expect, it } from "vitest";
import { hash } from "starknet";
import setFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import memberFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-member-set.json";
import deleteFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-deleted.json";
import foreignFixture from "../../../../contracts/l3/world-native/schema/fixtures/foreign-emitter.json";
import malformedFixture from "../../../../contracts/l3/world-native/schema/fixtures/malformed-row.json";
import { toJsonValue } from "../model-registry";
import { NativeWorldFold as WorldFold } from "./world-fold";
import { NativeDecoder } from "./decoder";
import { NativeIngestion } from "./ingestion";
import { schemaIdentity } from "./schema";

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
    const { decoder, fold } = setup();
    expect(() => decoder.decode(raw(foreignFixture.raw), fold)).toThrow();
    expect(() => decoder.decode(raw(malformedFixture.raw), fold)).toThrow();
    expect(() => decoder.decode(raw({ ...setFixture.raw, from_address: "0x999" }), fold)).toThrow(
      "Foreign native emitter",
    );
  });
  it("rejects out-of-range values, trailing data and unknown versions", () => {
    const { decoder, fold } = setup();
    const invalid = structuredClone(setFixture.raw);
    invalid.data[4] = String(1n << 32n);
    expect(() => decoder.decode(raw(invalid), fold)).toThrow("exceeds");
    expect(() => decoder.decode(raw({ ...setFixture.raw, data: [...setFixture.raw.data, "0x0"] }), fold)).toThrow(
      "trailing",
    );
    const version = structuredClone(setFixture.raw);
    version.keys[2] = "0x2";
    expect(() => decoder.decode(raw(version), fold)).toThrow("version");
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
  it("uses the recorded domain class for events before and after an upgrade", () => {
    const upgraded = structuredClone(schema);
    const changedLayout = upgraded.domains.troops.events.find((event) => event.name === "RowMemberSet")!;
    changedLayout.prefix = ["0x987", ...changedLayout.prefix.slice(1)];
    upgraded.identity = schemaIdentity(upgraded);
    const release = structuredClone(manifest);
    release.native.schemas[upgraded.identity] = upgraded;
    release.native.activeSchema = upgraded.identity;
    release.native.domains.troops.classes["0x456"] = upgraded.identity;
    const decoder = new NativeDecoder(release);
    const native = new NativeIngestion(decoder);
    const fold = new WorldFold(decoder.registry);
    const lifecycle = schema.domains.troops.events.find((event) => event.name === "RowSet")!;
    const model = schema.models.find((model) => model.name === "DomainClass")!;
    const upgrade = {
      from_address: manifest.native.domains.troops.address,
      keys: [...lifecycle.prefix, "0x1", model.identity],
      data: ["0x1", manifest.native.domains.troops.address, "0x1", "0x456"],
    };
    const afterUpgrade = {
      ...memberFixture.raw,
      keys: [...changedLayout.prefix, ...memberFixture.raw.keys.slice(changedLayout.prefix.length)],
    };
    native.applyReceipt(fold, receipt([setFixture.raw, upgrade, afterUpgrade]), 10, 0);
    expect(toJsonValue(fold.modelRows("ExplorerTroops")[0].value)).toEqual({
      ...memberFixture.expected.key,
      ...memberFixture.expected.value,
    });
    expect(fold.modelRows("DomainClass")[0].value.class_hash).toBe("0x456");
    const unknown = structuredClone(upgrade);
    unknown.data[3] = "0x789";
    expect(() => native.applyReceipt(fold, receipt([unknown]), 11, 0)).toThrow("Unregistered native class");
  });
});
