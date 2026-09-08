// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
vi.mock("./utils", () => ({
  getWorldPositionForHex: ({ col, row }: { col: number; row: number }) => new Vector3(col, row, 0),
}));
import { projectHexToScreen } from "./project-hex-to-screen";
afterEach(() => document.body.replaceChildren());
it("projects into the canvas viewport including its offset", () => {
  const canvas = document.createElement("canvas");
  canvas.id = "main-canvas";
  canvas.getBoundingClientRect = () => ({ left: 100, top: 50, width: 800, height: 400 }) as DOMRect;
  document.body.append(canvas);
  const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
  camera.position.z = 10;
  camera.updateMatrixWorld();
  expect(projectHexToScreen({ col: 1, row: 1 }, camera)).toEqual({ x: 700, y: 150 });
});
it("fails loudly when the map canvas is missing", () => {
  expect(() => projectHexToScreen({ col: 0, row: 0 }, new OrthographicCamera())).toThrow("Map canvas is missing");
});
