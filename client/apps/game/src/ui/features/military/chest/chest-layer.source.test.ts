import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Chest layer wiring", () => {
  it("passes the selected chest layer from ChestModal into ChestContainer", () => {
    const source = readSource("chest-modal.tsx");

    expect(source).toContain("chestAlt = DEFAULT_COORD_ALT");
    expect(source).toContain(
      "<ChestContainer explorerEntityId={selected.id} chestHex={chestHex} chestAlt={chestAlt} />",
    );
  });

  it("uses the selected chest layer for tile lookup and open_chest calls", () => {
    const source = readSource("chest-container.tsx");

    expect(source).toContain("chestAlt = DEFAULT_COORD_ALT");
    expect(source).toContain("getTileAt(components, chestAlt, chestHex.x, chestHex.y)");
    expect(source).toContain("alt: chestAlt");
  });
});
