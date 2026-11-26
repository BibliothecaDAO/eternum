import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { expect, it } from "vitest";
import { withFlagCloth } from "./flag-cloth";
import { REALM_BANNER_TILE } from "./settlement-appearance";

const realm = (flagAnchors?: unknown[]) => {
  const scene = new Group();
  const body = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  if (flagAnchors) body.userData.flagAnchors = flagAnchors;
  scene.add(body);
  return { scene, animations: [] } as unknown as GLTF;
};

const cloth = (gltf: GLTF) => gltf.scene.children.filter((node) => node.userData.orderCloth);
const corner = (mesh: Mesh, index: number) =>
  new Vector3()
    .fromBufferAttribute(mesh.geometry.getAttribute("position"), index)
    .toArray()
    .map((value) => Number(value.toFixed(3)));

it("hangs one banner cloth from each anchor's top, as tall as the Order tile is for its width", () => {
  const gltf = withFlagCloth(
    realm([
      { top: [0.2, 0.5, 0.1], width: 0.2, facing: 0 },
      { top: [-0.3, 0.3, 0.2], width: 0.1, facing: 90 },
    ]),
  );
  const [banner] = cloth(gltf) as Mesh[];
  expect(cloth(gltf)).toHaveLength(1);
  expect(banner.userData.orderCloth).toBe("banner");
  expect(banner.geometry.index!.count / 3).toBe(4);
  const drop = Number(((0.2 * REALM_BANNER_TILE.height) / REALM_BANNER_TILE.width).toFixed(3));
  expect(corner(banner, 0)).toEqual([0.1, 0.5, 0.1]);
  expect(corner(banner, 2)).toEqual([0.3, Number((0.5 - drop).toFixed(3)), 0.1]);
  expect(new Vector3().fromBufferAttribute(banner.geometry.getAttribute("normal"), 4).x).toBeCloseTo(1);
});

it("refuses an anchor that declares anything but a top, a width and a facing, so no banner is squashed", () => {
  expect(() => withFlagCloth(realm([{ role: "banner", position: [0, 0.5, 0], size: [0.2, 0.1], facing: 0 }]))).toThrow(
    "flag anchor",
  );
  expect(() => withFlagCloth(realm([{ top: [0, 0.5, 0], width: 0.2, height: 0.1, facing: 0 }]))).toThrow("flag anchor");
});

it("adds nothing to a model that declares no anchors, and never twice to a shared model", () => {
  expect(cloth(withFlagCloth(realm([])))).toEqual([]);
  expect(cloth(withFlagCloth(realm()))).toEqual([]);
  const shared = realm([{ top: [0, 0.5, 0], width: 0.2, facing: 0 }]);
  withFlagCloth(shared);
  withFlagCloth(shared);
  expect(cloth(shared)).toHaveLength(1);
});
