import { Matrix4, type Scene, type Vector3 } from "three";
import { REALM_ASSETS, realmModelIndex } from "../structures/realm-design";
import { SettlementModel } from "../structures/settlement-model";
import { gltfLoader } from "../utils/utils";
import type { WorldmapProceduralTerrain } from "../terrain/worldmap-procedural-terrain";

/** 48 placed realms: six normal and six wonder instances of each age, sharing the live model batches. */
export async function createRealmDensityFixture(scene: Scene, terrain: WorldmapProceduralTerrain, center: Vector3) {
  const models = new Map<number, SettlementModel>();
  const counts = new Map<number, number>();
  try {
    for (let index = 0; index < 48; index++) {
      const level = index % 4;
      const entity = 1001 + Math.floor(index / 4);
      const modelIndex = realmModelIndex(level, index >= 24, entity);
      let model = models.get(modelIndex);
      if (!model) {
        const asset = REALM_ASSETS[modelIndex];
        model = new SettlementModel(await gltfLoader.loadAsync(asset.path), 6, "realm", asset.wonder);
        models.set(modelIndex, model);
        await model.prepare();
        scene.add(model.group);
      }
      const slot = counts.get(modelIndex) ?? 0;
      const x = center.x + ((index % 8) - 3.5) * Math.sqrt(3) * 2;
      const z = center.z + (Math.floor(index / 8) - 2.5) * 3;
      model.setMatrixAt(slot, new Matrix4().makeTranslation(x, terrain.sampleSurface(x, z).height, z));
      model.setOrderAt(slot, level);
      model.setRelationshipAt(slot, index % 2 ? "owned" : "enemy");
      model.setWonderEntityAt(slot, entity);
      model.setCount(slot + 1);
      counts.set(modelIndex, slot + 1);
    }
    return {
      update: (delta: number) => models.forEach((model) => model.updateAnimations(delta)),
      dispose: () => models.forEach((model) => model.dispose()),
    };
  } catch (error) {
    models.forEach((model) => model.dispose());
    throw error;
  }
}
