import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { expect, it } from "vitest";
import { withFlagCloth } from "./flag-cloth";

const realm = (flagAnchors?: unknown[]) => {
  const scene = new Group();
  const body = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  if (flagAnchors) body.userData.flagAnchors = flagAnchors;
  scene.add(body);
  return { scene, animations: [] } as unknown as GLTF;
};

const cloth = (gltf: GLTF) => gltf.scene.children.filter((node) => node.userData.orderCloth);

it("hangs the game's own cloth at each anchor, one tagged mesh per role, where the anchor says", () => {
  const gltf = withFlagCloth(
    realm([
      { role: "banner", position: [0.2, 0.5, 0.1], size: [0.2, 0.4], facing: 0 },
      { role: "banner", position: [-0.3, 0.3, 0.2], size: [0.1, 0.2], facing: 90 },
      { role: "trim", position: [0, 0.2, 0.4], size: [0.1, 0.1], facing: 0 },
    ]),
  );
  const [banner, trim] = cloth(gltf) as Mesh[];
  expect([banner.userData.orderCloth, trim.userData.orderCloth]).toEqual(["banner", "trim"]);
  expect(banner.geometry.index!.count / 3).toBe(4);
  banner.geometry.computeBoundingBox();
  const first = new Vector3().fromBufferAttribute(banner.geometry.getAttribute("position"), 0);
  expect(first.toArray().map((value) => Number(value.toFixed(3)))).toEqual([0.1, 0.7, 0.1]);
  expect(new Vector3().fromBufferAttribute(banner.geometry.getAttribute("normal"), 4).x).toBeCloseTo(1);
});

it("refuses an anchor of a role the game has no cloth for, rather than leaving a bare post", () => {
  expect(() => withFlagCloth(realm([{ role: "pennant", position: [0, 0.5, 0], size: [0.2, 0.4], facing: 0 }]))).toThrow(
    "flag anchor",
  );
});

it("adds nothing to a model that declares no anchors, and never twice to a shared model", () => {
  expect(cloth(withFlagCloth(realm([])))).toEqual([]);
  expect(cloth(withFlagCloth(realm()))).toEqual([]);
  const shared = realm([{ role: "banner", position: [0, 0.5, 0], size: [0.2, 0.4], facing: 0 }]);
  withFlagCloth(shared);
  withFlagCloth(shared);
  expect(cloth(shared)).toHaveLength(1);
});
