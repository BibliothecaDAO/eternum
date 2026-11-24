import { useEffect } from "react";
import { create } from "zustand";

interface OpenFrame {
  readonly label: string;
  readonly opening: number;
}

const useOpenFrameStore = create<{ frames: readonly OpenFrame[] }>(() => ({ frames: [] }));
let openings = 0;

export const useOpenFrames = (): readonly OpenFrame[] => useOpenFrameStore((state) => state.frames);

export const useMarkFrameOpen = (label: string): void => {
  useEffect(() => {
    const frame = { label, opening: ++openings };
    useOpenFrameStore.setState((state) => ({ frames: [...state.frames, frame] }));
    return () => useOpenFrameStore.setState((state) => ({ frames: state.frames.filter((open) => open !== frame) }));
  }, [label]);
};
