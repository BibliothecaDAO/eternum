// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";

import { afterEach, expect, it, vi } from "vitest";

import {
  createBrowserSession,
  modelPathOf,
  screenPoint,
  serveModelOverrides,
  setViewport,
} from "./browser-session.mjs";

const { spawnSync } = vi.hoisted(() => ({ spawnSync: vi.fn(() => ({ status: 0, stdout: "", stderr: "" })) }));
vi.mock("node:child_process", async (original) => ({ ...(await original()), spawnSync }));

it("rounds fractional offsets once for tap, hover, right-click and both double-click paths", () => {
  spawnSync.mockClear();
  const browser = createBrowserSession("pointer-proof", { profile: "/tmp/pointer-proof" });
  const offset = [10.6, -20.4];
  browser.tap(offset);
  browser.hover(offset);
  browser.rightClick(offset);
  browser.doubleClick(offset);
  // Each command follows the session's launch settings, which end with the browser's flags.
  const commands = spawnSync.mock.calls.map(([, args]) => args.slice(args.indexOf("--args") + 2));
  expect(commands).toEqual([
    ["batch", "mouse move 971 520", "mouse down", "mouse up"],
    ["mouse", "move", "971", "520"],
    ["batch", "mouse move 971 520", "mouse down right", "mouse up right"],
    ["batch", "mouse move 971 520", "mouse down", "mouse up", "mouse move 971 520", "mouse down", "mouse up"],
    [
      "eval",
      'document.elementFromPoint(971, 520)?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window, detail: 2, clientX: 971, clientY: 520 })) ?? false',
    ],
  ]);
});

const made = [];
afterEach(() => made.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** A DevTools connection that records what the page was answered and lets a test pause a request. */
function fakeDevTools() {
  const sent = [];
  let listener = () => {};
  return {
    sent,
    onEvent: (callback) => (listener = callback),
    send: async (method, params) => sent.push({ method, params }),
    pause: (requestId, url) => listener({ method: "Fetch.requestPaused", params: { requestId, request: { url } } }),
  };
}

it("names a deployed model by its path below models, without its content hash", () => {
  expect(modelPathOf("https://play.realms.party/models/frontier/painted/hearth.cf0fab2c01b9.glb")).toBe(
    "frontier/painted/hearth.glb",
  );
  expect(modelPathOf("https://127.0.0.1:4174/models/realms/city.glb")).toBe("realms/city.glb");
});

it("answers a model found in the override directory with its bytes, and lets every other request through", async () => {
  const directory = mkdtempSync(join(tmpdir(), "model-overrides-"));
  made.push(directory);
  mkdirSync(join(directory, "realms"));
  writeFileSync(join(directory, "realms/city.glb"), "heavier city");
  const devTools = fakeDevTools();

  const served = await serveModelOverrides(devTools, directory);
  devTools.pause("a", "https://play.realms.party/models/realms/city.0123456789ab.glb");
  devTools.pause("b", "https://play.realms.party/models/frontier/painted/city.0123456789ab.glb");

  expect(devTools.sent[0]).toEqual({
    method: "Fetch.enable",
    params: { patterns: [{ urlPattern: "*.glb*", requestStage: "Request" }] },
  });
  const [fulfilled, passed] = devTools.sent.slice(1);
  expect(fulfilled.method).toBe("Fetch.fulfillRequest");
  expect(fulfilled.params.requestId).toBe("a");
  expect(Buffer.from(fulfilled.params.body, "base64").toString()).toBe("heavier city");
  expect(passed).toEqual({ method: "Fetch.continueRequest", params: { requestId: "b" } });
  expect(served()).toEqual(["realms/city.glb"]);
});

it("aims a press in whole pixels on a page of odd size, as agent-browser's mouse takes no fraction", () => {
  setViewport({ width: 412, height: 915 });
  expect(screenPoint([0, 0])).toEqual([206, 458]);
  expect(screenPoint([-10, 3])).toEqual([196, 461]);
  setViewport({ width: 1920, height: 1080 });
});

it("refuses a launch option on one command, which would relaunch the browser without the page's settings", () => {
  const browser = createBrowserSession("launch-option", { profile: join(tmpdir(), "never-launched") });

  for (const option of ["--ignore-https-errors", "--args", "--headed", "--init-script"]) {
    expect(() => browser.run(["open", "https://127.0.0.1:4173/", option])).toThrow(
      `${option} launches the browser: give it to createBrowserSession, not one command`,
    );
  }
});


it.each(["Deep", "Ethereal II"])("observes the phone's visible %s layer rather than inferring Map from its switch", (layer) => {
  const dom = new JSDOM(`<nav aria-label="Places"><button data-switch="realm" aria-haspopup="listbox"><span>0</span><span>${layer}</span><div>3 chests</div></button></nav>`, {
    url: "https://play.test/game/map", runScripts: "outside-only",
  });
  dom.window.__rendererDiagnostics = { sceneName: "map" };
  spawnSync.mockImplementationOnce((_command, args) => {
    const expression = args[args.indexOf("eval") + 1];
    return { status: 0, stdout: JSON.stringify(dom.window.eval(expression)), stderr: "" };
  });
  try {
    expect(createBrowserSession("layer-proof", { profile: "/tmp/layer-proof" }).observe()).toMatchObject({
      scene: "map", rendered: "map", place: layer,
    });
  } finally { dom.window.close(); }
});
