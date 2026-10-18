import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ADMIN_ACCESS, readAdminAccessList, syncAdminAccess, type AdminAccess } from "./admin-access";
import { Platform } from "./platform";
import { PrivateStore } from "./private-store";
import { environments, type Environment, type Inputs } from "./settings";

const originalFetch = globalThis.fetch;
const temporary: string[] = [];
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

const ACCOUNT = "account-1";
const ACCESS = `/accounts/${ACCOUNT}/access`;

/** The most a fake list page holds, whatever the reader asks for: small, so real inventories span several pages. */
const PAGE_SIZE = 5;

/**
 * Cloudflare's Access API for one account, in memory: what the deploy reads and writes, and every write it made. Its
 * lists answer one page at a time with `result_info`, as Cloudflare's do.
 */
function cloudflare({ organization = true } = {}) {
  const state = {
    providers: [] as { id: string; type: string }[],
    policies: [] as { id: string; name: string; decision: string; include: { email: { email: string } }[] }[],
    apps: [] as {
      id: string;
      name: string;
      domain: string;
      aud: string;
      same_site_cookie_attribute?: string;
      policies: { id: string }[];
    }[],
    revoked: [] as string[],
    writes: [] as string[],
  };
  let next = 0;
  const ok = (result: unknown) => Response.json({ success: true, result });
  let query = new URLSearchParams();
  const listed = (items: unknown[]) => {
    const page = Number(query.get("page") ?? 1);
    const asked = Number(query.get("per_page") ?? PAGE_SIZE);
    // As Cloudflare's Pages lists do: a page size over 10 is refused, not shortened.
    if (asked > 10)
      return Response.json(
        { success: false, errors: [{ code: 8000024, message: "Invalid list options" }] },
        { status: 400 },
      );
    const perPage = Math.min(asked, PAGE_SIZE);
    const result = items.slice((page - 1) * perPage, page * perPage);
    const total_pages = Math.max(1, Math.ceil(items.length / perPage));
    return Response.json({
      success: true,
      result,
      result_info: { page, per_page: perPage, count: result.length, total_count: items.length, total_pages },
    });
  };
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const parsed = new URL(String(url));
    query = parsed.searchParams;
    const path = parsed.pathname.replace("/client/v4", "");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (method !== "GET") state.writes.push(`${method} ${path.replace(ACCESS, "")}`);
    if (path === "/accounts") return listed([{ id: ACCOUNT }]);
    if (path === `${ACCESS}/organizations`)
      return organization ? ok({ auth_domain: "realms.cloudflareaccess.com" }) : ok({});
    if (path === `${ACCESS}/identity_providers`) {
      if (method === "POST") state.providers.push({ id: `idp-${++next}`, type: body.type });
      return method === "POST" ? ok(state.providers.at(-1)) : listed(state.providers);
    }
    if (path === `${ACCESS}/policies` && method === "GET") return listed(state.policies);
    if (path.startsWith(`${ACCESS}/policies`)) {
      const id = path.split("/").at(-1) === "policies" ? `policy-${++next}` : path.split("/").at(-1)!;
      state.policies = [...state.policies.filter((policy) => policy.id !== id), { id, ...body }];
      return ok({ id, ...body });
    }
    if (path === `${ACCESS}/apps` && method === "GET") return listed(state.apps);
    if (path.startsWith(`${ACCESS}/apps`)) {
      const id = path.split("/").at(-1) === "apps" ? `app-${++next}` : path.split("/").at(-1)!;
      const aud = state.apps.find((app) => app.id === id)?.aud ?? `aud-${id}`;
      const app = {
        id,
        aud,
        name: body.name,
        domain: body.domain,
        same_site_cookie_attribute: body.same_site_cookie_attribute,
        policies: body.policies.map(({ id }: { id: string }) => ({ id })),
      };
      state.apps = [...state.apps.filter((entry) => entry.id !== id), app];
      return ok(app);
    }
    if (path === `${ACCESS}/organizations/revoke_user`) {
      state.revoked.push(body.email);
      return ok(true);
    }
    return Response.json({ success: false, errors: [{ code: 7003 }] }, { status: 404 });
  }) as typeof fetch;
  return state;
}

