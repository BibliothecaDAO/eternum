import "./troop-traits-card.css";

import { Icon } from "@/ui/design-system/icon";
import { TROOP_TRAIT_WORDS, type TroopFigures } from "@/ui/design-system/kit/words";
import { type BuildingType, FRONTIER_TROOP_NAMES, type TroopType } from "@bibliothecadao/types";

import { troopTraits } from "../deploy/troop-figures";
import { combatMarkOf } from "../sites/combat-mark";
import { FRONTIER_STORES, storeMadeBy } from "../stores";

const TROOP_STORES = Object.values(FRONTIER_STORES).filter(
  (store): store is Extract<(typeof FRONTIER_STORES)[keyof typeof FRONTIER_STORES], { troop: TroopType }> =>
    "troop" in store,
);

export const buildingForTroop = (category: TroopType): BuildingType => {
  const entry = TROOP_STORES.find((store) => store.troop === category);
  if (!entry) throw new Error(`No Frontier building trains troop ${category}`);
  return entry.made.category;
};

export const troopForBuilding = (category: BuildingType): TroopType | undefined => {
  const kind = storeMadeBy(category);
  if (!kind) return undefined;
  const store = FRONTIER_STORES[kind];
  return "troop" in store ? store.troop : undefined;
};

export const TroopTraitCard = ({ category, figures }: { category: TroopType; figures: TroopFigures }) => {
  const traits = troopTraits(category);
  const mark = combatMarkOf(category);
  const name = FRONTIER_TROOP_NAMES[category].many;
  const lines = TROOP_TRAIT_WORDS.lines(traits, figures);
  return (
    <div data-troop-trait-card={category} className="troop-trait-card">
      <div className="troop-trait-card__head">
        <Icon name={mark.icon} size={16} />
        <span>{`${name} · ${mark.label}`}</span>
      </div>
      <div className="troop-trait-card__lines">
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </div>
  );
};

export const TroopTraitStrip = ({ category, figures }: { category: TroopType; figures: TroopFigures }) => {
  const traits = troopTraits(category);
  const mark = combatMarkOf(category);
  const pills = TROOP_TRAIT_WORDS.pills(traits, figures);
  return (
    <div data-troop-trait-strip={category} className="troop-trait-strip">
      <span className="troop-trait-pill" data-combat-mark={mark.label}>
        <Icon name={mark.icon} size={13} />
        {mark.label}
      </span>
      {pills.map((line, index) => (
        <span
          key={line}
          className="troop-trait-pill"
          data-tone={index === 0 && traits.scout ? "good" : index > 0 || traits.light ? "muted" : undefined}
        >
          {index === 0 && traits.scout && <Icon name="stamina" size={12} />}
          {line}
        </span>
      ))}
    </div>
  );
};
