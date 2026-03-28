import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — module resolution handled by bundler at runtime
import { MAP_DATA_REFRESH_INTERVAL, MapDataStore, Position } from "@bibliothecadao/eternum";
// @ts-ignore
import { ContractAddress, StructureType } from "@bibliothecadao/types";
// @ts-ignore
import { useDojo, useHyperstructures, useQuery } from "@bibliothecadao/react";

import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGoToStructure, useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { sqlApi } from "@/services/api";
import { AudioManager } from "@/audio/core/AudioManager";

import { type Headline, HEADLINE_DISPLAY_MS, RECENT_HEADLINE_WINDOW_MS } from "./headline-types";
import { NewsHeadlineBanner } from "./news-headline-banner";
import { parseNumeric } from "../story-events/story-event-utils";

/** Fields we access on story events — typed locally to avoid cascading module resolution issues */
interface BattleEvent {
  id: string;
  tx_hash?: string;
  story: string;
  timestampMs: number;
  battle_defender_id?: number;
  battle_attacker_id?: number;
  battle_winner_id?: number;
  battle_defender_owner_address?: string;
  battle_attacker_owner_address?: string;
  explorer_create_structure_id?: unknown;
  explorer_create_tier?: unknown;
}

const parseTroopTier = (value: unknown, usesZeroBasedEncoding: boolean): 1 | 2 | 3 | null => {
  if (value == null) return null;

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 1) {
      return parseTroopTier(entries[0][0], usesZeroBasedEncoding);
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const normalized = trimmed.toUpperCase();
    if (normalized === "T1") return 1;
    if (normalized === "T2") return 2;
    if (normalized === "T3") return 3;

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        return parseTroopTier(JSON.parse(trimmed), usesZeroBasedEncoding);
      } catch {
        return null;
      }
    }
  }

  const numericTier = parseNumeric(value);
  if (numericTier == null) {
    return null;
  }

  if (usesZeroBasedEncoding) {
    if (numericTier === 0) return 1;
    if (numericTier === 1) return 2;
    if (numericTier === 2) return 3;
    return null;
  }

  if (numericTier === 1 || numericTier === 2 || numericTier === 3) {
    return numericTier;
  }

  return null;
};

