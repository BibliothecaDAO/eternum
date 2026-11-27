import type { NativeFactStore } from "../client/native-fact-store";
import type { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import { isCommandEnabled } from "./mode-rules";

/** The same Frontier boundary for the map's order and the selected target's card. */
export function armyCombatRefusal(
  store: Pick<NativeFactStore, "get" | "require">,
  attacker: { game_id: number; explorer_id: number | bigint },
  defender: { game_id: number; explorer_id: number | bigint },
): "no-attack" | "allied" | undefined {
  if (attacker.game_id !== defender.game_id) return "no-attack";
  const command = commandRefusal(store, attacker.game_id, "Battle");
  if (command) return command;
  return sameAspectArmies(store, attacker.game_id, attacker.explorer_id, defender.explorer_id) ? "allied" : undefined;
}

export function homeAspect(store: Pick<NativeFactStore, "require">, game_id: number, home: number | bigint): number {
  return store.require("HomeAspect", { game_id, home }).aspect;
}

export function sharesAspect(
  store: Pick<NativeFactStore, "require">,
  game_id: number,
  home: number | bigint,
  aspect: number | undefined,
): boolean {
  return Boolean(aspect) && homeAspect(store, game_id, home) === aspect;
}

const sameAspectArmies = (
  store: Pick<NativeFactStore, "get" | "require">,
  game_id: number,
  firstId: number | bigint,
  secondId: number | bigint,
): boolean => {
  const first = store.get("ExplorerTroops", { game_id, explorer_id: firstId });
  const second = store.get("ExplorerTroops", { game_id, explorer_id: secondId });
  if (!first || !second) return false;
  const secondAspect = store.get("DeepRules", { game_id })
    ? homeAspect(store, game_id, second.owner)
    : store.get("HomeAspect", { game_id, home: second.owner })?.aspect;
  return sharesAspect(store, game_id, first.owner, secondAspect);
};

export const commandRefusal = (
  store: Pick<NativeFactStore, "require">,
  game_id: number,
  command: keyof typeof nativeCommandBits,
): "no-attack" | undefined =>
  isCommandEnabled(store.require("SliceRules", { game_id }), command) ? undefined : "no-attack";

/** Whether a home stands in the Aspect of one of the viewer's own realms: an Aspect's armies are allies in the Deep. */
export function isAspectAlly(
  store: Pick<NativeFactStore, "get" | "structuresOwnedBy">,
  game_id: number,
  viewer: bigint | null,
  home: number | bigint,
): boolean {
  const aspect = store.get("HomeAspect", { game_id, home })?.aspect;
  return aspect !== undefined && viewerAspects(store, game_id, viewer).has(aspect);
}

export function accountAspect(
  store: Pick<NativeFactStore, "get" | "structuresOwnedBy">,
  game_id: number,
  account: bigint | null,
): number | undefined {
  const held = viewerAspects(store, game_id, account);
  return held.size === 1 ? [...held][0] : undefined;
}

export function viewerAspects(
  store: Pick<NativeFactStore, "get" | "structuresOwnedBy">,
  game_id: number,
  viewer: bigint | null,
): Set<number> {
  if (viewer === null) return new Set();
  return new Set(
    [...store.structuresOwnedBy(game_id, viewer)].flatMap((realm) => {
      const aspect = store.get("HomeAspect", { game_id, home: realm.entity_id })?.aspect;
      return aspect === undefined ? [] : [aspect];
    }),
  );
}
