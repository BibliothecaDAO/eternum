import { PerspectiveCamera, Scene } from "three";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import { pass } from "three/tsl";
import { RenderPipeline, type WebGPURenderer } from "three/webgpu";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MapFinish } from "./map-finish";

afterEach(() => vi.restoreAllMocks());

const classOf = (node: object) => Object.getPrototypeOf(node) as { dispose(): void };

function watchReleases() {
  vi.spyOn(RenderPipeline.prototype, "render").mockImplementation(() => {});
  const scenePass = pass(new Scene(), new PerspectiveCamera());
  const released = [scenePass, bloom(scenePass.getTextureNode()), smaa(scenePass.getTextureNode())].map((node) =>
    vi.spyOn(classOf(node), "dispose"),
  );
  return () => released.map((spy) => spy.mock.calls.length);
}

function watchPasses() {
  const made: Array<{ scene: unknown; camera: unknown }> = [];
  const passClass = classOf(pass(new Scene(), new PerspectiveCamera())) as unknown as { setMRT(mrt: unknown): unknown };
  const setMRT = passClass.setMRT;
  vi.spyOn(passClass, "setMRT").mockImplementation(function (this: { scene: unknown; camera: unknown }, mrt) {
    made.push(this);
    return setMRT.call(this, mrt);
  });
  return made;
}

describe("the map's finish", () => {
  it("draws the realm and the map through one set of offscreen passes, each frame the scene and camera asked", () => {
    const releases = watchReleases();
    const passes = watchPasses();
    const finish = new MapFinish({} as WebGPURenderer);
    const map = { scene: new Scene(), camera: new PerspectiveCamera() };
    const realm = { scene: new Scene(), camera: new PerspectiveCamera() };

    finish.render(map.scene, map.camera);
    finish.render(realm.scene, realm.camera);
    expect(passes).toHaveLength(1);
    expect(passes[0]).toMatchObject({ scene: realm.scene, camera: realm.camera });

    finish.render(map.scene, map.camera);
    expect(passes[0]).toMatchObject({ scene: map.scene, camera: map.camera });
    expect(releases()).toEqual([0, 0, 0]);
  });

  it("releases its offscreen passes once when the map leaves, however often it leaves", () => {
    const releases = watchReleases();
    const finish = new MapFinish({} as WebGPURenderer);
    finish.render(new Scene(), new PerspectiveCamera());
    finish.render(new Scene(), new PerspectiveCamera());
    finish.dispose();
    finish.dispose();
    expect(releases()).toEqual([1, 1, 1]);
  });
});
