// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import { projectHexEastEdgeToScreen } from "./project-hex-to-screen";
import { getHexForWorldPosition, getWorldPositionForHex } from "./utils";

afterEach(() => document.body.replaceChildren());

const RECT = { left: 0, top: 0, width: 800, height: 800 };

it("puts a revealed tile's flourish on its own east edge, never inside the neighbour", () => {
  const canvas = document.createElement("canvas");
  canvas.id = "main-canvas";
  canvas.getBoundingClientRect = () => RECT as DOMRect;
  document.body.append(canvas);
  const hex = { col: 12, row: 7 };
  const centre = getWorldPositionForHex(hex);
  const camera = new OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
  camera.position.set(centre.x, 20, centre.z);
  camera.up.set(0, 0, -1);
  camera.lookAt(centre);
  camera.updateMatrixWorld();
  const point = projectHexEastEdgeToScreen(hex, camera);
  const world = new Vector3((point.x / RECT.width) * 2 - 1, 1 - (point.y / RECT.height) * 2, 0).unproject(camera);
  expect(getHexForWorldPosition({ x: world.x - 0.01, y: 0, z: world.z })).toEqual(hex);
  expect(getHexForWorldPosition({ x: world.x + 0.01, y: 0, z: world.z })).not.toEqual(hex);
});
