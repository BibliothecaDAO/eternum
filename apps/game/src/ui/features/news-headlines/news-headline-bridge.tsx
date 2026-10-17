import { safeInteger, getScopedGameId } from "@bibliothecadao/eternum/game-client";
import { useSeasonWinner } from "@/hooks/store/use-story-events-store";
import { useFactView } from "@/hooks/use-fact-view";
import { seasonClockView } from "@/sync/fact-views";
import { resolveGameEndHeadline } from "./game-end-headline";
import { createBuildingMilestones } from "./building-milestones";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useHeadlineFeedStore } from "./headline-feed-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Position, structureMapPosition } from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { ContractAddress, StructureType } from "@bibliothecadao/types";
import { useGame } from "@/hooks/context/game-context";
import { useQuery } from "@/hooks/helpers/use-query";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGoToStructure, useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { AudioManager } from "@/audio/core/AudioManager";

import { type Headline, HEADLINE_DISPLAY_MS } from "./headline-types";
import { NewsHeadlineBanner } from "./news-headline-banner";
import { usePointsGoal } from "@/ui/features/world/hud/points-goal";
import { buildCaptureHeadline, NEWSWORTHY_CAPTURES } from "./capture-headline";
import { createWorldEventEntityReader } from "../story-events/world-event-entity-reader";
import { getPlayerDisplayName } from "@/hooks/use-player-profile";

export function NewsHeadlineBridge() {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const selectOnMap = useUIStore((state) => state.selectOnMap);
  const winner = useSeasonWinner();
  const endRevision = useNativeRevision(["BlitzResult", "BlitzRoster", "PlayerPoints"]);
  const goToStructure = useGoToStructure(setup);
  const navigateToMapView = useNavigateToMapView();
  const entityReader = useMemo(() => {
    const projection = getActiveGameSyncRuntime()?.getWorldSpatialProjection();
    return projection ? createWorldEventEntityReader(setup.store, projection) : null;
  }, [setup.store]);

  const address = useAccountStore((state) => state.account?.address);
  const startAt = useFactView(seasonClockView).gameStartMainAt;
  const goal = usePointsGoal();
  const nowSeconds = useCurrentBlockTimestamp();
  const wasBeforeStart = useRef(false);

  // Queue state
  const [queue, setQueue] = useState<Headline[]>([]);
  const currentHeadline = queue[0] ?? null;

  // Dedup
  const shownIdsRef = useRef(new Set<string>());

  // Navigation refs
  const navRef = useRef({ goToStructure, navigateToMapView, selectOnMap, isMapView });
  useEffect(() => {
    navRef.current = { goToStructure, navigateToMapView, selectOnMap, isMapView };
  }, [goToStructure, navigateToMapView, selectOnMap, isMapView]);

  // --- Banner, then the feed ---
  const announce = useCallback((headline: Headline) => {
    if (shownIdsRef.current.has(headline.id)) return;
    shownIdsRef.current.add(headline.id);
    setQueue((prev) => [...prev, headline]);
    try {
      AudioManager.getInstance().play("combat.victory");
    } catch {
      // audio not critical
    }
  }, []);
  const enqueue = useCallback(
    (headline: Headline) => {
      announce(headline);
      useHeadlineFeedStore.getState().publish(headline);
    },
    [announce],
  );

  useEffect(() => {
    return () => useHeadlineFeedStore.setState({ headlines: [] });
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

  // Ownership headlines follow the native row transition for realms and hyperstructures. A capture's row in the feed is
  // its story, which history keeps for a player who was away; the headline is only the banner.
  useEffect(() => {
    return setup.store.subscribe((changes) => {
      for (const change of changes) {
        if (change.model !== "Structure") continue;
        const { current, previous } = change;
        if (!current || !previous || current.game_id !== getScopedGameId() || current.owner === previous.owner)
          continue;
        if (!NEWSWORTHY_CAPTURES.has(current.base.category as StructureType)) continue;
        if (!entityReader) continue;
        const structureId = safeInteger(current.entity_id);
        const site = structureMapPosition(setup.store, current);
        announce(
          buildCaptureHeadline({
            structureId,
            isHyperstructure: current.base.category === StructureType.Hyperstructure,
            structureName: entityReader.getStructure(structureId)?.structureName ?? null,
            previousOwner: BigInt(previous.owner),
            newOwner: BigInt(current.owner),
            site,
            viewer: address ? BigInt(address) : null,
            nameOf: (owner) => entityReader.getPlayerName(ContractAddress(owner).toString()),
            at: Date.now(),
          }),
        );
      }
    });
  }, [setup.store, entityReader, address, announce]);

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
      title: "The game has begun",
      description: goal.sentence,
      timestamp: Date.now(),
    });
  }, [startAt, nowSeconds, enqueue, goal.sentence]);

  useEffect(() => {
    const resolveMilestone = createBuildingMilestones([...setup.store.inGame("Building", getScopedGameId())]);
    return setup.store.subscribe((changes) => {
      for (const change of changes) {
        if (change.model !== "Building") continue;
        const { current } = change;
        if (!current || current.game_id !== getScopedGameId()) continue;
        const buildingName = resolveMilestone(current, getActiveGameSyncRuntime()?.getStatus() === "running");
        if (!buildingName) continue;
        const structureId = safeInteger(current.structure_id);
        const structure = entityReader?.getStructure(structureId);
        const realmName = structure?.structureName || "A realm";
        enqueue({
          id: `t3-building:${structureId}`,
          type: "t3-building",
          icon: "t3-building",
          title: "Tier 3 building raised",
          description: `${realmName} has raised a Tier 3 ${buildingName}`,
          location: structure ? { x: structure.coordX, y: structure.coordY, entityId: structureId } : undefined,
          timestamp: Date.now(),
        });
      }
    });
  }, [setup.store, entityReader, enqueue]);

  // --- Game end detection ---
  useEffect(() => {
    const headline = resolveGameEndHeadline(setup.store, getScopedGameId(), winner, getPlayerDisplayName);
    if (headline) enqueue(headline);
  }, [setup.store, winner, endRevision, enqueue]);

  // --- Navigation handler ---
  const handleNavigate = useCallback(
    async (location: { x: number; y: number; entityId: number }) => {
      const { goToStructure, navigateToMapView, selectOnMap, isMapView } = navRef.current;
      const position = Position.fromContract({ x: location.x, y: location.y });

      const col = Number(location.x);
      const row = Number(location.y);
      if (Number.isFinite(col) && Number.isFinite(row)) {
        const next = { col, row };
        selectOnMap({ kind: "hex", hex: next });
        setTimeout(() => selectOnMap({ kind: "hex", hex: next }), 0);
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
