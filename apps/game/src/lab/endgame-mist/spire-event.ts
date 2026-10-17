import { DoubleSide, Material, Matrix4, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry } from "three";
import {
  color,
  float,
  materialColor,
  mix,
  mx_noise_float,
  normalView,
  normalLocal,
  positionLocal,
  positionViewDirection,
  positionWorld,
  smoothstep,
  uniform,
} from "three/tsl";
import MeshStandardNodeMaterial from "three/src/materials/nodes/MeshStandardNodeMaterial.js";
import MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";
import type NodeMaterial from "three/src/materials/nodes/NodeMaterial.js";
import type Node from "three/src/nodes/core/Node.js";
import type { SpireModel } from "@/three/structures/spire-model";
import { ENDGAME_SEQUENCE, type EndgameSettings, type endgameFrame } from "./sequence";

/** The existing orb is the source of the burst; all temporary materials are owned by this preview. */
export class SpireEndEvent {
  private readonly appearance = uniform(0);
  private readonly orbPresence = uniform(0);
  private readonly flash = uniform(0);
  private readonly burstOpacity = uniform(0);
  private readonly replacements = new Map<Mesh, { original: Material | Material[]; owned: NodeMaterial[] }>();
  private readonly bursts: Mesh<BufferGeometry, MeshBasicNodeMaterial>[];
  private readonly transform = new Matrix4();
  private readonly size = new Vector3();
  private readonly position = new Vector3();
  private origins: { x: number; y: number; z: number }[] = [];

  constructor(
    private readonly model: SpireModel,
    geometry: BufferGeometry,
    private readonly settings: EndgameSettings,
    private readonly frost: (surface: Node<"vec3">) => Node<"vec3">,
    allowed: Node<"float">,
  ) {
    const rim = float(1).sub(normalView.dot(positionViewDirection).abs()).pow(0.7);
    const smoke = mx_noise_float(positionWorld.mul(3.7)).mul(0.5).add(0.5);
    const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
    material.name = "Spire orb mist burst";
    material.forceSinglePass = true;
    material.toneMapped = false;
    material.positionNode = positionLocal.add(normalLocal.mul(mx_noise_float(positionLocal.mul(13)).mul(0.1)));
    material.colorNode = mix(mix(color("#22252e"), color("#879393"), smoke), color("#f5e9ff"), this.flash.mul(0.25));
    material.opacityNode = rim
      .mul(smoothstep(0.38, 0.7, smoke))
      .mul(this.burstOpacity)
      .mul(float(allowed));
    this.bursts = [0, 1].map(() => {
      const mesh = new Mesh(geometry, material);
      mesh.name = "Mist from the spire orb";
      mesh.matrixAutoUpdate = false;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 890;
      mesh.raycast = () => {};
      return mesh;
    });
  }

  get meshes() {
    return this.bursts;
  }

  update(frame: ReturnType<typeof endgameFrame>): void {
    this.appearance.value = this.settings.spires === "awaken" ? 1 : frame.materialisation;
    this.orbPresence.value = frame.materialisation;
    const afterBurst = frame.seconds - ENDGAME_SEQUENCE.burstAt;
    this.flash.value = afterBurst < 0 ? 0 : Math.max(0, 1 - afterBurst / 0.25);
    this.burstOpacity.value = Math.max(0, 1 - frame.burst);
    this.patchMaterials();
    this.origins = [];
    this.bursts.forEach((mesh, index) => {
      this.model.setOrbScale(index, frame.orbScale);
      const hasOrb = this.model.getOrbTransform(index, this.transform);
      if (hasOrb) {
        this.position.setFromMatrixPosition(this.transform);
        this.origins.push({ x: this.position.x, y: this.position.y, z: this.position.z });
      }
      mesh.visible = hasOrb && !this.settings.shipped && afterBurst >= 0 && frame.burst < 1;
      mesh.matrix.copy(this.transform).scale(this.size.setScalar(0.06 + frame.burst * 20));
      mesh.matrixWorldNeedsUpdate = true;
    });
  }

  getSnapshot() {
    return { orbOrigins: this.origins, burstDraws: this.bursts.filter((mesh) => mesh.visible).length };
  }

  private patchMaterials(): void {
    const present = new Set<Mesh>();
    this.model.group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      present.add(object);
      if (this.replacements.has(object)) return;
      const original = object.material;
      const owned = (Array.isArray(original) ? original : [original]).map((source) => this.material(source, object));
      object.material = Array.isArray(original) ? owned : owned[0];
      this.replacements.set(object, { original, owned });
    });
    for (const [mesh, record] of this.replacements) {
      if (present.has(mesh)) continue;
      mesh.material = record.original;
      record.owned.forEach((material) => material.dispose());
      this.replacements.delete(mesh);
    }
  }

  private material(source: Material, mesh: Mesh): NodeMaterial {
    let material: NodeMaterial;
    if (source instanceof MeshStandardMaterial)
      material = Object.assign(new MeshStandardNodeMaterial(), source.clone());
    else material = source.clone() as NodeMaterial;
    const isCore = mesh.userData.trueSphereRadius > 0;
    if (isCore) {
      material.dispose();
      const core = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      core.toneMapped = false;
      const edge = float(1).sub(normalView.dot(positionViewDirection).abs()).pow(4);
      core.colorNode = mix(mix(color("#010106"), color("#b998f1"), edge), color("#fff5ff"), this.flash);
      core.opacityNode = this.appearance.mul(this.orbPresence);
      return core;
    }
    material.name = `${source.name} / materialising spire`;
    if (source.transparent)
      material.opacityNode = this.appearance
        .mul(this.orbPresence)
        .mul(material.opacityNode ? float(material.opacityNode as Node<"float">) : source.opacity);
    else {
      const noise = mx_noise_float(positionWorld.mul(24)).mul(0.5).add(0.5);
      material.maskNode = noise.lessThan(this.appearance.mul(1.1).sub(0.05));
      material.colorNode = this.frost((material.colorNode ?? materialColor) as Node<"vec3">);
    }
    return material;
  }

  dispose(): void {
    for (const [mesh, { original, owned }] of this.replacements) {
      mesh.material = original;
      owned.forEach((material) => material.dispose());
    }
    this.replacements.clear();
    this.bursts.forEach((mesh) => mesh.removeFromParent());
    this.bursts[0].material.dispose();
  }
}
