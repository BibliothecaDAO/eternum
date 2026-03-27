import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readLabelComponentsSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "label-components.ts"), "utf8");
}

describe("incoming troop label helpers", () => {
  it("defines icon-first incoming troop helpers without zoom-specific display rules", () => {
    const source = readLabelComponentsSource();

    expect(source).toMatch(/const createIncomingTroopList =/);
    expect(source).toMatch(/const createIncomingTroopIcon =/);
    expect(source).toMatch(/const createIncomingTroopTierIndicator =/);
    expect(source).toMatch(/const createIncomingTroopEta =/);
    expect(source).toMatch(/export const updateIncomingTroopDisplay =/);
    expect(source).toMatch(/img\.src = `\/images\/resources\/\$\{resourceId\}\.png`/);
    expect(source).toMatch(/tierIndicator\.textContent = `T\$\{tierValue\}`/);
    expect(source).toMatch(/etaIcon\.textContent = "⏳"/);
    expect(source).toMatch(/const visibleArrivals = arrivals\.slice\(0, 3\)/);
    expect(source).toMatch(/\+\$\{arrivals\.length - visibleArrivals\.length\} more/);
    expect(source).toMatch(/useChainTimeStore\.getState\(\)\.getNowSeconds\(\)/);
    expect(source).not.toMatch(/incoming-troops-badge/);
    expect(source).not.toMatch(/\$\{arrival\.troopType\}/);
    expect(source).not.toMatch(/inputView === CameraView\.Far/);
    expect(source).not.toMatch(/inputView === CameraView\.Close/);
  });

  it("inserts incoming troop rows before productions instead of appending them after", () => {
    const source = readLabelComponentsSource();

    expect(source).toMatch(/contentContainer\.insertBefore\(container, productionsDisplay\)/);
  });
});
