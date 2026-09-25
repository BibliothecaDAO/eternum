import { absoluteEpoch, expeditionRealmSite, isCurrentExpeditionArmy, isRealmCategory } from "../utils/expeditions";
import { hasSingleTilePosition } from "../client/native-occupancy";
import { gameSyncRegion, syncScalar, type GameSyncScope } from "./model-manifest";

type ScopeInputModel = "PlayerEntry" | "Structure" | "ExplorerTroops" | "TileOccupancy";
export type ScopeRowReader = (
  model: ScopeInputModel,
  spacing: number,
  keys: string[],
) => readonly { value: Record<string, unknown> }[];

/** The same derivation reads Herald's indexed fold or the client's completed facts. */
export function deriveGameSyncScope(
  actor: string | undefined,
  timestamp: number,
  expedition: { epochSeconds: number; spacing: number; startMainAt: number } | null,
  read: ScopeRowReader,
  visit?: string,
): GameSyncScope {
  const position = (entity: unknown) => {
    if (!expedition) throw new Error("Position requires expedition rules");
    const positions = read("TileOccupancy", expedition.spacing, [scopeLookup.occupancyOf(entity)]);
    if (positions.length !== 1) throw new Error(`Expected one position for scope entity ${syncScalar(entity)}`);
    const row = positions[0].value;
    return { x: Number(row.col), y: Number(row.row), alt: row.alt === true };
  };
  for (const account of [actor, visit]) {
    if (account !== undefined && (BigInt(account) <= 0n || BigInt(account) >= (1n << 251n) - 256n))
      throw new Error("Invalid gameplay account");
  }
  const scope: GameSyncScope = { actor, ...(visit === undefined ? {} : { visit }) };
  if (!expedition) return scope;
  const { spacing } = expedition;
  const currentAbsoluteEpoch = timestamp < expedition.startMainAt ? -1 : absoluteEpoch(expedition, timestamp);
  const actingOwners = resolveOwners(actor, spacing, read);
  const owners = new Set([...actingOwners, ...resolveOwners(visit, spacing, read)]);
  const homes = read("Structure", spacing, [...owners].map(scopeLookup.structuresOf)).filter(({ value }) =>
    isRealmCategory(Number((value.base as Record<string, unknown>).category)),
  );
  const actingHomes = homes.filter(({ value }) => actingOwners.has(syncScalar(value.owner)));
  const actingRealms = new Set(actingHomes.map(({ value }) => syncScalar(value.entity_id)));
  const realms = new Set(homes.map(({ value }) => syncScalar(value.entity_id)));
  const realmTraits = new Set(
    homes.map(({ value }) => syncScalar((value.metadata as Record<string, unknown>).realm_id)),
  );
  const regions = new Set<string>();
  const armies = read("ExplorerTroops", spacing, [...realms].map(scopeLookup.armiesOf)).filter(({ value }) => {
    if (BigInt((value.troops as Record<string, unknown>).count as string) <= 0n) return false;
    const coord = position(value.explorer_id);
    return isCurrentExpeditionArmy(
      expedition,
      { x: Number(coord.x), y: Number(coord.y), alt: coord.alt === true },
      timestamp,
    );
  });
  // With no current army, morning muster starts on the surface, at the site the contract raises the realm on today.
  const actingArmies = armies.filter(({ value }) => actingRealms.has(syncScalar(value.owner)));
  if (currentAbsoluteEpoch >= 0 && actingArmies.length === 0)
    for (const { value } of actingHomes) {
      const site = expeditionRealmSite(
        expedition,
        Number((value.metadata as Record<string, unknown>).realm_id),
        timestamp,
      );
      regions.add(gameSyncRegion({ alt: false, x: site.col, y: site.row }, spacing)!);
    }
  for (const { value } of actingArmies) {
    const region = gameSyncRegion(position(value.explorer_id), spacing);
    if (region !== undefined) regions.add(region);
  }
  const entities = new Set([...realms, ...armies.map(({ value }) => syncScalar(value.explorer_id))]);
  for (const { value } of read("TileOccupancy", spacing, [...regions].map(scopeLookup.occupancyIn))) {
    if (
      value.is_structure === true &&
      hasSingleTilePosition({ entity_id: syncScalar(value.entity_id), category: syncScalar(value.category) })
    )
      entities.add(syncScalar(value.entity_id));
  }
  scope.expedition = {
    absoluteEpoch: currentAbsoluteEpoch,
    spacing,
    owners,
    realms,
    realmTraits,
    regions,
    entities,
  };
  return scope;
}

function resolveOwners(account: string | undefined, spacing: number, read: ScopeRowReader): Set<string> {
  if (account === undefined) return new Set();
  return new Set([
    syncScalar(account),
    ...read("PlayerEntry", spacing, [scopeLookup.entryOf(account)]).map(({ value }) => syncScalar(value.owner)),
  ]);
}

/** The lookups subscriptionScope makes, spelled once: rows are indexed under them and a scope is taken through them. */
export const scopeLookup = {
  entryOf: (player: unknown) => `PlayerEntry.player:${syncScalar(player)}`,
  structuresOf: (owner: unknown) => `Structure.owner:${syncScalar(owner)}`,
  structure: (entity: unknown) => `Structure.entity:${syncScalar(entity)}`,
  occupancyIn: (region: string) => `TileOccupancy.region:${region}`,
  occupancyOf: (entity: unknown) => `TileOccupancy.entity:${syncScalar(entity)}`,
  armiesOf: (home: unknown) => `ExplorerTroops.owner:${syncScalar(home)}`,
  army: (entity: unknown) => `ExplorerTroops.entity:${syncScalar(entity)}`,
};

/** The lookups that can find this row; a region key needs the expedition spacing, and without one there is none. */
export function scopeInputKeys(model: string, row: Record<string, unknown>, spacing: number | undefined): string[] {
  if (model === "PlayerEntry") return [scopeLookup.entryOf(row.player)];
  if (model === "ExplorerTroops") return [scopeLookup.armiesOf(row.owner), scopeLookup.army(row.explorer_id)];
  if (model === "Structure") return [scopeLookup.structuresOf(row.owner), scopeLookup.structure(row.entity_id)];
  if (model !== "TileOccupancy") return [];
  const region = spacing === undefined ? undefined : gameSyncRegion({ alt: row.alt, x: row.col, y: row.row }, spacing);
  return [
    ...(!hasSingleTilePosition({ entity_id: syncScalar(row.entity_id), category: syncScalar(row.category) })
      ? []
      : [scopeLookup.occupancyOf(row.entity_id)]),
    ...(region === undefined ? [] : [scopeLookup.occupancyIn(region)]),
  ];
}
