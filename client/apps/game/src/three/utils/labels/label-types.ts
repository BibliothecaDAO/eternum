import { Position } from "@/types/position";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { CameraView } from "../../scenes/hexagon-scene";
import * as THREE from "three";

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
 * Label instance with Three.js object and metadata
 */
export interface LabelInstance {
  css2dObject: CSS2DObject;
  element: HTMLElement;
  config: LabelConfig;
  data: LabelData;
  isVisible: boolean;
  transitionTimeoutId?: number;
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

/**
 * Event types for label interactions
 */
export type LabelEventType = "mouseenter" | "mouseleave" | "click" | "rightclick" | "update";

/**
 * Label event handler
 */
export interface LabelEventHandler {
  (event: {
    type: LabelEventType;
    labelInstance: LabelInstance;
    originalEvent?: Event;
  }): void;
}

/**
 * Options for creating a label
 */
export interface CreateLabelOptions {
  /** Override the default configuration */
  config?: Partial<LabelConfig>;
  /** Initial camera view state */
  cameraView?: CameraView;
  /** Custom event handlers */
  eventHandlers?: Record<LabelEventType, LabelEventHandler>;
}

/**
 * Options for updating labels
 */
export interface UpdateLabelOptions {
  /** Whether to animate the update */
  animate?: boolean;
  /** Custom transition duration for this update */
  transitionDuration?: number;
}

/**
 * Label manager configuration
 */
export interface LabelManagerConfig {
  /** Three.js group to add labels to */
  labelsGroup: THREE.Group;
  /** Initial camera view */
  initialCameraView?: CameraView;
  /** Global event handlers that apply to all labels */
  globalEventHandlers?: Partial<Record<LabelEventType, LabelEventHandler>>;
  /** Maximum number of labels to display */
  maxLabels?: number;
  /** Whether to automatically clean up labels on removal */
  autoCleanup?: boolean;
}

/**
 * Camera view transition info
 */
export interface CameraViewTransition {
  from: CameraView;
  to: CameraView;
  timestamp: number;
}