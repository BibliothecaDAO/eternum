import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { MAP_DATA_REFRESH_INTERVAL, MapDataStore, StructureType } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";

import { type ProcessedStoryEvent, useStoryEvents } from "@/hooks/store/use-story-events-store";
import { sqlApi } from "@/services/api";

import { BigEventToast } from "./big-event-toast";
import { shortenAddress } from "./story-event-utils";

/** How far back (ms) from now to consider events as "recent" for big event notifications. */
const BIG_EVENT_WINDOW_MS = 30_000;

export function BigEventNotificationSystem() {
  const { setup } = useDojo();
  const mapDataStore = useMemo(() => MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL, sqlApi), []);

  const { data: storyEventLog = [] } = useStoryEvents(100);

  // Track which event IDs we've already shown as big event notifications
  const shownBigEventsRef = useRef(new Set<string>());
  // Track initial load so we don't toast all existing events on mount
  const initializedRef = useRef(false);

  const getPlayerDisplayName = useCallback(
    (ownerAddress: unknown): string => {
      if (typeof ownerAddress === "string" && ownerAddress.startsWith("0x")) {
        try {
          const name = mapDataStore.getPlayerName(ownerAddress);
          if (name) return name;
        } catch {
          // fall through
        }
        return shortenAddress(ownerAddress) || "Unknown Player";
      }
      return "Unknown Player";
    },
    [mapDataStore]
  );

  const isBigEvent = useCallback((event: ProcessedStoryEvent): boolean => {
    if (event.story === "BattleStory") {
      // For now, detect major battles based on significant troop losses
      // indicating potential realm/structure captures
      const attackerTroopsBefore = parseInt(event.battle_attacker_troops_before || "0");
      const defenderTroopsBefore = parseInt(event.battle_defender_troops_before || "0");
      const attackerTroopsLost = parseInt(event.battle_attacker_troops_lost || "0");
      const defenderTroopsLost = parseInt(event.battle_defender_troops_lost || "0");
      
      // Consider it a big event if:
      // 1. Large scale battle (both sides had significant forces)
      // 2. Complete defeat (one side lost all troops)
      const isMajorBattle = (attackerTroopsBefore + defenderTroopsBefore) >= 100;
      const isCompleteDefeat = defenderTroopsLost === defenderTroopsBefore && defenderTroopsBefore > 10;
      
      return isMajorBattle || isCompleteDefeat;
    }
    
    if (event.story === "RealmCreatedStory") {
      // New realm settlements are notable events
      return true;
    }
    
    // TODO: Add hyperstructure completion events when they are tracked in story events
    // TODO: Add player elimination detection
    
    return false;
  }, []);

  const createBigEventNotification = useCallback((event: ProcessedStoryEvent) => {
    if (event.story === "BattleStory") {
      const attackerName = getPlayerDisplayName(event.battle_attacker_owner_address);
      const defenderName = getPlayerDisplayName(event.battle_defender_owner_address);
      const attackerTroopsBefore = parseInt(event.battle_attacker_troops_before || "0");
      const defenderTroopsBefore = parseInt(event.battle_defender_troops_before || "0");
      const defenderTroopsLost = parseInt(event.battle_defender_troops_lost || "0");
      
      let title = "";
      let description = "";
      let type: "hyperstructure" | "capture" | "elimination" = "capture";

      // Check if it's a complete defeat (potential structure capture)
      const isCompleteDefeat = defenderTroopsLost === defenderTroopsBefore && defenderTroopsBefore > 10;
      const isMajorBattle = (attackerTroopsBefore + defenderTroopsBefore) >= 100;

      if (isCompleteDefeat) {
        title = "MAJOR VICTORY!";
        description = `${attackerName} has achieved a decisive victory against ${defenderName}, potentially capturing their position!`;
        type = "capture";
      } else if (isMajorBattle) {
        title = "EPIC BATTLE!";
        description = `A massive clash between ${attackerName} and ${defenderName} with over ${attackerTroopsBefore + defenderTroopsBefore} troops involved!`;
        type = "capture";
      } else {
        title = "SIGNIFICANT BATTLE!";
        description = `${attackerName} and ${defenderName} engaged in major combat!`;
        type = "capture";
      }

      toast.custom(
        (id) => (
          <BigEventToast
            toastId={id}
            title={title}
            description={description}
            type={type}
            playerName={attackerName}
          />
        ),
        { 
          duration: 15000, // Show for 15 seconds (longer than regular battle toasts)
          position: "top-center", // Make it more prominent
        }
      );
    } else if (event.story === "RealmCreatedStory") {
      const ownerName = getPlayerDisplayName(event.owner);
      
      toast.custom(
        (id) => (
          <BigEventToast
            toastId={id}
            title="NEW REALM FOUNDED!"
            description={`${ownerName} has established a new realm on the map!`}
            type="hyperstructure"
            playerName={ownerName}
          />
        ),
        { 
          duration: 12000,
          position: "top-center",
        }
      );
    }
  }, [getPlayerDisplayName]);

  // Monitor story events for big events
  useEffect(() => {
    const now = Date.now();

    if (!initializedRef.current) {
      // On first load, mark all current events as "seen" so we don't spam notifications
      for (const event of storyEventLog) {
        const key = event.tx_hash ?? event.id;
        if (key) shownBigEventsRef.current.add(key);
      }
      initializedRef.current = true;
      return;
    }

    // Find new big events within the recent window
    const recentBigEvents = storyEventLog.filter(
      (event) =>
        isBigEvent(event) &&
        event.timestampMs >= now - BIG_EVENT_WINDOW_MS &&
        !shownBigEventsRef.current.has(event.tx_hash ?? event.id)
    );

    for (const event of recentBigEvents) {
      const key = event.tx_hash ?? event.id;
      if (key) {
        shownBigEventsRef.current.add(key);
        createBigEventNotification(event);
      }
    }

    // Prune old IDs to prevent unbounded memory growth
    if (shownBigEventsRef.current.size > 200) {
      const currentIds = new Set(storyEventLog.map((e) => e.tx_hash ?? e.id));
      for (const id of shownBigEventsRef.current) {
        if (!currentIds.has(id)) shownBigEventsRef.current.delete(id);
      }
    }
  }, [storyEventLog, isBigEvent, createBigEventNotification]);

  return null; // This is a background system component
}