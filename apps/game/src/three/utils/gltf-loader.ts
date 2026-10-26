import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import type { Texture } from "three";
import { currentModelUrls, readDeployedModelUrls } from "./model-url";

type KtxRenderer = Parameters<KTX2Loader["detectSupport"]>[0];

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");

// Under vitest the gstatic fetch resolves after the jsdom env tears down, and
// three.js's FileLoader calls `new ProgressEvent(...)` on the stale global,
// which leaks as an unhandled rejection and fails CI.
const isVitest = typeof process !== "undefined" && process.env?.VITEST === "true";
if (!isVitest) {
  dracoLoader.preload();
}

/**
 * The game's one glTF loader. Models are fetched at the URLs the build serves them at (content-hashed names); a model
 * that fails to load is asked for once more when the deployment now names it, or its buffers, differently.
 */
class DeployedGltfLoader extends GLTFLoader {
  override load(
    url: string,
    onLoad: (gltf: GLTF) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const asked = currentModelUrls();
    super.load(url, onLoad, onProgress, (error) => {
      void readDeployedModelUrls().then(() => {
        if (currentModelUrls() !== asked) super.load(url, onLoad, onProgress, onError);
        else if (onError) onError(error);
        else console.error(error);
      });
    });
  }
}

export const gltfLoader = new DeployedGltfLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

// /basis-v2/: the original /basis/ URL shipped a git-corrupted wasm with an
// immutable 1y cache header, so that path is permanently poisoned in tester
// browsers. Bump the directory if these files ever change again.
const ktx2Loader = new KTX2Loader().setTranscoderPath("/basis-v2/").setWorkerLimit(2);
gltfLoader.setKTX2Loader(ktx2Loader);

export function configureGltfTextureSupport(renderer: KtxRenderer): void {
  ktx2Loader.detectSupport(renderer);
}

export function loadKtx2Texture(path: string): Promise<Texture> {
  return ktx2Loader.loadAsync(path);
}
