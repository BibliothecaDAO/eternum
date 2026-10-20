import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import type { RealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";

vi.mock("@/ui/modules/entity-details/realm/castle-level", () => ({
  describeCastleLevel: (level: number) => `${level * 6} buildable plots`,
}));

import { LevelUpRequirements } from "./chip";

const step = (overrides: Partial<RealmLevelUp>): RealmLevelUp => ({
  mode: "level-up",
  word: "Level up to City",
  ready: false,
  loading: false,
  refusal: null,
  currentLevel: 0,
  nextLevel: 1,
  nextLevelName: "City",
  requirements: [],
  run: () => undefined,
  ...overrides,
});

it("says why a level cannot be taken, that a free one costs nothing, and what the level gives", () => {
  const html = renderToStaticMarkup(<LevelUpRequirements step={step({ refusal: "Play opens in 3m" })} />);
  expect(html).toContain("Play opens in 3m");
  expect(html).toContain("Nothing to pay for this level.");
  expect(html).toContain("City gives 6 buildable plots.");
  expect(html).not.toContain("No upgrade requirements found");
});

it("lists each cost as what the realm holds against what it needs", () => {
  const html = renderToStaticMarkup(
    <LevelUpRequirements
      step={step({
        nextLevel: 2,
        nextLevelName: "Kingdom",
        refusal: "Need resources",
        requirements: [{ resource: ResourcesIds.Wheat, amount: 2400, current: 1200, progress: 0.5, incoming: null }],
      })}
    />,
  );
  expect(html).toContain("Need resources");
  expect(html).toMatch(/1,200 \/\s*2,400/);
  expect(html).not.toContain("Nothing to pay");
});
