// @vitest-environment jsdom
import { PerspectiveCamera, Scene } from "three";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import { pass } from "three/tsl";
import { RenderPipeline, type WebGPURenderer } from "three/webgpu";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MapFinish } from "./map-finish";

afterEach(() => vi.restoreAllMocks());

/** The class of a node three's own factory makes, as the finish makes it. */
const classOf = (node: object) => Object.getPrototypeOf(node) as { dispose(): void };

/** How many scene passes, blooms and SMAA passes have been released, the finish's real nodes drawn through a stub. */
function watchReleases() {
  vi.spyOn(RenderPipeline.prototype, "render").mockImplementation(() => {});
  const scenePass = pass(new Scene(), new PerspectiveCamera());
  const released = [scenePass, bloom(scenePass.getTextureNode()), smaa(scenePass.getTextureNode())].map((node) =>
    vi.spyOn(classOf(node), "dispose"),
  );
  return () => released.map((spy) => spy.mock.calls.length);
}

describe("the map's finish", () => {
  it("releases a scene's offscreen passes when its camera is replaced, and the rest when the map leaves", () => {
    const releases = watchReleases();
    const finish = new MapFinish({} as WebGPURenderer);
    const scene = new Scene();
    finish.render(scene, new PerspectiveCamera());
    finish.render(scene, new PerspectiveCamera());
    expect(releases()).toEqual([1, 1, 1]);

    finish.render(new Scene(), new PerspectiveCamera());
    finish.dispose();
    expect(releases()).toEqual([3, 3, 3]);
  });

  it("releases nothing twice when the map leaves twice", () => {
    const releases = watchReleases();
    const finish = new MapFinish({} as WebGPURenderer);
    finish.render(new Scene(), new PerspectiveCamera());
    finish.dispose();
    finish.dispose();
    expect(releases()).toEqual([1, 1, 1]);
  });

  it("keeps one finish per scene and camera across frames", () => {
    const releases = watchReleases();
    const finish = new MapFinish({} as WebGPURenderer);
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    for (let frame = 0; frame < 5; frame += 1) finish.render(scene, camera);
    expect(releases()).toEqual([0, 0, 0]);
  });
});
