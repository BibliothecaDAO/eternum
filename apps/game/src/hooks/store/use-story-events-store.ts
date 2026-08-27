import { POLLING_INTERVALS } from "@/config/polling";
import { sqlApi } from "@/services/api";
import { buildStoryEventPresentation } from "@bibliothecadao/eternum";
import type { GameSyncEntity } from "@bibliothecadao/eternum/game-sync";
import { useDojo } from "@bibliothecadao/react";
import { StoryEventData } from "@bibliothecadao/torii";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { create } from "zustand";

export interface ProcessedStoryEvent extends StoryEventData {
  id: string;
  timestampMs: number;
  presentation: ReturnType<typeof buildStoryEventPresentation>;
}

interface StreamStoryEvent extends StoryEventData {
  storyPayload: Record<string, unknown>;
  rawStory: unknown;
}

interface StoryEventsState {
  streamed: StreamStoryEvent[];
  accept: (event: StreamStoryEvent) => void;
  reset: () => void;
}

const STREAM_EVENT_LIMIT = 512;

const useStoryEventsStore = create<StoryEventsState>((set) => ({
  streamed: [],
  accept: (event) =>
    set((state) => ({
      streamed: [event, ...state.streamed.filter((existing) => existing.event_id !== event.event_id)].slice(
        0,
        STREAM_EVENT_LIMIT,
      ),
    })),
  reset: () => set({ streamed: [] }),
}));

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const toOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  try {
    const number = Number(BigInt(String(value)));
    return Number.isSafeInteger(number) ? number : null;
  } catch {
    return null;
  }
};

const storyVariant = (story: unknown): { payload: Record<string, unknown>; type: string } | null => {
  if (typeof story === "string") return { payload: {}, type: story };
  const record = asRecord(story);
  const entry = record ? Object.entries(record)[0] : undefined;
  if (!entry) return null;
  return { type: entry[0], payload: asRecord(entry[1]) ?? {} };
};

const legacyHeadlineFields = (type: string, payload: Record<string, unknown>): Record<string, unknown> => {
  if (type === "BattleStory") {
    return Object.fromEntries(Object.entries(payload).map(([key, value]) => [`battle_${key}`, value]));
  }
  if (type === "ExplorerCreateStory") {
    return Object.fromEntries(Object.entries(payload).map(([key, value]) => [`explorer_create_${key}`, value]));
  }
  return {};
};

export const toStreamStoryEvent = (event: GameSyncEntity): StreamStoryEvent | null => {
  const modelEntry = Object.entries(event.models).find(
    ([model]) => model === "StoryEvent" || model.endsWith("-StoryEvent"),
  );
  const value = modelEntry ? asRecord(modelEntry[1]) : null;
  const variant = storyVariant(value?.story);
  if (!value || !variant) return null;

  const timestamp = String(value.timestamp ?? "0x0");
  const transactionHash = String(value.tx_hash ?? "0x0");
  return {
    owner: value.owner === null || value.owner === undefined ? null : String(value.owner),
    entity_id: toOptionalNumber(value.entity_id),
    id: value.id === undefined ? null : String(value.id),
    tx_hash: transactionHash,
    story: variant.type,
    timestamp,
    event_id: `${event.hashed_keys}:${transactionHash}`,
    storyPayload: variant.payload,
    rawStory: value.story,
    ...legacyHeadlineFields(variant.type, variant.payload),
  } as StreamStoryEvent;
};

export const acceptGameSyncStoryEvent = (event: GameSyncEntity): void => {
  const storyEvent = toStreamStoryEvent(event);
  if (storyEvent) useStoryEventsStore.getState().accept(storyEvent);
};

export const resetGameSyncStoryEvents = (): void => useStoryEventsStore.getState().reset();

const processStoryEvent = (
  event: StoryEventData | StreamStoryEvent,
  index: number,
  components: Parameters<typeof buildStoryEventPresentation>[1],
): ProcessedStoryEvent => {
  const timestampMs = Number(BigInt(event.timestamp)) * 1_000;
  const streamEvent = event as Partial<StreamStoryEvent>;
  const storyPayload = streamEvent.storyPayload ?? buildStoryPayloadFromEvent(event);
  const presentation = buildStoryEventPresentation(
    {
      ownerAddress: event.owner,
      ownerName: null,
      entityId: event.entity_id,
      txHash: event.tx_hash,
      timestamp: timestampMs,
      storyType: event.story,
      storyPayload,
      rawStory: streamEvent.rawStory ?? event,
    },
    components,
  );
  const id = event.event_id ?? `${event.tx_hash}-${event.timestamp}-${event.entity_id ?? "unknown"}-${index}`;
  return { ...event, id, timestampMs, presentation };
};

