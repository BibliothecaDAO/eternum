import type { GuildInfo, Player, ResourceArrivalInfo } from "@bibliothecadao/types";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { create } from "zustand";

type Row<Model extends keyof NativeRows> = NativeRows[Model];

export interface BuildingTile {
  innerCol: number;
  innerRow: number;
  outerEntityId: number;
}

/**
 * Narrowed world slices, written only by the native fact → view bridge at most once per ingest slice. Components
 * subscribe to a slice instead of to every row of a hot component. The revision counters are for consumers that
 * keep their own fact reads (leaderboard, resource table, exploration dashboard): a change in the counter is the
 * signal to recompute, and their memoization must depend on it and on nothing that changes per row.
 */
export interface WorldSlicesStore {
  addressNames: Row<"AddressName">[];
  armiesRevision: number;
  blitzSettlementPlayers: bigint[];
  buildings: BuildingTile[];
  faithfulStructures: Row<"FaithfulStructure">[];
  guilds: GuildInfo[];
  hyperstructures: Row<"Hyperstructure">[];
  leaderboardRevision: number;
  players: Player[];
  resourceArrivals: ResourceArrivalInfo[];
  resourcesRevision: number;
  structures: Row<"Structure">[];
  wonderFaith: Row<"WonderFaith">[];
}

export const useWorldSlicesStore = create<WorldSlicesStore>()(() => ({
  addressNames: [],
  armiesRevision: 0,
  blitzSettlementPlayers: [],
  buildings: [],
  faithfulStructures: [],
  guilds: [],
  hyperstructures: [],
  leaderboardRevision: 0,
  players: [],
  resourceArrivals: [],
  resourcesRevision: 0,
  structures: [],
  wonderFaith: [],
}));
