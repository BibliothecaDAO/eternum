import { configManager } from "@bibliothecadao/eternum";
import {
  deepCenter,
  deepGateTiles,
  deepZoneBounds,
  nativeRuleConstants,
  viewerAspects,
  type NativeFactStore,
} from "@bibliothecadao/eternum/game-client";
import { aspects, ordersOfAspect, type AspectId } from "@bibliothecadao/types";
import { accountAddress } from "@/hooks/store/use-account-store";
import { SIDE_HEX } from "@/tokens";
import { orderEmblem } from "@/ui/design-system/kit/order-emblem";
import { FELT_CENTER } from "@/ui/config";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  PlaneGeometry,
  type Scene,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { smoothstep, uv } from "three/tsl";
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";
import { DEEP_FLOOR, DEEP_PALETTE } from "../terrain/deep-floor-material";
import { placePositionOnTerrain, type TerrainSurface } from "../terrain/terrain-surface";
import { getWorldPositionForHex } from "../utils";
import { subscribeWorldOrigin } from "../world-origin";
import { HEX_HORIZONTAL_SPACING, HEX_VERTICAL_SPACING } from "../utils/hex-lattice";

const GATE_HEIGHT = 3;
const GATE_SPAN = 1.5;
const LINTEL_FRONT = 0.31;
const CREST_SIZE = 0.9;
export const DEEP_GATEWAY_HEIGHT = GATE_HEIGHT + 1.18;

export class DeepArenaManager {
  private readonly group = new Group();
  private readonly stone: InstancedMesh;
  private readonly veil: InstancedMesh;
  private readonly crests: Record<AspectId, Mesh>;
  private readonly dummy = new Object3D();
  private readonly unsubscribeStore: () => void;
  private readonly unsubscribeOrigin: () => void;

  constructor(
    private readonly scene: Scene,
    private readonly store: NativeFactStore,
    private readonly terrain: TerrainSurface,
  ) {
    this.group.name = "deep-arena";
    this.stone = new InstancedMesh(gatewayStone(), gatewayStoneMaterial(), aspects.length);
    this.stone.castShadow = true;
    this.stone.receiveShadow = true;
    this.veil = new InstancedMesh(gatewayVeil(), gatewayVeilMaterial(), aspects.length);
    this.veil.renderOrder = 2;
    this.crests = Object.fromEntries(aspects.map(({ id }) => [id, gatewayCrest(id)])) as Record<AspectId, Mesh>;
    this.group.add(this.stone, this.veil, ...Object.values(this.crests));
    scene.add(this.group);
    this.unsubscribeStore = store.subscribe((changes) => {
      if (changes.some(({ model }) => model === "DeepRules" || model === "SettlementRules" || model === "HomeAspect"))
        this.place();
    });
    this.unsubscribeOrigin = subscribeWorldOrigin(() => this.place());
    this.place();
  }

  public refreshTerrainPlacement(): void {
    this.place();
  }

