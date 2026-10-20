import type { LeftListFilter } from "@/hooks/store/use-ui-store";
import { mineMeaning, realmMeaning, structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { presentedMineKind } from "@bibliothecadao/eternum";
import { StructureType, structurePlural, type StructureNamingMode } from "@bibliothecadao/types";

/**
 * The one grammar every list of the player's holdings reads by: the HUD's holdings panel, the transfer window's Send
 * from and Send to, and the compact HUD's and the workspaces' structure lists. Kinds as tabs in this order, each named
 * as the game names it, one kind at a time, a search once the kind outgrows a screen, starred holdings first.
 */
type ListedHolding = Pick<
  StructureWithMetadata,
  "category" | "displayName" | "isFavorite" | "realmLevel" | "structure"
>;

/** Every kind a player can hold, in the order the tabs show them. */
const KINDS = [
  StructureType.Realm,
  StructureType.Village,
  StructureType.Camp,
  StructureType.Mine,
  StructureType.Rift,
  StructureType.BitcoinMine,
  StructureType.Hyperstructure,
  StructureType.Bank,
  StructureType.Ruin,
  StructureType.Beasts,
];
const KIND_RANK = new Map(KINDS.map((kind, index) => [kind, index]));

/** A search box earns its place once the kind shown no longer fits on one screen. */
const SEARCH_FROM = 12;

/** A held mine's kind as the game presents it (a Rift, a Fragment Mine); none for any other holding. */
const mineKindOf = (holding: Pick<ListedHolding, "category" | "structure">): number | undefined =>
  holding.category === StructureType.Mine ? presentedMineKind(holding.structure) : undefined;

/**
 * The kinds held, in tab order, each with its name, its painting and its count. Mines are named and painted by the
 * kind they present, so a player holding rifts sees "Rifts", as everywhere else; only both kinds at once
 * share the word "Mines".
 */
export const kindsHeld = (
  holdings: ReadonlyArray<Pick<ListedHolding, "category" | "structure">>,
  mode?: StructureNamingMode,
) => {
  const counts = new Map<StructureType, number>();
  const mineKinds = new Set<number>();
  for (const holding of holdings) {
    const kind = holding.category as StructureType;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    const mineKind = mineKindOf(holding);
    if (mineKind !== undefined) mineKinds.add(mineKind);
  }
  const [onlyMineKind] = mineKinds.size === 1 ? mineKinds : [];
  return KINDS.filter((kind) => counts.has(kind)).map((kind) => {
    const presentsOneMineKind = kind === StructureType.Mine && onlyMineKind !== undefined;
    return {
      kind,
      plural: structurePlural(kind, presentsOneMineKind ? onlyMineKind : undefined, mode),
      icon:
        mode === "frontier" && kind === StructureType.Camp
          ? ("beast-troll" as const)
          : presentsOneMineKind
            ? mineMeaning(onlyMineKind)
            : structureMeaning(kind),
      count: counts.get(kind)!,
    };
  });
};

/** Never every holding at once: the asked kind while one is held, else the first held (realms come first). */
export const shownKind = (asked: LeftListFilter, held: ReadonlyArray<{ kind: StructureType }>): LeftListFilter =>
  asked !== "all" && held.some(({ kind }) => kind === asked) ? asked : (held[0]?.kind ?? "all");

/** Whether the kind shown holds enough to need its search. */
export const needsSearch = (
  held: ReadonlyArray<{ kind: StructureType; count: number }>,
  kind: LeftListFilter,
  total: number,
) => (held.find((entry) => entry.kind === kind)?.count ?? total) >= SEARCH_FROM;

/** The shown kind's holdings matching the search: starred first, then the higher level, then by name. */
export const listHoldings = <T extends ListedHolding>(holdings: T[], kind: LeftListFilter, query: string): T[] => {
  const needle = query.trim().toLowerCase();
  return holdings
    .filter((holding) => kind === "all" || holding.category === kind)
    .filter((holding) => needle === "" || holding.displayName.toLowerCase().includes(needle))
    .toSorted(
      (a, b) =>
        (KIND_RANK.get(a.category as StructureType) ?? 99) - (KIND_RANK.get(b.category as StructureType) ?? 99) ||
        Number(b.isFavorite) - Number(a.isFavorite) ||
        b.realmLevel - a.realmLevel ||
        a.displayName.localeCompare(b.displayName),
    );
};

/** A realm shows its age's painting, a mine its kind's (a rift's rift), every other holding its category's. */
export const holdingIcon = (holding: Pick<ListedHolding, "category" | "realmLevel" | "structure">): IconMeaning => {
  if (holding.category === StructureType.Realm) return realmMeaning(holding.realmLevel);
  const mineKind = mineKindOf(holding);
  return mineKind !== undefined ? mineMeaning(mineKind) : structureMeaning(holding.category as StructureType);
};
