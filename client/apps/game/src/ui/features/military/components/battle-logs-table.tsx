import {
  ProcessedBattleLogEvent,
  useBattleLogs,
  useBattleLogsError,
  useBattleLogsLoading,
  useBattleLogsStore,
} from "@/hooks/store/use-battle-logs-store";
import { usePlayerStore } from "@/hooks/store/use-player-store";
import Button from "@/ui/design-system/atoms/button";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { findResourceById, RESOURCE_PRECISION } from "@bibliothecadao/types";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  Crown,
  Filter,
  HelpCircle,
  Home,
  MinusCircle,
  RefreshCw,
  Search,
  Shield,
  Sword,
  Target,
  Users,
  X,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Enhanced interfaces for better type safety
interface EntityInfo {
  id: number;
  name: string;
  type: "structure" | "army" | "daydream" | "unknown";
  playerId?: number;
  playerName?: string;
  isResolved: boolean;
}

interface FilterState {
  eventType: "all" | "battles" | "raids";
  entityFilter: {
    type: "all" | "entity" | "player";
    id?: number;
    name?: string;
  };
  searchTerm: string;
}

// Constants for special entity types
const DAYDREAM_AGENT_ID = 4294967288;
const UNKNOWN_ENTITY_ID = 0;

const cleanPlayerName = (name: string) => {
  if (name == "0") {
    return "";
  }
  return name;
};

// Entity data management hook
const useEntityData = (battleLogs: ProcessedBattleLogEvent[]) => {
  const [entities, setEntities] = useState<Map<number, EntityInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [players, setPlayers] = useState<Map<number, string>>(new Map());

  const resolveEntityData = useCallback(async () => {
    if (battleLogs.length === 0) return;

    setIsLoading(true);
    const playerStore = usePlayerStore.getState();
    const newEntities = new Map<number, EntityInfo>();
    const newPlayers = new Map<number, string>();
    // Collect all unique entity IDs
    const entityIds = new Set<[number, number]>();
    battleLogs.forEach((log) => {
      if (log.attacker_id) entityIds.add([log.attacker_id, log.attacker_owner_id || 0]);
      if (log.defender_id) entityIds.add([log.defender_id, log.defender_owner_id || 0]);
    });

    // Resolve entities in parallel
    await Promise.allSettled(
      Array.from(entityIds).map(async (id) => {
        let entityId = id[0];
        let ownerId = id[1];

        try {
          // Handle special cases first
          if (entityId === UNKNOWN_ENTITY_ID && ownerId === UNKNOWN_ENTITY_ID) {
            newEntities.set(entityId, {
              id: entityId,
              name: "Unknown Entity",
              type: "unknown",
              isResolved: true,
            });
            return;
          }

          if (ownerId === DAYDREAM_AGENT_ID) {
            newEntities.set(entityId, {
              id: entityId,
              name: `Agent #${entityId}`,
              type: "daydream",
              playerName: "Daydreams",
              isResolved: true,
            });
            return;
          }

          // Try to resolve as structure
          let playerData = await playerStore.getPlayerDataByStructureId(entityId.toString());
          if (playerData) {
            let playerName = cleanPlayerName(playerData.ownerName);
            const structureName = await playerStore.getStructureName(entityId.toString());
            const displayName = structureName
              ? `${playerName} ${structureName} #${entityId}`
              : `${playerName} Structure #${entityId}`;

            newEntities.set(entityId, {
              id: entityId,
              name: displayName,
              type: "structure",
              playerName: playerName,
              isResolved: true,
            });
            newPlayers.set(entityId, playerName);
            return;
          }

          // Try to resolve as army/explorer
          playerData = await playerStore.getPlayerDataByExplorerId(entityId.toString());
          if (playerData) {
            let playerName = cleanPlayerName(playerData.ownerName);
            newEntities.set(entityId, {
              id: entityId,
              name: `${playerName} Army #${entityId}`,
              type: "army",
              playerName: playerName,
              isResolved: true,
            });
            newPlayers.set(entityId, playerName);
            return;
          }

          // Try to resolve as DEAD army/explorer
          playerData = await playerStore.getPlayerDataByStructureId(ownerId.toString());
          if (playerData) {
            let playerName = cleanPlayerName(playerData.ownerName);
            newEntities.set(entityId, {
              id: entityId,
              name: `${playerName} Army #${entityId} [DEAD]`,
              type: "army",
              playerName: playerName,
              isResolved: true,
            });
            newPlayers.set(ownerId, playerName);
            return;
          }

          // Fallback
          newEntities.set(entityId, {
            id: entityId,
            name: `Entity #${entityId}`,
            type: "unknown",
            isResolved: true,
          });
        } catch (error) {
          console.error(`Failed to resolve entity ${entityId}:`, error);
          newEntities.set(entityId, {
            id: entityId,
            name: `Entity #${entityId}`,
            type: "unknown",
            isResolved: false,
          });
        }
      }),
    );

    setEntities(newEntities);
    setPlayers(newPlayers);
    setIsLoading(false);
  }, [battleLogs]);

  useEffect(() => {
    resolveEntityData();
  }, [resolveEntityData]);

  return { entities, players, isLoading };
};

