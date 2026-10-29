// @vitest-environment jsdom
import { expect, it } from "vitest";

const { default: HexceptionScene } = await import("./hexception");

/** A realm view entering a realm whose grid builds when the test says so. */
const enteringRealm = () => {
  let finishGrid: () => void = () => {};
  const scene = Object.assign(Object.create(HexceptionScene.prototype), {
    activeRealmGeneration: 1,
    gridBuilds: { whenBuilt: () => new Promise<void>((resolve) => (finishGrid = resolve)) },
    groundTexturesReady: Promise.resolve(),
  });
  scene.prepareLocalPresentation();
  let presentable = false;
  void scene.whenPresentable().then(() => (presentable = true));
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { scene, finishGrid: () => finishGrid(), settle, isPresentable: () => presentable };
};

it("draws the realm once its grid is built, and is presentable only after that first frame is drawn", async () => {
  const realm = enteringRealm();
  expect(realm.scene.isReadyToRender()).toBe(false);

  realm.finishGrid();
  await realm.settle();
  // The first frame may be drawn behind the held map frame; until it is, the reveal waits.
  expect(realm.scene.isReadyToRender()).toBe(true);
  expect(realm.isPresentable()).toBe(false);

  realm.scene.onFrameRendered();
  await realm.settle();
  expect(realm.isPresentable()).toBe(true);
});

it("releases whoever waited on a realm another one replaced before its first frame", async () => {
  const realm = enteringRealm();
  realm.finishGrid();
  await realm.settle();

  realm.scene.prepareLocalPresentation();
  await realm.settle();
  expect(realm.isPresentable()).toBe(true);
});
