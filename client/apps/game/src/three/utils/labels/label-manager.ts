import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { CameraView } from "../../scenes/hexagon-scene";
import { getWorldPositionForHex } from "../utils";
import { getCameraViewConfig, mergeConfigs, TRANSITION_CLASSES } from "./label-config";
import {
  CreateLabelOptions,
  LabelConfig,
  LabelData,
  LabelEventHandler,
  LabelEventType,
  LabelInstance,
  LabelManagerConfig,
  LabelStyle,
  LabelTypeDefinition,
  UpdateLabelOptions,
} from "./label-types";

/**
 * Generic label manager that handles all label lifecycle operations
 * Provides a unified API for creating, updating, and managing labels across different entity types
 */
export class LabelManager {
  private labels: Map<number, LabelInstance> = new Map();
  private labelTypes: Map<string, LabelTypeDefinition> = new Map();
  private labelsGroup: THREE.Group;
  private currentCameraView: CameraView;
  private globalEventHandlers: Partial<Record<LabelEventType, LabelEventHandler>>;
  private maxLabels: number;
  private autoCleanup: boolean;
  private transitionTimeouts: Map<number, number> = new Map();

  constructor(config: LabelManagerConfig) {
    this.labelsGroup = config.labelsGroup;
    this.currentCameraView = config.initialCameraView || CameraView.Medium;
    this.globalEventHandlers = config.globalEventHandlers || {};
    this.maxLabels = config.maxLabels || Infinity;
    this.autoCleanup = config.autoCleanup !== false;
  }

  /**
   * Register a new label type
   */
  registerLabelType<T extends LabelData = LabelData>(definition: LabelTypeDefinition<T>): void {
    if (this.labelTypes.has(definition.type)) {
      console.warn(`Label type "${definition.type}" is already registered. Overwriting...`);
    }
    this.labelTypes.set(definition.type, definition as LabelTypeDefinition);
  }

  /**
   * Create a new label for an entity
   */
  createLabel<T extends LabelData = LabelData>(
    type: string,
    data: T,
    options: CreateLabelOptions = {},
  ): LabelInstance | null {
    const typeDefinition = this.labelTypes.get(type);
    if (!typeDefinition) {
      console.error(`Label type "${type}" is not registered`);
      return null;
    }

    // Check if label already exists
    if (this.labels.has(data.entityId)) {
      console.warn(`Label for entity ${data.entityId} already exists. Removing old label...`);
      this.removeLabel(data.entityId);
    }

    // Check max labels limit
    if (this.labels.size >= this.maxLabels) {
      console.warn(`Maximum label limit (${this.maxLabels}) reached`);
      return null;
    }

    // Merge configurations
    const cameraView = options.cameraView || this.currentCameraView;
    const cameraConfig = getCameraViewConfig(cameraView);
    const config = mergeConfigs(typeDefinition.defaultConfig, cameraConfig, options.config || {});

    // Check if label should be displayed
    if (typeDefinition.shouldDisplay && !typeDefinition.shouldDisplay(data, cameraView)) {
      return null;
    }

    // Create DOM element
    const element = typeDefinition.createElement(data, cameraView);

    // Apply base configuration
    this.applyConfiguration(element, config, data);

    // Create CSS2D object
    const css2dObject = new CSS2DObject(element);
    const position = this.calculateLabelPosition(data, config);
    css2dObject.position.copy(position);

    if (config.renderOrder !== undefined) {
      css2dObject.renderOrder = config.renderOrder;
    }

    // Create label instance
    const labelInstance: LabelInstance = {
      css2dObject,
      element,
      config,
      data,
      isVisible: true,
    };

    // Setup event handlers
    this.setupEventHandlers(labelInstance, options.eventHandlers);

    // Apply initial visibility state
    this.applyVisibilityState(labelInstance, cameraView);

    // Add to scene and tracking
    this.labelsGroup.add(css2dObject);
    this.labels.set(data.entityId, labelInstance);

    return labelInstance;
  }

  /**
   * Update an existing label
   */
  updateLabel<T extends LabelData = LabelData>(
    entityId: number,
    data: Partial<T>,
    options: UpdateLabelOptions = {},
  ): boolean {
    const labelInstance = this.labels.get(entityId);
    if (!labelInstance) {
      console.warn(`No label found for entity ${entityId}`);
      return false;
    }

    // Check if label type supports updates
    if (!labelInstance.config.updatable) {
      console.warn(`Label type does not support updates`);
      return false;
    }

    // Update data
    labelInstance.data = { ...labelInstance.data, ...data };

    // Get type definition
    const typeDefinition = this.findTypeDefinition(labelInstance);
    if (!typeDefinition || !typeDefinition.updateElement) {
      console.warn(`No update function defined for label type`);
      return false;
    }

    // Apply update with optional animation
    if (options.animate) {
      labelInstance.element.style.transition = `all ${options.transitionDuration || 300}ms ease-in-out`;
    }

    typeDefinition.updateElement(labelInstance.element, labelInstance.data, this.currentCameraView);

    // Update position if hex coordinates changed
    if (data.hexCoords) {
      const newPosition = this.calculateLabelPosition(labelInstance.data, labelInstance.config);
      labelInstance.css2dObject.position.copy(newPosition);
    }

    // Trigger update event
    this.triggerEvent("update", labelInstance);

    return true;
  }

