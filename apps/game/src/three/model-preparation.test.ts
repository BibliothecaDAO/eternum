// @vitest-environment node
import { Group, PerspectiveCamera, Scene } from "three";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** A compiler whose every compile waits for `finish()`, and the page's preparation it reports to. */
async function heldCompiler() {
  const { createPipelineCompiler } = await import("./pipeline-compiler");
  const { whenModelPreparationSettles } = await import("./model-preparation");
  const pending: Array<() => void> = [];
  const compile = createPipelineCompiler({
    getRenderer: () => ({ compileAsync: () => new Promise<void>((resolve) => pending.push(resolve)) }),
    getCamera: () => new PerspectiveCamera(),
  });
  const finish = async () => {
    await vi.waitFor(() => expect(pending.length).toBeGreaterThan(0));
    pending.shift()!();
  };
  return { compile, finish, whenModelPreparationSettles };
}

it("is settled at once when no model loads or compiles", async () => {
  const { whenModelPreparationSettles } = await import("./model-preparation");
  await expect(whenModelPreparationSettles(1_000)).resolves.toBe("settled");
});

it("settles only after models compiled one after another have all finished", async () => {
  const { compile, finish, whenModelPreparationSettles } = await heldCompiler();
  const scene = new Scene();
  const loop = (async () => {
    for (const model of [new Group(), new Group()]) await compile(model, scene);
  })();
  let settled: string | null = null;
  void whenModelPreparationSettles(5_000).then((result) => (settled = result));

  await finish();
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(settled).toBeNull();

  await finish();
  await loop;
  await vi.waitFor(() => expect(settled).toBe("settled"));
});

it("counts a model the game's glTF loader is still fetching", async () => {
  let answer: (body: string) => void = () => {};
  vi.stubGlobal("__MODEL_URLS__", {});
  vi.stubGlobal("ProgressEvent", class extends Event {});
  vi.stubGlobal(
    "Request",
    class {
      constructor(readonly url: string) {}
    },
  );
  vi.stubGlobal("fetch", () => new Promise<Response>((resolve) => (answer = (body) => resolve(new Response(body)))));
  const { gltfLoader } = await import("./utils/gltf-loader");
  const { whenModelPreparationSettles } = await import("./model-preparation");

  const loading = gltfLoader.loadAsync("/models/realms/city.gltf");
  let settled: string | null = null;
  void whenModelPreparationSettles(5_000).then((result) => (settled = result));
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(settled).toBeNull();

  answer(JSON.stringify({ asset: { version: "2.0" }, scenes: [{}], scene: 0 }));
  await loading;
  await vi.waitFor(() => expect(settled).toBe("settled"));
});

it("gives up after its bound while a compile never ends", async () => {
  const { compile, finish, whenModelPreparationSettles } = await heldCompiler();
  const compiling = compile(new Group(), new Scene());
  await expect(whenModelPreparationSettles(20)).resolves.toBe("timed-out");
  await finish();
  await compiling;
});
