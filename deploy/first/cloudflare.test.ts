import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ADMIN_ACCESS } from "./admin-access";
import { setUpDirectory } from "./cloudflare";
import { PublicError } from "./errors";
import { preparationSteps, type Deployment } from "./main";
import { Platform, workers } from "./platform";
import { PrivateStore } from "./private-store";
import { runSteps } from "./run";
import { environments, root, type Inputs } from "./settings";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const account = "private-account-id";
const privateMessage = "private response detail";
function platform(apply = false) {
  return new Platform(environments.dev, { cloudflareToken: "private-token" } as Inputs, {} as PrivateStore, apply);
}
function refused(status: number, code: number) {
  return Response.json(
    { success: false, errors: [{ code, message: privateMessage }, { code: "private-code" }] },
    { status },
  );
}
/** A request's URL without the page a list read asks for, so a fake can match the resource it names. */
function bare(url: unknown) {
  const parsed = new URL(String(url));
  for (const key of ["page", "per_page", "cursor"]) parsed.searchParams.delete(key);
  return parsed.toString();
}
/** What a fake Cloudflare answers a successful read of this path with: the one account, the zone, or an empty list. */
function listed(url: unknown) {
  const path = bare(url);
  if (path.endsWith("/accounts")) return [{ id: account }];
  if (path.includes("/zones?")) return [{ id: "test-zone" }];
  if (path.endsWith("/r2/buckets")) return { buckets: [] };
  return [];
}
function namedError(family: string, status: number, code?: number) {
  return `Cloudflare refused ${family}: ${status}${code === undefined ? "" : ` (${code})`}. Check that the token has this permission and that the product is enabled on the account.`;
}

test.each([
  ["/accounts", "accounts", 403, 10000],
  [`/accounts/${account}/workers/scripts/example`, "Workers scripts", 403, 10000],
  [`/accounts/${account}/d1/database`, "D1", 403, 10000],
  [`/accounts/${account}/r2/buckets`, "R2 buckets", 403, 10042],
  [`/accounts/${account}/pages/projects/missing/domains`, "Pages", 404, 8000007],
  ["/zones?name=private.example", "zone", 403, 10000],
  ["/zones/private-zone/dns_records?name=private.example", "DNS", 403, 10000],
  ["/zones/private-zone/rulesets", "Cache Rules", 403, 10000],
] as const)("refusal for %s exposes only family, status and numeric codes", async (path, family, status, code) => {
  globalThis.fetch = (async (_url, _init) => refused(status, code)) as typeof fetch;
  const failure = await platform()
    .cf(path)
    .catch((error) => error);
  expect(failure).toBeInstanceOf(PublicError);
  if (!(failure instanceof PublicError)) throw failure;
  expect(failure.message).toBe(namedError(family, status, code));
  expect(String(failure)).not.toContain(privateMessage);
  expect(String(failure)).not.toContain(account);
  expect(String(failure)).not.toContain("private-token");
  expect(String(failure)).not.toContain("private-code");
});

test("an unstructured refusal still names the family and status without exposing the body", async () => {
  globalThis.fetch = (async (_url, _init) => new Response(privateMessage, { status: 502 })) as typeof fetch;
  await expect(platform().cf(`/accounts/${account}/r2/buckets`)).rejects.toThrow(namedError("R2 buckets", 502));
});

test("a failed Cloudflare envelope at HTTP 200 is also a public refusal", async () => {
  globalThis.fetch = (async (_url, _init) => refused(200, 10000)) as typeof fetch;
  await expect(platform().cf("/accounts")).rejects.toThrow(namedError("accounts", 200, 10000));
});

test("bootstrap PUT shares the sanitized Workers refusal", async () => {
  const methods: string[] = [];
  globalThis.fetch = (async (url, init) => {
    methods.push(init?.method ?? "GET");
    if (init?.method === "PUT") return refused(403, 10000);
    return Response.json({ success: true, result: listed(url) });
  }) as typeof fetch;
  await expect(platform(true).bootstrapWorkers()).rejects.toThrow(namedError("Workers scripts", 403, 10000));
  expect(methods).toEqual(["GET", "GET", "PUT"]);
});

