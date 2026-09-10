import { SceneName } from "@/three/types";
import type { ReactNode } from "react";

export interface ContextMenuAction {
  id: string;
  label: string;
  disabled?: boolean;
  hint?: string;
  icon?: string;
  iconComponent?: ReactNode;
  onSelect: () => void;
  children?: ContextMenuAction[];
  childTitle?: string;
  childSubtitle?: string;
}

export interface ContextMenuMetadata {
  entityId?: unknown;
  entityType?: string;
  hex?: { col: number; row: number };
  [key: string]: unknown;
}

export interface ContextMenuState {
  id: string;
  title?: string;
  subtitle?: string;
  position: { x: number; y: number };
  scene: SceneName;
  actions: ContextMenuAction[];
  metadata?: ContextMenuMetadata;
}
