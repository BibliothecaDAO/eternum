// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import { modelPathOf, serveModelOverrides } from "./browser-session.mjs";

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
