import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Castle from "lucide-react/dist/esm/icons/castle";
import Coins from "lucide-react/dist/esm/icons/coins";
import Factory from "lucide-react/dist/esm/icons/factory";
import Hammer from "lucide-react/dist/esm/icons/hammer";
import Navigation from "lucide-react/dist/esm/icons/navigation";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import Shield from "lucide-react/dist/esm/icons/shield";
import Swords from "lucide-react/dist/esm/icons/swords";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import type { ComponentType } from "react";

import type { StoryEventIcon } from "@bibliothecadao/eternum";

export const STORY_EVENT_THEMES: Record<
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

export interface BattleLocation {
  entityId: number;
  coordX: number;
  coordY: number;
  type: "structure" | "army";
}

export const formatEnum = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value.toString();
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 1) return keys[0];
  }
  return undefined;
};

export const parseNumeric = (value: unknown): number | null => {
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
    } catch {
      return null;
    }
  }
  return null;
};

export const formatCount = (value: number | null): string | undefined => {
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

export const formatTroopSummary = (countValue: unknown, typeValue: unknown, tierValue: unknown): string => {
  const count = formatCount(parseNumeric(countValue));
  const typeLabel = formatEnum(typeValue) ?? "Forces";
  const tierNumeric = parseNumeric(tierValue);
  const tierLabel = tierNumeric !== null ? `T${tierNumeric}` : formatEnum(tierValue);
  const parts = [count, tierLabel, typeLabel].filter(Boolean);
  return parts.length ? parts.join(" ") : "Unknown forces";
};

export const shortenAddress = (value: unknown): string => {
  if (!value) return "Unknown";
  const raw = String(value);
  if (!raw.startsWith("0x") || raw.length <= 10) return raw;
  return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
};

export const formatPlayerLabel = (value: unknown): string => {
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

export const extractRoleLabel = (description: string | undefined, role: "Attacker" | "Defender"): string | undefined => {
  if (!description) return undefined;
  const pattern = new RegExp(`${role}\\s*\\[(.*?)\\]`);
  const match = description.match(pattern);
  return match?.[1];
};

export interface StoryDescriptionSegment {
  label?: string;
  value: string;
}

export const parsePresentationDescription = (description?: string): StoryDescriptionSegment[] => {
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

export const findSegmentValue = (
  segments: StoryDescriptionSegment[],
  matcher: (label?: string) => boolean,
): string | undefined => {
  return segments.find((segment) => matcher(segment.label))?.value;
};

export const normalizePresentationTroops = (value?: string): string | undefined => {
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

export const formatWinnerName = (value?: string): string | undefined => {
  if (!value) return undefined;
  const match = value.match(/\[(.*?)\]/);
  if (match?.[1]) return match[1];
  return value;
};