// Filtering logic
const useFilteredBattleLogs = (
  battleLogs: ProcessedBattleLogEvent[],
  entities: Map<number, EntityInfo>,
  filterState: FilterState,
) => {
  return useMemo(() => {
    let filtered = [...battleLogs];

    // Filter by event type
    if (filterState.eventType === "battles") {
      filtered = filtered.filter((log) => !log.isRaidEvent);
    } else if (filterState.eventType === "raids") {
      filtered = filtered.filter((log) => log.isRaidEvent);
    }

    // Filter by entity/player
    if (filterState.entityFilter.type === "entity" && filterState.entityFilter.id) {
      const entityId = filterState.entityFilter.id;
      filtered = filtered.filter(
        (log) =>
          log.attacker_id === entityId ||
          log.defender_id === entityId ||
          log.attacker_owner_id === entityId ||
          log.defender_owner_id === entityId,
      );
    } else if (filterState.entityFilter.type === "player" && filterState.entityFilter.name) {
      const playerName = filterState.entityFilter.name;
      filtered = filtered.filter((log) => {
        const attackerEntity = entities.get(log.attacker_id);
        const defenderEntity = entities.get(log.defender_id);
        const attackerOwnerEntity = entities.get(log.attacker_owner_id || 0);
        const defenderOwnerEntity = entities.get(log.defender_owner_id || 0);

        return (
          attackerEntity?.playerName === playerName ||
          defenderEntity?.playerName === playerName ||
          attackerOwnerEntity?.playerName === playerName ||
          defenderOwnerEntity?.playerName === playerName
        );
      });
    }

    // Filter by search term
    if (filterState.searchTerm) {
      const searchLower = filterState.searchTerm.toLowerCase();
      filtered = filtered.filter((log) => {
        const attackerEntity = entities.get(log.attacker_id);
        const defenderEntity = entities.get(log.defender_id);

        return (
          attackerEntity?.name.toLowerCase().includes(searchLower) ||
          defenderEntity?.name.toLowerCase().includes(searchLower) ||
          attackerEntity?.playerName?.toLowerCase().includes(searchLower) ||
          defenderEntity?.playerName?.toLowerCase().includes(searchLower) ||
          log.attacker_id.toString().includes(filterState.searchTerm) ||
          log.defender_id.toString().includes(filterState.searchTerm)
        );
      });
    }

    // Sort by timestamp descending (newest first)
    return filtered.sort((a, b) => b.timestampMs - a.timestampMs);
  }, [battleLogs, entities, filterState]);
};

