import { BoxGeometry, BufferGeometry, Mesh, PerspectiveCamera, Scene } from "three";
import Renderer from "three/src/renderers/common/Renderer.js";
import { afterEach, describe, expect, it, vi } from "vitest";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

/** Exercise Three's installed compileAsync; only scene traversal and GPU submission are faked. */
function createCompilation() {
  vi.stubGlobal("self", { scheduler: { yield: () => Promise.resolve() } });
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const objects = [new Mesh(new BufferGeometry()), new Mesh(new BufferGeometry())];
  const work = objects.map((object) => ({ object, material: object.material, scene, camera }));
  const pipelines = work.map(() => deferred());
  const renderList = {
    push: vi.fn(),
    begin: vi.fn(),
    finish: vi.fn(),
    opaque: work,
    transparent: [],
    transparentDoublePass: [],
  };
  const updateAfter = vi.fn();
  const buildNodes = vi.fn(async (): Promise<void> => {});
  const submit = vi.fn((object: (typeof work)[number], pending: Promise<void>[]) => {
    pending.push(pipelines[work.indexOf(object)].promise);
  });
  const renderer = {
    _initialized: true,
    _createObjectPipeline: vi.fn(),
    _handleObjectFunction: vi.fn(),
    _renderTarget: null,
    _outputRenderTarget: null,
    _nodes: {
      nodeFrame: { renderId: 7, update: vi.fn() },
      getForRenderAsync: buildNodes,
      updateBefore: vi.fn(),
      updateForRender: vi.fn(),
      updateAfter,
    },
    _renderContexts: { get: () => ({}) },
    _renderLists: { get: () => renderList },
    _updateCamera: () => camera,
    _projectObject: vi.fn(),
    _background: { update: vi.fn() },
    _objects: { get: (object: Mesh) => work.find((entry) => entry.object === object) },
    _geometries: { updateForRender: vi.fn() },
    _bindings: { updateForRender: vi.fn() },
    _pipelines: { getForRender: submit },
    _compilationPromises: [] as typeof work,
    _renderObjects: () => renderer._compilationPromises.push(...work),
    opaque: true,
    transparent: false,
  };
  const compile = () => Renderer.prototype.compileAsync.call(renderer as unknown as Renderer, scene, camera);
  return { compile, pipelines, submit, updateAfter, work, renderer, buildNodes, renderList, objects, camera };
}

afterEach(() => vi.unstubAllGlobals());

describe("Three pipeline submission", () => {
  it("submits later parts while earlier pipelines are pending, and waits for all parts", async () => {
    const { compile, pipelines, submit, updateAfter, work, renderer } = createCompilation();
    const finished = vi.fn();
    const compilation = compile().then(finished);
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    expect(renderer._nodes.nodeFrame.renderId).toBe(7);
    expect(updateAfter).not.toHaveBeenCalled();
    expect(finished).not.toHaveBeenCalled();
    pipelines[1].resolve();
    await vi.waitFor(() => expect(updateAfter).toHaveBeenCalledWith(work[1]));
    expect(finished).not.toHaveBeenCalled();
    pipelines[0].resolve();
    await compilation;
    expect(updateAfter).toHaveBeenCalledWith(work[0]);
    expect(finished).toHaveBeenCalledOnce();
  });

  it("observes early GPU rejection while later shaders yield, then propagates the failure", async () => {
    const { compile, pipelines, submit, buildNodes } = createCompilation();
    const laterShader = deferred();
    buildNodes.mockImplementationOnce(async () => undefined).mockImplementationOnce(() => laterShader.promise);
    const failure = new Error("GPU pipeline failed");
    const compilation = expect(compile()).rejects.toBe(failure);
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    pipelines[0].reject(failure);
    // Let the unhandled-rejection turn pass while shader building is still pending.
    await new Promise((resolve) => setTimeout(resolve, 0));
    laterShader.resolve();
    pipelines[1].resolve();
    await compilation;
    expect(submit).toHaveBeenCalledTimes(2);
  });
});

// Use Three's real frustum projection so this catches a prewarm that silently skips empty/off-camera models.
it("precompiles off-camera models while retaining frustum culling for actual draws", async () => {
  const { compile, renderer, renderList, objects, camera, pipelines } = createCompilation();
  const mesh = objects[0];
  mesh.geometry = new BoxGeometry();
  mesh.position.set(100_000, 100_000, 100_000);
  mesh.updateMatrixWorld();
  const projectObject = Reflect.get(Renderer.prototype, "_projectObject");
  renderer._projectObject.mockImplementation(() => projectObject.call(renderer, mesh, camera, 0, renderList, {}));
  pipelines.forEach((pipeline) => pipeline.resolve());
  await compile();
  expect(renderList.push).toHaveBeenCalledOnce();
  expect(mesh.frustumCulled).toBe(true);
  renderList.push.mockClear();
  renderer._projectObject();
  expect(renderList.push).not.toHaveBeenCalled();
  mesh.geometry.dispose();
});
