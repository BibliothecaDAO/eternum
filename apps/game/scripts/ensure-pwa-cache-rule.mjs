import { isDeepStrictEqual } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const phase = "http_request_cache_settings";
const ruleRef = "realms_pwa_revalidation";

/** Owns one rule; never replaces a zone's ruleset or changes another application's caching. */
export async function ensurePwaCacheRule({ origin, zoneName, token, fetch: request = globalThis.fetch }) {
  const hostname = validatePwaOrigin(origin, zoneName);
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required with Zone Read and Cache Rules Edit permissions");
  const api = cloudflareApi(token, request);
  const zone = await resolveZonePath(api, zoneName);
  const ruleset = await api(`${zone}/rulesets/phases/${phase}/entrypoint`, { allowMissing: true });
  const desired = buildPwaCacheRule(hostname);
  if (!ruleset) {
    await api(`${zone}/rulesets`, {
      method: "POST",
      body: { name: "Game PWA caching", kind: "zone", phase, rules: [desired] },
    });
    return { origin, action: "created-ruleset" };
  }
  const matches = ruleset.rules.filter((rule) => rule.ref === ruleRef);
  if (matches.length > 1) throw new Error("Duplicate managed PWA cache rules");
  const current = matches[0];
  const last = ruleset.rules.at(-1);
  if (current && last.id === current.id && matchesDesiredRule(current, desired)) return { origin, action: "unchanged" };
  const path = `${zone}/rulesets/${ruleset.id}/rules${current ? `/${current.id}` : ""}`;
  const position = last && (!current || last.id !== current.id) ? { position: { after: last.id } } : {};
  await api(path, { method: current ? "PATCH" : "POST", body: { ...desired, ...position } });
  return { origin, action: current ? "updated-rule" : "created-rule" };
}

function validatePwaOrigin(origin, zoneName) {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.origin !== origin ||
    !/^[a-z0-9.-]+$/.test(zoneName) ||
    !(url.hostname === zoneName || url.hostname.endsWith(`.${zoneName}`))
  )
    throw new Error("Invalid PWA origin or zone");
  return url.hostname;
}

async function resolveZonePath(api, zoneName) {
  const zones = await api(`/zones?name=${encodeURIComponent(zoneName)}`);
  if (zones.length !== 1 || zones[0].name !== zoneName || !/^[a-f0-9]{32}$/.test(zones[0].id))
    throw new Error("Expected exactly one matching Cloudflare zone");
  return `/zones/${zones[0].id}`;
}

function buildPwaCacheRule(hostname) {
  return {
    ref: ruleRef,
    description: "Respect origin freshness for game install resources",
    enabled: true,
    expression: `(http.host eq "${hostname}" and http.request.uri.path in {"/sw.js" "/manifest.webmanifest" "/offline.html"})`,
    action: "set_cache_settings",
    action_parameters: { cache: true, edge_ttl: { mode: "respect_origin" }, browser_ttl: { mode: "respect_origin" } },
  };
}

function matchesDesiredRule(current, desired) {
  return Object.entries(desired).every(([key, value]) => isDeepStrictEqual(current[key], value));
}

function cloudflareApi(token, request) {
  return async (path, { method = "GET", body, allowMissing = false } = {}) => {
    const response = await request(`https://api.cloudflare.com/client/v4${path}`, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok)
      throw new Error(`Cloudflare ${method} ${path} failed (${response.status}); check zone/token permissions`);
    const payload = await response.json();
    if (!payload.success) throw new Error(`Cloudflare ${method} ${path} was not successful`);
    return payload.result;
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [origin, zoneName] = process.argv.slice(2);
  console.log(JSON.stringify(await ensurePwaCacheRule({ origin, zoneName, token: process.env.CLOUDFLARE_API_TOKEN })));
}
