import { Euler, Group, Matrix4, Vector3, type Camera, type Scene } from "three";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { configManager } from "@bibliothecadao/eternum";
import preset from "../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { BiomeTypeToId, TileOccupier, TroopTier, TroopType } from "@bibliothecadao/types";
import type { PipelineCompiler } from "@/three/pipeline-compiler";
import { FELT_CENTER } from "@/ui/config";
import {
  ProceduralArmyCharacterLayer,
  type ProceduralArmyCharacterPresentation,
} from "@/three/characters/procedural-army-character-layer";
import { SettlementModel } from "@/three/structures/settlement-model";
import { SpireManager } from "@/three/managers/spire-manager";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import { gltfLoader } from "@/three/utils/utils";
import { advanceGameEnd, resetGameEnd, skipGameEnd } from "@/three/effects/endgame/state";
import { setEndgameView } from "@/three/effects/endgame/field";
import { endgameFrame } from "@/three/effects/endgame/sequence";
import { createEndgameFixture, type EndgameLabSettings } from "./fixture";

/** Offline native facts and actors; the SpireManager and end sequence are the production implementation. */
export class EndgameFixtureScene {
  private readonly store = new NativeFactStore();
  private readonly projection = new WorldSpatialProjection({ store: this.store });
  private readonly fixture;
  private realms: SettlementModel | null = null;
  private armies: ProceduralArmyCharacterLayer | null = null;
  private spires: SpireManager | null = null;
  private actors: ProceduralArmyCharacterPresentation[] = [];
  private frame = endgameFrame(null);
  constructor(private readonly settings: EndgameLabSettings) {
    this.fixture = createEndgameFixture(settings);
    this.store.applyFacts([{ model: "SliceRules", key: "2", value: { ...preset.rules, game_id: 1 } }]);
    configManager.setActiveGame(1, 3);
    configManager.setStore(this.store);
    const offset = FELT_CENTER();
    const facts = this.fixture.request.cells.flatMap((cell, i) => {
      const hex = { game_id: 1, alt: false, col: cell.col + offset, row: cell.row + offset };
      const nativeSpire =
        settings.spires === "awaken" && this.fixture.spires.some((p) => p.col === cell.col && p.row === cell.row);
      const army = this.fixture.realms.some(
        (p) => cell.row === p.row + 1 && (cell.col === p.col - 1 || cell.col === p.col + 1),
      );
      const realm = this.fixture.realms.some((p) => p.col === cell.col && p.row === cell.row);
      return [
        {
          model: "TileOpt",
          key: String(i + 100),
          value: { ...hex, data: String(BigInt(BiomeTypeToId[cell.biome!]) << 41n) },
        },
        ...(nativeSpire || realm || army
          ? [
              {
                model: "TileOccupancy",
                key: String(i + 2000),
                value: {
                  ...hex,
                  entity_id: i + 1,
                  category: nativeSpire
                    ? TileOccupier.DormantSpire
                    : realm
                      ? TileOccupier.RealmRegularLevel1
                      : TileOccupier.ExplorerKnightT1,
                  is_structure: realm,
                },
              },
            ]
          : []),
      ];
    });
    this.store.applyFacts(facts);
    this.setEnded(false);
    this.projection.start();
  }
  private setEnded(ended: boolean): void {
    this.store.applyFacts([
      {
        model: "GameRegistry",
        key: "1",
        value: {
          game_id: 1,
          preset_id: 3,
          name: "1",
          start_settling_at: "1",
          start_main_at: "1",
          end_at: "0",
          settled: ended,
          ready: true,
          dev_mode_on: false,
          end_grace_seconds: 0,
          seed: "1",
        },
      },
    ]);
  }
  async prepare(scene: Scene, terrain: ProceduralTerrain, camera: Camera, compile: PipelineCompiler): Promise<void> {
    resetGameEnd();
    advanceGameEnd(1, false, 0);
    const asset = await gltfLoader.loadAsync("/models/realms/settlement.glb");
    this.realms = new SettlementModel(asset, this.fixture.realms.length, "realm");
    await this.realms.prepare();
    scene.add(this.realms.group);
    const matrix = new Matrix4();
    this.fixture.realms.forEach((p, i) => {
      const w = terrainHexToWorld(p.col, p.row);
      matrix.makeRotationY(i * 0.6).setPosition(w.x, terrain.sampleSurface(w.x, w.z).height + 0.025, w.z);
      this.realms!.setMatrixAt(i, matrix);
      this.realms!.setRelationshipAt(i, p === this.fixture.realm ? "owned" : "enemy");
      this.realms!.setOrderAt(i, (i % 16) + 1);
    });
    this.realms.setCount(this.fixture.realms.length);
    this.realms.needsUpdate();
    this.armies = new ProceduralArmyCharacterLayer(scene);
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
    const start = performance.now();
    while (this.armies.getStats().actorCount !== this.actors.length) {
      if (this.armies.getStats().loadState === "failed" || performance.now() - start > 20000)
        throw new Error("Fixture armies did not load");
      this.armies.sync(this.actors, 0);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    this.spires = new SpireManager(scene, this.projection, new Group(), terrain, undefined, undefined, compile);
    // The lab plays the end on demand, as a game in its last minutes: the veil is ready before it is asked for.
    this.spires.prepareGameEnd();
    await this.spires.prepare();
    this.spires.update(0, camera);
  }
  play(): void {
    this.setEnded(true);
  }
  reset(): void {
    this.setEnded(false);
    resetGameEnd();
    advanceGameEnd(1, false, 0);
  }
  skip(): void {
    skipGameEnd();
  }
  update(delta: number, _terrain: ProceduralTerrain, camera: Camera): void {
    const ended = this.store.require("GameRegistry", { game_id: 1 }).settled;
    this.frame = advanceGameEnd(1, ended, delta);
    const spared = this.settings.spared === "realm" ? this.fixture.realm : null;
    this.spires?.advanceGameEnd(this.frame, delta, camera, spared);
    this.spires?.update(this.frame.finished ? 0 : delta, camera);
    setEndgameView(true, this.settings.spared === "realm", this.frame.spread);
    if (!this.frame.finished) {
      this.armies?.sync(this.actors, delta);
      this.realms?.updateAnimations(delta);
    }
  }
  getSnapshot() {
    return {
      ...this.frame,
      sequence: "Fractured veil",
      duration: 9,
      spires: this.settings.spires,
      spared: this.settings.spared,
      realmSites: this.fixture.realms,
      realmCount: this.fixture.realms.length,
      armyCount: this.armies?.getStats().actorCount ?? 0,
      mistDraws: 0,
      ...this.spires?.getEndgameSnapshot(),
    };
  }
  dispose(): void {
    this.spires?.destroy();
    this.armies?.dispose();
    this.realms?.group.removeFromParent();
    this.realms?.dispose();
    this.projection.dispose();
    resetGameEnd();
  }
}
