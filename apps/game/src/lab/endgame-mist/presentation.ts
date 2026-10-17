import { Euler, Group, Matrix4, Mesh, PlaneGeometry, Vector2, Vector3, type Camera, type Scene } from "three";
import {
  color,
  diffuseColor,
  float,
  materialColor,
  mix,
  mx_noise_float,
  positionWorld,
  smoothstep,
  uniform,
  vec3,
} from "three/tsl";
import MeshStandardNodeMaterial from "three/src/materials/nodes/MeshStandardNodeMaterial.js";
import MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";
import type NodeBuilder from "three/src/nodes/core/NodeBuilder.js";
import type Node from "three/src/nodes/core/Node.js";
import type NodeMaterial from "three/src/materials/nodes/NodeMaterial.js";
import { GameMapMaterialLibrary } from "@/three/effects/game-map-material-library";
import {
  ProceduralArmyCharacterLayer,
  type ProceduralArmyCharacterPresentation,
} from "@/three/characters/procedural-army-character-layer";
import { SettlementModel } from "@/three/structures/settlement-model";
import { SpireModel } from "@/three/structures/spire-model";
import { SPIRE_MODEL_PATH } from "@/three/constants/scene-constants";
import { gltfLoader } from "@/three/utils/utils";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { createEndgameFixture } from "./fixture";
import { ENDGAME_VARIATIONS, endgameFrame, type EndgameSettings } from "./sequence";

/** Preview uniforms and materials belong to the lab renderer and never touch the live end trigger. */
export class EndgameMistPresentation {
  readonly library: GameMapMaterialLibrary;
  private readonly active = uniform(0);
  private readonly reach = uniform(0);
  private readonly clock = uniform(0);
  private readonly settled = uniform(0);
  private readonly group = new Group();
  private readonly fixture: ReturnType<typeof createEndgameFixture>;
  private readonly matrix = new Matrix4();
  private elapsed: number | null = null;
  private playing = false;
  private spires: SpireModel | null = null;
  private realms: SettlementModel | null = null;
  private characters: ProceduralArmyCharacterLayer | null = null;
  private actors: ProceduralArmyCharacterPresentation[] = [];
  private mist: Mesh<PlaneGeometry, MeshBasicNodeMaterial> | null = null;
  private spirePhase = false;
  private readonly maximumReach: number;

