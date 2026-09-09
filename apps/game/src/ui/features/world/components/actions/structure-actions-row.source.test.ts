// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("renders the action row under the selected own structure, not in the left column", () => {
  expect(existsSync("src/ui/features/world/containers/left-actions-row.tsx")).toBe(false);
  expect(readFileSync("src/ui/features/world/containers/left-command-sidebar.tsx", "utf8")).not.toContain(
    "LeftActionsRow",
  );
  const banner = readFileSync("src/ui/features/world/components/entities/banner/structure-banner-entity-detail.tsx", "utf8");
  expect(banner).toContain("{isMine && <StructureActionsRow structureEntityId={Number(structure.entity_id)} />}");
  const local = readFileSync("src/ui/features/world/components/bottom-right-panel/bottom-right-panel.tsx", "utf8");
  expect(local).toContain("{canManageBuilding && <StructureActionsRow structureEntityId={structureEntityId} />}");
  const row = readFileSync("src/ui/features/world/components/actions/structure-actions-row.tsx", "utf8");
  expect(row).not.toContain('variant="action"');
  expect(row).toContain("setStructureEntityId(structureEntityId)");
  expect(readFileSync("src/ui/features/world/containers/left-facets/structure-list-column.tsx", "utf8")).not.toContain(
    "No structures synced yet",
  );
});
