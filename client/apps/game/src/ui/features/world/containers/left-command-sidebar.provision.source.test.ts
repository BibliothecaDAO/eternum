// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("structure-picker provision wiring", () => {
  it("keeps the provision action in the realm action cluster", () => {
    const chipSource = readSource("src/ui/features/world/containers/top-header/structure-picker/chip.tsx");

    expect(chipSource).toContain("useBlitzRealmProvision");
    expect(chipSource).toContain(
      '<StructureRealmActions structureEntityId={structure.entityId} className="shrink-0" />',
    );
    expect(chipSource).toContain('aria-label="Provision realm"');
  });
});
