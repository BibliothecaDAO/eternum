import { describe, expect, it } from "vitest";
import { shortString } from "starknet";
import { nativeSyncScopes } from "../../../../contracts/l3/world-native/schema/client.gen";
import { manifest, receipt, schema, setup, raw, rowEvent, structureValue } from "./fixtures";
const retiredMetadataModels = [
  "RealmCatalogue",
  "Authentication",
  "GameSequence",
  "EntitySequence",
  "LedgerOperator",
] as const;

describe("gameplay-only native facts", () => {
  it("uses the same canonical row identity for a receipt and its confirmed fold", () => {
    const { native, decoder, fold } = setup();
    const overlay = fold.overlay();
    const event = rowEvent("Structure", ["1", "9"], {
      ...structureValue,
      owner: "10",
      metadata: { ...structureValue.metadata, realm_id: 9 },
    });
    const decoded = decoder.decode(raw(event));
    if (decoded.kind !== "set") throw new Error("Expected a Structure row set");

    const pending = native.applyReceipt(overlay, receipt([event]), null, 0);
    const confirmed = native.applyReceipt(fold, receipt([event]), 10, 0);
    const pendingKey = pending.changes.find(({ change }) => change?.set?.model === "Structure")?.change?.set?.key;

    expect(pendingKey).toBe(decoded.entityId);
    expect(fold.currentRow("Structure", decoded.entityId)?.key).toBe(pendingKey);
    expect(confirmed.changes.find(({ change }) => change?.set?.model === "Structure")?.change?.set?.key).toBe(
      pendingKey,
    );
  });

  it.each(retiredMetadataModels)("has no decoder or sync scope for retired %s rows", (name) => {
    const { decoder } = setup();
    const row = schema.games.events.find(({ name }) => name === "RowSet")!;
    const event = {
      from_address: manifest.world.address,
      keys: [...row.prefix, "1", shortString.encodeShortString(name)],
      data: ["1", "1", "1", "1"],
    };
    expect(schema.models.some((model) => model.name === name)).toBe(false);
    expect(name in nativeSyncScopes).toBe(false);
    expect(() => decoder.decode(raw(event))).toThrow("Unknown native model");
  });
});
