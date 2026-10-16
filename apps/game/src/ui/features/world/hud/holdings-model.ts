import type { LeftListFilter } from "@/hooks/store/use-ui-store";
import { realmMeaning, structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { StructureType } from "@bibliothecadao/types";

/**
 * The one grammar every list of the player's holdings reads by: the HUD's holdings panel and the transfer window's
 * Send from and Send to. Kinds as tabs in this order, one kind at a time, a search once the kind outgrows a screen,
 * starred holdings first.
 */
type ListedHolding = Pick<StructureWithMetadata, "category" | "displayName" | "isFavorite" | "realmLevel">;

/** Every kind a player can hold, in the order the tabs show them. */
const KINDS: Array<{ kind: StructureType; plural: string }> = [
  { kind: StructureType.Realm, plural: "Realms" },
  { kind: StructureType.Village, plural: "Villages" },
  { kind: StructureType.Camp, plural: "Camps" },
  { kind: StructureType.Mine, plural: "Mines" },
  { kind: StructureType.Rift, plural: "Rifts" },
  { kind: StructureType.BitcoinMine, plural: "Bitcoin mines" },
  { kind: StructureType.Hyperstructure, plural: "Hyperstructures" },
  { kind: StructureType.Bank, plural: "Banks" },
  { kind: StructureType.Ruin, plural: "Ruins" },
  { kind: StructureType.Stragglers, plural: "Stragglers" },
];
const KIND_RANK = new Map(KINDS.map(({ kind }, index) => [kind, index]));

/** A search box earns its place once the kind shown no longer fits on one screen. */
const SEARCH_FROM = 12;

/** The kinds held, in tab order, each with its count. */
export const kindsHeld = (holdings: ReadonlyArray<Pick<ListedHolding, "category">>) => {
  const counts = new Map<StructureType, number>();
  for (const holding of holdings) {
    const kind = holding.category as StructureType;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return KINDS.filter(({ kind }) => counts.has(kind)).map((entry) => ({ ...entry, count: counts.get(entry.kind)! }));
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

/** A realm shows its age's painting; every other holding its kind's. */
export const holdingIcon = (holding: Pick<ListedHolding, "category" | "realmLevel">): IconMeaning =>
  holding.category === StructureType.Realm
    ? realmMeaning(holding.realmLevel)
    : structureMeaning(holding.category as StructureType);
