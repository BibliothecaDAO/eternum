import * as T from "three";
import { WebGPURenderer } from "three/webgpu";
import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { gltfLoader, configureGltfTextureSupport } from "@/three/utils/gltf-loader";

export async function renderModel(model: string, pixels = 384) {
  const Renderer = WebGPURenderer as unknown as new (options: {
    alpha: boolean;
    antialias: boolean;
    forceWebGL: boolean;
  }) => RendererSurfaceLike & {
    init(): Promise<void>;
    setClearColor(color: number, alpha: number): void;
    compileAsync(object: T.Object3D, camera: T.Camera): Promise<unknown>;
  };
  const renderer = new Renderer({ alpha: true, antialias: true, forceWebGL: true });
  renderer.setSize(pixels, pixels);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = model.endsWith("/spire.glb") ? 3.5 : 1.3;
  await renderer.init();
  configureGltfTextureSupport(renderer);
  let object: T.Group | undefined;
  try {
    if (model === "procedural:hyperstructure") {
      const { createHyperstructureKit } = await import("@/three/structures/hyperstructure-kit");
      object = createHyperstructureKit(true).scene;
    } else {
      object = (await gltfLoader.loadAsync(model)).scene;
    }
    if (model.endsWith("/chest-c2.glb")) {
      const { ChestPresentation } = await import("@/three/rewards/chest-presentation");
      new ChestPresentation(object).faceCamera(new T.Vector3(-1.8, 1.55, 2.1));
    }
    const bounds = new T.Box3().setFromObject(object);
    const size = bounds.getSize(new T.Vector3());
    const center = bounds.getCenter(new T.Vector3());
    const scale = 1 / Math.max(size.x, size.y, size.z);
    object.scale.multiplyScalar(scale);
    object.position.sub(center.multiplyScalar(scale));
    const scene = new T.Scene();
    scene.add(object, new T.HemisphereLight(0xf3f6ff, 0x746955, 2.5));
    const key = new T.DirectionalLight(0xffecd4, 3);
    key.position.set(-3, 6, 8);
    scene.add(key);
    const camera = new T.OrthographicCamera(-0.7, 0.7, 0.7, -0.7, 0.01, 20);
    camera.position.set(-1.8, 1.55, 2.1);
    camera.lookAt(0, 0, 0);
    await renderer.compileAsync(scene, camera);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png");
  } finally {
    object?.traverse((child) => {
      if (!(child instanceof T.Mesh)) return;
      child.geometry?.dispose();
      for (const material of Array.isArray(child.material) ? child.material : child.material ? [child.material] : []) {
        for (const value of Object.values(material)) if (value instanceof T.Texture) value.dispose();
        material.dispose();
      }
    });
    renderer.dispose();
    renderer.domElement.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
