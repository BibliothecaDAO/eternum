import { expeditionEpoch, expeditionRealmSite, isCurrentExpeditionArmy, isRealmCategory } from "../utils/expeditions";
import { hasSingleTilePosition } from "../client/native-occupancy";
import { gameSyncRegion, syncScalar, type GameSyncScope } from "./model-manifest";

type ScopeInputModel = "PlayerEntry" | "Structure" | "ExplorerTroops" | "TileOccupancy" | "ProductionReceiver";
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
): GameSyncScope {
  const position = (entity: unknown) => {
    if (!expedition) throw new Error("Position requires expedition rules");
    const positions = read("TileOccupancy", expedition.spacing, [scopeLookup.occupancyOf(entity)]);
    if (positions.length !== 1) throw new Error(`Expected one position for scope entity ${syncScalar(entity)}`);
    const row = positions[0].value;
    return { x: Number(row.col), y: Number(row.row), alt: row.alt === true };
  };
  if (actor !== undefined && (BigInt(actor) <= 0n || BigInt(actor) >= (1n << 251n) - 256n))
    throw new Error("Invalid gameplay account");
  const scope: GameSyncScope = { actor };
  if (!expedition) return scope;
  const { spacing } = expedition;
  const epoch = expeditionEpoch(expedition, timestamp);
  const owners = new Set<string>(actor === undefined ? [] : [syncScalar(actor)]);
  if (actor !== undefined)
    for (const { value } of read("PlayerEntry", spacing, [scopeLookup.entryOf(actor)]))
      owners.add(syncScalar(value.owner));
  const homes = read("Structure", spacing, [...owners].map(scopeLookup.structuresOf)).filter(({ value }) =>
    isRealmCategory(Number((value.base as Record<string, unknown>).category)),
  );
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
  if (epoch >= 0 && armies.length === 0)
    for (const realm of realmTraits) {
      const site = expeditionRealmSite(expedition, Number(realm), timestamp);
      regions.add(gameSyncRegion({ alt: false, x: site.col, y: site.row }, spacing)!);
    }
  for (const { value } of armies) {
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
  const productionSources = new Set(
    read("ProductionReceiver", spacing, [...realms].map(scopeLookup.receiversOf)).map(({ value }) =>
      syncScalar(value.entity_id),
    ),
  );
  scope.expedition = { epoch, spacing, owners, realms, realmTraits, regions, entities, productionSources };
  return scope;
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
  receiversOf: (home: unknown) => `ProductionReceiver.home:${syncScalar(home)}`,
  receiver: (entity: unknown) => `ProductionReceiver.entity:${syncScalar(entity)}`,
};

/** The lookups that can find this row; a region key needs the expedition spacing, and without one there is none. */
export function scopeInputKeys(model: string, row: Record<string, unknown>, spacing: number | undefined): string[] {
  if (model === "PlayerEntry") return [scopeLookup.entryOf(row.player)];
  if (model === "ExplorerTroops") return [scopeLookup.armiesOf(row.owner), scopeLookup.army(row.explorer_id)];
  if (model === "ProductionReceiver") return [scopeLookup.receiversOf(row.home), scopeLookup.receiver(row.entity_id)];
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
