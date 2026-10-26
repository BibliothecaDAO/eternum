import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { expect, it, vi } from "vitest";
import { HexceptionModels } from "./hexception-models";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function realmView() {
  const model = { model: new Group(), animations: [] };
  model.model.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
  let entered = true;
  const pending = deferred<typeof model>();
  const load = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(model);
  const render = vi.fn();
  const path = "/models/realms/twin-guardians.glb";
  const reconcile = () => {
    if (!entered) return;
    const selected = models.get(path);
    if (selected) render(selected.model);
  };
  const models = new HexceptionModels(load, reconcile);
  return {
    models,
    model,
    pending,
    load,
    render,
    path,
    leave: () => {
      entered = false;
    },
    enter: () => {
      entered = true;
      reconcile();
    },
  };
}

it("retains a completion while away and reconciles the selected model on return", async () => {
  const view = realmView();
  const loading = view.models.request(view.path);
  expect(view.models.request(view.path)).toBe(loading);
  view.leave();
  view.pending.resolve(view.model);
  await loading;
  expect(view.render).not.toHaveBeenCalled();
  view.enter();
  expect(view.render).toHaveBeenCalledOnce();
  expect(view.render).toHaveBeenCalledWith(view.model.model);
  await view.models.request(view.path);
  expect(view.load).toHaveBeenCalledTimes(1);
  view.models.dispose();
});

it("retries a rejected request and reconciles its successful replacement", async () => {
  const view = realmView();
  const loading = view.models.request(view.path);
  view.pending.reject(new Error("network failed"));
  await expect(loading).rejects.toThrow("network failed");
  expect(view.render).not.toHaveBeenCalled();
  await view.models.request(view.path);
  expect(view.load).toHaveBeenCalledTimes(2);
  expect(view.render).toHaveBeenCalledOnce();
  expect(view.render).toHaveBeenCalledWith(view.model.model);
  view.models.dispose();
});

it("disposes a late completion without caching or reconciling a destroyed scene", async () => {
  const view = realmView();
  const mesh = view.model.model.children[0] as Mesh;
  const dispose = vi.spyOn(mesh.geometry, "dispose");
  const loading = view.models.request(view.path);
  view.models.dispose();
  view.pending.resolve(view.model);
  await loading;
  expect(dispose).toHaveBeenCalledOnce();
  expect(view.models.get(view.path)).toBeUndefined();
  view.enter();
  await view.models.request(view.path);
  expect(view.render).not.toHaveBeenCalled();
  expect(view.load).toHaveBeenCalledTimes(1);
});
