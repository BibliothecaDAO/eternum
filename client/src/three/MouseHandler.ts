import { ArmyMovementManager, TravelPaths } from "@/dojo/modelManager/ArmyMovementManager";
import WorldmapScene from "./scenes/Worldmap";
import * as THREE from "three";
import { SceneManager } from "./SceneManager";
import { SetupResult } from "@/dojo/setup";
import { LocationManager } from "./helpers/LocationManager";
import { throttle } from "lodash";
import { getHexagonCoordinates, getWorldPositionForHex } from "@/ui/utils/utils";
import useUIStore, { AppStore } from "@/hooks/store/useUIStore";
import { View } from "@/ui/modules/navigation/LeftNavigationModule";
import { FELT_CENTER } from "@/ui/config";

export class MouseHandler {
  private worldmapScene?: WorldmapScene;
  private throttledHandleHexHover: (hexCoords: { row: number; col: number }) => void;
  public selectedEntityId: number | null = null;
  private state: AppStore;
  private travelPaths: TravelPaths;

  constructor(
    private dojo: SetupResult,
    private raycaster: THREE.Raycaster,
    private mouse: THREE.Vector2,
    private camera: THREE.Camera,
    public sceneManager: SceneManager,
    private locationManager: LocationManager,
  ) {
    this.throttledHandleHexHover = throttle(this.handleHexHover.bind(this), 100);
    this.state = useUIStore.getState();
    this.travelPaths = new TravelPaths();
  }

  initScene(worldmapScene: WorldmapScene) {
    this.worldmapScene = worldmapScene;
  }

  private checkIfSceneIsInitialized() {
    if (!this.worldmapScene) throw new Error("Scene not initialized");
  }

  private setSelectedEntityId(entityId: number | null) {
    this.selectedEntityId = entityId;
    this.state.updateSelectedEntityId(entityId);
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

    if (hoveredHex && !this.travelPaths) {
      this.state.setSelectedHex({ col: hoveredHex.col + FELT_CENTER, row: hoveredHex.row + FELT_CENTER });
      this.state.setLeftNavigationView(View.EntityView);
    }
  }

  onMouseMove(event: MouseEvent) {
    this.updateMousePosition(event);

    if (this.travelPaths) {
      const hoveredHex = this.getHoveredHex();
      if (hoveredHex) {
        this.throttledHandleHexHover(hoveredHex);
        return;
      }
    }
    this.state.updateHoveredHex(null);
  }

  private updateMousePosition(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  private handleHexHover(hexCoords: { row: number; col: number }) {
    const travelPath = this.travelPaths?.get(TravelPaths.posKey(hexCoords, true));
    if (travelPath) {
      const hexPosition = getWorldPositionForHex(hexCoords);
      this.state.updateHoveredHex({ col: hexCoords.col, row: hexCoords.row, x: hexPosition.x, z: hexPosition.z });
      return;
    }
    this.state.updateHoveredHex(null);
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
    if (armyMovementManager.isMine()) {
      this.setSelectedEntityId(entityId);
      this.travelPaths = armyMovementManager.findPaths(this.worldmapScene!.systemManager.tileSystem.getExplored());
      this.state.updateTravelPaths(this.travelPaths.getPaths());
      this.worldmapScene!.highlightHexManager.highlightHexes(this.travelPaths.getHighlightedHexes());
    }
  }

  private clearEntitySelection() {
    this.checkIfSceneIsInitialized();
    this.setSelectedEntityId(null);
    this.worldmapScene!.highlightHexManager.highlightHexes([]);
    this.travelPaths?.deleteAll();
  }

  private getHoveredHex(): { row: number; col: number } | null {
    this.checkIfSceneIsInitialized();
    const intersects = this.getIntersects();

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      if (clickedObject instanceof THREE.InstancedMesh) {
        const instanceId = intersects[0].instanceId;
        if (instanceId !== undefined) {
          return getHexagonCoordinates(clickedObject, instanceId);
        }
      }
    }

    return null;
  }
}
