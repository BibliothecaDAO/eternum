import { configManager } from "@bibliothecadao/eternum";
import {
  deepCenter,
  deepGateTiles,
  deepZoneBounds,
  nativeRuleConstants,
  viewerAspects,
  type NativeFactStore,
} from "@bibliothecadao/eternum/game-client";
import { aspects, type AspectId } from "@bibliothecadao/types";
import { accountAddress } from "@/hooks/store/use-account-store";
import { ASPECT_HEX, SIDE_HEX } from "@/tokens";
import { FELT_CENTER } from "@/ui/config";
import { Color, Group, InstancedMesh, Mesh, Object3D, type Scene } from "three";
import {
  createDeepGateKit,
  createDeepGateVeilGeometry,
  createDeepGateVeilMaterial,
  DEEP_GATE_HEIGHT,
} from "../structures/deep-site-kit";
import { DEEP_FLOOR, writeDeepFloorZones } from "../terrain/deep-floor-material";
import { placePositionOnTerrain, type TerrainSurface } from "../terrain/terrain-surface";
import { getWorldPositionForHex } from "../utils";
import { HEX_HORIZONTAL_SPACING, HEX_VERTICAL_SPACING } from "../utils/hex-lattice";
import type { PipelineCompiler } from "../pipeline-compiler";
import { subscribeWorldOrigin } from "../world-origin";

export const DEEP_GATEWAY_HEIGHT = DEEP_GATE_HEIGHT + 0.25;

export class DeepArenaManager {
  private readonly group = new Group();
  private readonly gates: Record<AspectId, Group>;
  private readonly veil: InstancedMesh;
  private readonly dummy = new Object3D();
  private readonly unsubscribeStore: () => void;
  private readonly unsubscribeOrigin: () => void;
  private destroyed = false;

  constructor(
    private readonly scene: Scene,
    private readonly store: NativeFactStore,
    private readonly terrain: TerrainSurface,
    private readonly compilePipelines: PipelineCompiler = async () => {},
  ) {
    this.group.name = "deep-arena";
    this.gates = Object.fromEntries(aspects.map(({ id }) => [id, gateSlot(id)])) as Record<AspectId, Group>;
    this.veil = new InstancedMesh(createDeepGateVeilGeometry(), createDeepGateVeilMaterial(), aspects.length);
    this.veil.renderOrder = 2;
    this.group.add(this.veil, ...Object.values(this.gates));
    scene.add(this.group);
    for (const { id } of aspects) {
      this.buildGate(id);
    }
    this.unsubscribeStore = store.subscribe((changes) => {
      if (changes.some(({ model }) => model === "DeepRules" || model === "SettlementRules" || model === "HomeAspect"))
        this.place();
    });
    this.unsubscribeOrigin = subscribeWorldOrigin(() => this.place());
    this.place();
  }

  public destroy(): void {
    this.destroyed = true;
    this.unsubscribeStore();
    this.unsubscribeOrigin();
    this.scene.remove(this.group);
    disposeObjectTree(this.group);
  }

  private buildGate(aspect: AspectId): void {
    const model = createDeepGateKit(aspect).scene;
    void this.compilePipelines(model, this.scene)
      .then(() => {
        if (this.destroyed) {
          disposeObjectTree(model);
          return;
        }
        this.gates[aspect].add(model);
      })
      .catch((error) => {
        disposeObjectTree(model);
        if (!this.destroyed) console.error(`[DeepArenaManager] Failed to warm up gate ${aspect}`, error);
      });
  }

  private place(): void {
    const gameId = configManager.getActiveGameId();
    const rules = this.store.get("DeepRules", { game_id: gameId });
    const settlement = this.store.get("SettlementRules", { game_id: gameId });
    this.group.visible = Boolean(rules && settlement);
    if (!rules || !settlement) return;
    const center = this.worldAt(deepCenter(settlement.spacing));
    DEEP_FLOOR.center.value.set(center.x, center.z);
    writeDeepFloorZones(DEEP_FLOOR, deepZoneBounds(rules));
    const gates = deepGateTiles(rules.gate_distance, settlement.spacing);
    this.writeFloorEdges(deepCenter(settlement.spacing), center, gates);
    const own = viewerAspects(this.store, gameId, accountAddress() ?? null);
    gates.forEach((gate, index) => {
      const at = this.worldAt(gate);
      this.dummy.position.copy(placePositionOnTerrain(at, this.terrain));
      this.dummy.updateMatrix();
      this.gates[gate.aspect].position.copy(this.dummy.position);
      this.veil.setMatrixAt(index, this.dummy.matrix);
      this.veil.setColorAt(index, new Color(own.has(gate.aspect) ? SIDE_HEX.own : ASPECT_HEX[gate.aspect]));
    });
    this.veil.instanceMatrix.needsUpdate = true;
    if (this.veil.instanceColor) this.veil.instanceColor.needsUpdate = true;
    this.veil.computeBoundingSphere();
  }

  private writeFloorEdges(
    middle: { col: number; row: number },
    center: { x: number; z: number },
    gates: readonly { col: number; row: number }[],
  ): void {
    const half = nativeRuleConstants.DEEP_MAP_SIZE / 2;
    const offsets = squareBorder(middle, half).map((hex) => {
      const at = this.worldAt(hex);
      return { x: at.x - center.x, z: at.z - center.z };
    });
    const edges = {
      left: Math.min(...offsets.map(({ x }) => x)) - TILE_INRADIUS,
      right: Math.max(...offsets.map(({ x }) => x)) + TILE_INRADIUS,
      near: Math.min(...offsets.map(({ z }) => z)) - TILE_RADIUS,
      far: Math.max(...offsets.map(({ z }) => z)) + TILE_RADIUS,
    };
    DEEP_FLOOR.edges.value.set(edges.left, edges.right, edges.near, edges.far);
    const gateInset = Math.min(
      ...gates.map((gate) => {
        const at = this.worldAt(gate);
        const [x, z] = [at.x - center.x, at.z - center.z];
        return Math.min(x - edges.left, edges.right - x, z - edges.near, edges.far - z);
      }),
    );
    DEEP_FLOOR.edgeFade.value = Math.min(EDGE_FADE, Math.max(0, gateInset - TILE_RADIUS));
  }

  private worldAt(hex: { col: number; row: number }) {
    return getWorldPositionForHex({ col: hex.col - FELT_CENTER(), row: hex.row - FELT_CENTER() });
  }
}

const TILE_RADIUS = HEX_VERTICAL_SPACING / 1.5;
const EDGE_FADE = 8;
const TILE_INRADIUS = HEX_HORIZONTAL_SPACING / 2;

function gateSlot(aspect: AspectId): Group {
  const slot = new Group();
  slot.name = `deep-gateway-${aspect}`;
  return slot;
}

function disposeObjectTree(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      if ("map" in material && material.map && typeof material.map.dispose === "function") {
        material.map.dispose();
      }
      material.dispose();
    }
  });
}

function squareBorder(middle: { col: number; row: number }, half: number): { col: number; row: number }[] {
  const span = Array.from({ length: half * 2 }, (_, step) => step - half);
  return span.flatMap((step) => [
    { col: middle.col - half, row: middle.row + step },
    { col: middle.col + half - 1, row: middle.row + step },
    { col: middle.col + step, row: middle.row - half },
    { col: middle.col + step, row: middle.row + half - 1 },
  ]);
}
