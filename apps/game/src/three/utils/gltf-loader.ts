import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { LoadingManager, type Texture } from "three";
import { beginModelPreparation } from "../model-preparation";
import { currentModelUrls, modelUrl, readDeployedModelUrls } from "./model-url";

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

// /basis-v2/: the original /basis/ URL shipped a git-corrupted wasm with an
// immutable 1y cache header, so that path is permanently poisoned in tester
// browsers. Bump the directory if these files ever change again.
const ktx2Loader = new KTX2Loader().setTranscoderPath("/basis-v2/").setWorkerLimit(2);

/** One load of one model: its own manager sees every file it fetches, the glTF's buffers and images included. */
function attemptLoader(): { loader: GLTFLoader; failed: () => boolean } {
  const manager = new LoadingManager();
  manager.setURLModifier(modelUrl);
  let failed = false;
  manager.onError = () => {
    failed = true;
  };
  const loader = new GLTFLoader(manager)
    .setDRACOLoader(dracoLoader)
    .setMeshoptDecoder(MeshoptDecoder)
    .setKTX2Loader(ktx2Loader);
  return { loader, failed: () => failed };
}

/**
 * The game's one glTF loader. Models are fetched at the URLs the build serves them at (content-hashed names). A model
 * any of whose files failed, the glTF itself or a buffer or image it names, is loaded once more when the deployment
 * now names a file differently; a missing image leaves no error of its own, so each load watches its files.
 */
class DeployedGltfLoader extends GLTFLoader {
  override load(
    url: string,
    onLoad: (gltf: GLTF) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    // The load counts as model preparation until it hands its model over or fails (model-preparation.ts).
    const endPreparation = beginModelPreparation();
    const loaded = (gltf: GLTF) => {
      endPreparation();
      onLoad(gltf);
    };
    const fail = (error: unknown) => {
      endPreparation();
      if (onError) onError(error);
      else console.error(error);
    };
    const attempt = (last: boolean) => {
      const asked = currentModelUrls();
      const { loader, failed } = attemptLoader();
      const settle = (gltf: GLTF | null, error?: unknown) => {
        if (gltf && !failed()) return loaded(gltf);
        if (last) return gltf ? loaded(gltf) : fail(error);
        void readDeployedModelUrls().then(() => {
          if (currentModelUrls() !== asked) attempt(true);
          else if (gltf) loaded(gltf);
          else fail(error);
        });
      };
      loader.load(
        url,
        (gltf) => settle(gltf),
        onProgress,
        (error) => settle(null, error),
      );
    };
    attempt(false);
  }
}

export const gltfLoader = new DeployedGltfLoader();

export function configureGltfTextureSupport(renderer: KtxRenderer): void {
  ktx2Loader.detectSupport(renderer);
}

export function loadKtx2Texture(path: string): Promise<Texture> {
  return ktx2Loader.loadAsync(path);
}
