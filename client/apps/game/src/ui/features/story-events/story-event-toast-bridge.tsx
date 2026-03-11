import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { MAP_DATA_REFRESH_INTERVAL, MapDataStore, Position } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { useDojo, useQuery } from "@bibliothecadao/react";

import { useGoToStructure, useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { type ProcessedStoryEvent, useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";

import { BattleToast } from "./battle-toast";
import {
  type BattleLocation,
  extractRoleLabel,
  findSegmentValue,
  formatPlayerLabel,
  formatTroopSummary,
  normalizePresentationTroops,
  parseNumeric,
  parsePresentationDescription,
  shortenAddress,
} from "./story-event-utils";

/** How far back (ms) from now to consider events as "recent" for toasting. */
const RECENT_WINDOW_MS = 20_000;

const getStoryEventToastKey = (event: ProcessedStoryEvent): string => {
  if (event.story !== "BattleStory") {
    return event.tx_hash ?? event.id;
  }

  const attackerId = parseNumeric(event.battle_attacker_id);
  const defenderId = parseNumeric(event.battle_defender_id);
  const winnerId = parseNumeric(event.battle_winner_id);

  return [
    "battle",
    event.tx_hash ?? "",
    event.timestamp ?? "",
    attackerId ?? "na",
    defenderId ?? "na",
    winnerId ?? "na",
  ].join(":");
};

const getBattleLocationPriority = (location: BattleLocation | null, locationLabel: string): number => {
  if (!location) return 0;
  if (locationLabel === "Hex") return 3;
  if (location.type === "structure") return 2;
  return 1;
};

export function StoryEventToastBridge() {
  const { setup } = useDojo();
  const { isMapView } = useQuery();
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const goToStructure = useGoToStructure(setup);
  const navigateToMapView = useNavigateToMapView();
  const mapDataStore = useMemo(() => MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL, sqlApi), []);

  const { data: storyEventLog = [] } = useStoryEvents(350);

  // Track which event keys we've already shown as toasts
  const shownIdsRef = useRef(new Set<string>());
  // Track initial load so we don't toast all existing events on mount
  const initializedRef = useRef(false);

  // Keep navigation helpers in refs so the toast callback always uses the latest values
  const navRef = useRef({ goToStructure, navigateToMapView, setSelectedHex, isMapView });
  useEffect(() => {
    navRef.current = { goToStructure, navigateToMapView, setSelectedHex, isMapView };
  }, [goToStructure, navigateToMapView, setSelectedHex, isMapView]);

  const resolveParticipantLabel = useCallback(
    (entityValue: unknown, ownerValue: unknown): string => {
      const resolveOwnerAddress = (value: unknown): string | undefined => {
        if (typeof value === "string" && value.startsWith("0x")) return value;
        return undefined;
      };

      const ownerAddress = resolveOwnerAddress(ownerValue) ?? resolveOwnerAddress(entityValue);
      if (ownerAddress) {
        try {
          const name = mapDataStore.getPlayerName(ownerAddress);
          if (name) return name;
        } catch {
          // fall through
        }
      }

      const entityId = parseNumeric(entityValue);
      if (entityId !== null) {
        const structure = mapDataStore.getStructureById(entityId);
        if (structure) return structure.ownerName || structure.structureTypeName || `Entity ${entityId}`;
        const army = mapDataStore.getArmyById(entityId);
        if (army) return army.ownerName || `Army ${entityId}`;
      }

      if (ownerAddress) return shortenAddress(ownerAddress);
      return formatPlayerLabel(ownerValue ?? entityValue);
    },
    [mapDataStore],
  );

  const getBattleLocation = useCallback(
    (event: ProcessedStoryEvent): BattleLocation | null => {
      const candidateIds: number[] = [];
      const addCandidate = (value: unknown) => {
        if (value === null || value === undefined) return;
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return;
        if (!candidateIds.includes(numeric)) candidateIds.push(numeric);
      };

      addCandidate(event.entity_id);
      addCandidate(event.battle_attacker_id);
      addCandidate(event.battle_defender_id);
      addCandidate(event.battle_winner_id);

      for (const candidate of candidateIds) {
        const structure = mapDataStore.getStructureById(candidate);
        if (structure) {
          return { entityId: candidate, coordX: structure.coordX, coordY: structure.coordY, type: "structure" };
        }
        const army = mapDataStore.getArmyById(candidate);
        if (army) {
          return { entityId: candidate, coordX: army.coordX, coordY: army.coordY, type: "army" };
        }
      }

      return null;
    },
    [mapDataStore],
  );

  const getLocationLabel = useCallback(
    (location: BattleLocation | null): string => {
      if (!location) return "Hex";
      if (location.type === "army") return "Hex";
      const structure = mapDataStore.getStructureById(location.entityId);
      if (!structure) return "Hex";

      switch (structure.structureType) {
        case StructureType.Realm:
          return "Realm";
        case StructureType.Hyperstructure:
          return "Hyperstructure";
        case StructureType.Village:
          return "Camp";
        case StructureType.FragmentMine:
          return "Rift";
        case StructureType.Bank:
          return "Bank";
        default:
          break;
      }

      if (structure.realmId && structure.realmId !== 0) return "Realm";

      const typeName = structure.structureTypeName?.toLowerCase?.() ?? "";
      if (typeName.includes("hyper")) return "Hyperstructure";
      if (typeName.includes("realm")) return "Realm";
      if (typeName.includes("camp")) return "Camp";
      if (typeName.includes("essence") || typeName.includes("shrine") || typeName.includes("rift")) return "Rift";
      return "Hex";
    },
    [mapDataStore],
  );

  const handleNavigate = useCallback(async (location: BattleLocation) => {
    const { goToStructure, navigateToMapView, setSelectedHex, isMapView } = navRef.current;
    const position = new Position({ x: location.coordX, y: location.coordY });

    const col = Number(location.coordX);
    const row = Number(location.coordY);
    if (Number.isFinite(col) && Number.isFinite(row)) {
      const next = { col, row };
      setSelectedHex(next);
      setTimeout(() => setSelectedHex(next), 0);
    }

    try {
      if (location.type === "structure") {
        await goToStructure(location.entityId, position, isMapView);
      } else {
        navigateToMapView(position);
      }
    } catch (error) {
      console.error("[BattleToast] Failed to navigate to battle location", error);
    }
  }, []);

  // When storyEventLog updates, show toasts for new battle events
  useEffect(() => {
    const now = Date.now();

    if (!initializedRef.current) {
      // On first load, mark all current events as "seen" so we don't spam toasts
      for (const event of storyEventLog) {
        const key = getStoryEventToastKey(event);
        if (key) shownIdsRef.current.add(key);
      }
      initializedRef.current = true;
      return;
    }

    // Find new battle events within the recent window
    const recentBattles = storyEventLog.filter(
      (event) =>
        event.story === "BattleStory" &&
        event.timestampMs >= now - RECENT_WINDOW_MS &&
        !shownIdsRef.current.has(getStoryEventToastKey(event)),
    );

    const dedupedBattles = new Map<
      string,
      {
        event: ProcessedStoryEvent;
        location: BattleLocation | null;
        locationLabel: string;
        priority: number;
      }
    >();

    for (const event of recentBattles) {
      const key = getStoryEventToastKey(event);
      if (key) shownIdsRef.current.add(key);

      const location = getBattleLocation(event);
      const locationLabel = getLocationLabel(location);
      const priority = getBattleLocationPriority(location, locationLabel);
      const existing = dedupedBattles.get(key);
      if (!existing || priority > existing.priority) {
        dedupedBattles.set(key, { event, location, locationLabel, priority });
      }
    }

    for (const { event, location, locationLabel } of dedupedBattles.values()) {
      const description = event.presentation?.description;
      const descriptionSegments = parsePresentationDescription(description);

      const attackerForces = findSegmentValue(descriptionSegments, (label) => label === "Attacker forces");
      const defenderForces = findSegmentValue(descriptionSegments, (label) => label === "Defender forces");
      const winnerLabel = findSegmentValue(descriptionSegments, (label) => label === "Winner");

      const attackerLabel =
        extractRoleLabel(description, "Attacker") ??
        resolveParticipantLabel(event.battle_attacker_id, event.battle_attacker_owner_address);
      const defenderLabel =
        extractRoleLabel(description, "Defender") ??
        resolveParticipantLabel(event.battle_defender_id, event.battle_defender_owner_address);

      const attackerTroops =
        normalizePresentationTroops(attackerForces) ??
        formatTroopSummary(
          event.battle_attacker_troops_before,
          event.battle_attacker_troops_type,
          event.battle_attacker_troops_tier,
        );
      const defenderTroops =
        normalizePresentationTroops(defenderForces) ??
        formatTroopSummary(
          event.battle_defender_troops_before,
          event.battle_defender_troops_type,
          event.battle_defender_troops_tier,
        );

      toast.custom(
        (id) => (
          <BattleToast
            toastId={id}
            icon={event.presentation?.icon ?? "battle"}
            attackerLabel={attackerLabel}
            defenderLabel={defenderLabel}
            attackerTroops={attackerTroops}
            defenderTroops={defenderTroops}
            winnerLabel={winnerLabel}
            location={location}
            locationLabel={locationLabel}
            onNavigate={handleNavigate}
          />
        ),
        { duration: 12000 },
      );
    }

    // Prune old IDs to prevent unbounded memory growth
    if (shownIdsRef.current.size > 500) {
      const currentIds = new Set(storyEventLog.map((event) => getStoryEventToastKey(event)));
      for (const id of shownIdsRef.current) {
        if (!currentIds.has(id)) shownIdsRef.current.delete(id);
      }
    }
  }, [storyEventLog, resolveParticipantLabel, getBattleLocation, getLocationLabel, handleNavigate]);

  return null;
}