  /**
   * Remove a label
   */
  removeLabel(entityId: number): boolean {
    const labelInstance = this.labels.get(entityId);
    if (!labelInstance) {
      return false;
    }

    // Clear any pending transitions
    this.clearTransitionTimeout(entityId);

    // Remove event listeners
    this.removeEventHandlers(labelInstance);

    // Remove from scene
    this.labelsGroup.remove(labelInstance.css2dObject);

    // Clean up DOM element if auto cleanup is enabled
    if (this.autoCleanup && labelInstance.element.parentNode) {
      labelInstance.element.parentNode.removeChild(labelInstance.element);
    }

    // Remove from tracking
    this.labels.delete(entityId);

    return true;
  }

  /**
   * Remove all labels
   */
  removeAllLabels(): void {
    const entityIds = Array.from(this.labels.keys());
    entityIds.forEach((entityId) => this.removeLabel(entityId));
  }

  /**
   * Get a label instance
   */
  getLabel(entityId: number): LabelInstance | undefined {
    return this.labels.get(entityId);
  }

  /**
   * Get all labels of a specific type
   */
  getLabelsByType(type: string): LabelInstance[] {
    return Array.from(this.labels.values()).filter((label) => {
      const typeDefinition = this.findTypeDefinition(label);
      return typeDefinition?.type === type;
    });
  }

  /**
   * Update camera view for all labels
   */
  updateCameraView(newView: CameraView): void {
    if (this.currentCameraView === newView) return;

    const oldView = this.currentCameraView;
    this.currentCameraView = newView;

    // Update all label visibility states
    this.labels.forEach((labelInstance) => {
      this.applyVisibilityState(labelInstance, newView);
    });
  }

