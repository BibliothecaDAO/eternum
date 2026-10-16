import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runProof } from "./prove-run.mjs";

/** Runs inside the client origin so it uses the game's Draco, Meshopt and KTX2 loader. */
export async function renderBuildingModel(model) {
  const threeUrl = new URL("/node_modules/.vite/deps/three.js", location.origin).href;
  const loaderUrl = new URL("/src/three/utils/gltf-loader.ts", location.origin).href;
  const T = await import(threeUrl);
  const { gltfLoader, configureGltfTextureSupport } = await import(loaderUrl);
  const renderer = new T.WebGPURenderer({ alpha: true, antialias: true, forceWebGL: true });
  renderer.setSize(384, 384);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  await renderer.init();
  configureGltfTextureSupport(renderer);
  let object;
  try {
    object = (await gltfLoader.loadAsync(model)).scene;
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
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png");
  } finally {
    object?.traverse((child) => {
      child.geometry?.dispose();
      for (const material of Array.isArray(child.material) ? child.material : child.material ? [child.material] : []) {
        for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
        material.dispose();
      }
    });
    renderer.dispose();
    renderer.backend.gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

const game = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Against the running client: node scripts/render-building-thumbnails.mjs <base-url> <evidence-directory>. */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseUrl = process.argv[2] ?? "https://127.0.0.1:4193";
  const manifestFile = resolve(game, "asset-sources/building-thumbnails.json");
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  await runProof(
    {
      parent: resolve(process.argv[3] ?? ".context/building-thumbnails"),
      name: "building-thumbnails",
      baseUrl,
      where: (record) => ({ name: record.name }),
    },
    async (b, out, records) => {
      b.run("open", `${baseUrl}/`, "--ignore-https-errors");
      for (const [image, entry] of Object.entries(manifest)) {
        const data = await b.evaluate(`(${renderBuildingModel.toString()})(${JSON.stringify(entry.model)})`);
        const png = Buffer.from(data.split(",")[1], "base64");
        const destination = resolve(game, `public${image}`);
        mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(destination, png);
        entry.modelSha256 = createHash("sha256")
          .update(readFileSync(resolve(game, `public${entry.model}`)))
          .digest("hex");
        entry.imageSha256 = createHash("sha256").update(png).digest("hex");
        records.push({ name: image, ready: true, presses: [], model: entry.model });
      }
      writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
      writeFileSync(resolve(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
      b.run("open", "about:blank");
    },
  );
}