export function NewsHeadlineBridge() {
  const { setup } = useDojo();
  const { isMapView } = useQuery();
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const gameWinner = useUIStore((state) => state.gameWinner);
  const goToStructure = useGoToStructure(setup);
  const navigateToMapView = useNavigateToMapView();
  const mapDataStore = useMemo(() => MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL, sqlApi), []);

  const { data: storyEventLog = [] } = useStoryEvents(350);
  const hyperstructures = useHyperstructures();

  // Queue state
  const [queue, setQueue] = useState<Headline[]>([]);
  const currentHeadline = queue[0] ?? null;

  // Dedup
  const shownIdsRef = useRef(new Set<string>());

  // Init-skip refs
  const storyInitializedRef = useRef(false);
  const hyperOwnerRef = useRef<Map<number, string>>(new Map());
  const hyperInitializedRef = useRef(false);
  const gameEndFiredRef = useRef(false);
  const troopMilestonesInitializedRef = useRef(false);
  const firstT2ArmyFiredRef = useRef(false);
  const firstT3ArmyFiredRef = useRef(false);

  // Navigation refs
  const navRef = useRef({ goToStructure, navigateToMapView, setSelectedHex, isMapView });
  useEffect(() => {
    navRef.current = { goToStructure, navigateToMapView, setSelectedHex, isMapView };
  }, [goToStructure, navigateToMapView, setSelectedHex, isMapView]);

  // --- Enqueue helper ---
  const enqueue = useCallback((headline: Headline) => {
    if (shownIdsRef.current.has(headline.id)) return;
    shownIdsRef.current.add(headline.id);
    setQueue((prev) => [...prev, headline]);
    try {
      AudioManager.getInstance().play("combat.victory");
    } catch {
      // audio not critical
    }
  }, []);

  // --- Dismiss ---
  const dismiss = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  // --- Auto-dismiss timer ---
  useEffect(() => {
    if (!currentHeadline) return;
    const timer = setTimeout(dismiss, HEADLINE_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [currentHeadline, dismiss]);

  // --- Realm fall + elimination detection ---
  useEffect(() => {
    const now = Date.now();
    // Cast to access battle fields that exist at runtime (StoryEventData) but
    // can't resolve at tsc time due to workspace module resolution.
    const events = storyEventLog as unknown as BattleEvent[];

    if (!storyInitializedRef.current) {
      for (const event of events) {
        const key = `realm-fall:${event.tx_hash ?? event.id}:${event.battle_defender_id}`;
        shownIdsRef.current.add(key);
      }
      storyInitializedRef.current = true;
      return;
    }

    const recentBattles = events.filter(
      (event) => event.story === "BattleStory" && event.timestampMs >= now - RECENT_HEADLINE_WINDOW_MS,
    );

    for (const event of recentBattles) {
      const defenderId = parseNumeric(event.battle_defender_id);
      if (defenderId === null) continue;

      const structure = mapDataStore.getStructureById(defenderId);
      if (!structure || structure.structureType !== StructureType.Realm) continue;

      // Check if attacker won (realm fell)
      const winnerId = parseNumeric(event.battle_winner_id);
      const attackerId = parseNumeric(event.battle_attacker_id);
      if (winnerId === null || attackerId === null || winnerId !== attackerId) continue;

      const realmFallKey = `realm-fall:${event.tx_hash ?? event.id}:${defenderId}`;
      if (shownIdsRef.current.has(realmFallKey)) continue;

      // Resolve names
      const defenderAddr = String(event.battle_defender_owner_address ?? "");
      const attackerAddr = String(event.battle_attacker_owner_address ?? "");
      const realmName = structure.ownerName || structure.structureTypeName || `Realm #${defenderId}`;
      const attackerName = attackerAddr ? mapDataStore.getPlayerName(attackerAddr) || "Unknown" : "Unknown";

      enqueue({
        id: realmFallKey,
        type: "realm-fall",
        title: "REALM FALLEN",
        description: `"${realmName} has fallen to ${attackerName}"`,
        icon: "realm-fall",
        location: { x: structure.coordX, y: structure.coordY, entityId: defenderId },
        timestamp: now,
      });

      // Check for player elimination
      if (defenderAddr) {
        try {
          const ownedStructures = mapDataStore.getStructuresByOwner(defenderAddr);
          const ownedRealms = ownedStructures.filter(
            (s: { structureType: number }) => s.structureType === StructureType.Realm,
          );
          // If 0 or 1 realms left (the fallen one may still be in cache), player may be eliminated
          if (ownedRealms.length <= 1) {
            const defenderName = mapDataStore.getPlayerName(defenderAddr) || realmName;
            const elimKey = `elimination:${defenderAddr}:${now}`;
            enqueue({
              id: elimKey,
              type: "elimination",
              title: "PLAYER ELIMINATED",
              description: `"${defenderName} has been vanquished"`,
              icon: "elimination",
              timestamp: now,
            });
          }
        } catch {
          // structure lookup not critical
        }
      }
    }
  }, [storyEventLog, mapDataStore, enqueue]);

  // --- First T2 / T3 army creation detection ---
  useEffect(() => {
    const now = Date.now();
    const events = storyEventLog as unknown as BattleEvent[];

    const creationEvents = events.filter((event) => event.story === "ExplorerCreateStory");
    const numericTiers = creationEvents
      .map((event) => parseNumeric(event.explorer_create_tier))
      .filter((tier): tier is number => tier !== null);
    const usesZeroBasedTierEncoding = numericTiers.includes(0);

    if (!storyInitializedRef.current) {
      return;
    }

    if (!troopMilestonesInitializedRef.current) {
      firstT2ArmyFiredRef.current = creationEvents.some(
        (event) => parseTroopTier(event.explorer_create_tier, usesZeroBasedTierEncoding) === 2,
      );
      firstT3ArmyFiredRef.current = creationEvents.some(
        (event) => parseTroopTier(event.explorer_create_tier, usesZeroBasedTierEncoding) === 3,
      );
      troopMilestonesInitializedRef.current = true;
      return;
    }

    const recentCreationEvents = creationEvents.filter((event) => event.timestampMs >= now - RECENT_HEADLINE_WINDOW_MS);

    for (const event of recentCreationEvents) {
      const troopTier = parseTroopTier(event.explorer_create_tier, usesZeroBasedTierEncoding);
      const structureId = parseNumeric(event.explorer_create_structure_id);

      if (troopTier !== 2 && troopTier !== 3) {
        continue;
      }

      if (troopTier === 2 && firstT2ArmyFiredRef.current) {
        continue;
      }

      if (troopTier === 3 && firstT3ArmyFiredRef.current) {
        continue;
      }

      const structure = structureId !== null ? mapDataStore.getStructureById(structureId) : null;
      const ownerName = structure?.ownerName || structure?.structureTypeName || "Unknown commander";
      const headlineType = troopTier === 2 ? "first-t2-army" : "first-t3-army";

      enqueue({
        id: `${headlineType}:${event.tx_hash ?? event.id}`,
        type: headlineType,
        title: troopTier === 2 ? "FIRST T2 ARMY BUILT" : "FIRST T3 ARMY BUILT",
        description: `"${ownerName}" fields the first Tier ${troopTier} army`,
        icon: headlineType,
        location:
          structure && structureId !== null
            ? { x: structure.coordX, y: structure.coordY, entityId: structureId }
            : undefined,
        timestamp: now,
      });

      if (troopTier === 2) {
        firstT2ArmyFiredRef.current = true;
      }

      if (troopTier === 3) {
        firstT3ArmyFiredRef.current = true;
      }
    }
  }, [storyEventLog, mapDataStore, enqueue]);

  // --- Hyperstructure capture detection ---
  useEffect(() => {
    if (!hyperInitializedRef.current) {
      // First render: populate ref without firing headlines
      const map = new Map<number, string>();
      for (const h of hyperstructures) {
        map.set(h.entity_id, ContractAddress(h.owner).toString());
      }
      hyperOwnerRef.current = map;
      hyperInitializedRef.current = true;
      return;
    }

    for (const h of hyperstructures) {
      const currentOwner = ContractAddress(h.owner).toString();
      const prevOwner = hyperOwnerRef.current.get(h.entity_id);

      if (prevOwner !== undefined && prevOwner !== currentOwner) {
        const newOwnerName = h.ownerName || mapDataStore.getPlayerName(currentOwner) || "Unknown";
        const oldOwnerName = mapDataStore.getPlayerName(prevOwner) || "Unknown";
        const captureKey = `hyper-capture:${h.entity_id}:${currentOwner}`;

        const position = h.position;
        enqueue({
          id: captureKey,
          type: "hyper-capture",
          title: "HYPERSTRUCTURE SEIZED",
          description: `"${newOwnerName} captures Hyperstructure from ${oldOwnerName}"`,
          icon: "hyper-capture",
          location: position ? { x: position.x, y: position.y, entityId: h.entity_id } : undefined,
          timestamp: Date.now(),
        });
      }

      hyperOwnerRef.current.set(h.entity_id, currentOwner);
    }
  }, [hyperstructures, mapDataStore, enqueue]);

  // --- Game end detection ---
  useEffect(() => {
    if (!gameWinner || gameEndFiredRef.current) return;
    gameEndFiredRef.current = true;

    const winnerName = gameWinner.name || "Unknown";
    enqueue({
      id: `game-end:${gameWinner.address}`,
      type: "game-end",
      title: "THE AGE HAS ENDED",
      description: `"${winnerName} claims victory"`,
      icon: "game-end",
      timestamp: Date.now(),
    });
  }, [gameWinner, enqueue]);

  // --- Navigation handler ---
  const handleNavigate = useCallback(
    async (location: { x: number; y: number; entityId: number }) => {
      const { goToStructure, navigateToMapView, setSelectedHex, isMapView } = navRef.current;
      const position = new Position({ x: location.x, y: location.y });

      const col = Number(location.x);
      const row = Number(location.y);
      if (Number.isFinite(col) && Number.isFinite(row)) {
        const next = { col, row };
        setSelectedHex(next);
        setTimeout(() => setSelectedHex(next), 0);
      }

      try {
        await goToStructure(location.entityId, position, isMapView);
      } catch {
        navigateToMapView(position);
      }

      dismiss();
    },
    [dismiss],
  );

  // --- Prune old IDs ---
  useEffect(() => {
    if (shownIdsRef.current.size > 500) {
      const entries = Array.from(shownIdsRef.current);
      const toRemove = entries.slice(0, entries.length - 200);
      for (const id of toRemove) {
        shownIdsRef.current.delete(id);
      }
    }
  }, [queue]);

  return <NewsHeadlineBanner headline={currentHeadline} onDismiss={dismiss} onNavigate={handleNavigate} />;
}
