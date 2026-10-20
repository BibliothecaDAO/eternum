import type { ID } from "@bibliothecadao/types";

/**
 * One of Next up's steps. A realm's level-up is read and sent by the realm's own hook, with the reason the step asks
 * for it; any other step has its line and its one verb, or no verb when the player takes it on the map itself.
 */
export type NextStep =
  | { key: string; kind: "level-up"; realmId: ID; name: string; why?: string }
  | { key: string; kind: "order"; line: string; verb: string | null; busy: boolean; run: (() => void) | null };
