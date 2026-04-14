import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sidebarSource = readFileSync(
  new URL("./left-command-sidebar.tsx", import.meta.url),
  "utf8",
);

describe("left-command-sidebar structure status wiring", () => {
  it("routes structure stat rendering through the shared status snapshot resolver", () => {
    expect(sidebarSource).toContain("resolveStructureStatusSnapshot");
    expect(sidebarSource).not.toContain(
      "populationCapacity = Number(structureBuildings?.population.max ?? 0) +",
    );
    expect(sidebarSource).not.toContain(
      "Number(liveStructureBuildings?.population.max ?? selectedStructureMetadata?.populationCapacity ?? 0) +",
    );
    expect(sidebarSource).not.toContain(
      "Number(liveStructureBuildings?.population.max ?? structure.populationCapacity ?? 0) +",
    );
  });
});