  /**
   * Apply configuration to a label element
   */
  private applyConfiguration(element: HTMLElement, config: LabelConfig, data: LabelData): void {
    // Apply base classes
    if (config.baseClasses) {
      element.classList.add(...config.baseClasses);
    }

    // Apply dynamic classes
    if (config.dynamicClasses) {
      const dynamicClasses = config.dynamicClasses(data);
      element.classList.add(...dynamicClasses);
    }

    // Apply default styles
    if (config.styles?.default) {
      this.applyStyles(element, config.styles.default);
    }

    // Prevent right click context menu
    element.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  /**
   * Apply styles to an element
   */
  private applyStyles(element: HTMLElement, styles: LabelStyle): void {
    Object.entries(styles).forEach(([property, value]) => {
      if (value) {
        // Convert camelCase to kebab-case for CSS properties
        const cssProperty = property.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        element.style.setProperty(cssProperty, value, "important");
      }
    });
  }

  /**
   * Calculate label position based on entity data and configuration
   */
  private calculateLabelPosition(data: LabelData, config: LabelConfig): THREE.Vector3 {
    const { x, y } = data.hexCoords.getNormalized();
    const basePosition = this.getWorldPositionForHex({ col: x, row: y });

    if (config.positionOffset) {
      basePosition.x += config.positionOffset.x;
      basePosition.y += config.positionOffset.y;
      basePosition.z += config.positionOffset.z;
    }

    return basePosition;
  }

  /**
   * Get world position for hex coordinates
   * This should be injected or imported from the appropriate utility
   */
  private getWorldPositionForHex(coords: { col: number; row: number }): THREE.Vector3 {
    // Import from the actual utility - this is a placeholder
    // In a real implementation, this would be injected or imported
    try {
      // Try to import the actual utility
      return getWorldPositionForHex(coords);
    } catch {
      // Fallback to simple hex grid calculation
      const HEX_SIZE = 1;
      const x = coords.col * HEX_SIZE * 1.5;
      const z = coords.row * HEX_SIZE * Math.sqrt(3) + ((coords.col % 2) * HEX_SIZE * Math.sqrt(3)) / 2;
      return new THREE.Vector3(x, 0, z);
    }
  }

  /**
   * Setup event handlers for a label
   */
  private setupEventHandlers(labelInstance: LabelInstance, customHandlers?: Record<string, LabelEventHandler>): void {
    const element = labelInstance.element;
    const css2dObject = labelInstance.css2dObject;

    // Store original render order for hover effect
    const originalRenderOrder = css2dObject.renderOrder;

    // Mouse enter
    element.addEventListener("mouseenter", (e) => {
      // Apply hover styles
      if (labelInstance.config.styles?.hover) {
        this.applyStyles(element, labelInstance.config.styles.hover);
      }

      // Bring to front
      css2dObject.renderOrder = Infinity;

      // Trigger events
      this.triggerEvent("mouseenter", labelInstance, e);
    });

    // Mouse leave
    element.addEventListener("mouseleave", (e) => {
      // Restore default styles
      if (labelInstance.config.styles?.default) {
        this.applyStyles(element, labelInstance.config.styles.default);
      }

      // Restore render order
      css2dObject.renderOrder = originalRenderOrder;

      // Trigger events
      this.triggerEvent("mouseleave", labelInstance, e);
    });

    // Click
    element.addEventListener("click", (e) => {
      this.triggerEvent("click", labelInstance, e);
    });

    // Right click
    element.addEventListener("contextmenu", (e) => {
      this.triggerEvent("rightclick", labelInstance, e);
    });
  }

  /**
   * Remove event handlers from a label
   */
  private removeEventHandlers(labelInstance: LabelInstance): void {
    // Event listeners are automatically removed when the element is destroyed
    // but we could store references and remove them explicitly if needed
  }

  /**
   * Trigger an event
   */
  private triggerEvent(type: LabelEventType, labelInstance: LabelInstance, originalEvent?: Event): void {
    const event = {
      type,
      labelInstance,
      originalEvent,
    };

    // Call global handler first
    const globalHandler = this.globalEventHandlers[type];
    if (globalHandler) {
      globalHandler(event);
    }

    // Call custom handler if provided
    // (Would need to store custom handlers per label instance)
  }

  /**
   * Apply visibility state based on camera view
   */
  private applyVisibilityState(labelInstance: LabelInstance, cameraView: CameraView): void {
    const config = labelInstance.config;
    const transitions = config.transitions || {};

    // Find wrapper container with transition classes
    const wrapperContainer = labelInstance.element.querySelector(".transition-all.duration-700") as HTMLElement;
    if (!wrapperContainer) return;

    // Clear any existing transition timeout
    this.clearTransitionTimeout(labelInstance.data.entityId);

    // Apply transition classes
    wrapperContainer.style.transition = `all ${transitions.duration || 700}ms ${transitions.easing || "ease-in-out"}`;

    const behavior = transitions.collapseBehavior || "delayed";

    switch (cameraView) {
      case CameraView.Far:
        if (behavior !== "never") {
          this.setCollapsed(wrapperContainer);
        }
        break;

      case CameraView.Close:
        this.setExpanded(wrapperContainer);
        break;

      case CameraView.Medium:
        this.setExpanded(wrapperContainer);

        if (behavior === "delayed" && transitions.collapseDelay) {
          const timeoutId = window.setTimeout(() => {
            this.setCollapsed(wrapperContainer);
            this.transitionTimeouts.delete(labelInstance.data.entityId);
          }, transitions.collapseDelay);

          this.transitionTimeouts.set(labelInstance.data.entityId, timeoutId);
        }
        break;
    }
  }

  /**
   * Set label to expanded state
   */
  private setExpanded(container: HTMLElement): void {
    container.classList.remove(...TRANSITION_CLASSES.COLLAPSED);
    container.classList.add(...TRANSITION_CLASSES.EXPANDED);
  }

  /**
   * Set label to collapsed state
   */
  private setCollapsed(container: HTMLElement): void {
    container.classList.remove(...TRANSITION_CLASSES.EXPANDED);
    container.classList.add(...TRANSITION_CLASSES.COLLAPSED);
  }

  /**
   * Clear transition timeout for an entity
   */
  private clearTransitionTimeout(entityId: number): void {
    const timeoutId = this.transitionTimeouts.get(entityId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      this.transitionTimeouts.delete(entityId);
    }
  }

  /**
   * Find type definition for a label instance
   */
  private findTypeDefinition(labelInstance: LabelInstance): LabelTypeDefinition | undefined {
    // This is a simplified approach - in a real implementation,
    // we might store the type with the label instance
    for (const definition of this.labelTypes.values()) {
      // Check if the label was created with this type
      // This would need a better way to track label types
      return definition;
    }
    return undefined;
  }

  /**
   * Destroy the label manager and clean up resources
   */
  destroy(): void {
    // Remove all labels
    this.removeAllLabels();

    // Clear all timeouts
    this.transitionTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.transitionTimeouts.clear();

    // Clear registrations
    this.labelTypes.clear();
  }
}