test("a Worker's serving version is its newest deployment, read across a deployment history of many pages", async () => {
  const guardian = workers.find((worker) => worker.id === "guardian")!;
  const script = guardian.name + environments.dev.workerSuffix;
  // Newest first, as Cloudflare lists them; 25 deployments, ten a page.
  const deployments = Array.from({ length: 25 }, (_, index) => ({
    versions: [{ version_id: `v${25 - index}`, percentage: 100 }],
  }));
  globalThis.fetch = (async (url) => {
    const parsed = new URL(String(url));
    const path = bare(url).split("/client/v4")[1]!;
    if (path === "/accounts") return Response.json({ success: true, result: [{ id: account }] });
    if (path === `/accounts/${account}/workers/scripts`)
      return Response.json({ success: true, result: [{ id: script }] });
    if (path === `/accounts/${account}/workers/scripts/${script}/versions/v25`)
      return Response.json({ success: true, result: { annotations: { "workers/tag": "a".repeat(40) } } });
    if (path !== `/accounts/${account}/workers/scripts/${script}/deployments`) return refused(404, 7003);
    const page = Number(parsed.searchParams.get("page") ?? 1);
    const perPage = Number(parsed.searchParams.get("per_page") ?? 10);
    if (perPage > 10) return refused(400, 8000024);
    return Response.json({
      success: true,
      result: { deployments: deployments.slice((page - 1) * perPage, page * perPage) },
      result_info: { page, per_page: perPage, total_count: 25, total_pages: Math.ceil(25 / perPage) },
    });
  }) as typeof fetch;
  await expect(platform().deployedVersion(guardian)).resolves.toEqual({ id: "v25", revision: "a".repeat(40) });
});

test("prerequisites read each required family once, using GET only", async () => {
  const paths: string[] = [];
  globalThis.fetch = (async (url, init) => {
    expect(init?.method).toBe("GET");
    const path = bare(url).split("/client/v4")[1]!;
    paths.push(path);
    return Response.json({ success: true, result: listed(url) });
  }) as typeof fetch;
  await platform().checkAccess();
  expect(paths.sort()).toEqual(
    [
      "/accounts",
      `/accounts/${account}/d1/database`,
      `/accounts/${account}/pages/projects`,
      `/accounts/${account}/r2/buckets`,
      `/accounts/${account}/workers/scripts`,
      `/zones?name=${environments.dev.zone}`,
      "/zones/test-zone/rulesets",
    ].sort(),
  );
});

test.each([
  ["/r2/buckets", "R2 buckets", 10042],
  ["/rulesets", "Cache Rules", 10000],
] as const)(
  "%s refusal stops Deployment prerequisites before any funded step or write",
  async (suffix, family, code) => {
    globalThis.fetch = (async (url, init) => {
      expect(init?.method).toBe("GET");
      if (bare(url).endsWith(suffix)) return refused(403, code);
      return Response.json({ success: true, result: listed(url) });
    }) as typeof fetch;
    const steps = preparationSteps({ target: environments.dev, platform: platform(true) } as Deployment);
    const index = steps.findIndex((step) => step.name === "Deployment prerequisites");
    expect(index).toBeLessThan(steps.findIndex((step) => step.name === "Fund and deploy accounts"));
    let laterReads = 0;
    let writes = 0;
    await expect(
      runSteps(
        [
          steps[index]!,
          {
            name: "Funded step",
            payer: "deployer",
            cost: "STRK",
            inspect: async () => {
              laterReads++;
              return { done: false, detail: "" };
            },
            apply: async () => {
              writes++;
            },
          },
        ],
        true,
        () => {},
      ),
    ).rejects.toThrow(namedError(family, 403, code));
    expect(laterReads).toBe(0);
    expect(writes).toBe(0);
  },
);

test("dry-run output keeps the sanitized refusal instead of hiding its cause", async () => {
  globalThis.fetch = (async (_url, _init) => refused(403, 10042)) as typeof fetch;
  const lines: string[] = [];
  await runSteps(
    [
      {
        name: "Cloudflare resources",
        payer: "none",
        cost: "0 STRK",
        inspect: async () => {
          await platform().cf(`/accounts/${account}/r2/buckets`);
          return { done: true, detail: "" };
        },
        apply: async () => {
          throw new Error("No writes expected");
        },
      },
    ],
    false,
    (line) => lines.push(line),
  );
  expect(lines[1]).toContain(namedError("R2 buckets", 403, 10042));
  expect(lines.join("\n")).not.toContain(privateMessage);
});

test("a zone not visible to the token refuses the cache rules probe", async () => {
  const paths: string[] = [];
  globalThis.fetch = (async (url, _init) => {
    paths.push(bare(url));
    return Response.json({ success: true, result: bare(url).includes("/zones?") ? [] : listed(url) });
  }) as typeof fetch;
  await expect(platform().checkAccess()).rejects.toThrow("Cloudflare zone unavailable; check Zone read permission");
  expect(paths.some((path) => path.endsWith("/rulesets"))).toBe(false);
});

/**
 * A Cloudflare account whose every list is long: each answers at most 5 per page, by page number, or by cursor for R2,
 * with the deploy's own resources last. Records every request.
 */
