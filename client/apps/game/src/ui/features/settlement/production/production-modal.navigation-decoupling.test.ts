// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
};

describe("Production modal navigation decoupling", () => {
  it("keeps realm selection local to the popup", () => {
    const source = readSource("src/ui/features/settlement/production/production-modal.tsx");

    expect(source).toContain("preSelectedRealmId?: ID");
    expect(source).toContain("resolveInitialSelectedRealm");
    expect(source).not.toContain("useGoToStructure");
    expect(source).not.toContain("setStructureEntityId(");
    expect(source).not.toContain("goToStructure(");
  });

  it("passes explicit preselected realm ids from non-current production entry points", () => {
    const resourceChipSource = readSource("src/ui/features/economy/resources/resource-chip.tsx");
    const entityTableSource = readSource(
      "src/ui/features/economy/resources/entity-resource-table/entity-resource-table-new.tsx",
    );
    const realmInfoPanelSource = readSource("src/ui/modules/entity-details/realm/realm-info-panel.tsx");

    expect(resourceChipSource).toContain("preSelectedRealmId={resourceManager.entityId}");
    expect(entityTableSource).toContain("preSelectedRealmId={structureId}");
    expect(realmInfoPanelSource).toContain("preSelectedRealmId={realmId}");
    expect(realmInfoPanelSource).not.toContain("void goToStructure(realmId");
  });
});
