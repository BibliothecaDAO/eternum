import { expect, it } from "vitest";
import { RealmGridBuilds } from "./hexception-grid-builds";

/**
 * A scene's grid as the realm view keeps it: each build lays out its cells over the shared state, the terrain worker
 * answers page requests in the order they were sent, and presenting draws a page over whatever cells are laid out then.
 */
function realmScene() {
  const builds = new RealmGridBuilds();
  const replies: Array<() => void> = [];
  const presented: Array<{ page: number; cells: number }> = [];
  const released: number[] = [];
  let cells = 0;
  let built = 0;
  const update = () => {
    built += 1;
    const build = built;
    builds.start({
      loadModels: () => Promise.resolve(),
      layOut: () => {
        cells = build;
        return build;
      },
      preparePage: (layout) => new Promise<number>((resolve) => replies.push(() => resolve(layout))),
      present: (page) => presented.push({ page, cells }),
      release: (layout) => released.push(layout),
    });
  };
  const replyNext = async () => {
    replies.shift()!();
    await settle();
  };
  return { builds, update, replyNext, presented, released };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

it("presents only the latest build when the realm updates again before the first page comes back", async () => {
  const scene = realmScene();
  scene.update();
  await settle();
  scene.update();
  await settle();

  await scene.replyNext();
  await scene.replyNext();

  expect(scene.presented).toEqual([{ page: 2, cells: 2 }]);
  expect(scene.released).toEqual([1, 2]);
});

it("presents nothing of a build whose realm was left before its page came back", async () => {
  const scene = realmScene();
  scene.update();
  await settle();
  scene.builds.supersede();

  await scene.replyNext();

  expect(scene.presented).toEqual([]);
  expect(scene.released).toEqual([1]);
});

it("presents a build once its buildings' models are in, and nothing of one whose realm was left meanwhile", async () => {
  const builds = new RealmGridBuilds();
  const presented: number[] = [];
  let modelsIn = () => {};
  const start = () =>
    builds.start({
      layOut: () => presented.length + 1,
      loadModels: () => new Promise<void>((resolve) => (modelsIn = resolve)),
      preparePage: (layout) => Promise.resolve(layout),
      present: (page) => presented.push(page),
      release: () => {},
    });

  start();
  await settle();
  expect(presented).toEqual([]);
  modelsIn();
  await builds.whenBuilt();
  expect(presented).toEqual([1]);

  start();
  builds.supersede();
  modelsIn();
  await builds.whenBuilt();
  expect(presented).toEqual([1]);
});

it("is built only once the latest build has presented, not when a superseded one settles", async () => {
  const scene = realmScene();
  scene.update();
  await settle();
  let built = false;
  void scene.builds.whenBuilt().then(() => (built = true));
  scene.update();
  await settle();

  await scene.replyNext();
  expect(built).toBe(false);

  await scene.replyNext();
  expect(built).toBe(true);
  expect(scene.presented).toEqual([{ page: 2, cells: 2 }]);
});
