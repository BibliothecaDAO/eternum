// @vitest-environment node
import { createRequire } from "node:module";
import { NodeIO, type Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { expect, it } from "vitest";
import { BUILDINGS_CENTER, BuildingType, getProducedResource } from "@bibliothecadao/types";
import { getGameModeConfig } from "@/config/game-modes";
import { BUILDINGS_GROUPS } from "../constants/scene-constants";
import { REALM_SKIN_MODELS } from "../structures/realm-skins";
import { FRONTIER_PAINTED_BUILDINGS } from "../structures/frontier-painted-buildings";
import { prepareBuildingModel } from "./hexception-models";
import { resolveBuildingModelSelection } from "./hexception-building-model";

it("grounds every building kind and tier in each mode, including keeps and cosmetic skins", async () => {
  const { createDecoderModule } = createRequire(import.meta.url)("draco3dgltf");
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": await createDecoderModule(),
    "meshopt.decoder": MeshoptDecoder,
  });
  const paths = new Set([...REALM_SKIN_MODELS, ...FRONTIER_PAINTED_BUILDINGS].map(({ path }) => path));
  const covered = new Set<BuildingType>();
  const kinds = Object.values(BuildingType).filter(
    (kind): kind is BuildingType => typeof kind === "number" && kind !== BuildingType.None,
  );
  for (const preset of [2, 3, 5]) {
    const mode = getGameModeConfig(preset);
    for (const [group, models] of Object.entries(mode.assets.buildingModelPaths)) {
      if (group !== BUILDINGS_GROUPS.HYPERSTRUCTURE) Object.values(models).forEach((path) => paths.add(path));
    }
    for (const category of kinds) {
      for (let tier = 1; tier <= 3; tier++) {
        const selected = resolveBuildingModelSelection(
          {
            category,
            tier,
            col: BUILDINGS_CENTER[0] + 1,
            row: BUILDINGS_CENTER[1],
            resource: getProducedResource(category),
          },
          { stage: 0, structureId: 7, wonder: false, frontier: mode.id === "frontier" },
        );
        const models: Readonly<Record<string, string>> = mode.assets.buildingModelPaths[selected.group];
        const path = selected.tierPath ?? models[selected.type];
        if (path) {
          paths.add(path);
          covered.add(category);
        }
      }
    }
  }
  expect(covered).toEqual(new Set(kinds));
  for (const path of paths) {
    const document = await io.read(new URL(`../../../public${path}`, import.meta.url).pathname);
    const source = new Group();
    for (const node of document.getRoot().listScenes()[0].listChildren()) source.add(sceneNode(node));
    const model = prepareBuildingModel(source);
    model.position.set(3, 0.47, -2);
    model.rotation.y = 2.1;
    for (const scale of [0.01, 0.7, 1, 1.08]) {
      model.scale.setScalar(scale);
      expect(new Box3().setFromObject(model, true).min.y, path).toBeCloseTo(0.47, 6);
    }
    model.traverse((part) => {
      if (part instanceof Mesh) part.geometry.dispose();
    });
  }
});

/** Decode the file's actual vertex positions and complete node hierarchy; textures do not affect contact. */
function sceneNode(node: Node): Group {
  const group = new Group();
  new Matrix4().fromArray(node.getMatrix()).decompose(group.position, group.quaternion, group.scale);
  for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    group.add(
      new Mesh(
        new BufferGeometry().setAttribute(
          "position",
          new Float32BufferAttribute(primitive.getAttribute("POSITION")!.getArray()!, 3),
        ),
      ),
    );
  }
  for (const child of node.listChildren()) group.add(sceneNode(child));
  return group;
}
