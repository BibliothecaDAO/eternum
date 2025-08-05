import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { CameraView } from "../scenes/hexagon-scene";
import { transitionManager } from "../utils/labels/label-transitions";
import { HexPosition, ID, HexEntityInfo } from "@bibliothecadao/types";

/**
 * Manager responsible for handling label expansion/collapse on hex hover
 * 
 * This class encapsulates all logic related to expanding labels when hovering over hexes
 * and collapsing them when moving away, while respecting camera view states.
 */
export class HoverLabelManager {
  private currentHoveredHex: HexPosition | null = null;
  private expandedLabelIds: Set<string> = new Set();
  private currentCameraView: CameraView;

  // Label groups for different entity types
  private armyLabelsGroup: THREE.Group;
  private structureLabelsGroup: THREE.Group;
  private questLabelsGroup: THREE.Group;
  private chestLabelsGroup: THREE.Group;

  // Function to get entities at a hex position
  private getHexagonEntity: (hexCoords: HexPosition) => {
    army?: HexEntityInfo;
    structure?: HexEntityInfo;
    quest?: HexEntityInfo;
    chest?: HexEntityInfo;
  };

  constructor(
    labelGroups: {
      army: THREE.Group;
      structure: THREE.Group;
      quest: THREE.Group;
      chest: THREE.Group;
    },
    getHexagonEntityFn: (hexCoords: HexPosition) => {
      army?: HexEntityInfo;
      structure?: HexEntityInfo;
      quest?: HexEntityInfo;
      chest?: HexEntityInfo;
    },
    initialCameraView: CameraView = CameraView.Medium
  ) {
    this.armyLabelsGroup = labelGroups.army;
    this.structureLabelsGroup = labelGroups.structure;
    this.questLabelsGroup = labelGroups.quest;
    this.chestLabelsGroup = labelGroups.chest;
    this.getHexagonEntity = getHexagonEntityFn;
    this.currentCameraView = initialCameraView;
  }

  /**
   * Handle mouse hover over a hex
   * @param hexCoords The hex coordinates being hovered
   */
  onHexHover(hexCoords: HexPosition): void {
    // Check if this is a different hex than currently hovered
    if (!this.currentHoveredHex || 
        this.currentHoveredHex.col !== hexCoords.col || 
        this.currentHoveredHex.row !== hexCoords.row) {
      
      // Collapse labels for previously hovered hex if any
      if (this.currentHoveredHex) {
        this.collapseLabelsForHex(this.currentHoveredHex);
      }
      
      // Expand labels for newly hovered hex
      this.expandLabelsForHex(hexCoords);
      this.currentHoveredHex = hexCoords;
    }
  }

  /**
   * Handle mouse leaving hexes (no hex hovered)
   */
  onHexLeave(): void {
    // Collapse labels for previously hovered hex
    if (this.currentHoveredHex) {
      this.collapseLabelsForHex(this.currentHoveredHex);
      this.currentHoveredHex = null;
    }
  }

  /**
   * Update camera view and adjust label states accordingly
   * @param newCameraView The new camera view
   */
  updateCameraView(newCameraView: CameraView): void {
    this.currentCameraView = newCameraView;
    
    // If we're currently hovering over a hex, re-expand its labels
    // to ensure they're in the correct state for the new camera view
    if (this.currentHoveredHex) {
      this.expandLabelsForHex(this.currentHoveredHex);
    }
  }

