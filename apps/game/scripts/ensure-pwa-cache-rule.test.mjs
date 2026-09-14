// @vitest-environment node
import assert from "node:assert/strict";
const { test } = process.env.VITEST ? await import("vitest") : await import("node:test");
import { ensurePwaCacheRule } from "./ensure-pwa-cache-rule.mjs";

function fixture(initialRules = []) {
  let ruleset = initialRules === null ? null : { id: "ruleset", rules: structuredClone(initialRules) };
  const calls = [];
  const input = {
    origin: "https://play.realms.party",
    zoneName: "realms.party",
    token: "test-token",
    fetch: async (url, options) => {
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ url, method: options.method, body });
      if (url.includes("/zones?"))
        return Response.json({ success: true, result: [{ id: "a".repeat(32), name: "realms.party" }] });
      if (url.endsWith("/entrypoint"))
        return ruleset ? Response.json({ success: true, result: ruleset }) : new Response(null, { status: 404 });
      if (url.endsWith("/rulesets"))
        ruleset = { id: "ruleset", rules: body.rules.map((rule) => ({ ...rule, id: "managed" })) };
      else {
        const rule = { ...body, id: "managed" };
        delete rule.position;
        ruleset.rules = [...ruleset.rules.filter((rule) => rule.id !== "managed"), rule];
      }
      return Response.json({ success: true, result: ruleset });
    },
  };
  return { input, calls, rules: () => ruleset.rules };
}

test("creates only a scoped PWA rule, preserves existing rules, and is idempotent", async () => {
  const other = { id: "other", ref: "assets", action_parameters: { cache: true } };
  const f = fixture([other]);
  assert.equal((await ensurePwaCacheRule(f.input)).action, "created-rule");
  assert.deepEqual(f.rules()[0], other);
  const write = f.calls.find((call) => call.method === "POST");
  assert.equal(
    write.body.expression,
    '(http.host eq "play.realms.party" and http.request.uri.path in {"/sw.js" "/manifest.webmanifest" "/offline.html"})',
  );
  assert.equal(write.body.action_parameters.browser_ttl.mode, "respect_origin");
  assert.equal(write.body.action_parameters.edge_ttl.mode, "respect_origin");
  assert.deepEqual(write.body.position, { after: "other" });
  assert.equal((await ensurePwaCacheRule(f.input)).action, "unchanged");
  assert.equal(f.calls.filter((call) => call.method !== "GET").length, 1);
  assert.ok(f.calls.every((call) => call.method !== "PUT" && call.method !== "DELETE"));
});

test("repairs and reorders only its own rule after a later override", async () => {
  const other = { id: "other", ref: "assets", action_parameters: { cache: true } };
  const f = fixture([{ id: "managed", ref: "realms_pwa_revalidation", enabled: false }, other]);
  assert.equal((await ensurePwaCacheRule(f.input)).action, "updated-rule");
  assert.equal(f.calls.at(-1).method, "PATCH");
  assert.deepEqual(f.calls.at(-1).body.position, { after: "other" });
  assert.deepEqual(f.rules()[0], other);
});

test("creates an entrypoint only when missing and fails closed on permission errors", async () => {
  const f = fixture(null);
  assert.equal((await ensurePwaCacheRule(f.input)).action, "created-ruleset");
  assert.equal(f.calls.at(-1).body.phase, "http_request_cache_settings");
  await assert.rejects(
    ensurePwaCacheRule({ ...f.input, fetch: async () => new Response(null, { status: 403 }) }),
    /403/,
  );
  await assert.rejects(ensurePwaCacheRule({ ...f.input, origin: "https://other.example" }), /Invalid/);
  await assert.rejects(ensurePwaCacheRule({ ...f.input, token: "" }), /required/);
});
