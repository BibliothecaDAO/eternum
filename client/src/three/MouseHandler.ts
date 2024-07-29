import { ThreeStore } from "@/hooks/store/useThreeStore";
import { ArmyMovementManager, TravelPaths } from "@/dojo/modelManager/ArmyMovementManager";
import { ActionInfo } from "./components/ActionInfo";
import WorldmapScene from "./scenes/Worldmap";
import * as THREE from "three";
import { SceneManager } from "./SceneManager";
import { SetupResult } from "@/dojo/setup";
import { LocationManager } from "./helpers/LocationManager";
import { throttle } from "lodash";
import { getWorldPositionForHex } from "@/ui/utils/utils";

export class MouseHandler {
  private worldmapScene?: WorldmapScene;
  private throttledHandleHexHover: (hexCoords: { row: number; col: number }) => void;
  public selectedEntityId: number | null = null;
  private actionInfo: ActionInfo | null = null;

  constructor(
    private dojo: SetupResult,
    private state: ThreeStore,
    private raycaster: THREE.Raycaster,
    private mouse: THREE.Vector2,
    private camera: THREE.Camera,
    private travelPaths: TravelPaths | undefined,
    public sceneManager: SceneManager,
    private locationManager: LocationManager,
  ) {
    this.throttledHandleHexHover = throttle(this.handleHexHover.bind(this), 100);
  }

  initScene(worldmapScene: WorldmapScene) {
    this.worldmapScene = worldmapScene;
  }

  private checkIfSceneIsInitialized() {
    if (!this.worldmapScene) throw new Error("Scene not initialized");
  }

  private setSelectedEntityId(entityId: number | null) {
    this.selectedEntityId = entityId;
    this.state.setSelectedEntityId(entityId);
  }

  onRightClick(event: MouseEvent) {
    event.preventDefault();
    if (this.sceneManager.currentScene !== "worldmap") return;

    const intersects = this.getIntersects();
    if (intersects.length === 0) {
      this.clearEntitySelection();
      return;
    }

    const clickedObject = intersects[0].object;
    if (!(clickedObject instanceof THREE.InstancedMesh)) return;

    const instanceId = intersects[0].instanceId;
    if (instanceId === undefined) return;

    const entityIdMap = clickedObject.userData.entityIdMap;
    if (entityIdMap) {
      this.handleEntitySelection(entityIdMap[instanceId]);
    } else {
      this.clearEntitySelection();
    }
  }

  onClick() {
    if (this.sceneManager.currentScene !== "worldmap") return;

    const hoveredHex = this.getHoveredHex();
    if (this.selectedEntityId && hoveredHex && this.travelPaths?.isHighlighted(hoveredHex.row, hoveredHex.col)) {
      const travelPath = this.travelPaths.get(TravelPaths.posKey(hoveredHex, true));
      const selectedPath = travelPath?.path ?? [];
      const isExplored = travelPath?.isExplored ?? false;
      if (selectedPath.length > 0) {
        const armyMovementManager = new ArmyMovementManager(this.dojo, this.selectedEntityId);
        armyMovementManager.moveArmy(selectedPath, isExplored);
        this.clearEntitySelection();
      }
    }
  }

  onDoubleClick() {
    if (this.sceneManager.currentScene !== "worldmap") return;
    this.checkIfSceneIsInitialized();

    const intersects = this.getIntersects();
    if (intersects.length === 0) return;

    const clickedObject = intersects[0].object;
    if (!(clickedObject instanceof THREE.InstancedMesh)) return;

    const instanceId = intersects[0].instanceId;
    if (instanceId === undefined) return;

    const { row, col, x, z } = this.worldmapScene!.getHexagonCoordinates(clickedObject, instanceId);
    this.locationManager.addRowColToQueryString(row, col);
    this.sceneManager.transitionToDetailedScene(row, col, x, z);
  }

  onMouseMove(event: MouseEvent) {
    this.updateMousePosition(event);

    if (this.travelPaths) {
      const hoveredHex = this.getHoveredHex();
      if (hoveredHex) {
        this.throttledHandleHexHover(hoveredHex);
      } else {
        this.actionInfo?.hideTooltip();
      }
    } else {
      this.actionInfo?.hideTooltip();
    }
  }

  private updateMousePosition(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  private handleHexHover(hexCoords: { row: number; col: number }) {
    const travelPath = this.travelPaths?.get(TravelPaths.posKey(hexCoords, true));
    if (travelPath) {
      const hexPosition = getWorldPositionForHex(hexCoords);
      this.state.setHoveredHex({ col: hexCoords.col, row: hexCoords.row, x: hexPosition.x, z: hexPosition.z });
    } else {
      this.actionInfo?.hideTooltip();
    }
  }

  private getIntersects() {
    this.checkIfSceneIsInitialized();
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(this.worldmapScene!.scene.children, true);
  }

  private handleEntitySelection(entityId: number) {
    this.checkIfSceneIsInitialized();
    this.clearEntitySelection();
    const armyMovementManager = new ArmyMovementManager(this.dojo, entityId);
    this.actionInfo = new ActionInfo(entityId, this.camera, this.dojo);
    if (armyMovementManager.isMine()) {
      this.setSelectedEntityId(entityId);
      this.travelPaths = armyMovementManager.findPaths(this.worldmapScene!.systemManager.tileSystem.getExplored());
      this.state.setTravelPaths(this.travelPaths.getPaths());
      this.worldmapScene!.highlightHexManager.highlightHexes(this.travelPaths.getHighlightedHexes());
    }
  }

  private clearEntitySelection() {
    this.checkIfSceneIsInitialized();
    this.setSelectedEntityId(null);
    this.worldmapScene!.highlightHexManager.highlightHexes([]);
    this.travelPaths?.deleteAll();
    this.actionInfo?.hideTooltip();
    this.actionInfo = null;
  }

  private getHoveredHex(): { row: number; col: number } | null {
    this.checkIfSceneIsInitialized();
    const intersects = this.getIntersects();

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      if (clickedObject instanceof THREE.InstancedMesh) {
        const instanceId = intersects[0].instanceId;
        if (instanceId !== undefined) {
          return this.worldmapScene!.getHexagonCoordinates(clickedObject, instanceId);
        }
      }
    }

    return null;
  }
}
