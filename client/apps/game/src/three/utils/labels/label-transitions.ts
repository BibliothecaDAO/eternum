import { CameraView } from "../../scenes/hexagon-scene";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

/**
 * Label transition management system.
 * 
 * This module provides transition management for label visibility and camera view changes.
 * It maintains backward compatibility with existing managers while the label system
 * is being migrated to the new LabelManager architecture.
 * 
 * Key features:
 * - LabelTransitionDB: In-memory database for tracking label transition states
 * - transitionManager: Simple interface for managing label transitions  
 * - applyLabelTransitions: Handles camera view transitions for existing labels
 * 
 * For new label functionality, use the label-manager.ts system.
 */

// In-memory database for managing label transitions
interface LabelTransitionRecord {
  id: string;
  timestamp: number;
  timeoutId?: number;
  type: "medium" | "close" | "far";
  entityType?: string;
  entityId?: string;
}

class LabelTransitionDB {
  private static instance: LabelTransitionDB;
  private records: Map<string, LabelTransitionRecord> = new Map();
  private indices: {
    byType: Map<string, Set<string>>;
    byEntity: Map<string, Set<string>>;
  } = {
    byType: new Map(),
    byEntity: new Map(),
  };

  private constructor() {}

  static getInstance(): LabelTransitionDB {
    if (!LabelTransitionDB.instance) {
      LabelTransitionDB.instance = new LabelTransitionDB();
    }
    return LabelTransitionDB.instance;
  }

  // Database operations
  private addIndex(record: LabelTransitionRecord): void {
    // Index by type
    if (!this.indices.byType.has(record.type)) {
      this.indices.byType.set(record.type, new Set());
    }
    this.indices.byType.get(record.type)!.add(record.id);

    // Index by entity if available
    if (record.entityType && record.entityId) {
      const entityKey = `${record.entityType}:${record.entityId}`;
      if (!this.indices.byEntity.has(entityKey)) {
        this.indices.byEntity.set(entityKey, new Set());
      }
      this.indices.byEntity.get(entityKey)!.add(record.id);
    }
  }

  private removeIndex(record: LabelTransitionRecord): void {
    // Remove from type index
    this.indices.byType.get(record.type)?.delete(record.id);

    // Remove from entity index if available
    if (record.entityType && record.entityId) {
      const entityKey = `${record.entityType}:${record.entityId}`;
      this.indices.byEntity.get(entityKey)?.delete(record.id);
    }
  }

  private clearTimeout(id: string): void {
    const record = this.records.get(id);
    if (record?.timeoutId) {
      window.clearTimeout(record.timeoutId);
      // Update record
      record.timeoutId = undefined;
      this.records.set(id, record);
    }
  }

  // Public API
  set(id: string, type: "medium" | "close" | "far", entityType?: string, entityId?: string): void {
    // Transaction-like behavior: get and clear existing record first
    this.delete(id);

    // Create new record
    const record: LabelTransitionRecord = {
      id,
      timestamp: Date.now(),
      type,
      entityType,
      entityId,
    };

    // Store and index
    this.records.set(id, record);
    this.addIndex(record);
  }

  get(id: string): LabelTransitionRecord | undefined {
    return this.records.get(id);
  }

  delete(id: string): void {
    const record = this.records.get(id);
    if (record) {
      // Clean up timeout if exists
      this.clearTimeout(id);
      // Remove from indices
      this.removeIndex(record);
      // Remove record
      this.records.delete(id);
    }
  }

  // Specific methods for label transitions
  setMediumViewTransition(id: string, entityType?: string, entityId?: string): void {
    this.set(id, "medium", entityType, entityId);
  }

  getMediumViewExpanded(id: string): boolean {
    const record = this.get(id);
    return record && record.type === "medium" ? Date.now() - record.timestamp < 2000 : false;
  }

  clearMediumViewTransition(id: string): void {
    this.delete(id);
  }

