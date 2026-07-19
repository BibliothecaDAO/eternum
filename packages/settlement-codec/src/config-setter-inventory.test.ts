import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const inventoryUrl = new URL("../schema/config-setter-inventory-v0.json", import.meta.url);
const cairoVectorsUrl = new URL(
  "../../../contracts/settlement_protocol/src/config_setter_vectors.cairo",
  import.meta.url,
);

describe("A11 configuration setter inventory", () => {
  test("enumerates every World and factory configuration setter", () => {
    const inventory = readJson(inventoryUrl);

    expect(inventory.summary).toEqual({
      total: 46,
      world: 40,
      factory: 6,
      implemented: 45,
      missingImplementation: 1,
    });
    expect(new Set(inventory.entries.map((entry: Record<string, unknown>) => entry.name)).size).toBe(46);
    expect(new Set(inventory.entries.map((entry: Record<string, unknown>) => entry.selector)).size).toBe(46);
    expect(
      inventory.entries
        .filter((entry: Record<string, unknown>) => entry.implementationStatus === "missing")
        .map((entry: Record<string, unknown>) => entry.name),
    ).toEqual(["set_stamina_config"]);
    expect(inventory.entries.every((entry: Record<string, unknown>) => entry.interfacePath && entry.signature)).toBe(
      true,
    );
  });

  test("publishes every inventoried selector to the Cairo seal fixture", () => {
    const inventory = readJson(inventoryUrl);
    const cairoVectors = readFileSync(cairoVectorsUrl, "utf8");

    for (const entry of inventory.entries) {
      expect(cairoVectors).toContain(entry.selector);
    }
  });
});

function readJson(url: URL): any {
  return JSON.parse(readFileSync(url, "utf8"));
}
