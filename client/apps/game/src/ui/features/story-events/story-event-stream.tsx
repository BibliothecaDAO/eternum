import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Castle,
  Coins,
  Factory,
  Hammer,
  Navigation,
  ScrollText,
  Shield,
  Swords,
  Trophy,
} from "lucide-react";
import { type ComponentType, useCallback, useEffect, useMemo, useState } from "react";

import { useGoToStructure, useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { type ProcessedStoryEvent, useStoryEvents } from "@/hooks/store/use-story-events-store";
import type { StoryEventIcon } from "@bibliothecadao/eternum";
import { MAP_DATA_REFRESH_INTERVAL, MapDataStore, Position } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { useDojo, useQuery } from "@bibliothecadao/react";

const STORY_EVENT_THEMES: Record<
  StoryEventIcon,
  { accent: string; highlight: string; icon: ComponentType<{ className?: string }> }
> = {
  realm: {
    accent: "from-fuchsia-500/80 via-fuchsia-400/30 to-transparent",
    highlight: "text-fuchsia-200",
    icon: Castle,
  },
  building: { accent: "from-sky-400/80 via-sky-300/25 to-transparent", highlight: "text-sky-200", icon: Hammer },
  production: {
    accent: "from-emerald-500/80 via-emerald-300/25 to-transparent",
    highlight: "text-emerald-200",
    icon: Factory,
  },
  battle: { accent: "from-rose-500/80 via-amber-300/25 to-transparent", highlight: "text-rose-200", icon: Swords },
  resource: { accent: "from-amber-500/80 via-amber-300/25 to-transparent", highlight: "text-amber-200", icon: Coins },
  troop: { accent: "from-indigo-500/80 via-indigo-300/25 to-transparent", highlight: "text-indigo-200", icon: Shield },
  prize: { accent: "from-yellow-400/80 via-yellow-200/25 to-transparent", highlight: "text-yellow-200", icon: Trophy },
  travel: { accent: "from-teal-500/80 via-cyan-300/25 to-transparent", highlight: "text-teal-200", icon: Navigation },
  alert: { accent: "from-red-500/80 via-rose-300/25 to-transparent", highlight: "text-red-200", icon: AlertTriangle },
  scroll: {
    accent: "from-slate-500/80 via-slate-300/25 to-transparent",
    highlight: "text-slate-200",
    icon: ScrollText,
  },
};

interface BattleLocation {
  entityId: number;
  coordX: number;
  coordY: number;
  type: "structure" | "army";
}

const formatEnum = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value.toString();
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 1) return keys[0];
  }
  return undefined;
};

const parseNumeric = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : null;
  }
  if (typeof value === "string") {
    try {
      const parsed = value.startsWith("0x") ? Number(BigInt(value)) : Number(value);
      return Number.isNaN(parsed) ? null : parsed;
    } catch (error) {
      return null;
    }
  }
  return null;
};

const formatCount = (value: number | null): string | undefined => {
  if (value === null || !Number.isFinite(value)) return undefined;
  const absValue = Math.abs(value);
  if (absValue < 1000) {
    return value.toLocaleString();
  }
  const units = ["", "K", "M", "B"];
  let scaled = value;
  let unitIndex = 0;
  while (Math.abs(scaled) >= 1000 && unitIndex < units.length - 1) {
    scaled /= 1000;
    unitIndex++;
  }
  const decimals = Math.abs(scaled) >= 100 ? 0 : 1;
  return `${scaled.toFixed(decimals)}${units[unitIndex]}`;
};

const formatTroopSummary = (countValue: unknown, typeValue: unknown, tierValue: unknown): string => {
  const count = formatCount(parseNumeric(countValue));
  const typeLabel = formatEnum(typeValue) ?? "Forces";
  const tierNumeric = parseNumeric(tierValue);
  const tierLabel = tierNumeric !== null ? `T${tierNumeric}` : formatEnum(tierValue);
  const parts = [count, tierLabel, typeLabel].filter(Boolean);
  return parts.length ? parts.join(" ") : "Unknown forces";
};

const shortenAddress = (value: unknown): string => {
  if (!value) return "Unknown";
  const raw = String(value);
  if (!raw.startsWith("0x") || raw.length <= 10) return raw;
  return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
};

const formatPlayerLabel = (value: unknown): string => {
  if (!value) return "Unknown";
  if (typeof value === "string" && value.startsWith("0x")) {
    return shortenAddress(value);
  }
  const numeric = parseNumeric(value);
  if (numeric !== null) {
    return `Player ${numeric}`;
  }
  return String(value);
};

const extractRoleLabel = (description: string | undefined, role: "Attacker" | "Defender"): string | undefined => {
  if (!description) return undefined;
  const pattern = new RegExp(`${role}\\s*\\[(.*?)\\]`);
  const match = description.match(pattern);
  return match?.[1];
};

interface StoryDescriptionSegment {
  label?: string;
  value: string;
}

