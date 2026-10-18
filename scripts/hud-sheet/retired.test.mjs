import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { CLEAN, importsOf, readModules, retiredReach, rootsOf } from "./retired.mjs";

const modules = (graph) => new Map(Object.entries(graph));
const BUTTON = "ui/design-system/atoms/button";

test("reads static, side-effect, re-exported and dynamic imports", () => {
  assert.deepEqual(
    importsOf(
      `import A from "@/a";\nimport { b } from './b';\nimport "./e.css";\nexport * from "../c";\nconst d = import("@/d");`,
    ),
    ["@/a", "./b", "./e.css", "../c", "@/d"],
  );
});

test("finds a finished area importing a retired control", () => {
  const found = retiredReach({
    roots: ["ui/features/military/x"],
    modules: modules({ "ui/features/military/x": [BUTTON] }),
  });
  assert.deepEqual(found, [{ root: "ui/features/military/x", path: [BUTTON] }]);
});

test("finds it behind a shared wrapper, and names the way", () => {
  const share = "ui/design-system/molecules/twitter-share-button";
  const found = retiredReach({
    roots: ["ui/features/military/x"],
    modules: modules({ "ui/features/military/x": [share], [share]: [BUTTON] }),
  });
  assert.deepEqual(found, [{ root: "ui/features/military/x", path: [share, BUTTON] }]);
});

test("passes a named exception, the kit, and another area's features without walking into them", () => {
  const found = retiredReach({
    roots: ["ui/features/military/x"],
    modules: modules({
      "ui/features/military/x": [
        "ui/design-system/molecules/popover",
        "ui/design-system/kit/hud-elements",
        "ui/features/economy/y",
      ],
      "ui/design-system/molecules/popover": [BUTTON],
      "ui/design-system/kit/hud-elements": [BUTTON],
      "ui/features/economy/y": [BUTTON],
    }),
  });
  assert.deepEqual(found, []);
});

test("the finished areas reach no retired control in the app", () => {
  const modulesInApp = readModules(fileURLToPath(new URL("../../apps/game/src", import.meta.url)));
  for (const [area, paths] of Object.entries(CLEAN)) {
    const roots = rootsOf(modulesInApp, paths);
    assert.ok(roots.length > 0, `${area} has files`);
    const found = retiredReach({ roots, modules: modulesInApp });
    assert.deepEqual(
      found.map(({ root, path }) => `${root} -> ${path.join(" -> ")}`),
      [],
      `${area} reaches a retired control`,
    );
  }
});
