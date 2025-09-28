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
import { type ComponentType, useMemo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import type { StoryEventIcon } from "@bibliothecadao/eternum";

import { type StoryEventFeedItem, useStoryEventToasts } from "./story-event-toast-provider";

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

export function StoryEventStream() {
  const { visibleEvents } = useStoryEventToasts();

  const orderedEvents = useMemo(() => [...visibleEvents].sort((a, b) => b.createdAt - a.createdAt), [visibleEvents]);

  if (orderedEvents.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-8 left-6 z-[1100] flex w-full max-w-xs flex-col">
      <ul role="log" aria-live="polite" className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {orderedEvents.map((item) => (
            <StreamItem key={item.id} item={item} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

interface StreamItemProps {
  item: StoryEventFeedItem;
}

function StreamItem({ item }: StreamItemProps) {
  const { event } = item;
  const theme = STORY_EVENT_THEMES[event.icon] ?? STORY_EVENT_THEMES.scroll;
  const Icon = theme.icon;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="pointer-events-none relative pl-3 text-[11px] leading-tight text-zinc-200/75"
    >
      <span
        className={cn("absolute inset-y-1 left-0 w-[2px] rounded-full opacity-60 bg-gradient-to-b", theme.accent)}
        aria-hidden
      />
      <div className="flex items-start gap-1.5">
        <Icon className={cn("mt-0.5 h-3 w-3 opacity-70", theme.highlight)} aria-hidden />
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={cn("font-medium tracking-wide opacity-90", theme.highlight)}>{event.title}</span>
            {event.owner && <span className="text-[10px] uppercase text-zinc-400/70">{event.owner}</span>}
          </div>
          {event.description && <p className="mt-0.5 text-[10px] text-zinc-400/70 line-clamp-2">{event.description}</p>}
        </div>
      </div>
    </motion.li>
  );
}
