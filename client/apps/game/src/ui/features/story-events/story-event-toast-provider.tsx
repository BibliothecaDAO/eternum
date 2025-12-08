import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";

import type { StoryEventPresentation, StoryEventSystemUpdate } from "@bibliothecadao/eternum";

export interface StoryEventToastProviderProps {
  children: ReactNode;
  /** Automatically dismiss each toast after this duration (ms). Defaults to 6000. */
  autoDismissMs?: number;
  /** Maximum number of toasts shown simultaneously. Excess items are queued and shown in succession. Defaults to 5. */
  maxVisible?: number;
}

export interface StoryEventFeedItem {
  id: string;
  createdAt: number;
  event: StoryEventPresentation;
  source?: StoryEventSystemUpdate;
}

interface StoryEventToastContextValue {
  pushToast: (event: StoryEventPresentation, source?: StoryEventSystemUpdate) => void;
  clearAll: () => void;
  visibleEvents: StoryEventFeedItem[];
}

const StoryEventToastContext = createContext<StoryEventToastContextValue | undefined>(undefined);

export function StoryEventToastProvider({
  children,
  autoDismissMs = 12000,
  maxVisible = 5,
}: StoryEventToastProviderProps) {
  const [toasts, setToasts] = useState<StoryEventFeedItem[]>([]);
  const [, setQueue] = useState<StoryEventFeedItem[]>([]);
  const timeoutMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const processQueue = useCallback(() => {
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

  const removeToast = useCallback(
    (id: string) => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      const timeout = timeoutMap.current.get(id);
      if (timeout) {
        clearTimeout(timeout);
        timeoutMap.current.delete(id);
      }
      // Process queue after removal
      setTimeout(() => processQueue(), 50);
    },
    [processQueue],
  );

  const pushToast = useCallback(
    (event: StoryEventPresentation, source?: StoryEventSystemUpdate) => {
      const id = `${event.title}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const newToast: StoryEventFeedItem = { id, createdAt: Date.now(), event, source };

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
  }, []);

  const value = useMemo<StoryEventToastContextValue>(
    () => ({
      pushToast,
      clearAll,
      visibleEvents: toasts,
    }),
    [clearAll, pushToast, toasts],
  );

  return <StoryEventToastContext.Provider value={value}>{children}</StoryEventToastContext.Provider>;
}

export function useStoryEventToasts() {
  const context = useContext(StoryEventToastContext);
  if (!context) {
    throw new Error("useStoryEventToasts must be used within a StoryEventToastProvider");
  }
  return context;
}
