// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Unit command audio wiring", () => {
  it("registers dedicated command ids for select, move, attack, and explore", () => {
    const registrySource = readSource("src/audio/config/registry.ts");

    expect(registrySource).toContain('"unit.command.select"');
    expect(registrySource).toContain('"unit.command.move"');
    expect(registrySource).toContain('"unit.command.attack"');
    expect(registrySource).toContain('"unit.command.explore"');
  });

  it("routes worldmap army selection and movement through the shared command audio helper", () => {
    const worldmapSource = readSource("src/three/scenes/worldmap.tsx");

    expect(worldmapSource).toContain("import { playUnitCommandSound, playUnitCommandSoundForWorldmapAction }");
    expect(worldmapSource).toContain('playUnitCommandSound("select")');
    expect(worldmapSource).toContain("playUnitCommandSoundForWorldmapAction(actionType)");
    expect(worldmapSource).not.toContain('AudioManager.getInstance().play("unit.selected")');
    expect(worldmapSource).not.toContain('AudioManager.getInstance().play("unit.march")');
  });

  it("plays the shared attack acknowledgement in both attack submission flows", () => {
    const quickAttackPreviewSource = readSource("src/ui/features/military/battle/quick-attack-preview.tsx");
    const combatContainerSource = readSource("src/ui/features/military/battle/combat-container.tsx");

    expect(quickAttackPreviewSource).toContain('playUnitCommandSound("attack")');
    expect(combatContainerSource).toContain('playUnitCommandSound("attack")');
  });
});
