import { useState } from "react";
import { BuildingType, BuildingTypeToString, ResourcesIds } from "@bibliothecadao/types";
import { frontierBuildingName } from "@/ui/features/frontier/build/building-names";
import { BuildingCard } from "@/ui/features/settlement/construction/select-preview-building";

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

/** Real responsive construction cards; local counts let the controls be reviewed without a transaction. */
export function ConstructionLab() {
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
          const name = frontierBuildingName(building) ?? BuildingTypeToString[building];
          return (
            <section key={building} aria-label={name}>
              <BuildingCard
                buildingId={building}
                buildingName={name}
                active={selected === building}
                onClick={() => setSelected(building)}
                count={count}
                badge={<span>{count} built</span>}
                toolTip={<p>Building model preview</p>}
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
}
