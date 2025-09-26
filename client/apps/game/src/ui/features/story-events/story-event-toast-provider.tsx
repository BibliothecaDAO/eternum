import {
  createContext,
  type ComponentType,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Castle,
  Hammer,
  Factory,
  Swords,
  Coins,
  Shield,
  Trophy,
  Navigation,
  AlertTriangle,
  ScrollText,
} from "lucide-react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { StoryEventPresentation, StoryEventIcon } from "@bibliothecadao/eternum";

export interface StoryEventToastProviderProps {
  children: ReactNode;
  /** Automatically dismiss each toast after this duration (ms). Defaults to 3000. */
  autoDismissMs?: number;
  /** Maximum number of toasts shown simultaneously. Excess items are queued and shown in succession. Defaults to 2. */
  maxVisible?: number;
}

interface ToastItem {
  id: string;
  createdAt: number;
  event: StoryEventPresentation;
}

interface StoryEventToastContextValue {
  pushToast: (event: StoryEventPresentation) => void;
  clearAll: () => void;
}

const StoryEventToastContext = createContext<StoryEventToastContextValue | undefined>(undefined);

const iconThemes: Record<StoryEventIcon, { panel: string; iconSurface: string; icon: string }> = {
  realm: {
    panel: "border-fuchsia-500/60 bg-gradient-to-r from-fuchsia-950/85 via-purple-950/70 to-violet-900/60",
    iconSurface: "bg-fuchsia-500/20",
    icon: "text-fuchsia-100",
  },
  building: {
    panel: "border-sky-500/55 bg-gradient-to-r from-slate-950/85 via-sky-950/60 to-blue-900/55",
    iconSurface: "bg-sky-500/20",
    icon: "text-sky-100",
  },
  production: {
    panel: "border-emerald-500/60 bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-stone-950/70",
    iconSurface: "bg-emerald-500/20",
    icon: "text-emerald-100",
  },
  battle: {
    panel: "border-rose-500/60 bg-gradient-to-r from-rose-950/85 via-amber-900/40 to-rose-900/55",
    iconSurface: "bg-rose-500/20",
    icon: "text-rose-100",
  },
  resource: {
    panel: "border-amber-500/60 bg-gradient-to-r from-amber-950/85 via-stone-950/70 to-amber-900/60",
    iconSurface: "bg-amber-500/20",
    icon: "text-amber-100",
  },
  troop: {
    panel: "border-indigo-500/60 bg-gradient-to-r from-indigo-950/85 via-stone-950/70 to-indigo-900/55",
    iconSurface: "bg-indigo-500/20",
    icon: "text-indigo-100",
  },
  prize: {
    panel: "border-yellow-400/60 bg-gradient-to-r from-yellow-950/80 via-amber-900/55 to-yellow-900/50",
    iconSurface: "bg-yellow-500/20",
    icon: "text-yellow-100",
  },
  travel: {
    panel: "border-teal-400/60 bg-gradient-to-r from-teal-950/80 via-cyan-900/55 to-slate-950/70",
    iconSurface: "bg-teal-500/20",
    icon: "text-teal-100",
  },
  alert: {
    panel: "border-red-500/60 bg-gradient-to-r from-red-950/85 via-rose-900/55 to-stone-950/75",
    iconSurface: "bg-red-500/20",
    icon: "text-red-100",
  },
  scroll: {
    panel: "border-slate-500/60 bg-gradient-to-r from-slate-950/85 via-stone-950/70 to-slate-900/60",
    iconSurface: "bg-slate-500/20",
    icon: "text-slate-100",
  },
};

const iconMap: Record<StoryEventIcon, ComponentType<{ className?: string }>> = {
  realm: Castle,
  building: Hammer,
  production: Factory,
  battle: Swords,
  resource: Coins,
  troop: Shield,
  prize: Trophy,
  travel: Navigation,
  alert: AlertTriangle,
  scroll: ScrollText,
};

export function StoryEventToastProvider({
  children,
  autoDismissMs = 3000,
  maxVisible = 2,
}: StoryEventToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const timeoutMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const processingQueue = useRef(false);

  const processQueue = useCallback(() => {
    if (processingQueue.current) return;

    setQueue((currentQueue) => {
      if (currentQueue.length === 0) return currentQueue;

      setToasts((currentToasts) => {
        if (currentToasts.length >= maxVisible) return currentToasts;

        const nextToast = currentQueue[0];

        // Schedule removal for the new toast
        const timeout = setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== nextToast.id));
          const timeoutRef = timeoutMap.current.get(nextToast.id);
          if (timeoutRef) {
            clearTimeout(timeoutRef);
            timeoutMap.current.delete(nextToast.id);
          }
          // Process next item in queue after removal
          setTimeout(() => processQueue(), 50);
        }, autoDismissMs);
        timeoutMap.current.set(nextToast.id, timeout);

        return [...currentToasts, nextToast];
      });

      return currentQueue.slice(1);
    });
  }, [maxVisible, autoDismissMs]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timeout = timeoutMap.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutMap.current.delete(id);
    }
    // Process queue after removal
    setTimeout(() => processQueue(), 50);
  }, [processQueue]);

  const pushToast = useCallback(
    (event: StoryEventPresentation) => {
      const id = `${event.title}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const newToast: ToastItem = { id, createdAt: Date.now(), event };

      setToasts((currentToasts) => {
        if (currentToasts.length < maxVisible) {
          // Space available, show immediately
          const timeout = setTimeout(() => removeToast(id), autoDismissMs);
          timeoutMap.current.set(id, timeout);
          return [...currentToasts, newToast];
        } else {
          // No space, add to queue
          setQueue((currentQueue) => [...currentQueue, newToast]);
          return currentToasts;
        }
      });
    },
    [maxVisible, autoDismissMs, removeToast],
  );

  const clearAll = useCallback(() => {
    timeoutMap.current.forEach((timeout) => clearTimeout(timeout));
    timeoutMap.current.clear();
    setToasts([]);
    setQueue([]);
    processingQueue.current = false;
  }, []);

  const value = useMemo<StoryEventToastContextValue>(
    () => ({
      pushToast,
      clearAll,
    }),
    [clearAll, pushToast],
  );

  const viewport = useMemo(() => {
    if (toasts.length === 0) return null;

    return (
      <div className="pointer-events-none fixed inset-x-0 top-6 z-[1100] flex justify-center">
        <ul className="flex w-full max-w-lg flex-col gap-3 px-4">
          {toasts.map((toast) => {
            const { icon, title, description, owner } = toast.event;
            const Icon = iconMap[icon] ?? ScrollText;
            const theme = iconThemes[icon] ?? iconThemes.scroll;

            return (
              <li
                key={toast.id}
                className={cn(
                  "pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-amber-50 shadow-lg backdrop-blur-md transition duration-200",
                  theme.panel,
                )}
              >
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-full shadow-inner", theme.iconSurface)}>
                  <Icon className={cn("h-5 w-5", theme.icon)} />
                </div>
                <div className="flex-1 text-sm leading-snug">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tracking-wide">{title}</span>
                    {owner && <span className="text-xs uppercase text-white/60">{owner}</span>}
                  </div>
                  {description && <p className="mt-1 text-xs text-white/70">{description}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }, [toasts]);

  return (
    <StoryEventToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" ? createPortal(viewport, document.body) : viewport}
    </StoryEventToastContext.Provider>
  );
}

export function useStoryEventToasts() {
  const context = useContext(StoryEventToastContext);
  if (!context) {
    throw new Error("useStoryEventToasts must be used within a StoryEventToastProvider");
  }
  return context;
}