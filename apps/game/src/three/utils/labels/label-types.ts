import { Position } from "@bibliothecadao/eternum";

import { CameraView } from "../../scenes/camera-view";

/**
 * Core label data interface that all label types must implement
 */
export interface LabelData {
  entityId: number;
  hexCoords: Position;
  [key: string]: any; // Allow additional properties for specific label types
}

/**
 * Configuration for label appearance and behavior
 */
export interface LabelConfig {
  /** Base CSS classes applied to all labels of this type */
  baseClasses?: string[];
  /** Function to determine dynamic CSS classes based on label data */
  dynamicClasses?: (data: LabelData) => string[];
  /** Style configuration for different states */
  styles?: {
    default?: LabelStyle;
    hover?: LabelStyle;
    selected?: LabelStyle;
  };
  /** Transition configuration for camera view changes */
  transitions?: {
    duration?: number;
    easing?: string;
    collapseBehavior?: "immediate" | "delayed" | "never";
    collapseDelay?: number;
  };
  /** Position offset from the entity's world position */
  positionOffset?: { x: number; y: number; z: number };
  /** Render order for layering */
  renderOrder?: number;
  /** Whether this label type supports updates */
  updatable?: boolean;
}

/**
 * Style properties for labels
 */
export interface LabelStyle {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: string;
  padding?: string;
  fontSize?: string;
  fontWeight?: string;
  opacity?: string;
  [key: string]: string | undefined; // Index signature for CSS properties
}

/**
 * Label type definition for the registry
 */
export interface LabelTypeDefinition<T extends LabelData = LabelData> {
  /** Unique identifier for this label type */
  type: string;
  /** Default configuration for this label type */
  defaultConfig: LabelConfig;
  /** Function to create the label's DOM element */
  createElement: (data: T, cameraView: CameraView) => HTMLElement;
  /** Optional function to update an existing label */
  updateElement?: (element: HTMLElement, data: T, cameraView: CameraView) => void;
  /** Optional function to determine if a label should be visible */
  shouldDisplay?: (data: T, cameraView: CameraView) => boolean;
}