const parsePresentationDescription = (description?: string): StoryDescriptionSegment[] => {
  if (!description) return [];
  return description
    .split(" · ")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const separatorIndex = segment.indexOf(":");
      if (separatorIndex > 0 && separatorIndex < segment.length - 1) {
        const label = segment.slice(0, separatorIndex).trim();
        const value = segment.slice(separatorIndex + 1).trim();
        return { label, value };
      }
      return { value: segment };
    });
};

const findSegmentValue = (
  segments: StoryDescriptionSegment[],
  matcher: (label?: string) => boolean,
): string | undefined => {
  return segments.find((segment) => matcher(segment.label))?.value;
};

const normalizePresentationTroops = (value?: string): string | undefined => {
  if (!value) return undefined;
  const match = value.match(/^(?<type>.+?)\s*\[\s*(?<count>.+?)\s*\]$/);
  if (match?.groups?.type && match.groups.count) {
    const type = match.groups.type.trim();
    const count = match.groups.count.trim();
    if (count && type) {
      return `${count} ${type}`;
    }
  }
  return undefined;
};

export function StoryEventStream() {
  const { data: storyEventLog = [] } = useStoryEvents(350);
  const { setup } = useDojo();
  const { isMapView } = useQuery();
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const goToStructure = useGoToStructure(setup);
  const navigateToMapView = useNavigateToMapView();
  const mapDataStore = useMemo(() => MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL, sqlApi), []);
  const [mapDataVersion, setMapDataVersion] = useState(0);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const battleEvents = useMemo(() => {
    const seenKeys = new Set<string>();
    const deduped: ProcessedStoryEvent[] = [];
    const sorted = storyEventLog
      .filter((event) => event.story === "BattleStory" && event.timestampMs >= now - 20_000)
      .sort((a, b) => b.timestampMs - a.timestampMs);
    for (const event of sorted) {
      const key = event.tx_hash ?? event.id;
      if (key && seenKeys.has(key)) {
        continue;
      }
      if (key) {
        seenKeys.add(key);
      }
      deduped.push(event);
      if (deduped.length >= 5) {
        break;
      }
    }
    return deduped;
  }, [storyEventLog, now]);

  useEffect(() => {
    const handleRefresh = () => setMapDataVersion((version) => version + 1);
    mapDataStore.onRefresh(handleRefresh);
    return () => mapDataStore.offRefresh(handleRefresh);
  }, [mapDataStore]);

  useEffect(() => {
    if (mapDataStore.getStructureCount() === 0) {
      void mapDataStore.refresh().catch((error) => {
        console.error("[StoryEventStream] Failed to hydrate map data store", error);
      });
    }
  }, [mapDataStore]);

  const getBattleLocation = useCallback(
    (event: ProcessedStoryEvent): BattleLocation | null => {
      const candidateIds: number[] = [];
      const addCandidate = (value: unknown) => {
        if (value === null || value === undefined) return;
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return;
        if (!candidateIds.includes(numeric)) {
          candidateIds.push(numeric);
        }
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
    [mapDataStore, mapDataVersion],
  );

  const resolveParticipantLabel = useCallback(
    (entityValue: unknown, ownerValue: unknown): string => {
      const resolveOwnerAddress = (value: unknown): string | undefined => {
        if (typeof value === "string" && value.startsWith("0x")) {
          return value;
        }
        return undefined;
      };

      const ownerAddress = resolveOwnerAddress(ownerValue) ?? resolveOwnerAddress(entityValue);
      if (ownerAddress) {
        try {
          const name = mapDataStore.getPlayerName(ownerAddress);
          if (name) {
            return name;
          }
        } catch (error) {
          // ignore lookup errors, we'll fall back to shorter forms
        }
      }

      const entityId = parseNumeric(entityValue);
      if (entityId !== null) {
        const structure = mapDataStore.getStructureById(entityId);
        if (structure) {
          return structure.ownerName || structure.structureTypeName || `Entity ${entityId}`;
        }
        const army = mapDataStore.getArmyById(entityId);
        if (army) {
          return army.ownerName || `Army ${entityId}`;
        }
      }

      if (ownerAddress) {
        return shortenAddress(ownerAddress);
      }

      return formatPlayerLabel(ownerValue ?? entityValue);
    },
    [mapDataStore, mapDataVersion],
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

      if (structure.realmId && structure.realmId !== 0) {
        return "Realm";
      }

      const typeName = structure.structureTypeName?.toLowerCase?.() ?? "";
      if (typeName.includes("hyper")) return "Hyperstructure";
      if (typeName.includes("realm")) return "Realm";
      if (typeName.includes("camp")) return "Camp";
      if (typeName.includes("essence") || typeName.includes("shrine") || typeName.includes("rift")) return "Rift";
      return "Hex";
    },
    [mapDataStore, mapDataVersion],
  );

  const handleNavigateToBattle = useCallback(
    async (event: ProcessedStoryEvent, locationOverride?: BattleLocation | null) => {
      const location = locationOverride ?? getBattleLocation(event);
      if (!location) {
        console.warn("[StoryEventStream] Unable to resolve battle location for event", event.id);
        return;
      }

      setNavigatingId(event.id);
      const position = new Position({ x: location.coordX, y: location.coordY });

      const updateSelection = () => {
        const col = Number(location.coordX);
        const row = Number(location.coordY);
        if (!Number.isFinite(col) || !Number.isFinite(row)) {
          return;
        }
        const next = { col, row };
        setSelectedHex(next);
        setTimeout(() => setSelectedHex(next), 0);
      };

      try {
        if (location.type === "structure") {
          updateSelection();
          await goToStructure(location.entityId, position, isMapView);
        } else {
          updateSelection();
          navigateToMapView(position);
        }
      } catch (error) {
        console.error("[StoryEventStream] Failed to navigate to battle location", error);
      } finally {
        setNavigatingId(null);
      }
    },
    [getBattleLocation, goToStructure, isMapView, navigateToMapView, setSelectedHex],
  );

  if (battleEvents.length === 0) {
    return null;
  }

  if (showBlankOverlay) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed top-16 right-6 z-[1100] flex w-full max-w-sm flex-col items-end">
      <ul role="log" aria-live="polite" className="pointer-events-auto flex flex-col gap-1.5 w-full max-w-xs">
        <AnimatePresence initial={false}>
          {battleEvents.map((event) => {
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

            const attackerTroops = formatTroopSummary(
              event.battle_attacker_troops_before,
              event.battle_attacker_troops_type,
              event.battle_attacker_troops_tier,
            );
            const defenderTroops = formatTroopSummary(
              event.battle_defender_troops_before,
              event.battle_defender_troops_type,
              event.battle_defender_troops_tier,
            );
            const derivedLocation = getBattleLocation(event);
            const locationLabel = getLocationLabel(derivedLocation);
            return (
              <StreamItem
                key={event.id}
                event={event}
                location={derivedLocation}
                locationLabel={locationLabel}
                attackerLabel={attackerLabel}
                defenderLabel={defenderLabel}
                attackerTroops={normalizePresentationTroops(attackerForces) ?? attackerTroops}
                defenderTroops={normalizePresentationTroops(defenderForces) ?? defenderTroops}
                winnerLabel={winnerLabel}
                onNavigate={handleNavigateToBattle}
                isNavigating={navigatingId === event.id}
              />
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

const formatWinnerName = (value?: string): string | undefined => {
  if (!value) return undefined;
  const match = value.match(/\[(.*?)\]/);
  if (match?.[1]) return match[1];
  return value;
};

interface StreamItemProps {
  event: ProcessedStoryEvent;
  location: BattleLocation | null;
  locationLabel: string;
  attackerLabel: string;
  defenderLabel: string;
  attackerTroops: string;
  defenderTroops: string;
  winnerLabel?: string;
  onNavigate: (event: ProcessedStoryEvent, locationOverride?: BattleLocation | null) => void;
  isNavigating: boolean;
}

function StreamItem({
  event,
  location,
  locationLabel,
  attackerLabel,
  defenderLabel,
  attackerTroops,
  defenderTroops,
  winnerLabel,
  onNavigate,
  isNavigating,
}: StreamItemProps) {
  const theme = STORY_EVENT_THEMES[event.presentation?.icon ?? "battle"];
  const Icon = theme.icon;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="pointer-events-auto overflow-hidden rounded-lg border border-amber-500/40 bg-zinc-950/80 px-3 py-3 text-[11px] leading-tight text-zinc-200 shadow-lg shadow-amber-900/25"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-100">
            <Icon className={cn("h-3 w-3 flex-shrink-0", theme.highlight)} aria-hidden />
            <span className="truncate">{attackerLabel}</span>
            <span className="text-amber-400">vs</span>
            <span className="truncate">{defenderLabel}</span>
          </div>
        </div>
        <button
          type="button"
          disabled={!location || isNavigating}
          onClick={(evt) => {
            evt.stopPropagation();
            if (!location || isNavigating) return;
            onNavigate(event, location);
          }}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
            "border-amber-400/60 bg-amber-500/10 text-amber-50 hover:bg-amber-500/20",
            (!location || isNavigating) &&
              "cursor-not-allowed border-amber-400/20 text-amber-200/50 hover:bg-amber-500/10",
          )}
        >
          <Navigation className="h-3 w-3" />
          {locationLabel || "Hex"}
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-1 text-[11px] text-amber-50">
        <div className="leading-snug">
          <span>{attackerTroops}</span>
          <span className="px-1 text-amber-300">vs</span>
          <span>{defenderTroops}</span>
        </div>
        {winnerLabel && <div className="font-semibold text-amber-200">Winner: {formatWinnerName(winnerLabel)}</div>}
      </div>
    </motion.li>
  );
}
