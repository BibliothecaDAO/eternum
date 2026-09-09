import { useAccountStore } from "@/hooks/store/use-account-store";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useHeadlineFeedStore } from "./headline-feed-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — module resolution handled by bundler at runtime
import { Position } from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
// @ts-ignore
import { StructureType } from "@bibliothecadao/types";
// @ts-ignore
import { useDojo, useQuery } from "@bibliothecadao/react";

import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGoToStructure, useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { AudioManager } from "@/audio/core/AudioManager";

import { type Headline, HEADLINE_DISPLAY_MS, RECENT_HEADLINE_WINDOW_MS } from "./headline-types";
import { NewsHeadlineBanner } from "./news-headline-banner";
import { parseNumeric } from "../story-events/story-event-utils";
import { createWorldEventEntityReader } from "../story-events/world-event-entity-reader";

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
  const entityReader = useMemo(() => {
    const projection = getActiveGameSyncRuntime()?.getWorldSpatialProjection();
    return projection ? createWorldEventEntityReader(setup.components, projection) : null;
  }, [setup.components]);

  const { data: storyEventLog = [] } = useStoryEvents(350);
  const address = useAccountStore((state) => state.account?.address);
  const startAt = useUIStore((state) => state.gameStartMainAt);
  const nowSeconds = useCurrentBlockTimestamp();
  const wasBeforeStart = useRef(false);

  // Queue state
  const [queue, setQueue] = useState<Headline[]>([]);
  const currentHeadline = queue[0] ?? null;

  // Dedup
  const shownIdsRef = useRef(new Set<string>());

  // Init-skip refs
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
    useHeadlineFeedStore.getState().publish(headline);
    try {
      AudioManager.getInstance().play("combat.victory");
    } catch {
      // audio not critical
    }
  }, []);

  useEffect(() => () => useHeadlineFeedStore.setState({ headlines: [] }), []);

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

  // Ownership headlines follow the same RECS row transition for every kind of structure.
  useEffect(() => {
    const subscription = setup.components.Structure.update$.subscribe(({ value: [current, previous] }) => {
      if (!current || !previous || current.owner === previous.owner) return;
      const isHyperstructure = current.base.category === StructureType.Hyperstructure;
      const player = address ? BigInt(address) : null;
      if (!isHyperstructure && current.owner !== player && previous.owner !== player) return;
      const structure = entityReader?.getStructure(current.entity_id);
      const title = isHyperstructure
        ? "HYPERSTRUCTURE SEIZED"
        : current.owner === player
          ? "STRUCTURE CAPTURED"
          : "STRUCTURE LOST";
      enqueue({
        id: `capture:${current.entity_id}:${previous.owner}:${current.owner}:${Date.now()}`,
        type: isHyperstructure ? "hyper-capture" : "realm-fall",
        icon: isHyperstructure ? "hyper-capture" : "realm-fall",
        title,
        description: `${structure?.structureName || `Structure #${current.entity_id}`} changes hands`,
        location: { x: current.base.coord_x, y: current.base.coord_y, entityId: current.entity_id },
        timestamp: Date.now(),
      });
    });
    return () => subscription.unsubscribe();
  }, [setup.components, entityReader, address, enqueue]);

  useEffect(() => {
    if (!startAt) return;
    if (nowSeconds < startAt) {
      wasBeforeStart.current = true;
      return;
    }
    if (!wasBeforeStart.current) return;
    wasBeforeStart.current = false;
    enqueue({
      id: `game-start:${startAt}`,
      type: "game-start",
      icon: "game-start",
      title: "THE GAME HAS BEGUN",
      description: "The world is open. Let the campaign begin.",
      timestamp: Date.now(),
    });
  }, [startAt, nowSeconds, enqueue]);

  // --- First T2 / T3 army creation detection ---
  useEffect(() => {
    const now = Date.now();
    const events = storyEventLog as unknown as BattleEvent[];

    const creationEvents = events.filter((event) => event.story === "ExplorerCreateStory");
    const numericTiers = creationEvents
      .map((event) => parseNumeric(event.explorer_create_tier))
      .filter((tier): tier is number => tier !== null);
    const usesZeroBasedTierEncoding = numericTiers.includes(0);

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

      const structure = structureId !== null ? entityReader?.getStructure(structureId) : null;
      const ownerName = structure?.ownerName || structure?.structureName || "Unknown commander";
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
  }, [storyEventLog, entityReader, enqueue]);

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
