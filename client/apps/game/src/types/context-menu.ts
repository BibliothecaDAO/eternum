import { SceneName } from "@/three/types";

export type ContextMenuLayout = "auto" | "list" | "radial";

export interface ContextMenuRadialOptions {
  radius?: number;
  innerRadius?: number;
  selectRadius?: number;
  gapDegrees?: number;
  maxActions?: number;
}

export interface ContextMenuAction {
  id: string;
  label: string;
  disabled?: boolean;
  hint?: string;
  icon?: string;
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
  layout?: ContextMenuLayout;
  radialOptions?: ContextMenuRadialOptions;
  metadata?: ContextMenuMetadata;
}