function setup(environment: Environment, list: unknown) {
  const base = mkdtempSync(join(tmpdir(), "admin-access-test-"));
  temporary.push(base);
  mkdirSync(join(base, "repo"));
  const store = new PrivateStore(join(base, "private"), join(base, "repo"), true);
  store.write("admin-access.json", list);
  const platform = new Platform(environments[environment], { cloudflareToken: "token" } as Inputs, store, true);
  return { store, platform, read: () => readAdminAccessList(store, environment)! };
}

test("dev gets one-time PIN, one policy and one application for the page, and a second run writes nothing", async () => {
  const api = cloudflare();
  const { store, platform, read } = setup("dev", { operators: ["Owner@Realms.World"] });
  expect(await syncAdminAccess(platform, store, "dev", read(), true)).toEqual({ changed: true });
  expect(api.writes).toEqual(["POST /identity_providers", "POST /policies", "POST /apps"]);
  expect(api.policies).toMatchObject([
    { name: "Realms admin operators (dev)", decision: "allow", include: [{ email: { email: "owner@realms.world" } }] },
  ]);
  expect(api.apps).toMatchObject([
    { name: "Realms admin (dev)", domain: "admin.dev-realms.party", same_site_cookie_attribute: "lax" },
  ]);
  expect(store.read<AdminAccess>(ADMIN_ACCESS)).toEqual({
    teamDomain: "realms.cloudflareaccess.com",
    audience: api.apps[0]!.aud,
    operators: ["owner@realms.world"],
    writers: [],
  });
  api.writes.length = 0;
  expect(await syncAdminAccess(platform, store, "dev", read(), true)).toEqual({ changed: false });
  expect(api.writes).toEqual([]);
});

test("production keeps one application for its operators and records its writers for the admin Worker", async () => {
  const api = cloudflare();
  const { store, platform, read } = setup("production", {
    operators: ["ops@realms.world", "owner@realms.world"],
    writers: ["owner@realms.world"],
  });
  await syncAdminAccess(platform, store, "production", read(), true);
  expect(api.apps.map(({ name, domain }) => [name, domain])).toEqual([
    ["Realms admin (production)", "admin.realms.party"],
  ]);
  expect(api.policies.map((policy) => policy.include)).toEqual([
    [{ email: { email: "ops@realms.world" } }, { email: { email: "owner@realms.world" } }],
  ]);
  expect(store.read<AdminAccess>(ADMIN_ACCESS)).toEqual({
    teamDomain: "realms.cloudflareaccess.com",
    audience: api.apps[0]!.aud,
    operators: ["ops@realms.world", "owner@realms.world"],
    writers: ["owner@realms.world"],
  });
});

/** Twenty other teams' policies and applications, ahead of the admin's in every list. */
function crowd(api: ReturnType<typeof cloudflare>) {
  const others = Array.from({ length: 20 }, (_, i) => i);
  api.policies.unshift(
    ...others.map((i) => ({ id: `other-policy-${i}`, name: `Other ${i}`, decision: "allow", include: [] })),
  );
  api.apps.unshift(
    ...others.map((i) => ({
      id: `other-app-${i}`,
      name: `Other ${i}`,
      domain: `o${i}.example`,
      aud: `o${i}`,
      policies: [],
    })),
  );
  api.providers.unshift(...others.map((i) => ({ id: `other-idp-${i}`, type: "github" })));
}

test("a repeated setup finds the admin's login, policy and application on any page, and writes nothing", async () => {
  const api = cloudflare();
  const { store, platform, read } = setup("dev", { operators: ["owner@realms.world"] });
  await syncAdminAccess(platform, store, "dev", read(), true);
  crowd(api);
  api.writes.length = 0;
  expect(await syncAdminAccess(platform, store, "dev", read(), true)).toEqual({ changed: false });
  expect(api.writes).toEqual([]);
});

