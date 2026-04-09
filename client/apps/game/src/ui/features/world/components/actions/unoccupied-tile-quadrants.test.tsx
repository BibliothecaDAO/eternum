// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BiomeSummaryCard } from "./unoccupied-tile-quadrants";

const mocks = vi.hoisted(() => ({
  getBiomeCombatBonus: vi.fn(),
}));

vi.mock("@/ui/design-system/atoms/button", () => ({
  default: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/ui/design-system/molecules/resource-icon", () => ({
  ResourceIcon: ({ resource }: { resource: string }) => <span>{resource}</span>,
}));

vi.mock("@/ui/features/military", () => ({
  formatBiomeBonus: (bonus: number) => `${Math.round((bonus - 1) * 100)}%`,
}));

vi.mock("@/ui/features/world/components/entities/layout", () => ({
  EntityDetailSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/ui/features/world/components/config", () => ({
  battleSimulation: "battleSimulation",
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: () => vi.fn(),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  configManager: {
    getBiomeCombatBonus: mocks.getBiomeCombatBonus,
  },
}));

vi.mock("@bibliothecadao/types", () => ({
  BiomeType: {
    Tundra: "Tundra",
  },
  TroopType: {
    Knight: "Knight",
    Crossbowman: "Crossbowman",
    Paladin: "Paladin",
  },
}));

vi.mock("lucide-react/dist/esm/icons/crosshair", () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
}));

describe("BiomeSummaryCard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    mocks.getBiomeCombatBonus.mockReset();
    mocks.getBiomeCombatBonus.mockImplementation((troopType: string) => {
      if (troopType === "Knight") return 0.7;
      if (troopType === "Crossbowman") return 1;
      return 1.3;
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("renders three distinct biome bonus cards with clear battle states", async () => {
    await act(async () => {
      root.render(<BiomeSummaryCard biome={"Tundra" as never} />);
    });

    const bonusGrid = container.querySelector('[aria-label="Army bonuses"]');

    expect(bonusGrid?.className).toContain("w-full");
    expect(bonusGrid?.className).toContain("flex");
    expect(bonusGrid?.className).toContain("flex-col");
    expect(container.textContent).not.toContain("Army bonuses");

    const bonusCards = container.querySelectorAll('[data-bonus-card="true"]');
    expect(bonusCards).toHaveLength(3);
    expect(Array.from(bonusCards).every((card) => card.className.includes("w-full"))).toBe(true);
    expect(Array.from(bonusCards).every((card) => card.className.includes("p-1"))).toBe(true);
    expect(Array.from(bonusCards).every((card) => !card.className.includes("min-h-["))).toBe(true);

    expect(container.textContent).toContain("Penalty");
    expect(container.textContent).toContain("Neutral");
    expect(container.textContent).toContain("Advantage");
  });
});
