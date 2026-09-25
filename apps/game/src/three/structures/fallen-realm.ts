import { expeditionDepth, readExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";

/**
 * A fallen realm on the map (design §3.2): one shared ruin at every depth, held by a beast that is presentation only.
 * The beast and its size come from one depth table; each beast's scale stays under the largest it can take inside the
 * ruin, as measured against the ruin's masonry (models/frontier/SOURCE.md). Names are Loot Survivor's own beasts.
 */
export const FALLEN_REALM_RUIN_PATH = "/models/frontier/fallen-realm-ruin.glb";

export type FallenRealmBeast = "troll" | "wyvern" | "hydra";

export const FALLEN_REALM_BEASTS: Record<
  FallenRealmBeast,
  { path: string; name: string; lootSurvivorId: number; maxScale: number }
> = {
  // Loot Survivor beast ids from its beasts constants (BibliothecaDAO/loot-survivor@94538af).
  troll: { path: "/models/frontier/beast-troll.glb", name: "Troll", lootSurvivorId: 71, maxScale: 1.46 },
  wyvern: { path: "/models/frontier/beast-wyvern.glb", name: "Wyvern", lootSurvivorId: 37, maxScale: 1.38 },
  hydra: { path: "/models/frontier/beast-hydra.glb", name: "Hydra", lootSurvivorId: 59, maxScale: 1.7 },
};

/** The one depth table: the beast holding a fallen realm at each depth, larger the deeper it stands. */
export const FALLEN_REALM_DEPTHS: readonly { beast: FallenRealmBeast; scale: number }[] = [
  { beast: "troll", scale: 1.2 },
  { beast: "wyvern", scale: 1.35 },
  { beast: "hydra", scale: 1.45 },
  { beast: "hydra", scale: 1.7 },
];

export const fallenRealmBeast = (depth: number): { beast: FallenRealmBeast; scale: number; name: string } => {
  const entry = FALLEN_REALM_DEPTHS[depth];
  if (!entry) throw new Error(`No fallen realm beast for depth ${depth}`);
  return { ...entry, name: FALLEN_REALM_BEASTS[entry.beast].name };
};

/**
 * What a site's tile shows of a fallen realm: the ruin and the depth's beast while it stands. Once cleared, nothing
 * here: the capture replaced the site's occupancy with the closed chest, which draws as every closed chest does.
 */
const BEAST_ORDER = Object.keys(FALLEN_REALM_BEASTS) as FallenRealmBeast[];

/**
 * A fallen realm is a camp in the facts, so its models follow the camp's village (index 0) in the camp's model list:
 * the ruin, then one per beast.
 */
export const FALLEN_REALM_CAMP_MODEL_PATHS = [
  FALLEN_REALM_RUIN_PATH,
  ...BEAST_ORDER.map((beast) => FALLEN_REALM_BEASTS[beast].path),
];
export const FALLEN_REALM_RUIN_MODEL_INDEX = 1;
export const fallenRealmBeastModelIndex = (beast: FallenRealmBeast): number => 2 + BEAST_ORDER.indexOf(beast);

export const fallenRealmOnTile = (
  site: Pick<NativeRows["ExpeditionSite"], "kind" | "cleared">,
  depth: number,
): ReturnType<typeof fallenRealmBeast> | null =>
  site.kind === "FallenRealm" && !site.cleared ? fallenRealmBeast(depth) : null;

/**
 * The beast a site's tile shows, read from its facts: a camp is a fallen realm only by its ExpeditionSite kind, and
 * only while it stands. `tile` is the site's contract coordinate, whose row gives its depth.
 */
export const readStandingFallenRealm = (
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  entityId: number,
  tile: { row: number },
): ReturnType<typeof fallenRealmBeast> | undefined => {
  const site = store.get("ExpeditionSite", { game_id: gameId, entity_id: entityId });
  if (site?.kind !== "FallenRealm") return undefined;
  const rules = readExpeditionRules(store, gameId);
  if (!rules) throw new Error(`Fallen realm ${entityId} stands in a game without expedition rules`);
  return fallenRealmOnTile(site, expeditionDepth(rules, { y: tile.row })) ?? undefined;
};
