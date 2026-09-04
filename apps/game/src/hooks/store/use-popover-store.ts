import type { ReactNode } from "react";
import { create } from "zustand";

/** A screen rect a surface hangs from — a button's rect, or a scene point as a zero-size rect. */
export interface SurfaceAnchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Where a surface hangs from: a rect, a viewport edge, or null for the top centre. */
type SurfaceAnchorInput = SurfaceAnchor | "top-center" | "right-edge" | "bottom-right";

interface OpenSurface {
  id: string;
  content: ReactNode;
  anchor: SurfaceAnchorInput | null;
}

/**
 * Which anchored popover is open. At most one: opening another closes the current one, so a popover never needs
 * a scrim to guarantee exclusivity. A "surface" is a popover whose content is handed to the store instead of
 * rendered by a trigger — how a scene click or a plain button opens a large panel — and `SurfaceHost` renders it.
 */
interface PopoverStore {
  openId: string | null;
  surface: OpenSurface | null;
  open: (id: string) => void;
  close: (id?: string) => void;
  toggle: (id: string) => void;
  openSurface: (surface: { id: string; content: ReactNode; anchor?: SurfaceAnchorInput | null }) => void;
  closeSurface: () => void;
}

export const usePopoverStore = create<PopoverStore>()((set) => ({
  openId: null,
  surface: null,
  open: (id) => set({ openId: id, surface: null }),
  close: (id) => set((state) => (id === undefined || state.openId === id ? { openId: null, surface: null } : state)),
  toggle: (id) =>
    set((state) => (state.openId === id ? { openId: null, surface: null } : { openId: id, surface: null })),
  openSurface: ({ id, content, anchor = null }) => set({ openId: id, surface: { id, content, anchor } }),
  closeSurface: () => set((state) => (state.surface ? { openId: null, surface: null } : state)),
}));
