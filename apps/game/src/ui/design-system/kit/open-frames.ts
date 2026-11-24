import { useEffect } from "react";
import { create } from "zustand";

const useOpenFrameStore = create<{ labels: readonly string[] }>(() => ({ labels: [] }));

export const useOpenFrameLabels = (): readonly string[] => useOpenFrameStore((state) => state.labels);

export const useMarkFrameOpen = (label: string): void => {
  useEffect(() => {
    useOpenFrameStore.setState((state) => ({ labels: [...state.labels, label] }));
    return () =>
      useOpenFrameStore.setState((state) => {
        const index = state.labels.indexOf(label);
        return { labels: state.labels.filter((_, at) => at !== index) };
      });
  }, [label]);
};
