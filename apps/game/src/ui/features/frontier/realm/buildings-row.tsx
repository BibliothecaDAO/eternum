import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { BARRACKS, BUILDINGS, FARM, HUT, WORKSHOP } from "@/ui/design-system/kit/words";
import { buildableRadius } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType } from "@bibliothecadao/types";

/** The four common building types the row counts, in the wireframe's order. */
const TYPES: { category: BuildingType; icon: IconCode; word: string }[] = [
  { category: BuildingType.ResourceWheat, icon: "Fm", word: FARM },
  { category: BuildingType.ResourceKnightT1, icon: "Bs", word: BARRACKS },
  { category: BuildingType.ResourceLabor, icon: "Wk", word: WORKSHOP },
  { category: BuildingType.WorkersHut, icon: "Ht", word: HUT },
];

/** A realm of 36 plots or more is read whole on a phone; the row is how a type's sheet opens in one tap. */
const FULL_REALM_RADIUS = 3;

/**
 * Buildings, the full realm's summary row (wireframe 02): the four common types with their counts, each opening its
 * type's sheet in one tap.
 */
export const BuildingsRow = ({
  counts,
  onOpen,
}: {
  counts: Partial<Record<BuildingType, number>>;
  onOpen: (category: BuildingType) => void;
}) => (
  <nav aria-label={BUILDINGS} className="pointer-events-auto flex items-center justify-center gap-1.5">
    <span className="text-[12px] font-semibold text-kit-cream">{BUILDINGS}</span>
    {TYPES.map(({ category, icon, word }) => (
      <button
        key={category}
        type="button"
        aria-label={`${word} ${formatAmount(counts[category])}`}
        disabled={!counts[category]}
        onClick={() => onOpen(category)}
        className="frontier-chip h-12 w-[60px] justify-center !rounded-[14px] !px-2 disabled:opacity-50"
      >
        <span className="contents">
          <KitIcon code={icon} size={22} />
          <span className="frontier-chip-number tabular-nums !text-[15px]">{formatAmount(counts[category])}</span>
        </span>
      </button>
    ))}
  </nav>
);

/**
 * The row over the game's facts, on the realm board of a realm whose castle opens 36 plots or more: the realm's
 * buildings counted by type; a tap selects the first building of the type, which opens its sheet.
 */
export const RealmBuildingsRow = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  useNativeRevision(["Building"]);
  if (isMapView || buildableRadius(realm.base.level) < FULL_REALM_RADIUS) return null;
  const buildings = [...setup.store.inGame("Building", realm.game_id)].filter(
    (building) => building.structure_id === realm.entity_id,
  );
  const counts: Partial<Record<BuildingType, number>> = {};
  for (const building of buildings) {
    const category = Number(building.category) as BuildingType;
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return (
    <BuildingsRow
      counts={counts}
      onOpen={(category) => {
        const first = buildings.find((building) => Number(building.category) === category);
        if (first)
          setSelectedBuildingHex({
            structureId: realm.entity_id,
            innerCol: first.inner_col,
            innerRow: first.inner_row,
          });
      }}
    />
  );
};
