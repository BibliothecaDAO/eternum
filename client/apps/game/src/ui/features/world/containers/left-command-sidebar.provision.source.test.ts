// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("left-command-sidebar provision wiring", () => {
  it("keeps the provision action in the realm action cluster", () => {
    const source = readSource("src/ui/features/world/containers/left-command-sidebar.tsx");

    expect(source).toContain("useBlitzRealmProvision");
    expect(source).toContain('<StructureRealmActions structureEntityId={structure.entityId} className="shrink-0" />');
    expect(source).toContain('aria-label="Provision realm"');
  });
});