test("a first setup interrupted after Cloudflare created the admin's entries reuses them instead of making twins", async () => {
  const api = cloudflare();
  crowd(api);
  const { store, platform, read } = setup("dev", { operators: ["owner@realms.world"] });
  // The interrupted run: Cloudflare holds the login, policy and application, the private directory no record.
  api.providers.push({ id: "idp-otp", type: "onetimepin" });
  api.policies.push({
    id: "policy-admin",
    name: "Realms admin operators (dev)",
    decision: "allow",
    include: [{ email: { email: "owner@realms.world" } }],
  });
  api.apps.push({
    id: "app-admin",
    name: "Realms admin (dev)",
    domain: "admin.dev-realms.party",
    aud: "aud-admin",
    same_site_cookie_attribute: "lax",
    policies: [{ id: "policy-admin" }],
  });
  expect(await syncAdminAccess(platform, store, "dev", read(), true)).toEqual({ changed: true });
  expect(api.writes).toEqual([]);
  expect(store.read<AdminAccess>(ADMIN_ACCESS)).toMatchObject({ audience: "aud-admin" });
});

test("an application set up before its cookie was same-site is updated in place to lax", async () => {
  const api = cloudflare();
  const { store, platform, read } = setup("dev", { operators: ["owner@realms.world"] });
  await syncAdminAccess(platform, store, "dev", read(), true);
  const app = api.apps[0]!;
  delete app.same_site_cookie_attribute;
  api.writes.length = 0;
  expect(await syncAdminAccess(platform, store, "dev", read(), true)).toEqual({ changed: true });
  expect(api.writes).toEqual([`PUT /apps/${app.id}`]);
  expect(api.apps).toMatchObject([{ id: app.id, aud: app.aud, same_site_cookie_attribute: "lax" }]);
});

test("inspecting reads only and reports the difference", async () => {
  const api = cloudflare();
  const { store, platform, read } = setup("dev", { operators: ["owner@realms.world"] });
  expect(await syncAdminAccess(platform, store, "dev", read(), false)).toEqual({ changed: true });
  expect(api.writes).toEqual([]);
  expect(store.read(ADMIN_ACCESS)).toBeUndefined();
});

test("removing an email updates the list in place and ends that person's sessions", async () => {
  const api = cloudflare();
  const { store, platform, read } = setup("dev", { operators: ["owner@realms.world", "ops@realms.world"] });
  await syncAdminAccess(platform, store, "dev", read(), true);
  const audience = api.apps[0]!.aud;
  store.write("admin-access.json", { operators: ["owner@realms.world"] });
  api.writes.length = 0;
  await syncAdminAccess(platform, store, "dev", read(), true);
  expect(api.writes).toEqual([`PUT /policies/${api.policies[0]!.id}`, "POST /organizations/revoke_user"]);
  expect(api.revoked).toEqual(["ops@realms.world"]);
  expect(store.read<AdminAccess>(ADMIN_ACCESS)).toMatchObject({ audience, operators: ["owner@realms.world"] });
});

test("an account without Zero Trust stops with what to turn on, before writing", async () => {
  const api = cloudflare({ organization: false });
  const { store, platform, read } = setup("dev", { operators: ["owner@realms.world"] });
  await expect(syncAdminAccess(platform, store, "dev", read(), true)).rejects.toThrow("Turn on Cloudflare Zero Trust");
  expect(api.writes).toEqual([]);
});

test("the owner's lists are checked before anything is sent", () => {
  expect(setup("dev", { operators: ["owner@realms.world"] }).read()).toEqual({ operators: ["owner@realms.world"] });
  expect(() => setup("dev", { operators: [] }).read()).toThrow("needs operators");
  expect(() => setup("dev", { operators: ["not an email"] }).read()).toThrow("needs operators");
  expect(() => setup("dev", { operators: ["a@b.io"], writers: ["a@b.io"] }).read()).toThrow("takes no writers");
  expect(() => setup("production", { operators: ["a@b.io"] }).read()).toThrow("needs writers");
  expect(() => setup("production", { operators: ["a@b.io"], writers: ["c@d.io"] }).read()).toThrow(
    "must also be an operator",
  );
});
