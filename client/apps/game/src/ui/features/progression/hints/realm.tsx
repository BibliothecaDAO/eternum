import { Headline } from "@/ui/elements/headline";
import { ResourceCost } from "@/ui/elements/resource-cost";
import { configManager } from "@bibliothecadao/eternum";
import { LEVEL_DESCRIPTIONS, RealmLevelNames, RealmLevels } from "@bibliothecadao/types";
import { useMemo } from "react";

const CASTLE_IMAGES: Partial<Record<RealmLevelNames, string>> = {
  [RealmLevelNames.City]: "/images/buildings/construction/castleOne.png",
  [RealmLevelNames.Kingdom]: "/images/buildings/construction/castleTwo.png",
  [RealmLevelNames.Empire]: "/images/buildings/construction/castleThree.png",
} as const;

export const Realm = () => {
  return (
    <div className="space-y-8">
      <Headline>Realm</Headline>

      <section className="space-y-4">
        <h4>Your Realm</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Your realm is a unique territory composed of hexagonal tiles, each representing a potential construction
            site. These hexes are the foundation of your empire, where you'll build various structures to establish your
            dominion.
          </p>
          <p className="leading-relaxed">
            Strategic placement of buildings across your hexes is crucial - each structure serves a specific purpose in
            your realm's development, from resource generation to military strength.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h4>Realm Progression</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            As your influence grows, so too must your realm. Each level of progression - from City to Kingdom to Empire
            - unlocks new territories and opportunities. With each upgrade, you'll gain access to additional hexes,
            allowing for more complex and powerful configurations of buildings.
          </p>
          <p className="leading-relaxed">
            Below you'll find the resources required for each realm upgrade. Plan your expansion carefully - these
            investments are substantial but necessary for those who aspire to true power in the realm.
          </p>
        </div>
      </section>

      <LevelTable />
    </div>
  );
};

const LevelTable = () => {
  const levelTable = useMemo(() => {
    return Object.entries(configManager.realmUpgradeCosts).map(([level, costs]) => ({
      level: RealmLevels[level as keyof typeof RealmLevels],
      cost: costs.map((cost) => ({
        ...cost,
        amount: cost.amount,
      })),
    }));
  }, []);

  console.log(levelTable);

  return (
    <div className="rounded-lg border border-gold/20 overflow-hidden">
      <table className="not-prose w-full">
        <thead className="bg-gold/5">
          <tr className="border-b border-gold/20">
            <th className="text-left p-4 text-light-pink">Level Information</th>
            <th className="text-left p-4 text-light-pink">Cost</th>
          </tr>
        </thead>
        <tbody>
          {levelTable.map((resource) => (
            <tr className="border-b border-gold/10 hover:bg-gold/5 transition-colors" key={resource.level}>
              <td className="p-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-64 h-64 rounded-lg bg-gold/5 border border-gold/20 flex items-center justify-center overflow-hidden">
                    {CASTLE_IMAGES[resource.level as unknown as keyof typeof CASTLE_IMAGES] ? (
                      <img
                        src={CASTLE_IMAGES[resource.level as unknown as keyof typeof CASTLE_IMAGES]}
                        alt={`Level ${resource.level} Castle`}
                        className="object-contain"
                      />
                    ) : (
                      <span className="text-gold/40">No preview available</span>
                    )}
                  </div>
                  <div className="space-y-2 text-center">
                    <span className="text-2xl font-medium text-light-pink block">{resource.level}</span>
                    <span className="text-gray-300 block leading-relaxed">
                      {
                        LEVEL_DESCRIPTIONS[
                          RealmLevels[
                            resource.level as unknown as keyof typeof RealmLevels
                          ] as keyof typeof LEVEL_DESCRIPTIONS
                        ]
                      }
                    </span>
                  </div>
                </div>
              </td>
              <td className="p-6">
                <div className="gap-3 flex flex-col">
                  {resource.cost.length > 0 ? (
                    resource.cost.map((cost, index) => (
                      <div key={index}>
                        <ResourceCost resourceId={cost.resource} amount={cost.amount} size="lg" />
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-300">Starting Level</div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
