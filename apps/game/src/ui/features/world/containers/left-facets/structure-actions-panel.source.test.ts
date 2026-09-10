// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("renders the action row once, in the active own structure's realm panel", () => {
  expect(existsSync("src/ui/features/world/containers/left-actions-row.tsx")).toBe(false);
  expect(readFileSync("src/ui/features/world/containers/left-command-sidebar.tsx", "utf8")).not.toContain(
    "LeftActionsRow",
  );
  const cockpit = readFileSync("src/ui/features/world/containers/left-facets/empire-cockpit.tsx", "utf8");
  expect(cockpit).toContain("<StructureActionsRow structureEntityId={structureEntityId} />");
  for (const path of [
    "src/ui/features/world/components/entities/banner/structure-banner-entity-detail.tsx",
    "src/ui/features/world/components/bottom-right-panel/bottom-right-panel.tsx",
  ])
    expect(readFileSync(path, "utf8")).not.toContain("StructureActionsRow");
  const row = readFileSync("src/ui/features/world/components/actions/structure-actions-row.tsx", "utf8");
  expect(row).not.toContain('variant="action"');
  expect(row).toContain("setStructureEntityId(structureEntityId)");
  expect(readFileSync("src/ui/features/world/containers/left-facets/structure-list-column.tsx", "utf8")).not.toContain(
    "No structures synced yet",
  );
});