// Entity name display component (reimagined for cleaner aesthetic)
const EntityName: React.FC<{
  entityId: number;
  entities: Map<number, EntityInfo>;
  className?: string;
}> = ({ entityId, entities, className = "" }) => {
  const entity = entities.get(entityId);

  if (!entity) {
    return (
      <span className={`flex items-start text-stone-500 text-xs italic min-w-0`}>
        <HelpCircle className="w-3.5 h-3.5 text-stone-500 mr-1.5 shrink-0" />
        Resolving entity...
      </span>
    );
  }

  const getTypeIcon = (type: EntityInfo["type"]) => {
    switch (type) {
      case "structure":
        return <Home className="w-3.5 h-3.5 text-amber-600/90 mr-1.5 shrink-0" />;
      case "army":
        return <Users className="w-3.5 h-3.5 text-amber-600/90 mr-1.5 shrink-0" />;
      case "daydream":
        return <Cloud className="w-3.5 h-3.5 text-violet-500/90 mr-1.5 shrink-0" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-stone-500 mr-1.5 shrink-0" />;
    }
  };

  const icon = getTypeIcon(entity.type);

  return (
    <span className={`group relative flex items-start min-w-0 ${className}`}>
      {icon}
      {/* Visible, truncated name */}
      <span className="truncate block flex-grow min-w-0" title={`${entity.name} (${entity.type})`}>
        {entity.name}
      </span>

      {/* Hidden, full name pop-up on hover */}
      <div
        className="
          hidden group-hover:block 
          absolute left-0 top-full mt-1 z-20 
          p-2 bg-stone-950 border border-amber-500/60 rounded-lg shadow-2xl 
          text-sm 
          max-w-[280px] 
          whitespace-normal break-words 
          backdrop-blur-sm 
        "
      >
        <strong className="block text-amber-300 font-semibold mb-0.5">{entity.name}</strong>
      </div>
    </span>
  );
};

