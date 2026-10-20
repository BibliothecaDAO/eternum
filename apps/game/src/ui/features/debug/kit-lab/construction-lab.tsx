import { useState } from "react";
import { GameProvider } from "@/hooks/context/game-context";
import { BuildingType, buildingName, ResourcesIds } from "@bibliothecadao/types";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { BuildingCard } from "@/ui/features/settlement/construction/select-preview-building";

import { installBuildingRules, installFixtureGame, PLAYER } from "./fixture-game";

const buildings = [
  BuildingType.ResourceWheat,
  BuildingType.WorkersHut,
  BuildingType.ResourceLabor,
  BuildingType.ResourceDonkey,
  BuildingType.Storehouse,
  BuildingType.ResourceFish,
  BuildingType.ResourceKnightT1,
  BuildingType.ResourceCrossbowmanT1,
  BuildingType.ResourcePaladinT1,
  BuildingType.ResourceResearch,
  BuildingType.ResourceWood,
  BuildingType.ResourceCoal,
  BuildingType.ResourceCopper,
  BuildingType.ResourceDragonhide,
  BuildingType.ResourceEssence,
];

/**
 * Real responsive construction cards on the lab's fixture game, which holds the building rules and recipes a card's
 * details read; local counts let the controls be reviewed without a transaction.
 */
export function ConstructionLab() {
  const [store] = useState(() => {
    const store = installFixtureGame();
    installBuildingRules(store, buildings);
    return store;
  });
  return (
    <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
      <ConstructionCards />
    </GameProvider>
  );
}

const ConstructionCards = () => {
  const [counts, setCounts] = useState<Partial<Record<BuildingType, number>>>({});
  const [paused, setPaused] = useState<Partial<Record<BuildingType, boolean>>>({});
  const [selected, setSelected] = useState<BuildingType | null>(null);
  return (
    <main className="min-h-dvh bg-kit-ground p-4 text-kit-cream">
      <h1 className="text-2xl">Construction models</h1>
      <p className="my-3">
        Current model renders in the game’s desktop and phone cards. Build changes only this preview’s count.
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {buildings.map((building) => {
          const count = counts[building] ?? 1;
          const name = buildingName(building, true);
          return (
            <section key={building} aria-label={name}>
              <BuildingCard
                buildingId={building}
                buildingName={name}
                active={selected === building}
                onClick={() => setSelected(building)}
                count={count}
                badge={<span>{count} built</span>}
                entityId={undefined}
                useSimpleCost={false}
                requirements={[{ resource: ResourcesIds.Wood, current: 100, amount: 10 }]}
                onBuild={() => setCounts({ ...counts, [building]: count + 1 })}
                onDestroy={() => setCounts({ ...counts, [building]: Math.max(0, count - 1) })}
                onPauseResumeAll={() => setPaused({ ...paused, [building]: !paused[building] })}
                allPaused={paused[building] ?? false}
              />
            </section>
          );
        })}
      </div>
    </main>
  );
};