  scheduleTimeout(id: string, callback: () => void, ms: number): void {
    const record = this.records.get(id);
    if (record) {
      // Clear existing timeout
      this.clearTimeout(id);

      // Set new timeout
      const timeoutId = window.setTimeout(() => {
        callback();
        // Update record to show timeout completed
        if (this.records.has(id)) {
          const updatedRecord = this.records.get(id)!;
          updatedRecord.timeoutId = undefined;
          this.records.set(id, updatedRecord);
        }
      }, ms);

      // Update record with new timeout ID
      record.timeoutId = timeoutId;
      this.records.set(id, record);
    }
  }

  // Clear all expired records (useful for periodic cleanup)
  cleanupExpired(maxAge: number = 5000): number {
    const now = Date.now();
    let cleanedCount = 0;

    this.records.forEach((record, id) => {
      if (!record.timeoutId && now - record.timestamp > maxAge) {
        this.delete(id);
        cleanedCount++;
      }
    });

    return cleanedCount;
  }
}

export const transitionDB = LabelTransitionDB.getInstance();

// Export the transitionManager alias for backward compatibility
export const transitionManager = {
  setMediumViewTransition: (id: string = "global", entityType?: string, entityId?: string) =>
    transitionDB.setMediumViewTransition(id, entityType, entityId),
  getMediumViewExpanded: (id: string = "global") => transitionDB.getMediumViewExpanded(id),
  clearMediumViewTransition: (id: string = "global") => transitionDB.clearMediumViewTransition(id),
  setLabelTimeout: (callback: () => void, ms: number, id: string = "global") =>
    transitionDB.scheduleTimeout(id, callback, ms),
  clearTimeout: (id: string = "global") => transitionDB.delete(id),
};

// Centralized camera view transition handling for existing labels
// This is kept for backward compatibility with existing managers
export const applyLabelTransitions = (labelsMap: Map<any, CSS2DObject>, cameraView: CameraView) => {
  const styleExtended = ["max-w-[1000px]", "ml-2", "opacity-100"];
  const styleCollapsed = ["max-w-0", "ml-0", "opacity-0"];

  labelsMap.forEach((label, entityId) => {
    if (label.element) {
      // Look for the wrapper div with transition classes
      const wrapperContainer = label.element.querySelector(".transition-all.duration-700");
      if (wrapperContainer) {
        // Get or create a container ID for tracking timeouts
        let containerId = (wrapperContainer as HTMLElement).dataset.containerId;
        if (!containerId) {
          containerId = `structure_${entityId}_${Math.random().toString(36).substring(2, 9)}`;
          (wrapperContainer as HTMLElement).dataset.containerId = containerId;
        }

        // Remove all existing styles first
        wrapperContainer.classList.remove(...styleExtended, ...styleCollapsed);

        if (cameraView === CameraView.Far) {
          // For Far view, always collapse immediately
          wrapperContainer.classList.add(...styleCollapsed);
          transitionManager.clearTimeout(containerId);
        } else if (cameraView === CameraView.Close) {
          // For Close view, always expand and never collapse
          wrapperContainer.classList.add(...styleExtended);
          transitionManager.clearTimeout(containerId);
        } else if (cameraView === CameraView.Medium) {
          // For Medium view, expand initially
          wrapperContainer.classList.add(...styleExtended);

          // And set up timeout to collapse after 2 seconds
          transitionManager.setMediumViewTransition(containerId);
          transitionManager.setLabelTimeout(
            () => {
              if (wrapperContainer.isConnected) {
                wrapperContainer.classList.remove(...styleExtended);
                wrapperContainer.classList.add(...styleCollapsed);
                transitionManager.clearMediumViewTransition(containerId);
              }
            },
            2000,
            containerId,
          );
        }
      }
    }
  });
};

/**
 * All legacy label creation functionality has been moved to the new modular system.
 * Use LabelManager and the label factory for all new label implementations.
 */