import type { NativeFactStore } from "../client/native-fact-store";
import type { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import { isCommandEnabled } from "./mode-rules";

/** The same Frontier boundary for the map's order and the selected target's card. */
export function armyCombatRefusal(
  store: Pick<NativeFactStore, "require">,
  attacker: { game_id: number; explorer_id: number | bigint },
  defender: { game_id: number; explorer_id: number | bigint },
): "no-attack" | undefined {
  if (attacker.game_id !== defender.game_id) return "no-attack";
  return commandRefusal(store, attacker.game_id, "Battle");
}

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
