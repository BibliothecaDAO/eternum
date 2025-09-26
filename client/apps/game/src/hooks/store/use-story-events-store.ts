import { sqlApi } from "@/services/api";
import { buildStoryEventPresentation } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { StoryEventData } from "@bibliothecadao/torii";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";

export interface ProcessedStoryEvent extends StoryEventData {
  id: string;
  timestampMs: number;
  presentation: ReturnType<typeof buildStoryEventPresentation>;
}

interface StoryEventsState {
  lastRefreshTimestamp: number;
  setLastRefreshTimestamp: (timestamp: number) => void;
}

export const useStoryEventsStore = create<StoryEventsState>((set) => ({
  lastRefreshTimestamp: 0,
  setLastRefreshTimestamp: (timestamp: number) => set({ lastRefreshTimestamp: timestamp }),
}));

export const useStoryEvents = (limit: number = 100) => {
  const {
    setup: { components },
  } = useDojo();

  return useQuery({
    queryKey: ["storyEvents", limit],
    queryFn: async (): Promise<ProcessedStoryEvent[]> => {
      const rawEvents = await sqlApi.fetchStoryEvents(limit, 0);

      return rawEvents.map((event): ProcessedStoryEvent => {
        // Convert hex timestamp to milliseconds
        const timestampMs = parseInt(event.timestamp, 16) * 1000;

        // Create a story event system update object for the formatter
        const storyEventUpdate = {
          ownerAddress: event.owner,
          ownerName: null, // Will be resolved by the formatter
          entityId: event.entity_id,
          txHash: event.tx_hash,
          timestamp: timestampMs,
          storyType: event.story, // Use the story type directly
          storyPayload: buildStoryPayloadFromEvent(event),
          rawStory: event,
        };

        const presentation = buildStoryEventPresentation(storyEventUpdate, components);

        return {
          ...event,
          id: `${event.tx_hash}-${event.timestamp}`,
          timestampMs,
          presentation,
        };
      });
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 3000, // Auto-refresh every 3 seconds
  });
};

export const useStoryEventsLoading = () => {
  const {
    setup: { components },
  } = useDojo();

  return useQuery({
    queryKey: ["storyEvents", 100],
    queryFn: async (): Promise<ProcessedStoryEvent[]> => {
      const rawEvents = await sqlApi.fetchStoryEvents(100, 0);

      return rawEvents.map((event): ProcessedStoryEvent => {
        const timestampMs = parseInt(event.timestamp, 16) * 1000;

        const storyEventUpdate = {
          ownerAddress: event.owner,
          ownerName: null,
          entityId: event.entity_id,
          txHash: event.tx_hash,
          timestamp: timestampMs,
          storyType: event.story,
          storyPayload: buildStoryPayloadFromEvent(event),
          rawStory: event,
        };

        const presentation = buildStoryEventPresentation(storyEventUpdate, components);

        return {
          ...event,
          id: `${event.tx_hash}-${event.timestamp}`,
          timestampMs,
          presentation,
        };
      });
    },
  }).isLoading;
};

export const useStoryEventsError = () => {
  const {
    setup: { components },
  } = useDojo();

  return useQuery({
    queryKey: ["storyEvents", 100],
    queryFn: async (): Promise<ProcessedStoryEvent[]> => {
      const rawEvents = await sqlApi.fetchStoryEvents(100, 0);

      return rawEvents.map((event): ProcessedStoryEvent => {
        const timestampMs = parseInt(event.timestamp, 16) * 1000;

        const storyEventUpdate = {
          ownerAddress: event.owner,
          ownerName: null,
          entityId: event.entity_id,
          txHash: event.tx_hash,
          timestamp: timestampMs,
          storyType: event.story,
          storyPayload: buildStoryPayloadFromEvent(event),
          rawStory: event,
        };

        const presentation = buildStoryEventPresentation(storyEventUpdate, components);

        return {
          ...event,
          id: `${event.tx_hash}-${event.timestamp}`,
          timestampMs,
          presentation,
        };
      });
    },
  }).error?.message;
};

function parseMaybeJson<T = unknown>(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return value;
  const firstChar = trimmed[0];
  if (firstChar !== "{" && firstChar !== "[" && firstChar !== '"') {
    return value;
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch (error) {
    return value;
  }
}

const buildCoord = (x?: number | null, y?: number | null) => {
  if (x === null || x === undefined || y === null || y === undefined) {
    return null;
  }
  return { x, y };
};

// Helper function to build story payload from the flattened database event
function buildStoryPayloadFromEvent(event: StoryEventData): Record<string, unknown> | null {
  switch (event.story) {
    case 'RealmCreatedStory':
      return {
        coord: buildCoord(event.realm_coord_x ?? null, event.realm_coord_y ?? null),
      };

    case 'StructureLevelUpStory':
      return {
        new_level: event.structure_new_level,
      };

    case 'ExplorerMoveStory':
      return {
        explorer_id: event.explorer_id,
        explorer_structure_id: event.explorer_structure_id,
        start_coord: buildCoord(event.start_coord_x ?? null, event.start_coord_y ?? null),
        end_coord: buildCoord(event.end_coord_x ?? null, event.end_coord_y ?? null),
        directions: parseMaybeJson(event.explorer_directions),
        explore: event.explorer_explore,
        explore_find: parseMaybeJson(event.explore_find),
        reward_resource_type: event.reward_resource_type,
        reward_resource_amount: event.reward_resource_amount,
      };

    case 'BattleStory':
      return {
        attacker_id: event.battle_attacker_id,
        defender_id: event.battle_defender_id,
        winner_id: event.battle_winner_id,
        battle_type: parseMaybeJson(event.battle_type),
        attacker_owner_address: event.battle_attacker_owner_address,
        defender_owner_address: event.battle_defender_owner_address,
        attacker_owner_id: event.battle_attacker_owner_id,
        defender_owner_id: event.battle_defender_owner_id,
        attacker_troops_type: parseMaybeJson(event.battle_attacker_troops_type),
        attacker_troops_tier: parseMaybeJson(event.battle_attacker_troops_tier),
        attacker_troops_before: event.battle_attacker_troops_before,
        attacker_troops_lost: event.battle_attacker_troops_lost,
        defender_troops_type: parseMaybeJson(event.battle_defender_troops_type),
        defender_troops_tier: parseMaybeJson(event.battle_defender_troops_tier),
        defender_troops_before: event.battle_defender_troops_before,
        defender_troops_lost: event.battle_defender_troops_lost,
        stolen_resources: parseMaybeJson(event.battle_stolen_resources),
      };

    case 'ProductionStory':
      return {
        received_resource_type: event.production_resource_type,
        received_amount: event.production_amount,
        cost: parseMaybeJson(event.production_cost),
      };

    case 'BuildingPlacementStory':
      return {
        category: event.building_category,
        inner_coord: buildCoord(event.building_coord_x ?? null, event.building_coord_y ?? null),
        created: event.building_created,
        destroyed: event.building_destroyed,
        paused: event.building_paused,
        unpaused: event.building_unpaused,
      };

    case 'BuildingPaymentStory':
      return {
        category: event.building_payment_category ?? event.building_category,
        inner_coord: buildCoord(event.building_payment_coord_x ?? null, event.building_payment_coord_y ?? null),
        cost: parseMaybeJson(event.building_payment_cost),
      };

    case 'ResourceTransferStory':
      return {
        transfer_type: parseMaybeJson(event.resource_transfer_type),
        from_entity_id: event.resource_transfer_from_entity_id,
        from_entity_owner_address: event.resource_transfer_from_owner_address,
        to_entity_id: event.resource_transfer_to_entity_id,
        to_entity_owner_address: event.resource_transfer_to_owner_address,
        resources: parseMaybeJson(event.resource_transfer_resources),
        is_mint: event.resource_transfer_is_mint,
        travel_time: event.resource_transfer_travel_time,
      };

    case 'ResourceBurnStory':
      return {
        resources: parseMaybeJson(event.resource_burn_resources),
      };

    case 'ResourceReceiveArrivalStory':
      return {
        resources: parseMaybeJson(event.resource_receive_resources),
      };

    case 'GuardAddStory':
      return {
        structure_id: event.guard_add_structure_id,
        slot: parseMaybeJson(event.guard_add_slot),
        category: parseMaybeJson(event.guard_add_category),
        tier: parseMaybeJson(event.guard_add_tier),
        amount: event.guard_add_amount,
      };

    case 'GuardDeleteStory':
      return {
        structure_id: event.guard_delete_structure_id,
        slot: parseMaybeJson(event.guard_delete_slot),
      };

    case 'ExplorerCreateStory':
      return {
        structure_id: event.explorer_create_structure_id,
        explorer_id: event.explorer_create_explorer_id,
        category: parseMaybeJson(event.explorer_create_category),
        tier: parseMaybeJson(event.explorer_create_tier),
        amount: event.explorer_create_amount,
        spawn_direction: parseMaybeJson(event.explorer_create_spawn_direction),
      };

    case 'ExplorerAddStory':
      return {
        explorer_id: event.explorer_add_explorer_id,
        amount: event.explorer_add_amount,
        home_direction: parseMaybeJson(event.explorer_add_home_direction),
      };

    case 'ExplorerDeleteStory':
      return {
        explorer_id: event.explorer_delete_explorer_id,
      };

    case 'ExplorerExplorerSwapStory':
      return {
        from_explorer_id: event.explorer_swap_from_id,
        to_explorer_id: event.explorer_swap_to_id,
        to_explorer_direction: parseMaybeJson(event.explorer_swap_to_direction),
        count: event.explorer_swap_count,
      };

    case 'ExplorerGuardSwapStory':
      return {
        from_explorer_id: event.explorer_guard_swap_from_explorer_id,
        to_structure_id: event.explorer_guard_swap_to_structure_id,
        to_structure_direction: parseMaybeJson(event.explorer_guard_swap_to_structure_direction),
        to_guard_slot: parseMaybeJson(event.explorer_guard_swap_to_guard_slot),
        count: event.explorer_guard_swap_count,
      };

    case 'GuardExplorerSwapStory':
      return {
        from_structure_id: event.guard_explorer_swap_from_structure_id,
        from_guard_slot: parseMaybeJson(event.guard_explorer_swap_from_guard_slot),
        to_explorer_id: event.guard_explorer_swap_to_explorer_id,
        to_explorer_direction: parseMaybeJson(event.guard_explorer_swap_to_explorer_direction),
        count: event.guard_explorer_swap_count,
      };

    case 'PrizeDistributedStory':
      return {
        to_player_address: event.prize_to_player_address,
        amount: event.prize_amount,
        decimals: event.prize_decimals,
      };

    case 'PrizeDistributionFinalStory':
      return {
        trial_id: event.prize_trial_id,
      };

    default:
      // For story types we haven't mapped yet, return empty object
      return {};
  }
}
