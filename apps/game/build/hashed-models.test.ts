// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import type { BufferGeometry, Mesh, MeshStandardMaterial } from "three";
import { afterEach, expect, it, vi } from "vitest";
import { hashedModels } from "./hashed-models";

const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.resetModules();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const hashOf = (bytes: string) => createHash("sha256").update(bytes).digest("hex").slice(0, 12);

/** A client with one model and a glTF whose buffer sits beside it, built as players get it. */
async function builtClient(models: Record<string, string | Uint8Array>) {
  const root = await mkdtemp(join(tmpdir(), "hashed-models-"));
  roots.push(root);
  for (const [path, bytes] of Object.entries(models)) {
    await mkdir(join(root, "public/models", path, ".."), { recursive: true });
    await writeFile(join(root, "public/models", path), bytes);
  }
  await writeFile(join(root, "index.html"), '<script type="module" src="/main.js"></script>');
  await writeFile(join(root, "main.js"), "window.MODELS = __MODEL_URLS__;");
  await build({ root, logLevel: "silent", configFile: false, plugins: [hashedModels()] });
  const dist = join(root, "dist");
  const files = async (directory: string): Promise<string[]> =>
    (await readdir(directory, { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).slice(dist.length));
  const script = (await files(join(dist, "assets"))).find((file) => file.endsWith(".js"))!;
  return {
    dist,
    models: (await files(join(dist, "models"))).toSorted(),
    script: await readFile(join(dist, script), "utf8"),
    urls: JSON.parse(await readFile(join(dist, "model-urls.json"), "utf8")) as Record<string, string>,
  };
}

it("serves each model at a name carrying its content's hash, and gives the client the map from each URL to it", async () => {
  const client = await builtClient({
    "realms/city.glb": "city v1",
    "characters/dragon/scene.gltf": '{"buffers":[{"uri":"scene.bin"}]}',
    "characters/dragon/scene.bin": "dragon buffer",
  });

  const city = `/models/realms/city.${hashOf("city v1")}.glb`;
  const gltf = `/models/characters/dragon/scene.${hashOf('{"buffers":[{"uri":"scene.bin"}]}')}.gltf`;
  const buffer = `/models/characters/dragon/scene.${hashOf("dragon buffer")}.bin`;
  expect(client.models).toEqual([buffer, gltf, city].toSorted());
  expect(client.script).toContain(`"/models/realms/city.glb":"${city}"`);
  expect(client.script).toContain(`"/models/characters/dragon/scene.bin":"${buffer}"`);
});

it("gives a changed model a new URL and an unchanged one the same", async () => {
  const before = await builtClient({ "realms/city.glb": "city v1", "realms/kingdom.glb": "kingdom" });
  const after = await builtClient({ "realms/city.glb": "city v2", "realms/kingdom.glb": "kingdom" });

  expect(before.models).not.toContain(after.models.find((file) => file.includes("/city.")));
  expect(after.models).toContain(before.models.find((file) => file.includes("/kingdom.")));
});

const model = (release: string) =>
  JSON.stringify({ asset: { version: "2.0" }, scenes: [{}], scene: 0, extras: { release } });

/**
 * The game's glTF loader in a tab opened on one release while the host serves another's files. A missing file gets
 * the app's page, as Pages answers a path it does not hold.
 */
async function tabOpenedOn(release: { urls: Record<string, string> }, served: { dist: string }) {
  const asked: string[] = [];
  vi.stubGlobal("__MODEL_URLS__", release.urls);
  vi.stubGlobal("ProgressEvent", class extends Event {});
  vi.stubGlobal(
    "Request",
    class {
      constructor(readonly url: string) {}
    },
  );
  vi.stubGlobal("fetch", async (request: string | { url: string }) => {
    const path = typeof request === "string" ? request : request.url;
    asked.push(path);
    try {
      return new Response(await readFile(join(served.dist, path)));
    } catch {
      return new Response("<!doctype html><title>Realms</title>", { headers: { "content-type": "text/html" } });
    }
  });
  const { gltfLoader } = await import("@/three/utils/gltf-loader");
  return { asked, gltfLoader };
}

it("loads a model a deployment changed in a tab opened before it, from the deployment's own map", async () => {
  const before = await builtClient({ "realms/city.gltf": model("before"), "realms/kingdom.gltf": model("kept") });
  const after = await builtClient({ "realms/city.gltf": model("after"), "realms/kingdom.gltf": model("kept") });
  const tab = await tabOpenedOn(before, after);

  const city = await tab.gltfLoader.loadAsync("/models/realms/city.gltf");

  expect(city.userData).toEqual({ release: "after" });
  expect(tab.asked).toEqual([
    before.urls["/models/realms/city.gltf"],
    "/model-urls.json",
    after.urls["/models/realms/city.gltf"],
  ]);
  expect((await tab.gltfLoader.loadAsync("/models/realms/kingdom.gltf")).userData).toEqual({ release: "kept" });
});

it("fails a model the deployment does not serve after one read of its map", async () => {
  const before = await builtClient({ "realms/city.gltf": model("before"), "realms/ruin.gltf": model("before") });
  const after = await builtClient({ "realms/city.gltf": model("before") });
  const tab = await tabOpenedOn(before, after);

  await expect(tab.gltfLoader.loadAsync("/models/realms/ruin.gltf")).rejects.toThrow();
  expect(tab.asked.filter((path) => path === "/model-urls.json")).toHaveLength(1);
});

/** A triangle whose material's colour comes from `color.png` beside it; its vertices sit in `scene.bin`. */
const TEXTURED = JSON.stringify({
  asset: { version: "2.0" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] }],
  bufferViews: [{ buffer: 0, byteLength: 36 }],
  buffers: [{ uri: "scene.bin", byteLength: 36 }],
  materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
  textures: [{ source: 0 }],
  images: [{ uri: "color.png" }],
});
const TRIANGLE = new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);

it("gives a model its image a deployment changed, the glTF naming it unchanged", async () => {
  const before = await builtClient({
    "dragon/scene.gltf": TEXTURED,
    "dragon/scene.bin": TRIANGLE,
    "dragon/color.png": "v1",
  });
  const after = await builtClient({
    "dragon/scene.gltf": TEXTURED,
    "dragon/scene.bin": TRIANGLE,
    "dragon/color.png": "v2",
  });
  vi.stubGlobal("self", globalThis);
  // An image decodes unless it is the app's page, which the host answers for a file it does not hold.
  vi.stubGlobal("createImageBitmap", async (blob: Blob) => {
    if ((await blob.text()).startsWith("<!doctype")) throw new Error("not an image");
    return { width: 1, height: 1, close() {} };
  });
  const tab = await tabOpenedOn(before, after);

  const dragon = await tab.gltfLoader.loadAsync("/models/dragon/scene.gltf");

  expect((dragon.scene.children[0] as Mesh<BufferGeometry, MeshStandardMaterial>).material.map).not.toBeNull();
  expect(tab.asked.filter((path) => path.includes("color.") || path === "/model-urls.json")).toEqual([
    before.urls["/models/dragon/color.png"],
    "/model-urls.json",
    after.urls["/models/dragon/color.png"],
  ]);
});
