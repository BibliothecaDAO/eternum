import { REALM } from "@/ui/design-system/kit/words";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { Headline, ResourceCost } from "@/ui/design-system/molecules";
import { configManager } from "@bibliothecadao/eternum";
import { RealmLevelNames, RealmLevels, rankName } from "@bibliothecadao/types";
import { describeCastleLevel } from "@/ui/modules/entity-details/realm/castle-level";
import { useMemo } from "react";

import { ReferenceTable } from "./article";

const CASTLE_IMAGES: Partial<Record<RealmLevelNames, IconMeaning>> = {
  [RealmLevelNames.City]: "realm-1",
  [RealmLevelNames.Kingdom]: "realm-2",
  [RealmLevelNames.Empire]: "realm-3",
} as const;

export const Realm = () => {
  return (
    <div className="space-y-8">
      <Headline>{REALM}</Headline>

      <section className="space-y-4">
        <h4>Your Realm</h4>
        <div className="space-y-4">
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
        <div className="space-y-4">
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
    return configManager.realmUpgradeRecipes().map(({ level, costs }) => ({
      level: rankName(level),
      cost: costs.map((cost) => ({
        ...cost,
        amount: cost.amount,
      })),
    }));
  }, []);

  return (
    <ReferenceTable
      label="What each realm level costs"
      cols="1fr 1fr"
      head={["Level Information", "Cost"]}
      rows={levelTable.map((resource) => {
        const castle = CASTLE_IMAGES[resource.level as unknown as keyof typeof CASTLE_IMAGES];
        return {
          key: resource.level,
          label: String(resource.level),
          cells: [
            <span key="level" className="flex flex-col items-center gap-4 py-4">
              {castle ? (
                <SemanticIcon size={144} name={castle} alt={`${resource.level} castle`} className="object-contain" />
              ) : (
                <span className="text-hud-muted">No preview available</span>
              )}
              <span className="text-hud-display text-hud-accent">{resource.level}</span>
              <span className="text-center leading-relaxed">
                {describeCastleLevel(RealmLevels[resource.level as unknown as keyof typeof RealmLevels])}
              </span>
            </span>,
            <span key="cost" className="flex flex-col gap-3">
              {resource.cost.length > 0
                ? resource.cost.map((cost, index) => (
                    <ResourceCost key={index} resourceId={cost.resource} amount={cost.amount} size="lg" />
                  ))
                : "Starting Level"}
            </span>,
          ],
        };
      })}
    />
  );
};