// Smart filter component (reimagined for gold and brown aesthetic)
const SmartFilter: React.FC<{
  entities: Map<number, EntityInfo>;
  players: Map<number, string>;
  filterState: FilterState;
  onFilterChange: (filterState: FilterState) => void;
  isLoading: boolean;
}> = ({ entities, players, filterState, onFilterChange, isLoading }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const uniquePlayers = useMemo(() => {
    const playerNames = new Set<string>();
    entities.forEach((entity) => {
      if (entity.playerName) {
        playerNames.add(entity.playerName);
      }
    });
    return Array.from(playerNames).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [entities]);

  const getFilterSuggestions = () => {
    const suggestions: Array<{
      type: "clear" | "player" | "entity";
      id?: number;
      name: string;
      subtitle?: string;
      icon: React.ReactNode;
    }> = [];

    // Gold: text-yellow-400, border-yellow-500. Brown: text-stone-400 (muted), bg-stone-700
    // Updated: text-amber-400, border-amber-500. Stone: text-stone-400, bg-stone-800

    if (filterState.entityFilter.type !== "all") {
      suggestions.push({
        type: "clear",
        name: "Show All Events",
        icon: <Target className="w-3.5 h-3.5 text-stone-400" />,
      });
    }

    const searchLower = filterState.searchTerm.toLowerCase();

    if (!filterState.searchTerm) {
      uniquePlayers.slice(0, 5).forEach((playerName) => {
        suggestions.push({
          type: "player",
          name: playerName,
          subtitle: "View player activity",
          icon: <Crown className="w-3.5 h-3.5 text-amber-400" />,
        });
      });
    } else {
      const idMatch = parseInt(filterState.searchTerm);
      if (!isNaN(idMatch) && entities.has(idMatch)) {
        const entity = entities.get(idMatch)!;
        suggestions.push({
          type: "entity",
          id: idMatch,
          name: entity.name,
          subtitle: `Entity #${idMatch}`,
          icon:
            entity.type === "structure" ? (
              <Shield className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Sword className="w-3.5 h-3.5 text-amber-500" />
            ),
        });
      }

      uniquePlayers
        .filter((name) => name.toLowerCase().includes(searchLower))
        .slice(0, 3)
        .forEach((playerName) => {
          if (!suggestions.some((s) => s.type === "player" && s.name === playerName)) {
            suggestions.push({
              type: "player",
              name: playerName,
              subtitle: "View player activity",
              icon: <Crown className="w-3.5 h-3.5 text-amber-400" />,
            });
          }
        });

      Array.from(entities.values())
        .filter(
          (entity) =>
            entity.name.toLowerCase().includes(searchLower) &&
            !suggestions.some((s) => s.type === "entity" && s.id === entity.id),
        )
        .slice(0, 3)
        .forEach((entity) => {
          suggestions.push({
            type: "entity",
            id: entity.id,
            name: entity.name,
            subtitle: `Entity #${entity.id}`,
            icon:
              entity.type === "structure" ? (
                <Shield className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Sword className="w-3.5 h-3.5 text-amber-500" />
              ),
          });
        });
    }
    return suggestions.slice(0, 7);
  };

  const suggestions = getFilterSuggestions();

  const handleSuggestionClick = (suggestion: (typeof suggestions)[0]) => {
    if (suggestion.type === "clear") {
      onFilterChange({ ...filterState, entityFilter: { type: "all" }, searchTerm: "" });
    } else if (suggestion.type === "player") {
      onFilterChange({ ...filterState, entityFilter: { type: "player", name: suggestion.name }, searchTerm: "" });
    } else if (suggestion.type === "entity" && suggestion.id) {
      onFilterChange({
        ...filterState,
        entityFilter: { type: "entity", id: suggestion.id, name: suggestion.name },
        searchTerm: "",
      });
    }
    setIsDropdownOpen(false);
  };

  const eventTypeFilters = [
    { key: "all", label: "All", icon: Target, activeColor: "amber-400", baseColor: "stone-400" },
    { key: "battles", label: "Battles", icon: Sword, activeColor: "red-500", baseColor: "stone-400" },
    { key: "raids", label: "Raids", icon: Zap, activeColor: "violet-500", baseColor: "stone-400" },
  ];

  return (
    <div className="space-y-4">
      {/* Event type filter */}
      <div className="flex rounded-lg overflow-hidden border border-amber-600/30 shadow-md bg-stone-800/50">
        {eventTypeFilters.map(({ key, label, icon: Icon, activeColor, baseColor }) => (
          <button
            key={key}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors duration-200 relative ${
              filterState.eventType === key
                ? `text-amber-100 bg-amber-600/50`
                : `text-stone-300 hover:text-amber-300 hover:bg-amber-600/20`
            } ${key !== "all" ? "border-l border-amber-600/30" : ""}`}
            onClick={() => onFilterChange({ ...filterState, eventType: key as any })}
          >
            <Icon
              className={`w-4 h-4 ${
                filterState.eventType === key ? `text-${activeColor}` : `text-${baseColor} group-hover:text-amber-300`
              }`}
            />
            <span className={`${filterState.eventType === key ? "text-amber-200" : "text-stone-300"}`}>{label}</span>
            {filterState.eventType === key && <div className={`absolute inset-x-0 bottom-0 h-0.5 bg-${activeColor}`} />}
          </button>
        ))}
      </div>

      {/* Smart search input & dropdown */}
      <div className="relative z-40" ref={dropdownRef}>
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-amber-500/70 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Search by name, player, or entity ID..."
            value={filterState.searchTerm}
            onChange={(e) => {
              onFilterChange({ ...filterState, searchTerm: e.target.value });
              if (e.target.value) setIsDropdownOpen(true);
              else setIsDropdownOpen(false);
            }}
            onFocus={() => {
              if (filterState.searchTerm || suggestions.length > 0) setIsDropdownOpen(true);
            }}
            className="w-full bg-stone-950/70 border border-amber-500/40 text-amber-200 rounded-lg pl-10 pr-10 py-2.5 text-sm placeholder-stone-500 focus:border-amber-500/70 focus:outline-none focus:ring-1 focus:ring-amber-500/50 shadow-inner transition-colors duration-200"
          />
          <div className="absolute right-3 flex items-center gap-2">
            {isLoading && <RefreshCw className="w-4 h-4 text-amber-400/80 animate-spin" />}
            {filterState.searchTerm && (
              <button
                onClick={() => {
                  onFilterChange({ ...filterState, searchTerm: "" });
                  setIsDropdownOpen(false);
                }}
                className="p-0.5 text-stone-400 hover:text-amber-300 transition-colors duration-150"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {isDropdownOpen && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-stone-900/95 border border-amber-600/50 rounded-lg shadow-2xl z-50 max-h-72 overflow-hidden backdrop-blur-lg dropdown-enter">
            <div className="p-1.5 space-y-0.5 overflow-y-auto max-h-[calc(18rem-0.75rem)]">
              {suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.type}-${suggestion.id || suggestion.name}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 text-stone-300 hover:bg-amber-700/30 hover:text-amber-200 transition-colors duration-150 group"
                >
                  <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{suggestion.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate text-amber-300 group-hover:text-amber-100">
                      {suggestion.name}
                    </div>
                    {suggestion.subtitle && (
                      <div className="text-xs text-stone-400 group-hover:text-amber-500 truncate">
                        {suggestion.subtitle}
                      </div>
                    )}
                  </div>
                  {(suggestion.type === "player" || suggestion.type === "entity") && (
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-sm font-semibold ${suggestion.type === "player" ? "bg-amber-500/20 text-amber-200" : "bg-stone-700/50 text-stone-300"}`}
                    >
                      {suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {filterState.entityFilter.type !== "all" && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-amber-500/90">Filtered by:</span>
            <div className="inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1 bg-amber-900/40 border border-amber-500/50 rounded-full shadow-sm">
              <span
                className={`text-xs font-medium ${filterState.entityFilter.type === "player" ? "text-amber-300" : "text-amber-400"}`}
              >
                {filterState.entityFilter.type === "player" ? "Player" : "Entity"}
              </span>
              <span className="text-sm text-amber-200 max-w-[180px] truncate">
                {filterState.entityFilter.name || `#${filterState.entityFilter.id}`}
              </span>
              <button
                onClick={() => onFilterChange({ ...filterState, entityFilter: { type: "all" } })}
                className="p-0.5 text-stone-400 hover:text-amber-300 rounded-full hover:bg-amber-600/20 transition-colors duration-150"
                aria-label="Clear entity filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Battle card component (reimagined for gold and brown aesthetic)
const BattleCard: React.FC<{
  event: ProcessedBattleLogEvent;
  entities: Map<number, EntityInfo>;
}> = ({ event, entities }) => {
  const formatTime = (timestampMs: number) => {
    const date = new Date(timestampMs);
    const now = new Date();
    const diffMs = now.getTime() - timestampMs;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    let relativeTime;
    if (diffHours < 1) {
      relativeTime = diffMinutes <= 0 ? "Just now" : `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      relativeTime = `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      relativeTime = `${diffDays}d ago`;
    }

    const actualDateTime = date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return { relativeTime, actualDateTime };
  };

  const isRaid = event.isRaidEvent;
  const isWin = isRaid ? event.isWin : event.attacker_owner_id === event.winner_id;
  const isLoss = isRaid ? !event.isWin : event.defender_owner_id === event.winner_id;
  const isDraw = !isWin && !isLoss;
  const timeInfo = formatTime(event.timestampMs);

  // Gold: text-yellow-400, border-yellow-500. Brown: bg-stone-800, text-amber-600
  // Consider a richer brown e.g. bg-yellow-900 or bg-amber-800
  // Updated: text-amber-400, border-amber-500/600. Dark: bg-stone-900 or bg-black/opacity

  return (
    <div
      className={`battle-card bg-stone-900/80 border border-amber-600/40 rounded-lg shadow-xl backdrop-blur-md p-4 transition-all duration-300 hover:shadow-[0_0_25px_rgba(212,175,55,0.3)] hover:border-amber-400/60 hover:bg-black/30 ${
        isWin ? "green-border-pulse" : isLoss ? "red-border-pulse" : ""
      }`}
    >
      {/* Header: Type, Title, Time */}
      <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-amber-600/20">
        <div className="flex items-center gap-2.5">
          {isRaid ? <Zap className="w-4 h-4 text-violet-400" /> : <Sword className="w-4 h-4 text-red-500" />}
          <h3 className="text-sm font-semibold text-amber-300">{isRaid ? "Raid Report" : "Battle Report"}</h3>
        </div>
        <div className="text-xs text-amber-500/90 group relative cursor-help">
          <Clock className="w-3 h-3 inline mr-1 text-amber-500/80" />
          {timeInfo.relativeTime}
          {/* Custom CSS Tooltip for actual date/time */}
          <span
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 
                       bg-stone-950 text-amber-200 text-xs rounded-md shadow-lg whitespace-nowrap 
                       opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50"
          >
            {timeInfo.actualDateTime}
          </span>
        </div>
      </div>

      {/* Combatants */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-3.5">
        {/* Attacker */}
        <div className="text-left space-y-0.5 min-w-0">
          <div className="text-xs text-amber-500/90 flex items-center gap-1.5">
            <Sword className="w-3.5 h-3.5 text-amber-400/90" /> Attacker
          </div>
          <EntityName entityId={event.attacker_id} entities={entities} className="text-sm text-amber-200 font-medium" />
        </div>

        {/* VS Separator */}
        <div className="text-center">
          <span className="text-xs font-bold text-amber-500/60">VS</span>
        </div>

        {/* Defender */}
        <div className="text-right space-y-0.5 min-w-0">
          <div className="text-xs text-amber-500/90 flex items-center justify-end gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-400/90" /> Defender
          </div>
          <EntityName entityId={event.defender_id} entities={entities} className="text-sm text-amber-200 font-medium" />
        </div>
      </div>

      {/* Rewards Section */}
      {isWin && event.parsedRewards && event.parsedRewards.length > 0 && (
        <div className="mt-3 pt-3 border-t border-amber-600/20">
          {/* <div className="text-xs text-amber-500/90 mb-2 flex items-center gap-1.5">
            <span className="font-medium">Max Rewards:</span>
          </div> */}
          <div className="flex flex-wrap gap-2">
            {event.parsedRewards.map((reward, index) => {
              const resourceInfo = findResourceById(reward.resourceId);
              const resourceName = resourceInfo?.trait || `Resource #${reward.resourceId}`;
              // Convert from raw amount to display amount
              const displayAmount = Number(reward.amount) / RESOURCE_PRECISION;
              let formattedAmount;
              if (displayAmount === 0) {
                formattedAmount = "0";
              } else if (displayAmount < 0.01) {
                formattedAmount = "~ 0"; // Display "0" for very small numbers
              } else {
                formattedAmount = displayAmount % 1 === 0 ? displayAmount.toString() : displayAmount.toFixed(2);
              }

              return (
                <div
                  key={`${reward.resourceId}-${index}`}
                  className="resource-item bg-amber-900/20 border border-amber-600/30 rounded-md px-2.5 py-1 flex items-center gap-2 text-xs"
                >
                  <ResourceIcon resource={resourceName} size="xs" withTooltip={true} className="opacity-90" />
                  <span className="text-amber-200">{formattedAmount}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Outcome */}
      <div className="flex items-center justify-center mt-3 pt-3 border-t border-amber-600/20">
        <div
          className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 shadow-inner ${
            isWin
              ? "bg-green-500/15 text-green-200 border border-green-500/30" // Green for Victory
              : isLoss
                ? "bg-red-500/15 text-red-200 border border-red-500/30" // Red for Defeat
                : "bg-stone-700/60 text-stone-300 border border-stone-600/50" // Stone for Draw
          }`}
        >
          {isWin ? (
            <Crown className="w-4 h-4 text-green-400" />
          ) : isLoss ? (
            <Target className="w-4 h-4 text-red-400" /> // Using Target, styled red
          ) : (
            <MinusCircle className="w-4 h-4 text-stone-400" />
          )}
          <span className="uppercase tracking-wider">{isWin ? "Victory" : isLoss ? "Defeat" : "Draw"}</span>
        </div>
      </div>
    </div>
  );
};

const ITEMS_PER_PAGE = 20;

export const BattleLogsTable: React.FC = () => {
  const battleLogs = useBattleLogs();
  const isLoading = useBattleLogsLoading();
  const error = useBattleLogsError();
  const { refreshBattleLogs } = useBattleLogsStore();

  const [filterState, setFilterState] = useState<FilterState>({
    eventType: "all",
    entityFilter: { type: "all" },
    searchTerm: "",
  });
  const [currentPage, setCurrentPage] = useState(1);

  const { entities, players, isLoading: isEntityLoading } = useEntityData(battleLogs);
  const filteredLogs = useFilteredBattleLogs(battleLogs, entities, filterState);

  // Reset current page if filter changes or total logs change significantly
  useEffect(() => {
    setCurrentPage(1);
  }, [filterState, battleLogs.length]); // Reset if filter or underlying total logs change

  const totalPages = useMemo(() => {
    return Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  }, [filteredLogs.length]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredLogs.slice(startIndex, endIndex);
  }, [filteredLogs, currentPage]);

  const handleRefresh = () => {
    refreshBattleLogs();
    // setCurrentPage will be reset by the useEffect above due to battleLogs.length potentially changing
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  // Define a gold and brown color palette (Tailwind JIT will pick these up)
  // Gold shades: text-yellow-400, text-amber-500, border-yellow-500, bg-yellow-500
  // Brown shades: text-stone-700, bg-stone-800, border-stone-600, bg-yellow-900 (for a rich brown)
  // Updated: text-amber-300, text-amber-400, border-amber-500/600, bg-black or stone-950 for base

  if (isLoading && battleLogs.length === 0) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-6 bg-black text-gray-200">
        <LoadingAnimation />
        <h3 className="text-lg font-semibold text-amber-300 mt-4">Loading Chronicles...</h3>
        <p className="text-amber-500/80 text-sm max-w-xs mt-1 text-center">
          Gathering latest reports from the battlefield.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center bg-black text-gray-200">
        <div className="bg-stone-900/80 p-8 rounded-lg shadow-2xl backdrop-blur-md max-w-md w-full border border-amber-600/40">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />{" "}
          {/* Error icon, can be amber-themed if preferred */}
          <h2 className="text-xl font-semibold text-amber-400 mb-2">Chronicles Unavailable</h2>
          <p className="text-stone-400 text-sm mb-6">
            {error || "There was an issue fetching the battle logs. Please try again."}
          </p>
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 px-5 py-2.5 text-sm font-medium rounded-md transition-colors duration-200 flex items-center justify-center gap-2 mx-auto shadow-md hover:shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-4 space-y-6 bg-black text-gray-200 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-amber-600/30">
        <div>
          <h1 className="text-2xl font-semibold text-amber-300">Battle Chronicles</h1>
          <p className="text-sm text-amber-500/90">Review epic conflicts and raids across the realms.</p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          disabled={isLoading}
          className="bg-amber-600/20 border-amber-500/60 text-amber-300 hover:bg-amber-600/30 px-4 py-2 text-xs font-medium rounded-md transition-colors duration-200 flex items-center gap-1.5 shadow-sm hover:shadow-md"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Filters & Count Container */}
      <div className="relative z-30 bg-stone-900/70 p-4 rounded-lg shadow-xl backdrop-blur-md border border-amber-500/40">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-400" />
            <h3 className="text-amber-400 font-medium text-base">Filter Events</h3>
          </div>
          {!isEntityLoading && battleLogs.length > 0 && (
            <div className="text-xs text-amber-500/90 bg-black/20 px-2.5 py-1 rounded-md border border-amber-600/20">
              <span className="font-semibold text-amber-300">{filteredLogs.length}</span> of{" "}
              <span className="font-semibold text-amber-300">{battleLogs.length}</span>{" "}
            </div>
          )}
        </div>

        <SmartFilter
          entities={entities}
          players={players}
          filterState={filterState}
          onFilterChange={setFilterState}
          isLoading={isEntityLoading}
        />
      </div>

      {/* Battle Feed Area */}
      <div className="space-y-4">
        {/* This block is now handled by the main isLoading && battleLogs.length === 0 check further up */}
        {
          /* {isLoading && battleLogs.length === 0 ? ( 
          <div className="min-h-[300px] flex flex-col items-center justify-center p-5 text-center">
            <div className="bg-stone-900/80 p-10 rounded-lg shadow-2xl backdrop-blur-md border border-amber-600/40">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-amber-300">Loading Chronicles...</h3>
              <p className="text-amber-500/80 text-sm max-w-xs mt-1">
                Gathering latest reports from the battlefield.
              </p>
            </div>
          </div>
        ) : */ filteredLogs.length === 0 ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center p-5 text-center">
              <div className="bg-stone-900/80 p-10 rounded-lg shadow-2xl backdrop-blur-md border border-amber-600/40">
                <Search className="w-8 h-8 text-amber-500/70 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-amber-300 mb-1">No Chronicles Found</h3>
                <p className="text-amber-500/80 text-sm max-w-xs mx-auto">
                  {battleLogs.length === 0
                    ? "The realm is currently peaceful. No battles to report."
                    : "No battles match your current filter selection. Try adjusting your filters."}
                </p>
                {(filterState.entityFilter.type !== "all" ||
                  filterState.searchTerm ||
                  filterState.eventType !== "all") && (
                  <button
                    onClick={() =>
                      setFilterState({
                        eventType: "all",
                        entityFilter: { type: "all" },
                        searchTerm: "",
                      })
                    }
                    className="mt-5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 px-4 py-2 text-xs font-medium rounded-md transition-colors duration-200 shadow-md hover:shadow-lg"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {paginatedLogs.map((event) => (
                <BattleCard key={event.id} event={event} entities={entities} />
              ))}
            </div>
          )
        }
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-amber-600/20 mt-6">
          <Button
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            variant="outline"
            className="bg-amber-600/20 border-amber-500/60 text-amber-300 hover:bg-amber-600/30 px-4 py-2 text-xs font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          <span className="text-sm text-amber-400">
            Page <span className="font-semibold">{currentPage}</span> of{" "}
            <span className="font-semibold">{totalPages}</span>
          </span>
          <Button
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            variant="outline"
            className="bg-amber-600/20 border-amber-500/60 text-amber-300 hover:bg-amber-600/30 px-4 py-2 text-xs font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Footer/Loading indicator for refresh */}
      {isLoading && battleLogs.length > 0 && (
        <div className="flex justify-center pt-4 pb-2">
          <div className="bg-stone-900/80 border border-amber-600/40 px-4 py-2 rounded-md text-xs font-medium text-amber-300 flex items-center gap-2 shadow-lg backdrop-blur-md">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Updating Chronicles...</span>
          </div>
        </div>
      )}
    </div>
  );
};