function crowdedAccount() {
  const requests: string[] = [];
  const others = (prefix: string) =>
    Array.from({ length: 12 }, (_, i) => ({ id: `${prefix}-${i}`, name: `${prefix}-${i}` }));
  const target = environments.dev;
  const lists: Record<string, unknown[]> = {
    "/accounts": [{ id: account }],
    [`/accounts/${account}/d1/database`]: [
      ...others("db"),
      ...["realms-identity", "realms-launch", "realms-admin"].map((name) => ({ name: `${name}-${target.worker}` })),
    ],
    [`/accounts/${account}/pages/projects`]: [...others("project"), { name: target.pages }],
    [`/accounts/${account}/pages/projects/${target.pages}/domains`]: [
      ...others("domain"),
      { name: new URL(target.origin).hostname },
    ],
    [`/zones?name=${target.zone}`]: [{ id: "test-zone" }],
    [`/zones/test-zone/dns_records?name=${new URL(target.origin).hostname}`]: [
      { type: "CNAME", content: `${target.pages}.pages.dev` },
    ],
    [`/accounts/${account}/workers/scripts`]: [],
  };
  const buckets = [...others("bucket"), { name: target.statusBucket }];
  globalThis.fetch = (async (url, init) => {
    const method = init?.method ?? "GET";
    const parsed = new URL(String(url));
    requests.push(`${method} ${bare(url).split("/client/v4")[1]}`);
    if (method !== "GET") return Response.json({ success: true, result: {} });
    const path = bare(url).split("/client/v4")[1]!;
    const asked = Number(parsed.searchParams.get("per_page") ?? 5);
    // As Cloudflare's Pages lists do: a page size over 10 is refused, not shortened.
    if (asked > 10) return refused(400, 8000024);
    const perPage = Math.min(asked, 5);
    if (path === `/accounts/${account}/r2/buckets`) {
      const start = Number(parsed.searchParams.get("cursor") ?? 0);
      const end = start + perPage;
      return Response.json({
        success: true,
        result: { buckets: buckets.slice(start, end) },
        result_info: { per_page: perPage, ...(end < buckets.length ? { cursor: String(end) } : {}) },
      });
    }
    const items = lists[path];
    if (!items) return refused(404, 7003);
    const page = Number(parsed.searchParams.get("page") ?? 1);
    const result = items.slice((page - 1) * perPage, page * perPage);
    return Response.json({
      success: true,
      result,
      result_info: {
        page,
        per_page: perPage,
        count: result.length,
        total_count: items.length,
        total_pages: Math.ceil(items.length / perPage) || 1,
      },
    });
  }) as typeof fetch;
  return requests;
}

test("a list Cloudflare answers in part is refused as a single read, and read whole as a list", async () => {
  crowdedAccount();
  const value = platform();
  await expect(value.cf(`/accounts/${account}/d1/database`)).rejects.toThrow("Cloudflare listed only part of D1");
  expect((await value.cfList<{ name: string }>(`/accounts/${account}/d1/database`)).map(({ name }) => name)).toEqual([
    ...Array.from({ length: 12 }, (_, i) => `db-${i}`),
    "realms-identity-staging",
    "realms-launch-staging",
    "realms-admin-staging",
  ]);
});

test("setup finds its databases, project, bucket, domain and DNS on later pages, and creates nothing", async () => {
  const requests = crowdedAccount();
  const value = platform(true);
  expect(await value.resourcesPresent()).toBe(true);
  await value.prepareResources();
  expect(requests.filter((request) => !request.startsWith("GET"))).toEqual([]);
  expect(requests.filter((request) => request.endsWith("/r2/buckets")).length).toBeGreaterThan(2);
});

const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const privateDirectory = () => {
  const directory = join(mkdtempSync(join(tmpdir(), "cloudflare-test-")), "private");
  temporary.push(directory);
  return { directory, store: new PrivateStore(directory, root, true) };
};
const inputs: Inputs = {
  cloudflareToken: "fake-cloudflare",
  rpc: "https://starknet-mainnet.g.alchemy.com/v2/throwaway",
  resend: "fake-resend",
  discordClientId: "fake-discord-id",
  discordClientSecret: "fake-discord-secret",
  amount: "1000000",
  frontierStart: "2027-01-01T00:00:00Z",
  frontierEnd: "2027-01-21T00:00:00Z",
  blitzStart: "2027-01-01T00:00:00Z",
  blitzEnd: "2027-02-01T00:00:00Z",
};

test("publishing refuses a directory set up before the admin had Access, before anything deploys", () => {
  const { directory, store } = privateDirectory();
  expect(() => setUpDirectory(directory)).toThrow("Run setup before publishing Cloudflare");
  store.write("inputs.json", inputs);
  expect(() => setUpDirectory(directory)).toThrow("Admin access is not set up yet");
  store.write(ADMIN_ACCESS, { teamDomain: "realms.cloudflareaccess.com", audience: "aud", operators: [], writers: [] });
  expect(setUpDirectory(directory).inputs).toEqual(inputs);
});