  /**
   * Expand labels for all entities at the given hex coordinates
   */
  private expandLabelsForHex(hexCoords: HexPosition): void {
    const { army, structure, quest, chest } = this.getHexagonEntity(hexCoords);
    const styleExtended = ["max-w-[1000px]", "ml-2", "opacity-100"];
    const styleCollapsed = ["max-w-0", "ml-0", "opacity-0"];
    
    // Clear any previously expanded labels
    this.expandedLabelIds.clear();
    
    // Helper function to expand a label by finding it in the labels group
    const expandLabel = (entityId: ID, labelsGroup: THREE.Group) => {
      // Search through the labels group for the label with matching entity ID
      labelsGroup.children.forEach((child) => {
        if (child instanceof CSS2DObject && child.userData.entityId === entityId) {
          const label = child as CSS2DObject;
          if (label.element) {
            const wrapperContainer = label.element.querySelector(".transition-all.duration-700");
            if (wrapperContainer) {
              // Store the container ID for tracking
              const containerId = `hover_${entityId}_${Date.now()}`;
              (wrapperContainer as HTMLElement).dataset.hoverId = containerId;
              this.expandedLabelIds.add(containerId);
              
              // Remove collapsed styles and add expanded styles
              wrapperContainer.classList.remove(...styleCollapsed);
              wrapperContainer.classList.add(...styleExtended);
              
              // Clear any existing timeout for this label
              const existingContainerId = (wrapperContainer as HTMLElement).dataset.containerId;
              if (existingContainerId) {
                transitionManager.clearTimeout(existingContainerId);
              }
            }
          }
        }
      });
    };
    
    // Expand labels for all entities at this hex
    if (army) {
      expandLabel(army.id, this.armyLabelsGroup);
    }
    if (structure) {
      expandLabel(structure.id, this.structureLabelsGroup);
    }
    if (quest) {
      expandLabel(quest.id, this.questLabelsGroup);
    }
    if (chest) {
      expandLabel(chest.id, this.chestLabelsGroup);
    }
  }

  /**
   * Collapse labels for all entities at the given hex coordinates back to their default state
   */
  private collapseLabelsForHex(hexCoords: HexPosition): void {
    const { army, structure, quest, chest } = this.getHexagonEntity(hexCoords);
    const styleExtended = ["max-w-[1000px]", "ml-2", "opacity-100"];
    const styleCollapsed = ["max-w-0", "ml-0", "opacity-0"];
    
    // Helper function to restore label state based on camera view
    const restoreLabel = (entityId: ID, labelsGroup: THREE.Group) => {
      // Search through the labels group for the label with matching entity ID
      labelsGroup.children.forEach((child) => {
        if (child instanceof CSS2DObject && child.userData.entityId === entityId) {
          const label = child as CSS2DObject;
          if (label.element) {
            const wrapperContainer = label.element.querySelector(".transition-all.duration-700");
            if (wrapperContainer) {
              // Check if this label was expanded by hover
              const hoverId = (wrapperContainer as HTMLElement).dataset.hoverId;
              if (hoverId && this.expandedLabelIds.has(hoverId)) {
                // Remove hover tracking
                delete (wrapperContainer as HTMLElement).dataset.hoverId;
                this.expandedLabelIds.delete(hoverId);
                
                // Apply appropriate state based on camera view
                wrapperContainer.classList.remove(...styleExtended, ...styleCollapsed);
                
                if (this.currentCameraView === CameraView.Far) {
                  // Far view: always collapsed
                  wrapperContainer.classList.add(...styleCollapsed);
                } else if (this.currentCameraView === CameraView.Close) {
                  // Close view: always expanded
                  wrapperContainer.classList.add(...styleExtended);
                } else if (this.currentCameraView === CameraView.Medium) {
                  // Medium view: check if it should be collapsed based on timing
                  const containerId = (wrapperContainer as HTMLElement).dataset.containerId;
                  if (containerId && !transitionManager.getMediumViewExpanded(containerId)) {
                    // Should be collapsed
                    wrapperContainer.classList.add(...styleCollapsed);
                  } else {
                    // Should be expanded (either within timeout or no timeout set)
                    wrapperContainer.classList.add(...styleExtended);
                  }
                }
              }
            }
          }
        }
      });
    };
    
    // Restore labels for all entities at this hex
    if (army) {
      restoreLabel(army.id, this.armyLabelsGroup);
    }
    if (structure) {
      restoreLabel(structure.id, this.structureLabelsGroup);
    }
    if (quest) {
      restoreLabel(quest.id, this.questLabelsGroup);
    }
    if (chest) {
      restoreLabel(chest.id, this.chestLabelsGroup);
    }
    
    // Clear the expanded label tracking
    this.expandedLabelIds.clear();
  }

  /**
   * Clean up resources when the manager is no longer needed
   */
  destroy(): void {
    // Collapse any currently expanded labels
    if (this.currentHoveredHex) {
      this.collapseLabelsForHex(this.currentHoveredHex);
    }
    
    // Clear tracking
    this.currentHoveredHex = null;
    this.expandedLabelIds.clear();
  }
}