  constructor(readonly settings: EndgameSettings) {
    this.fixture = createEndgameFixture(settings);
    const first = terrainHexToWorld(this.fixture.spires[0].col, this.fixture.spires[0].row);
    const second = terrainHexToWorld(this.fixture.spires[1].col, this.fixture.spires[1].row);
    this.maximumReach =
      Math.max(
        ...this.fixture.request.cells.map((cell) => {
          const p = terrainHexToWorld(cell.col, cell.row);
          return Math.min(Math.hypot(p.x - first.x, p.z - first.z), Math.hypot(p.x - second.x, p.z - second.z));
        }),
      ) + ENDGAME_VARIATIONS[settings.variation].width;
    const a = uniform(new Vector2(first.x, first.z));
    const b = uniform(new Vector2(second.x, second.z));
    const realm = terrainHexToWorld(this.fixture.realm.col, this.fixture.realm.row);
    const relative = positionWorld.xz.sub(uniform(new Vector2(realm.x, realm.z))).abs();
    const hexDistance = relative.x.max(relative.x.mul(0.5).add(relative.y.mul(Math.sqrt(3) / 2)));
    const spared = settings.spared === "realm" ? float(1).sub(smoothstep(0.85, 0.87, hexDistance)) : float(0);
    const choice = ENDGAME_VARIATIONS[settings.variation];
    const noise = mx_noise_float(vec3(positionWorld.x.mul(0.38), positionWorld.z.mul(0.38), this.clock.mul(0.14)))
      .mul(0.5)
      .add(0.5);
    const distance = positionWorld.xz.sub(a).length().min(positionWorld.xz.sub(b).length());
    const boundary = distance.add(noise.sub(0.5).mul(choice.turbulence));
    const covered = smoothstep(boundary.sub(0.9), boundary.add(0.9), this.reach)
      .mul(this.active)
      .mul(float(1).sub(spared));
    const frost = covered.mul(this.settled.mul(0.6).add(0.4));
    const applyFrost = (surface: Node<"vec3">): Node<"vec3"> => {
      const grain = mx_noise_float(positionWorld.mul(22)).mul(0.5).add(0.5);
      const brightness = surface.dot(vec3(0.2126, 0.7152, 0.0722));
      const ice = color("#aed9ed").mul(
        brightness
          .mul(0.55)
          .add(0.35)
          .add(smoothstep(0.5, 0.7, grain).mul(0.08)),
      );
      return mix(surface, ice, frost.mul(0.82));
    };
    this.applyFrost = applyFrost;
    class StudyStandard extends MeshStandardNodeMaterial {
      override setupObserver(builder: NodeBuilder) {
        const observer = super.setupObserver(builder);
        observer.hasNode = true;
        return observer;
      }
      override setupDiffuseColor(builder: NodeBuilder) {
        super.setupDiffuseColor(builder);
        if (!this.transparent || this.alphaTest > 0) diffuseColor.rgb.assign(applyFrost(diffuseColor.rgb));
      }
    }
    class StudyArmy extends MeshBasicNodeMaterial {
      override setupObserver(builder: NodeBuilder) {
        const observer = super.setupObserver(builder);
        observer.hasNode = true;
        return observer;
      }
      override setupDiffuseColor(builder: NodeBuilder) {
        super.setupDiffuseColor(builder);
        if (builder.object.userData.gameEndFrost) diffuseColor.rgb.assign(applyFrost(diffuseColor.rgb));
      }
    }
    this.library = new GameMapMaterialLibrary();
    if (!settings.shipped) {
      this.library.materialNodes.set("MeshStandardMaterial", StudyStandard);
      this.library.materialNodes.set("MeshBasicMaterial", StudyArmy);
    }
    const wisps = mx_noise_float(
      vec3(
        positionWorld.x.mul(1.1).sub(this.clock.mul(0.22)),
        positionWorld.z.mul(1.1).add(noise),
        this.clock.mul(0.08),
      ),
    )
      .mul(0.5)
      .add(0.5);
    const rim = float(1).sub(smoothstep(choice.width * 0.25, choice.width, this.reach.sub(boundary).abs()));
    const material = new MeshBasicNodeMaterial();
    material.name = "Endgame lab mist front";
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = false;
    material.colorNode = mix(color("#151923"), color("#879393"), noise.mul(0.28).add(wisps.mul(0.16)));
    const movingOpacity = rim.mul(choice.opacity).add(noise.mul(0.17).add(0.1)).clamp(0, 0.96);
    const frozenOpacity = float(choice.endOpacity).add(noise.mul(0.04));
    material.opacityNode = covered.mul(mix(movingOpacity, frozenOpacity, this.settled));
    const mist = new Mesh(new PlaneGeometry(512, 512), material);
    mist.rotation.x = -Math.PI / 2;
    mist.position.set(realm.x, 0, realm.z);
    mist.renderOrder = 900;
    mist.frustumCulled = false;
    mist.raycast = () => {};
    mist.visible = false;
    this.mist = mist;
    this.group.name = "Endgame lab sequence";
    this.group.add(mist);
  }

  private readonly applyFrost: (surface: Node<"vec3">) => Node<"vec3">;

  async prepare(scene: Scene, terrain: ProceduralTerrain, camera: Camera): Promise<void> {
    scene.add(this.group);
    const [spireAsset, realmAsset] = await Promise.all([
      gltfLoader.loadAsync(SPIRE_MODEL_PATH),
      gltfLoader.loadAsync("/models/realms/settlement.glb"),
    ]);
    this.spires = new SpireModel(spireAsset, 2);
    this.realms = new SettlementModel(realmAsset, this.fixture.realms.length, "realm");
    await this.realms.prepare();
    this.group.add(this.spires.group, this.realms.group);
    this.fixture.realms.forEach((p, i) => {
      const w = terrainHexToWorld(p.col, p.row);
      this.matrix.makeRotationY(i * 0.6).setPosition(w.x, terrain.sampleSurface(w.x, w.z).height + 0.025, w.z);
      this.realms!.setMatrixAt(i, this.matrix);
      this.realms!.setRelationshipAt(i, p === this.fixture.realm ? "owned" : "enemy");
      this.realms!.setOrderAt(i, (i % 16) + 1);
    });
    this.realms.setCount(this.fixture.realms.length);
    this.realms.needsUpdate();
    this.characters = new ProceduralArmyCharacterLayer(scene);
    this.actors = this.fixture.realms.flatMap((p, i) =>
      [0, 1].map((j) => {
        const w = terrainHexToWorld(p.col + (j ? 1 : -1), p.row + 1);
        return {
          category: TroopType.Knight,
          tier: TroopTier.T1,
          entityId: i * 2 + j + 1,
          isNaval: false,
          isMoving: false,
          position: new Vector3(w.x, terrain.sampleSurface(w.x, w.z).height, w.z),
          rotation: new Euler(0, i, 0),
          primaryColor: i % 2 ? "#a33b39" : "#e1b955",
        };
      }),
    );
    this.characters.sync(this.actors, 0);
    const started = performance.now();
    while (this.characters.getStats().actorCount !== this.actors.length) {
      if (this.characters.getStats().loadState === "failed" || performance.now() - started > 20000)
        throw new Error("Endgame fixture armies did not load");
      await new Promise((resolve) => setTimeout(resolve, 30));
      this.characters.sync(this.actors, 0);
    }
    if (!this.settings.shipped) this.installTerrainFrost(scene);
    this.poseSpires(terrain);
    this.spires.updateAnimations(0, { camera });
  }

