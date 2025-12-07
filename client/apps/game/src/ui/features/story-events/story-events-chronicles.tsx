import { useGoToStructure, useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import {
  ProcessedStoryEvent,
  useStoryEvents,
  useStoryEventsError,
  useStoryEventsLoading,
} from "@/hooks/store/use-story-events-store";
import { sqlApi } from "@/services/api";
import Button from "@/ui/design-system/atoms/button";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import clsx from "clsx";
import {
  BookOpen,
  CalendarDays,
  Castle,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Compass,
  Factory,
  Filter,
  Flame,
  Hammer,
  Navigation,
  Package,
  ScrollText,
  Search,
  Shield,
  Sparkles,
  Sword,
  Trophy,
} from "lucide-react";
import React, { type ComponentType, useCallback, useEffect, useMemo, useState } from "react";

import { MAP_DATA_REFRESH_INTERVAL, MapDataStore, Position } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
type SortOrder = "newest" | "oldest";

interface StoryTypeConfig {
  label: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  halo: string;
  badge: string;
}

const STORY_FILTER_ORDER = [
  "RealmCreatedStory",
  "BuildingPlacementStory",
  "BuildingPaymentStory",
  "StructureLevelUpStory",
  "ProductionStory",
  "ExplorerMoveStory",
  "BattleStory",
  "ResourceTransferStory",
  "ResourceBurnStory",
  "ResourceReceiveArrivalStory",
  "GuardAddStory",
  "GuardDeleteStory",
  "ExplorerCreateStory",
  "ExplorerAddStory",
  "ExplorerDeleteStory",
  "ExplorerExplorerSwapStory",
  "ExplorerGuardSwapStory",
  "GuardExplorerSwapStory",
  "PrizeDistributedStory",
  "PrizeDistributionFinalStory",
  "UnknownStory",
] as const;

type StoryTypeKey = (typeof STORY_FILTER_ORDER)[number];
type StoryFilterValue = "all" | StoryTypeKey;

const STORY_TYPE_CONFIG: Record<StoryTypeKey, StoryTypeConfig> = {
  RealmCreatedStory: {
    label: "Realm Founded",
    icon: Castle,
    accent: "text-fuchsia-200",
    halo: "from-fuchsia-500/40 to-purple-900/20",
    badge: "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-100",
  },
  BuildingPlacementStory: {
    label: "Building Updated",
    icon: Hammer,
    accent: "text-sky-200",
    halo: "from-sky-500/35 to-blue-900/20",
    badge: "border-sky-400/60 bg-sky-500/15 text-sky-100",
  },
  BuildingPaymentStory: {
    label: "Building Paid For",
    icon: Coins,
    accent: "text-amber-200",
    halo: "from-amber-500/35 to-orange-900/20",
    badge: "border-amber-400/65 bg-amber-500/15 text-amber-100",
  },
  StructureLevelUpStory: {
    label: "Structure Level Up",
    icon: Sparkles,
    accent: "text-emerald-200",
    halo: "from-emerald-500/35 to-emerald-900/20",
    badge: "border-emerald-400/60 bg-emerald-500/15 text-emerald-100",
  },
  ProductionStory: {
    label: "Production Started",
    icon: Factory,
    accent: "text-emerald-200",
    halo: "from-emerald-500/35 to-emerald-900/20",
    badge: "border-emerald-400/60 bg-emerald-500/15 text-emerald-100",
  },
  ExplorerMoveStory: {
    label: "Army Moved",
    icon: Navigation,
    accent: "text-teal-200",
    halo: "from-teal-500/40 to-cyan-900/20",
    badge: "border-teal-400/60 bg-teal-500/15 text-teal-100",
  },
  BattleStory: {
    label: "Battle Report",
    icon: Sword,
    accent: "text-rose-200",
    halo: "from-rose-500/40 to-rose-900/20",
    badge: "border-rose-400/65 bg-rose-500/15 text-rose-100",
  },
  ResourceTransferStory: {
    label: "Resource Transfer",
    icon: Coins,
    accent: "text-amber-200",
    halo: "from-amber-500/35 to-orange-900/20",
    badge: "border-amber-400/65 bg-amber-500/15 text-amber-100",
  },
  ResourceBurnStory: {
    label: "Resource Burn",
    icon: Flame,
    accent: "text-red-200",
    halo: "from-red-500/35 to-red-900/20",
    badge: "border-red-400/65 bg-red-500/15 text-red-100",
  },
  ResourceReceiveArrivalStory: {
    label: "Resource Arrival",
    icon: Package,
    accent: "text-yellow-200",
    halo: "from-yellow-500/35 to-amber-900/20",
    badge: "border-yellow-400/60 bg-yellow-500/15 text-yellow-100",
  },
  GuardAddStory: {
    label: "Guard Added",
    icon: Shield,
    accent: "text-indigo-200",
    halo: "from-indigo-500/35 to-indigo-900/20",
    badge: "border-indigo-400/60 bg-indigo-500/15 text-indigo-100",
  },
  GuardDeleteStory: {
    label: "Guard Removed",
    icon: Shield,
    accent: "text-indigo-200",
    halo: "from-indigo-500/35 to-indigo-900/20",
    badge: "border-indigo-400/60 bg-indigo-500/15 text-indigo-100",
  },
  ExplorerCreateStory: {
    label: "Explorer Created",
    icon: Compass,
    accent: "text-teal-200",
    halo: "from-teal-500/40 to-cyan-900/20",
    badge: "border-teal-400/60 bg-teal-500/15 text-teal-100",
  },
  ExplorerAddStory: {
    label: "Explorer Reinforced",
    icon: Compass,
    accent: "text-teal-200",
    halo: "from-teal-500/40 to-cyan-900/20",
    badge: "border-teal-400/60 bg-teal-500/15 text-teal-100",
  },
  ExplorerDeleteStory: {
    label: "Explorer Retired",
    icon: Compass,
    accent: "text-teal-200",
    halo: "from-teal-500/40 to-cyan-900/20",
    badge: "border-teal-400/60 bg-teal-500/15 text-teal-100",
  },
  ExplorerExplorerSwapStory: {
    label: "Explorer Swap",
    icon: Compass,
    accent: "text-teal-200",
    halo: "from-teal-500/40 to-cyan-900/20",
    badge: "border-teal-400/60 bg-teal-500/15 text-teal-100",
  },
  ExplorerGuardSwapStory: {
    label: "Explorer→Guard Swap",
    icon: Shield,
    accent: "text-indigo-200",
    halo: "from-indigo-500/35 to-indigo-900/20",
    badge: "border-indigo-400/60 bg-indigo-500/15 text-indigo-100",
  },
  GuardExplorerSwapStory: {
    label: "Guard→Explorer Swap",
    icon: Shield,
    accent: "text-indigo-200",
    halo: "from-indigo-500/35 to-indigo-900/20",
    badge: "border-indigo-400/60 bg-indigo-500/15 text-indigo-100",
  },
  PrizeDistributedStory: {
    label: "Prize Distributed",
    icon: Trophy,
    accent: "text-yellow-100",
    halo: "from-yellow-500/35 to-amber-900/20",
    badge: "border-yellow-400/60 bg-yellow-500/20 text-yellow-100",
  },
  PrizeDistributionFinalStory: {
    label: "Prize Finalized",
    icon: Trophy,
    accent: "text-yellow-100",
    halo: "from-yellow-500/35 to-amber-900/20",
    badge: "border-yellow-400/60 bg-yellow-500/20 text-yellow-100",
  },
  UnknownStory: {
    label: "Uncatalogued",
    icon: ScrollText,
    accent: "text-slate-200",
    halo: "from-slate-500/35 to-slate-900/20",
    badge: "border-slate-400/60 bg-slate-500/15 text-slate-100",
  },
};

const STORY_FILTER_VALUES: StoryFilterValue[] = ["all", ...STORY_FILTER_ORDER];

const STORY_TYPE_SET = new Set<StoryTypeKey>(STORY_FILTER_ORDER as readonly StoryTypeKey[]);

const resolveStoryKey = (story: string | null | undefined): StoryTypeKey => {
  if (story && STORY_TYPE_SET.has(story as StoryTypeKey)) {
    return story as StoryTypeKey;
  }
  return "UnknownStory";
};

interface ChroniclesFilterState {
  searchTerm: string;
  storyType: StoryFilterValue;
  sortOrder: SortOrder;
}

type DetailSegment = { label?: string; value: string };

interface EventLocation {
  coordX: number;
  coordY: number;
  entityId: number;
  type: "structure" | "army";
}

const parseDetailSegments = (description?: string): DetailSegment[] => {
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

const DetailGrid: React.FC<{ details: DetailSegment[]; columns?: number }> = ({ details, columns = 2 }) => {
  if (!details.length) return null;

  const gridCols = columns === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2";

  return (
    <dl className={clsx("grid gap-1.5 rounded-md border border-amber-400/15 bg-black/25 p-2", gridCols)}>
      {details.map((detail, index) => (
        <div
          key={`${detail.value}-${index}`}
          className={clsx("flex flex-col gap-0.5", !detail.label && columns !== 1 ? "sm:col-span-2" : undefined)}
        >
          {detail.label && (
            <dt className="text-[10px] font-medium uppercase tracking-wide text-amber-500/70">{detail.label}</dt>
          )}
          <dd className="text-[11px] font-medium text-amber-100/90 leading-snug">{detail.value}</dd>
        </div>
      ))}
    </dl>
  );
};

const SORT_OPTIONS: Array<{ value: SortOrder; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

const DEFAULT_VISIBLE_EVENTS = 60;

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const absoluteTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateHeaderFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const getRelativeTime = (timestamp: number) => {
  const diffMs = timestamp - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (Math.abs(diffMinutes) < 60) {
    return relativeTimeFormatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return relativeTimeFormatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return relativeTimeFormatter.format(diffDays, "day");
};

const getDateHeaderLabel = (timestamp: number) => dateHeaderFormatter.format(timestamp);

const getAbsoluteLabel = (timestamp: number) => absoluteTimeFormatter.format(timestamp);

const LiveStatusIndicator: React.FC<{ isRefreshing: boolean }> = ({ isRefreshing }) => (
  <div
    className={clsx(
      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium",
      isRefreshing
        ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
        : "border-amber-400/50 bg-amber-500/10 text-amber-100",
    )}
  >
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
    </span>
    <span>Live</span>
    <span className="text-amber-400/50">/</span>
    <span className="tracking-wide uppercase">{isRefreshing ? "Syncing" : "Streaming"}</span>
  </div>
);

const ActivityHighlight: React.FC<{
  event: ProcessedStoryEvent | null;
  eventLocation: EventLocation | null;
  onNavigateToEvent?: (event: ProcessedStoryEvent) => void;
  isNavigating: boolean;
}> = ({ event, eventLocation, onNavigateToEvent, isNavigating }) => {
  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-amber-400/20 bg-black/30 px-4 py-6 text-center">
        <Sparkles className="h-5 w-5 text-amber-400/70" />
        <p className="mt-2 text-xs text-amber-300/75">Select an activity to inspect details.</p>
      </div>
    );
  }

  const storyKey = resolveStoryKey(event.story);
  const storyConfig = STORY_TYPE_CONFIG[storyKey];
  const StoryIcon = storyConfig.icon;
  const details = parseDetailSegments(event.presentation.description);

  return (
    <div className="relative rounded-md border border-amber-400/25 bg-gradient-to-br from-stone-950/95 via-stone-950/70 to-black/60 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-400/30 bg-black/50">
            <StoryIcon className={clsx("h-3.5 w-3.5", storyConfig.accent)} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-amber-500/70">Featured</p>
            <h2 className="truncate text-sm font-semibold text-amber-50">{event.presentation.title}</h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-amber-300/70">
          <Clock className="h-3 w-3 text-amber-400/70" />
          <span>{getRelativeTime(event.timestampMs)}</span>
          <span className="text-amber-500/40">•</span>
          <span>{getAbsoluteLabel(event.timestampMs)}</span>
        </div>
      </div>

      <DetailGrid details={details} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {event.presentation.owner && (
          <span className="inline-flex items-center gap-1 rounded border border-amber-400/20 bg-black/40 px-2 py-1 text-[11px] text-amber-300/80">
            <Compass className="h-3 w-3 text-amber-400/70" />
            Action by {event.presentation.owner}
          </span>
        )}
        <span
          className={clsx(
            "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide",
            storyConfig.badge,
          )}
        >
          {storyConfig.label}
        </span>
        {event.story === "BattleStory" && (
          <Button
            variant="outline"
            size="xs"
            disabled={!eventLocation || isNavigating}
            onClick={() => event && eventLocation && onNavigateToEvent?.(event)}
            className={clsx(
              "gap-1 border-amber-400/60 text-amber-50 hover:bg-amber-500/15 disabled:border-amber-400/20 disabled:text-amber-300/70",
              isNavigating && "cursor-wait",
            )}
            forceUppercase={false}
          >
            <Navigation className="h-3 w-3" />
            {eventLocation ? (isNavigating ? "Locating…" : "View hex") : "Location unavailable"}
          </Button>
        )}
      </div>
    </div>
  );
};

interface ChroniclesFilterPanelProps {
  state: ChroniclesFilterState;
  onChange: (next: ChroniclesFilterState) => void;
  onReset: () => void;
  storyCounts: Record<StoryFilterValue, number>;
  totalEvents: number;
  recentEvents: number;
  collapsed: boolean;
  onToggle: () => void;
}

const ChroniclesFilterPanel: React.FC<ChroniclesFilterPanelProps> = ({
  state,
  onChange,
  onReset,
  storyCounts,
  totalEvents,
  recentEvents,
  collapsed,
  onToggle,
}) => {
  const setStoryType = (storyType: StoryFilterValue) => onChange({ ...state, storyType });
  const setSortOrder = (sortOrder: SortOrder) => onChange({ ...state, sortOrder });

  const activeFilters =
    (state.storyType !== "all" ? 1 : 0) + (state.searchTerm ? 1 : 0) + (state.sortOrder !== "newest" ? 1 : 0);

  if (collapsed) {
    // Compact horizontal-collapsed rail
    return (
      <aside
        className={clsx(
          "flex flex-col items-center gap-3 rounded-md border border-amber-400/20 bg-black/35 p-2",
          "w-14 md:sticky md:top-4",
        )}
      >
        <button
          onClick={onToggle}
          aria-label="Expand filters"
          className="relative flex h-10 w-10 items-center justify-center rounded-md border border-amber-400/30 bg-black/40 text-amber-200 hover:border-amber-400/60 hover:bg-black/50"
        >
          <Filter className="h-4 w-4" />
          {activeFilters > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-amber-500/80 px-1.5 py-[2px] text-[9px] font-semibold text-black">
              {activeFilters}
            </span>
          )}
        </button>

        <div className="flex flex-col items-center gap-2">
          {/* Quick story type indicator (current) */}
          <div
            className="flex h-10 w-10 items-center justify-center rounded-md border border-amber-400/25 bg-black/45 text-amber-200"
            title={
              state.storyType === "all" ? "All story types" : STORY_TYPE_CONFIG[state.storyType as StoryTypeKey]?.label
            }
          >
            {state.storyType === "all" ? (
              <Sparkles className="h-4 w-4 text-amber-300" />
            ) : (
              React.createElement(STORY_TYPE_CONFIG[state.storyType as StoryTypeKey].icon, {
                className: clsx("h-4 w-4", STORY_TYPE_CONFIG[state.storyType as StoryTypeKey].accent),
              })
            )}
          </div>

          {/* Sort order indicator */}
          <div
            className="flex h-10 w-10 items-center justify-center rounded-md border border-amber-400/25 bg-black/45 text-amber-200"
            title={`Sort: ${SORT_OPTIONS.find((s) => s.value === state.sortOrder)?.label}`}
          >
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-auto flex flex-col items-center gap-2 pb-1">
          <button
            onClick={onReset}
            aria-label="Reset filters"
            className="flex h-10 w-10 items-center justify-center rounded-md border border-amber-400/30 bg-black/40 text-amber-200 hover:border-amber-400/60 hover:bg-black/50 text-[10px] font-medium"
          >
            R
          </button>
          <div
            className="flex h-14 w-10 flex-col items-center justify-center rounded-md border border-amber-400/25 bg-black/40 text-[9px] leading-tight text-amber-300"
            title={`${totalEvents} events (${recentEvents} / 24h)`}
          >
            <span className="font-semibold">{totalEvents}</span>
            <span className="text-amber-400/70">{recentEvents}</span>
          </div>
          <button
            onClick={onToggle}
            aria-label="Expand filters"
            className="flex h-8 w-8 items-center justify-center rounded border border-amber-400/30 bg-black/40 text-amber-200 hover:border-amber-400/60 hover:bg-black/50"
          >
            <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
          </button>
        </div>
      </aside>
    );
  }

  // Expanded (full) panel
  return (
    <aside className="flex flex-col gap-4 rounded-md border border-amber-400/20 bg-black/35 p-3 md:sticky md:top-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-400/30 bg-black/50">
            <Filter className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-50">Filters</h3>
            <p className="text-[11px] leading-tight text-amber-400/70">Refine activity stream.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeFilters > 0 && (
            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
              {activeFilters}
            </span>
          )}
          <button
            onClick={onToggle}
            aria-label="Collapse filters"
            className="inline-flex items-center gap-1 rounded border border-amber-400/30 bg-black/40 px-2 py-1 text-[10px] font-medium text-amber-200 hover:border-amber-400/60 hover:bg-black/50"
          >
            <ChevronUp className="h-3 w-3 rotate-[-90deg]" />
            Collapse
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/70">Search</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-amber-500/60" />
          <input
            className="w-full rounded border border-amber-400/30 bg-black/55 py-1.5 pl-7 pr-2 text-xs text-amber-100 placeholder:text-amber-500/50 focus:border-amber-400 focus:outline-none"
            placeholder="Search title / player / detail"
            value={state.searchTerm}
            onChange={(event) => onChange({ ...state, searchTerm: event.target.value })}
          />
        </div>
      </div>

      {/* Story Type */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/70">Story Type</label>
        <div className="grid grid-cols-1 gap-1.5">
          {STORY_FILTER_VALUES.map((key) => {
            const isAll = key === "all";
            const config = isAll
              ? { label: "All", icon: Sparkles, accent: "text-amber-200", halo: "" }
              : STORY_TYPE_CONFIG[key as StoryTypeKey];
            const IconComponent = config.icon;
            return (
              <button
                key={key}
                onClick={() => setStoryType(key)}
                className={clsx(
                  "group flex items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors",
                  state.storyType === key
                    ? "border-amber-400/70 bg-amber-500/15 text-amber-50"
                    : "border-amber-400/15 bg-black/40 text-amber-300/80 hover:border-amber-400/50 hover:text-amber-100",
                )}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-black/60">
                  <IconComponent className={clsx("h-3 w-3", config.accent)} />
                </div>
                <div className="flex flex-1 items-center justify-between gap-2">
                  <span className="text-[11px] font-medium">{config.label}</span>
                  <span className="text-[10px] tabular-nums text-amber-400/60">{storyCounts[key] ?? 0}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/70">Sort</label>
        <div className="flex gap-2">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSortOrder(option.value)}
              className={clsx(
                "flex-1 rounded border px-2 py-1.5 text-[11px] font-medium transition-colors",
                state.sortOrder === option.value
                  ? "border-amber-400/70 bg-amber-500/15 text-amber-50"
                  : "border-amber-400/20 bg-black/45 text-amber-300/80 hover:border-amber-400/50 hover:text-amber-100",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between rounded border border-amber-400/20 bg-black/40 px-3 py-2">
        <div className="leading-tight">
          <p className="text-[11px] font-semibold text-amber-50">{totalEvents} events</p>
          <p className="text-[10px] text-amber-400/70">{recentEvents} in last 24h</p>
        </div>
        <Button
          variant="outline"
          size="xs"
          onClick={onReset}
          className="border-amber-400/60 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-500/15"
          forceUppercase={false}
        >
          Reset
        </Button>
      </div>
    </aside>
  );
};

const TimelineEventCard: React.FC<{
  event: ProcessedStoryEvent;
  isActive: boolean;
  onSelect: () => void;
  eventLocation: EventLocation | null;
  onNavigateToEvent?: (event: ProcessedStoryEvent) => void;
  isNavigating: boolean;
}> = ({ event, isActive, onSelect, eventLocation, onNavigateToEvent, isNavigating }) => {
  const storyKey = resolveStoryKey(event.story);
  const storyConfig = STORY_TYPE_CONFIG[storyKey];
  const StoryIcon = storyConfig.icon;
  const details = parseDetailSegments(event.presentation.description);

  return (
    <li>
      <button
        onClick={onSelect}
        className={clsx(
          "group w-full rounded border p-3 text-left transition-colors",
          isActive
            ? "border-amber-400/70 bg-amber-500/15"
            : "border-amber-400/15 bg-black/35 hover:border-amber-400/50 hover:bg-black/45",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-amber-400/25 bg-black/50">
              <StoryIcon className={clsx("h-3.5 w-3.5", storyConfig.accent)} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-medium text-amber-50">{event.presentation.title}</h3>
              {event.presentation.owner && (
                <p className="truncate text-[11px] text-amber-400/70">by {event.presentation.owner}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 text-right sm:flex-row sm:items-center sm:gap-2">
            <div className="flex items-center gap-1 rounded border border-amber-400/20 bg-black/40 px-2 py-1 text-[10px] text-amber-400/70">
              <Clock className="h-3 w-3" />
              <span>{getRelativeTime(event.timestampMs)}</span>
            </div>
            {event.story === "BattleStory" && (
              <button
                type="button"
                disabled={!eventLocation || isNavigating}
                onClick={(evt) => {
                  evt.stopPropagation();
                  if (!eventLocation || isNavigating) return;
                  onNavigateToEvent?.(event);
                }}
                className={clsx(
                  "inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                  "border-amber-400/60 bg-black/30 text-amber-50 hover:bg-amber-500/10",
                  (!eventLocation || isNavigating) && "cursor-not-allowed border-amber-400/15 text-amber-400/60",
                )}
              >
                <Navigation className="h-3 w-3" />
                {eventLocation ? (isNavigating ? "Locating…" : "View hex") : "No hex"}
              </button>
            )}
          </div>
        </div>

        {details.length > 0 && (
          <div className="mt-2">
            <DetailGrid details={details} columns={details.length > 1 ? 2 : 1} />
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={clsx(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
              storyConfig.badge,
            )}
          >
            {storyConfig.label}
          </span>
        </div>
      </button>
    </li>
  );
};

const groupEventsByDate = (events: ProcessedStoryEvent[]) => {
  const groups: Array<{ dateKey: string; label: string; events: ProcessedStoryEvent[] }> = [];
  const bucket = new Map<string, ProcessedStoryEvent[]>();

  events.forEach((event) => {
    const dayStart = new Date(event.timestampMs);
    dayStart.setHours(0, 0, 0, 0);
    const key = dayStart.getTime().toString();
    const collection = bucket.get(key) ?? [];
    collection.push(event);
    bucket.set(key, collection);
  });

  Array.from(bucket.entries())
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .forEach(([key, dayEvents]) => {
      groups.push({
        dateKey: key,
        label: getDateHeaderLabel(Number(key)),
        events: dayEvents,
      });
    });

  return groups;
};

export const StoryEventsChronicles: React.FC = () => {
  const storyEvents = useStoryEvents(350);
  const isLoading = useStoryEventsLoading();
  const error = useStoryEventsError();
  const { setup } = useDojo();
  const { isMapView } = useQuery();
  const goToStructure = useGoToStructure(setup);
  const navigateToMapView = useNavigateToMapView();
  const mapDataStore = useMemo(() => MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL, sqlApi), []);
  const [mapDataVersion, setMapDataVersion] = useState(0);
  const [navigatingEventId, setNavigatingEventId] = useState<string | null>(null);

  const [filterState, setFilterState] = useState<ChroniclesFilterState>({
    searchTerm: "",
    storyType: "all",
    sortOrder: "newest",
  });
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  useEffect(() => {
    const handleRefresh = () => setMapDataVersion((version) => version + 1);
    mapDataStore.onRefresh(handleRefresh);
    return () => mapDataStore.offRefresh(handleRefresh);
  }, [mapDataStore]);

  useEffect(() => {
    if (mapDataStore.getStructureCount() === 0) {
      void mapDataStore.refresh().catch((error) => {
        console.error("[StoryEventsChronicles] Failed to hydrate map data store", error);
      });
    }
  }, [mapDataStore]);

  const allEvents = storyEvents.data ?? [];

  const getEventLocation = useCallback(
    (event: ProcessedStoryEvent | null): EventLocation | null => {
      if (!event || event.story !== "BattleStory") return null;

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

  const sortedEvents = useMemo(() => {
    const copy = [...allEvents];
    copy.sort((a, b) => b.timestampMs - a.timestampMs);
    if (filterState.sortOrder === "oldest") copy.reverse();
    return copy;
  }, [allEvents, filterState.sortOrder]);

  const storyCounts = useMemo(() => {
    const counts = {} as Record<StoryFilterValue, number>;
    STORY_FILTER_VALUES.forEach((key) => {
      counts[key] = key === "all" ? sortedEvents.length : 0;
    });
    sortedEvents.forEach((event) => {
      const key = resolveStoryKey(event.story);
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [sortedEvents]);

  const recentEvents = useMemo(() => {
    const oneDayAgo = Date.now() - 86400000;
    return sortedEvents.filter((event) => event.timestampMs >= oneDayAgo).length;
  }, [sortedEvents]);

  const searchFilteredEvents = useMemo(() => {
    if (!filterState.searchTerm) return sortedEvents;
    const q = filterState.searchTerm.toLowerCase();
    return sortedEvents.filter((event) => {
      const { title, description, owner } = event.presentation;
      return (
        title.toLowerCase().includes(q) ||
        (description?.toLowerCase().includes(q) ?? false) ||
        (owner?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [sortedEvents, filterState.searchTerm]);

  const storyFilteredEvents = useMemo(() => {
    if (filterState.storyType === "all") return searchFilteredEvents;
    return searchFilteredEvents.filter((e) => resolveStoryKey(e.story) === filterState.storyType);
  }, [searchFilteredEvents, filterState.storyType]);

  useEffect(() => {
    setVisibleCount(DEFAULT_VISIBLE_EVENTS);
    setSelectedEventId(null);
  }, [filterState.storyType, filterState.searchTerm, filterState.sortOrder]);

  useEffect(() => {
    if (!storyFilteredEvents.length) {
      setSelectedEventId(null);
      return;
    }
    if (!selectedEventId || !storyFilteredEvents.some((e) => e.id === selectedEventId)) {
      setSelectedEventId(storyFilteredEvents[0].id);
    }
  }, [storyFilteredEvents, selectedEventId]);

  const visibleEvents = useMemo(() => storyFilteredEvents.slice(0, visibleCount), [storyFilteredEvents, visibleCount]);

  const groupedEvents = useMemo(() => groupEventsByDate(visibleEvents), [visibleEvents]);

  const highlightedEvent = useMemo(() => {
    if (!selectedEventId) return storyFilteredEvents[0] ?? null;
    return storyFilteredEvents.find((e) => e.id === selectedEventId) ?? storyFilteredEvents[0] ?? null;
  }, [storyFilteredEvents, selectedEventId]);
  const highlightedLocation = useMemo(() => getEventLocation(highlightedEvent), [getEventLocation, highlightedEvent]);

  const handleRefresh = useCallback(() => {
    storyEvents.refetch();
  }, [storyEvents]);

  const handleResetFilters = useCallback(() => {
    setFilterState({ searchTerm: "", storyType: "all", sortOrder: "newest" });
  }, []);

  const handleNavigateToEvent = useCallback(
    async (event: ProcessedStoryEvent) => {
      const location = getEventLocation(event);
      if (!location) {
        console.warn("[StoryEventsChronicles] Unable to resolve location for event", event.id);
        return;
      }

      setNavigatingEventId(event.id);
      const position = new Position({ x: location.coordX, y: location.coordY });

      try {
        if (location.type === "structure") {
          await goToStructure(location.entityId, position, isMapView);
        } else {
          navigateToMapView(position);
        }
      } catch (error) {
        console.error("[StoryEventsChronicles] Failed to navigate to event location", error);
      } finally {
        setNavigatingEventId(null);
      }
    },
    [getEventLocation, goToStructure, isMapView, navigateToMapView],
  );

  const canShowMore = visibleCount < storyFilteredEvents.length;

  if (isLoading && !allEvents.length) {
    return (
      <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 rounded-md border border-amber-400/25 bg-black/45 p-6 text-amber-200">
        <LoadingAnimation />
        <div className="text-center">
          <h3 className="text-sm font-semibold text-amber-50">Loading…</h3>
          <p className="mt-1 max-w-sm text-xs text-amber-400/70">Gathering chronicles from the realm…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-md border border-rose-500/40 bg-black/55 p-6 text-center">
        <ScrollText className="h-6 w-6 text-rose-400" />
        <h3 className="text-sm font-semibold text-amber-50">Error loading</h3>
        <p className="max-w-sm text-xs text-amber-400/75">Connection to the chronicle archive failed. Try again.</p>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="border-amber-400/60 text-amber-100 hover:bg-amber-500/15"
          forceUppercase={false}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 rounded-xl border border-amber-400/20 bg-gradient-to-br from-stone-950/95 via-stone-950/70 to-black/60 p-5 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
      {/* ...existing header... */}
      <div
        className={clsx(
          "grid gap-5",
          filtersCollapsed
            ? "md:grid-cols-[56px_minmax(0,1fr)]"
            : "md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]",
        )}
      >
        <ChroniclesFilterPanel
          state={filterState}
          onChange={setFilterState}
          onReset={handleResetFilters}
          storyCounts={storyCounts}
          totalEvents={sortedEvents.length}
          recentEvents={recentEvents}
          collapsed={filtersCollapsed}
          onToggle={() => setFiltersCollapsed((c) => !c)}
        />
        <div className="flex flex-col gap-5">
          <ActivityHighlight
            event={highlightedEvent}
            eventLocation={highlightedLocation}
            onNavigateToEvent={handleNavigateToEvent}
            isNavigating={Boolean(highlightedEvent && navigatingEventId === highlightedEvent.id)}
          />

          <section
            key={`${filterState.storyType}-${filterState.searchTerm}-${filterState.sortOrder}`}
            className="rounded-md border border-amber-400/20 bg-black/30"
          >
            <div className="max-h-[70vh] overflow-y-auto p-4">
              {storyFilteredEvents.length === 0 ? (
                <div className="flex min-h-[140px] flex-col items-center justify-center gap-3 text-center">
                  <BookOpen className="h-6 w-6 text-amber-400/60" />
                  <div>
                    <h3 className="text-sm font-semibold text-amber-50">No matches</h3>
                    <p className="mt-1 text-xs text-amber-400/70">Adjust or clear filters to continue exploring.</p>
                  </div>
                </div>
              ) : (
                <ul className="space-y-8">
                  {groupedEvents.map((group) => (
                    <li key={group.dateKey} className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-amber-400/70" />
                        <h2 className="text-sm font-semibold text-amber-50">{group.label}</h2>
                        <span className="rounded border border-amber-400/25 px-2 py-0.5 text-[10px] text-amber-400/70">
                          {group.events.length} events
                        </span>
                      </div>
                      <ul className="space-y-4">
                        {group.events.map((event) => {
                          const eventLocation = getEventLocation(event);
                          return (
                            <TimelineEventCard
                              key={event.id}
                              event={event}
                              isActive={event.id === selectedEventId}
                              onSelect={() => setSelectedEventId(event.id)}
                              eventLocation={eventLocation}
                              onNavigateToEvent={handleNavigateToEvent}
                              isNavigating={Boolean(navigatingEventId === event.id)}
                            />
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}

              {canShowMore && storyFilteredEvents.length > 0 && (
                <div className="mt-8 text-center">
                  <Button
                    onClick={() => setVisibleCount((c) => c + DEFAULT_VISIBLE_EVENTS)}
                    variant="outline"
                    className="border-amber-400/60 px-4 py-2 text-amber-100 hover:bg-amber-500/15"
                    forceUppercase={false}
                  >
                    Load more
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
