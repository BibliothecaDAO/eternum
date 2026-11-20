import { safeInteger, getScopedGameId } from "@bibliothecadao/eternum/game-client";
import { useFactView } from "@/hooks/use-fact-view";
import { seasonClockView } from "@/sync/fact-views";
import { createBuildingMilestones } from "./building-milestones";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useHeadlineFeedStore } from "./headline-feed-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { structureMapPosition } from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { StructureType } from "@bibliothecadao/types";
import { useGame } from "@/hooks/context/game-context";

import { AudioManager } from "@/audio/core/AudioManager";

import { type Headline, HEADLINE_DISPLAY_MS } from "./headline-types";
import { NewsHeadlineBanner } from "./news-headline-banner";
import { buildCaptureHeadline, NEWSWORTHY_CAPTURES } from "./capture-headline";
import { createWorldEventEntityReader } from "../story-events/world-event-entity-reader";
import { usePlayerNames } from "@/hooks/use-player-profile";

export function NewsHeadlineBridge() {
  const { setup } = useGame();
  const names = usePlayerNames();
  const entityReader = useMemo(() => {
    const projection = getActiveGameSyncRuntime()?.getWorldSpatialProjection();
    return projection ? createWorldEventEntityReader(setup.store, projection, names.text) : null;
  }, [setup.store, names]);

  const address = useAccountStore((state) => state.account?.address);
  const startAt = useFactView(seasonClockView).gameStartMainAt;
  const nowSeconds = useCurrentBlockTimestamp();
  const wasBeforeStart = useRef(false);

  // Queue state
  const [queue, setQueue] = useState<Headline[]>([]);
  const currentHeadline = queue[0] ?? null;

  // Dedup
  const shownIdsRef = useRef(new Set<string>());

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

  // Each headline shows for its time, then gives way to the next: the only way it leaves.
  useEffect(() => {
    if (!currentHeadline) return;
    const timer = setTimeout(() => setQueue((prev) => prev.slice(1)), HEADLINE_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [currentHeadline]);

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
    enqueue(gameStartHeadline(startAt));
  }, [startAt, nowSeconds, enqueue]);

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
          description: [`${realmName} has raised a Tier 3 ${buildingName}`],
          location: structure ? { x: structure.coordX, y: structure.coordY, entityId: structureId } : undefined,
          timestamp: Date.now(),
        });
      }
    });
  }, [setup.store, entityReader, enqueue]);

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

  return <NewsHeadlineBanner headline={currentHeadline} />;
}

export const gameStartHeadline = (startAt: number): Headline => ({
  id: `game-start:${startAt}`,
  type: "game-start",
  icon: "game-start",
  title: "The game has begun",
  description: [],
  timestamp: Date.now(),
});