  private installTerrainFrost(scene: Scene): void {
    const patched = new Set<NodeMaterial>();
    scene.traverse((object) => {
      if (!(object instanceof Mesh) || object === this.mist) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (
          !(material instanceof MeshStandardNodeMaterial || material instanceof MeshBasicNodeMaterial) ||
          patched.has(material)
        )
          continue;
        if (material.name === "terrain-exploration-mist" || (material.transparent && material.alphaTest === 0))
          continue;
        material.colorNode = this.applyFrost((material.colorNode ?? materialColor) as Node<"vec3">);
        material.needsUpdate = true;
        patched.add(material);
      }
    });
  }

  play(): void {
    this.elapsed = 0;
    this.playing = true;
  }
  reset(): void {
    this.elapsed = null;
    this.playing = false;
  }
  seek(seconds: number): void {
    this.elapsed = seconds;
    this.playing = false;
  }
  skip(): void {
    this.seek(this.settings.shipped ? 2 : ENDGAME_VARIATIONS[this.settings.variation].duration);
  }

  update(delta: number, terrain: ProceduralTerrain, camera: Camera): void {
    if (this.playing && this.elapsed !== null) this.elapsed += delta;
    const frame = endgameFrame(this.settings, this.elapsed);
    if (frame.finished) this.playing = false;
    this.active.value = this.elapsed === null ? 0 : 1;
    this.clock.value = frame.seconds;
    this.settled.value = frame.settle;
    this.reach.value = frame.spread * this.maximumReach;
    if (this.mist) this.mist.visible = !this.settings.shipped && this.elapsed !== null;
    this.poseSpires(terrain);
    if (!frame.finished && (!this.settings.shipped || this.elapsed === null)) {
      this.spires?.updateAnimations(delta, { camera });
      this.characters?.sync(this.actors, delta);
      this.realms?.updateAnimations(delta);
    }
  }

  private poseSpires(terrain: ProceduralTerrain): void {
    if (!this.spires) return;
    const frame = endgameFrame(this.settings, this.elapsed);
    const awake = !this.settings.shipped && this.elapsed !== null && frame.emergence > 0.45;
    const changed = awake !== this.spirePhase;
    this.spirePhase = awake;
    this.spires.group.visible = this.settings.spires === "awaken" || (this.elapsed !== null && frame.emergence > 0);
    this.fixture.spires.forEach((p, i) => {
      const w = terrainHexToWorld(p.col, p.row);
      const emergence = this.settings.spires === "rise" ? frame.emergence : 1;
      const lift = emergence * emergence * (3 - 2 * emergence);
      this.matrix
        .makeRotationY(i * 1.2)
        .setPosition(w.x, terrain.sampleSurface(w.x, w.z).height - (1 - lift) * 3.4, w.z);
      if (this.settings.spires === "rise" && emergence === 0) return;
      this.spires!.placeSpire(i, this.matrix, !awake);
    });
    this.spires.setCount(2);
    if (changed || frame.phase === "awakening" || frame.phase === "live") this.spires.needsUpdate();
  }

  getSnapshot() {
    return {
      ...endgameFrame(this.settings, this.elapsed),
      variation: this.settings.variation,
      duration: this.settings.shipped ? 2 : ENDGAME_VARIATIONS[this.settings.variation].duration,
      shipped: this.settings.shipped === true,
      spires: this.settings.spires,
      spared: this.settings.shipped ? "none" : this.settings.spared,
      sparedHex: !this.settings.shipped && this.settings.spared === "realm" ? this.fixture.realm : null,
      realmSites: this.fixture.realms,
      spireSites: this.fixture.spires,
      realmCount: this.fixture.realms.length,
      armyCount: this.characters?.getStats().actorCount ?? 0,
      mistDraws: this.settings.shipped || this.elapsed === null ? 0 : 1,
      playing: this.playing,
    };
  }
  dispose(): void {
    this.characters?.dispose();
    this.spires?.dispose();
    this.realms?.dispose();
    this.mist?.geometry.dispose();
    this.mist?.material.dispose();
    this.group.removeFromParent();
  }
}
