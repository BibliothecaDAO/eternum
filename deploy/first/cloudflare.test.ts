import { afterEach, expect, test } from "bun:test";
import { PublicError } from "./dates";
import { preparationSteps, type Deployment } from "./main";
import { Platform } from "./platform";
import type { PrivateStore } from "./private-store";
import { runSteps } from "./run";
import { environments, type Inputs } from "./settings";

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
    return Response.json({ success: true, result: String(url).endsWith("/accounts") ? [{ id: account }] : [] });
  }) as typeof fetch;
  await expect(platform(true).bootstrapWorkers()).rejects.toThrow(namedError("Workers scripts", 403, 10000));
  expect(methods).toEqual(["GET", "GET", "PUT"]);
});

test("prerequisites read each required family once, using GET only", async () => {
  const paths: string[] = [];
  globalThis.fetch = (async (url, init) => {
    expect(init?.method).toBe("GET");
    const path = String(url).split("/client/v4")[1]!;
    paths.push(path);
    return Response.json({ success: true, result: path === "/accounts" ? [{ id: account }] : [] });
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
    ].sort(),
  );
});

test("R2 refusal stops Deployment prerequisites before any funded step or write", async () => {
  globalThis.fetch = (async (url, init) => {
    expect(init?.method).toBe("GET");
    if (String(url).endsWith("/r2/buckets")) return refused(403, 10042);
    return Response.json({ success: true, result: String(url).endsWith("/accounts") ? [{ id: account }] : [] });
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
  ).rejects.toThrow(namedError("R2 buckets", 403, 10042));
  expect(laterReads).toBe(0);
  expect(writes).toBe(0);
});

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