  public destroy(): void {
    this.unsubscribeStore();
    this.unsubscribeOrigin();
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const material = object.material as MeshBasicNodeMaterial;
      material.map?.dispose();
      material.dispose();
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
    writeZoneBounds(deepZoneBounds(rules));
    const gates = deepGateTiles(rules.gate_distance, settlement.spacing);
    this.writeFloorEdges(deepCenter(settlement.spacing), center, gates);
    const own = viewerAspects(this.store, gameId, accountAddress() ?? null);
    gates.forEach((gate, index) => {
      const at = this.worldAt(gate);
      this.dummy.position.copy(placePositionOnTerrain(at, this.terrain));
      this.dummy.updateMatrix();
      this.stone.setMatrixAt(index, this.dummy.matrix);
      this.veil.setMatrixAt(index, this.dummy.matrix);
      this.veil.setColorAt(index, new Color(own.has(gate.aspect) ? SIDE_HEX.own : DEEP_PALETTE.gold));
      this.crests[gate.aspect].position.copy(this.dummy.position);
    });
    this.stone.instanceMatrix.needsUpdate = true;
    this.veil.instanceMatrix.needsUpdate = true;
    if (this.veil.instanceColor) this.veil.instanceColor.needsUpdate = true;
    this.stone.computeBoundingSphere();
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

function squareBorder(middle: { col: number; row: number }, half: number): { col: number; row: number }[] {
  const span = Array.from({ length: half * 2 }, (_, step) => step - half);
  return span.flatMap((step) => [
    { col: middle.col - half, row: middle.row + step },
    { col: middle.col + half - 1, row: middle.row + step },
    { col: middle.col + step, row: middle.row - half },
    { col: middle.col + step, row: middle.row + half - 1 },
  ]);
}

function writeZoneBounds(bounds: ReturnType<typeof deepZoneBounds>): void {
  const [first, second, third, fourth, ...beyond] = bounds.ringRadii;
  if (beyond.length) throw new Error(`The floor draws four ring radii, not ${bounds.ringRadii.length}`);
  DEEP_FLOOR.plazaBelow.value = bounds.plazaBelow;
  DEEP_FLOOR.ringRadii.value.set(first ?? -1, second ?? -1, third ?? -1, fourth ?? -1);
  DEEP_FLOOR.rimBeyond.value = bounds.rimBeyond;
}

function gatewayStone(): BufferGeometry {
  const pylon = (side: number) => {
    const shaft = new CylinderGeometry(0.24, 0.34, GATE_HEIGHT, 4, 1).rotateY(Math.PI / 4);
    return shaft.translate(side * (GATE_SPAN / 2), GATE_HEIGHT / 2, 0);
  };
  const plinth = (side: number) => new BoxGeometry(0.72, 0.3, 0.72).translate(side * (GATE_SPAN / 2), 0.15, 0);
  const lintel = new BoxGeometry(GATE_SPAN + 0.95, 0.46, 0.6).translate(0, GATE_HEIGHT + 0.23, 0);
  const cap = new BoxGeometry(GATE_SPAN + 0.4, 0.22, 0.44).translate(0, GATE_HEIGHT + 0.57, 0);
  const crown = new CylinderGeometry(0, 0.3, 0.5, 4, 1).rotateY(Math.PI / 4).translate(0, GATE_HEIGHT + 0.93, 0);
  const parts = [pylon(-1), pylon(1), plinth(-1), plinth(1), lintel, cap, crown].map((part) => part.toNonIndexed());
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error("Deep gateway geometry did not merge");
  return merged;
}

function gatewayVeil(): BufferGeometry {
  return new PlaneGeometry(GATE_SPAN - 0.3, GATE_HEIGHT - 0.25).translate(0, (GATE_HEIGHT - 0.25) / 2 + 0.12, 0);
}

function gatewayCrest(aspect: AspectId): Mesh {
  const texture = new TextureLoader().load(orderEmblem(ordersOfAspect(aspect)[0]!.orderId).art);
  texture.colorSpace = SRGBColorSpace;
  const material = new MeshBasicNodeMaterial({ map: texture, transparent: true, alphaTest: 0.1 });
  material.name = "deep-gateway-crest";
  const crest = new Mesh(
    new PlaneGeometry(CREST_SIZE, CREST_SIZE).translate(0, GATE_HEIGHT + 0.3, LINTEL_FRONT + 0.06),
    material,
  );
  crest.add(
    new Mesh(
      new CylinderGeometry(CREST_SIZE * 0.52, CREST_SIZE * 0.52, 0.06, 8)
        .rotateX(Math.PI / 2)
        .translate(0, GATE_HEIGHT + 0.3, LINTEL_FRONT + 0.02),
      medallionMaterial(),
    ),
  );
  crest.name = `deep-gateway-crest-${aspect}`;
  return crest;
}

function medallionMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    color: new Color(DEEP_PALETTE.cobalt),
    roughness: 0.5,
    metalness: 0,
  });
  material.name = "deep-gateway-medallion";
  return material;
}

function gatewayStoneMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    color: new Color(DEEP_PALETTE.ivory),
    roughness: 0.62,
    metalness: 0,
  });
  material.emissive = new Color(DEEP_PALETTE.gold);
  material.emissiveIntensity = 0.12;
  material.name = "deep-gateway-stone";
  return material;
}

function gatewayVeilMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
  const across = uv().x.sub(0.5).abs().mul(2);
  material.opacityNode = smoothstep(1, 0.2, across)
    .mul(smoothstep(0, 0.35, uv().y))
    .mul(smoothstep(1, 0.6, uv().y))
    .mul(0.5);
  material.name = "deep-gateway-veil";
  return material;
}