export const useStoryEvents = (limit: number = 100) => {
  const {
    setup: { components },
  } = useDojo();
  const streamed = useStoryEventsStore((state) => state.streamed);

  const query = useQuery({
    queryKey: ["storyEvents", limit],
    queryFn: async (): Promise<StoryEventData[]> => sqlApi.fetchStoryEvents(limit, 0),
    staleTime: POLLING_INTERVALS.storyEventsStaleMs,
  });

  const data = useMemo(() => {
    const identities = new Set<string>();
    return [...streamed, ...(query.data ?? [])]
      .filter((event) => {
        const identity = event.event_id ?? `${event.tx_hash}:${event.timestamp}`;
        if (identities.has(identity)) return false;
        identities.add(identity);
        return true;
      })
      .slice(0, limit)
      .map((event, index) => processStoryEvent(event, index, components));
  }, [components, limit, query.data, streamed]);

  return { ...query, data };
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
    case "RealmCreatedStory":
      return {
        coord: buildCoord(event.realm_coord_x ?? null, event.realm_coord_y ?? null),
      };

    case "StructureLevelUpStory":
      return {
        new_level: event.structure_new_level,
      };

    case "ExplorerMoveStory":
      return {
        explorer_id: event.explorer_id,
        explorer_structure_id: event.explorer_structure_id,
        start_coord: buildCoord(event.start_coord_x ?? null, event.start_coord_y ?? null),
        end_coord: buildCoord(event.end_coord_x ?? null, event.end_coord_y ?? null),
        directions: parseMaybeJson(event.explorer_directions),
        explore: event.explorer_explore,
        explore_find: parseMaybeJson(event.explore_find),
        // reward_resource_type: event.reward_resource_type,
        // reward_resource_amount: event.reward_resource_amount,
      };

    case "ExplorerExtractRewardStory":
      return {
        explorer_id: event.extract_explorer_id,
        explorer_structure_id: event.extract_explorer_structure_id,
        coord: buildCoord(event.extract_coord_x ?? null, event.extract_coord_y ?? null),
        reward_resource_type: event.extract_reward_resource_type,
        reward_resource_amount: event.extract_reward_resource_amount,
      };

    case "BattleStory":
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

    case "ProductionStory":
      return {
        received_resource_type: event.production_resource_type,
        received_amount: event.production_amount,
        cost: parseMaybeJson(event.production_cost),
      };

    case "BuildingPlacementStory":
      return {
        category: event.building_category,
        inner_coord: buildCoord(event.building_coord_x ?? null, event.building_coord_y ?? null),
        created: event.building_created,
        destroyed: event.building_destroyed,
        paused: event.building_paused,
        unpaused: event.building_unpaused,
      };

    case "BuildingPaymentStory":
      return {
        category: event.building_payment_category ?? event.building_category,
        inner_coord: buildCoord(event.building_payment_coord_x ?? null, event.building_payment_coord_y ?? null),
        cost: parseMaybeJson(event.building_payment_cost),
      };

    case "ResourceTransferStory":
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

    case "ResourceBurnStory":
      return {
        resources: parseMaybeJson(event.resource_burn_resources),
      };

    case "ResourceReceiveArrivalStory":
      return {
        resources: parseMaybeJson(event.resource_receive_resources),
      };

    case "GuardAddStory":
      return {
        structure_id: event.guard_add_structure_id,
        slot: parseMaybeJson(event.guard_add_slot),
        category: parseMaybeJson(event.guard_add_category),
        tier: parseMaybeJson(event.guard_add_tier),
        amount: event.guard_add_amount,
      };

    case "GuardDeleteStory":
      return {
        structure_id: event.guard_delete_structure_id,
        slot: parseMaybeJson(event.guard_delete_slot),
      };

    case "ExplorerCreateStory":
      return {
        structure_id: event.explorer_create_structure_id,
        explorer_id: event.explorer_create_explorer_id,
        category: parseMaybeJson(event.explorer_create_category),
        tier: parseMaybeJson(event.explorer_create_tier),
        amount: event.explorer_create_amount,
        spawn_direction: parseMaybeJson(event.explorer_create_spawn_direction),
      };

    case "ExplorerAddStory":
      return {
        explorer_id: event.explorer_add_explorer_id,
        amount: event.explorer_add_amount,
        home_direction: parseMaybeJson(event.explorer_add_home_direction),
      };

    case "ExplorerDeleteStory":
      return {
        explorer_id: event.explorer_delete_explorer_id,
      };

    case "ExplorerExplorerSwapStory":
      return {
        from_explorer_id: event.explorer_swap_from_id,
        to_explorer_id: event.explorer_swap_to_id,
        to_explorer_direction: parseMaybeJson(event.explorer_swap_to_direction),
        count: event.explorer_swap_count,
      };

    case "ExplorerGuardSwapStory":
      return {
        from_explorer_id: event.explorer_guard_swap_from_explorer_id,
        to_structure_id: event.explorer_guard_swap_to_structure_id,
        to_structure_direction: parseMaybeJson(event.explorer_guard_swap_to_structure_direction),
        to_guard_slot: parseMaybeJson(event.explorer_guard_swap_to_guard_slot),
        count: event.explorer_guard_swap_count,
      };

    case "GuardExplorerSwapStory":
      return {
        from_structure_id: event.guard_explorer_swap_from_structure_id,
        from_guard_slot: parseMaybeJson(event.guard_explorer_swap_from_guard_slot),
        to_explorer_id: event.guard_explorer_swap_to_explorer_id,
        to_explorer_direction: parseMaybeJson(event.guard_explorer_swap_to_explorer_direction),
        count: event.guard_explorer_swap_count,
      };

    case "PrizeDistributedStory":
      return {
        to_player_address: event.prize_to_player_address,
        amount: event.prize_amount,
        decimals: event.prize_decimals,
      };

    case "PrizeDistributionFinalStory":
      return {
        trial_id: event.prize_trial_id,
      };

    default:
      // For story types we haven't mapped yet, return empty object
      return {};
  }
}
