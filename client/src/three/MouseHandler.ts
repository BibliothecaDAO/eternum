import { ThreeStore } from "@/hooks/store/useThreeStore";
import { ArmyMovementManager, TravelPaths } from "@/dojo/modelManager/ArmyMovementManager";
import { ActionInfo } from "./components/ActionInfo";
import WorldmapScene from "./scenes/Worldmap";
import * as THREE from "three";
import { SceneManager } from "./SceneManager";
import { SetupResult } from "@/dojo/setup";
import { LocationManager } from "./helpers/LocationManager";

export class MouseHandler {
  private worldmapScene: WorldmapScene | undefined;
  public selectedEntityId: number | null = null;

  constructor(
    private dojo: SetupResult,
    private state: ThreeStore,
    private raycaster: THREE.Raycaster,
    private mouse: THREE.Vector2,
    private camera: THREE.Camera,
    private travelPaths: TravelPaths | undefined,
    private actionInfo: ActionInfo,
    public sceneManager: SceneManager,
    private locationManager: LocationManager,
  ) {}

  initScene(worldmapScene: WorldmapScene) {
    this.worldmapScene = worldmapScene;
  }

  private _checkIfSceneIsInitialized() {
    if (!this.worldmapScene) throw new Error("Scene not initialized");
  }

  private _setSelectedEntityId(entityId: number | null) {
    this.selectedEntityId = entityId;
    this.state.setSelectedEntityId(entityId);
  }

  onRightClick(event: MouseEvent) {
    event.preventDefault();
    if (this.sceneManager.currentScene !== "worldmap") return;

    const intersects = this.getIntersects();
    if (intersects.length === 0) return;

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
    this._checkIfSceneIsInitialized();

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
        const { row, col } = hoveredHex;
        this.handleHexHover(row, col, event);
      } else {
        this.actionInfo.hideHoverMessage();
      }
    } else {
      this.actionInfo.hideHoverMessage();
    }
  }

  private updateMousePosition(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  private handleHexHover(row: number, col: number, event: MouseEvent) {
    if (this.travelPaths?.isHighlighted(row, col)) {
      this.actionInfo.showHoverMessage(`Highlighted Hex: (${col}, ${row})`, event.clientX, event.clientY);
    } else {
      this.actionInfo.hideHoverMessage();
    }
  }

  private getIntersects() {
    this._checkIfSceneIsInitialized();
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(this.worldmapScene!.scene.children, true);
  }

  private handleEntitySelection(entityId: number) {
    this._checkIfSceneIsInitialized();
    const armyMovementManager = new ArmyMovementManager(this.dojo, entityId);
    if (armyMovementManager.isMine()) {
      this._setSelectedEntityId(entityId);
      this.travelPaths = armyMovementManager.findPaths(this.worldmapScene!.systemManager.tileSystem.getExplored());
      this.worldmapScene!.highlightHexes(this.travelPaths.getHighlightedHexes());
    }
  }

  private clearEntitySelection() {
    this._checkIfSceneIsInitialized();
    this._setSelectedEntityId(null);
    this.worldmapScene!.highlightHexes([]);
    this.travelPaths?.deleteAll();
    this.actionInfo.hideHoverMessage();
  }

  private getHoveredHex(): { row: number; col: number } | null {
    this._checkIfSceneIsInitialized();
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
