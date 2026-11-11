import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";

import { answerPaused } from "./client-at-origin.mjs";

const made = [];
afterEach(() => made.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

it("answers a deployed origin from the candidate build, and leaves its API, other origins and unknown files to the network", async () => {
  const distDir = mkdtempSync(join(tmpdir(), "candidate-client-"));
  made.push(distDir);
  mkdirSync(join(distDir, "assets"));
  writeFileSync(join(distDir, "index.html"), "<!doctype html>candidate");
  writeFileSync(join(distDir, "assets/main-abc.js"), "candidate main");
  const sent = [];
  const served = [];
  const answer = (requestId, url, resourceType) =>
    answerPaused(
      {
        send: async (method, params) => sent.push({ method, params }),
        distDir,
        origin: "https://play.dev-realms.party",
        served,
      },
      { requestId, request: { url }, resourceType },
    );

  await answer("asset", "https://play.dev-realms.party/assets/main-abc.js", "Script");
  await answer("route", "https://play.dev-realms.party/g/0x53/7?spectate=true", "Document");
  await answer("api", "https://play.dev-realms.party/api/auth/wallet/default/build", "Fetch");
  await answer("api-page", "https://play.dev-realms.party/api/identity/callback", "Document");
  await answer("missing", "https://play.dev-realms.party/assets/old-main.js", "Script");
  await answer("other", "https://herald-s1.dev-realms.party/manifest", "Fetch");

  const body = (answered) => Buffer.from(answered.params.body, "base64").toString();
  expect(sent[0].params.requestId).toBe("asset");
  expect(body(sent[0])).toBe("candidate main");
  expect(sent[0].params.responseHeaders).toContainEqual({
    name: "content-type",
    value: "text/javascript; charset=utf-8",
  });
  expect(sent[1].params.requestId).toBe("route");
  expect(body(sent[1])).toBe("<!doctype html>candidate");
  expect(sent.slice(2)).toEqual(
    ["api", "api-page", "missing", "other"].map((requestId) => ({
      method: "Fetch.continueRequest",
      params: { requestId },
    })),
  );
  expect(served).toEqual(["assets/main-abc.js", "index.html"]);
});
