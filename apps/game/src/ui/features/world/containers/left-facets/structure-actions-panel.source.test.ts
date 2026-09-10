// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("renders the actions once, in their own bubble below the token panel", () => {
  expect(existsSync("src/ui/features/world/components/actions/structure-actions-row.tsx")).toBe(false);
  const sidebar = readFileSync("src/ui/features/world/containers/left-command-sidebar.tsx", "utf8");
  expect(sidebar).toContain("<StructureListColumn />\n      <EmpireCockpit />\n      <StructureActionsPanel />");
  for (const path of [
    "src/ui/features/world/containers/left-facets/empire-cockpit.tsx",
    "src/ui/features/world/components/entities/banner/structure-banner-entity-detail.tsx",
    "src/ui/features/world/components/bottom-right-panel/bottom-right-panel.tsx",
  ])
    expect(readFileSync(path, "utf8")).not.toMatch(/StructureActions(Row|Panel)/);
  const panel = readFileSync("src/ui/features/world/containers/left-facets/structure-actions-panel.tsx", "utf8");
  expect(panel).toContain('title="Actions"');
  expect(panel).toContain("mode.ui.showTradeMenu && <ActionTile");
  expect(panel).toContain("font-sans");
  expect(panel).not.toMatch(/Cinzel|CircleButton/);
  expect(readFileSync("src/ui/features/world/containers/left-facets/structure-list-column.tsx", "utf8")).not.toContain(
    "No structures synced yet",
  );
});
