import { activeGameRows } from "@/sync/recs-rows";
import { getScopedGameId } from "@/sync/game-scope";
import { createBuildingMilestones } from "./building-milestones";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useHeadlineFeedStore } from "./headline-feed-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — module resolution handled by bundler at runtime
import { Position } from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
// @ts-ignore
import { ContractAddress, StructureType } from "@bibliothecadao/types";
// @ts-ignore
import { useDojo, useQuery } from "@bibliothecadao/react";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGoToStructure, useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { AudioManager } from "@/audio/core/AudioManager";

import { type Headline, HEADLINE_DISPLAY_MS } from "./headline-types";
import { NewsHeadlineBanner } from "./news-headline-banner";
import { createWorldEventEntityReader } from "../story-events/world-event-entity-reader";

const NEWSWORTHY_CAPTURES = new Set<StructureType>([StructureType.Realm, StructureType.Hyperstructure]);

const resolveCaptureTitle = (isHyperstructure: boolean, playerTook: boolean, playerLost: boolean) => {
  if (isHyperstructure) return "HYPERSTRUCTURE SEIZED";
  if (playerTook) return "REALM CAPTURED";
  if (playerLost) return "REALM LOST";
  return "REALM FALLS";
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

  // Ownership headlines follow the same RECS row transition for realms and hyperstructures. Rifts and camps
  // change hands too often to be news.
  useEffect(() => {
    const subscription = setup.components.Structure.update$.subscribe(({ value: [current, previous] }) => {
      if (!current || !previous || current.owner === previous.owner) return;
      if (!NEWSWORTHY_CAPTURES.has(current.base.category as StructureType)) return;
      if (!entityReader) return;
      const isHyperstructure = current.base.category === StructureType.Hyperstructure;
      const player = address ? BigInt(address) : null;
      const structureName = entityReader.getStructure(current.entity_id)?.structureName ?? `#${current.entity_id}`;
      const captor = entityReader.getPlayerName(ContractAddress(current.owner).toString());
      const previousOwner = entityReader.getPlayerName(ContractAddress(previous.owner).toString());
      enqueue({
        id: `capture:${current.entity_id}:${previous.owner}:${current.owner}:${Date.now()}`,
        type: isHyperstructure ? "hyper-capture" : "realm-fall",
        icon: isHyperstructure ? "hyper-capture" : "realm-fall",
        title: resolveCaptureTitle(isHyperstructure, current.owner === player, previous.owner === player),
        description: `${captor} took ${structureName} from ${previousOwner}`,
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

  useEffect(() => {
    const resolveMilestone = createBuildingMilestones(activeGameRows(setup.components.Building));
    const subscription = setup.components.Building.update$.subscribe(({ value: [current] }) => {
      if (!current || current.game_id !== getScopedGameId()) return;
      const buildingName = resolveMilestone(current, getActiveGameSyncRuntime()?.getStatus() === "running");
      if (!buildingName) return;
      const structureId = current.outer_entity_id;
      const structure = entityReader?.getStructure(structureId);
      const realmName = structure?.structureName || `Realm #${structureId}`;
      enqueue({
        id: `t3-building:${structureId}`,
        type: "t3-building",
        icon: "t3-building",
        title: "TIER 3 BUILDING RAISED",
        description: `${realmName} has raised a Tier 3 ${buildingName}`,
        location: structure ? { x: structure.coordX, y: structure.coordY, entityId: structureId } : undefined,
        timestamp: Date.now(),
      });
    });
    return () => subscription.unsubscribe();
  }, [setup.components, entityReader, enqueue]);

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
