import { resolve } from "node:path";
import { randomBytes, createECDH, createHash } from "node:crypto";
import { accountIdentity, newKey, type Keys } from "./chain";
import { root, type Inputs, type Target } from "./settings";
import type { PrivateStore } from "./private-store";
import { command } from "./process";
import { PublicError } from "./errors";
import type { AdminAccess } from "./admin-access";

export const workers = [
  { id: "guardian", directory: "apps/guardian", config: "wrangler.jsonc", name: "realms-guardian" },
  { id: "identity", directory: "apps/realms", config: "wrangler.jsonc", name: "realms-identity" },
  { id: "relay", directory: "apps/value-relay", config: "wrangler.jsonc", name: "realms-value-relay" },
  { id: "monitor", directory: "apps/value-relay", config: "monitor.wrangler.jsonc", name: "realms-value-monitor" },
  { id: "launch", directory: "apps/launch-service", config: "wrangler.jsonc", name: "realms-launch" },
  { id: "status", directory: "apps/status-monitor", config: "wrangler.jsonc", name: "realms-status-monitor" },
  { id: "admin", directory: "apps/admin", config: "wrangler.jsonc", name: "realms-admin" },
] as const;
/** The Workers whose D1 database the deploy creates and migrates, each bound as `DB`. */
export const databaseWorkers = ["identity", "launch", "admin"] as const;
const databaseName = (worker: (typeof databaseWorkers)[number], target: Target) =>
  `${workers.find((entry) => entry.id === worker)!.name}-${target.worker}`;
export type Worker = (typeof workers)[number];
export interface Secrets {
  operator: string;
  auth: string;
  vapidPublic: string;
  vapidPrivate: string;
  guardian?: string;
}
export function generateSecrets(guardianExists: boolean): Secrets {
  const vapid = createECDH("prime256v1");
  vapid.generateKeys();
  return {
    operator: randomBytes(32).toString("hex"),
    auth: randomBytes(32).toString("hex"),
    vapidPublic: vapid.getPublicKey().toString("base64url"),
    vapidPrivate: vapid.getPrivateKey().toString("base64url"),
    ...(guardianExists ? {} : { guardian: newKey() }),
  };
}
/** The admin page's settings from Access, as its Worker reads them; refused until setup has made Access. */
function adminSecrets(secrets: Secrets, access: AdminAccess | undefined): Record<string, string> {
  if (!access?.audience) throw new PublicError("Admin access is not set up yet; run setup with --apply");
  return {
    OPERATOR_TOKEN: secrets.operator,
    ACCESS_TEAM_DOMAIN: access.teamDomain,
    ACCESS_AUD: access.audience,
    ...(access.writers.length ? { ADMIN_WRITERS: access.writers.join(",") } : {}),
  };
}
export function workerSecrets(
  worker: Worker,
  inputs: Inputs,
  secrets: Secrets,
  keys: Keys,
  access: AdminAccess | undefined,
): Record<string, string> {
  switch (worker.id) {
    case "guardian":
      return secrets.guardian ? { GUARDIAN_PRIVATE_KEY: secrets.guardian } : {};
    case "identity":
      return {
        L2_RPC_URL: inputs.rpc,
        RESEND_API_KEY: inputs.resend,
        BETTER_AUTH_SECRET: secrets.auth,
        OPERATOR_TOKEN: secrets.operator,
        WEB_PUSH_VAPID_PUBLIC_KEY: secrets.vapidPublic,
        WEB_PUSH_VAPID_PRIVATE_KEY: secrets.vapidPrivate,
        DISCORD_CLIENT_ID: inputs.discordClientId,
        DISCORD_CLIENT_SECRET: inputs.discordClientSecret,
      };
    case "launch":
      return { LAUNCH_DEPLOYER_PRIVATE_KEY: keys.launcher, OPERATOR_TOKEN: secrets.operator };
    case "relay":
      return {
        L2_RPC_URL: inputs.rpc,
        OPERATOR_TOKEN: secrets.operator,
        SHARD_LEDGER_OPERATOR_PRIVATE_KEY: keys.shardRelay,
        LEDGER_OPERATOR_PRIVATE_KEY: keys.relay,
        LEDGER_OPERATOR_ADDRESS: accountIdentity(keys.relay).address,
      };
    case "monitor":
      return {
        L2_RPC_URL: inputs.rpc,
        OPERATOR_TOKEN: secrets.operator,
        PAUSER_PRIVATE_KEY: keys.monitor,
        PAUSER_ACCOUNT_ADDRESS: accountIdentity(keys.monitor).address,
      };
    case "status":
      // Alerts go out through the identity Worker's Resend account, to the address setup recorded.
      return {
        L2_RPC_URL: inputs.rpc,
        RESEND_API_KEY: inputs.resend,
        ...(inputs.alertEmail ? { ALERT_EMAIL: inputs.alertEmail } : {}),
      };
    case "admin":
      return adminSecrets(secrets, access);
  }
}
function cloudflareFamily(path: string) {
  if (/^\/accounts\/[^/]+\/workers\/scripts(?:\/|$)/.test(path)) return "Workers scripts";
  if (/^\/accounts\/[^/]+\/d1(?:\/|$)/.test(path)) return "D1";
  if (/^\/accounts\/[^/]+\/r2(?:\/|$)/.test(path)) return "R2 buckets";
  if (/^\/accounts\/[^/]+\/pages(?:\/|$)/.test(path)) return "Pages";
  if (/^\/accounts\/[^/]+\/access(?:\/|$)/.test(path)) return "Access";
  if (/^\/zones\/[^/]+\/dns_records(?:[/?]|$)/.test(path)) return "DNS";
  if (/^\/zones\/[^/]+\/rulesets(?:[/?]|$)/.test(path)) return "Cache Rules";
  if (/^\/zones(?:[/?]|$)/.test(path)) return "zone";
  return "accounts";
}
/** Where a listed page sits in its list: by page number, by total, or by a cursor to the next page. */
interface ListPage {
  page?: number;
  total_pages?: number;
  total_count?: number;
  cursor?: string;
}
// Cloudflare's Pages lists refuse a page size over 10 (400, 8000024); one size every list accepts.
const PER_PAGE = 10;
const PAGE_LIMIT = 1000;
const withQuery = (path: string, query: Record<string, string | number>) =>
  `${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}`;
/** Whether a listed page leaves more of its list to read, given how many items have been read so far. */
const listContinues = (info: ListPage | undefined, read: number) =>
  Boolean(info?.cursor) ||
  (info?.page !== undefined && info.total_pages !== undefined && info.page < info.total_pages) ||
  (info?.total_count !== undefined && read < info.total_count);
const itemsOf = (result: unknown) =>
  Array.isArray(result)
    ? result.length
    : Array.isArray((result as { buckets?: unknown[] } | undefined)?.buckets)
      ? (result as { buckets: unknown[] }).buckets.length
      : 0;
async function cloudflareEnvelope<T>(response: Response, path: string): Promise<{ result: T; info?: ListPage }> {
  const body = (await response.json().catch(() => undefined)) as
    | { success?: boolean; result?: T; result_info?: ListPage; errors?: { code?: unknown }[] }
    | undefined;
  if (!response.ok || body?.success !== true) {
    const codes = Array.isArray(body?.errors)
      ? body.errors
          .map((error) => error?.code)
          .filter((code) => typeof code === "number" && Number.isSafeInteger(code) && code >= 0)
      : [];
    throw new PublicError(
      `Cloudflare refused ${cloudflareFamily(path)}: ${response.status}${codes.length ? ` (${codes.join(", ")})` : ""}. Check that the token has this permission and that the product is enabled on the account.`,
      response.status,
      codes.join(",") || "cloudflare_refused",
    );
  }
  return { result: body.result as T, info: body.result_info };
}
async function cloudflareResult<T>(response: Response, path: string): Promise<T> {
  return (await cloudflareEnvelope<T>(response, path)).result;
}
export class Platform {
  constructor(
    readonly target: Target,
    readonly inputs: Inputs,
    readonly store: PrivateStore,
    readonly apply: boolean,
  ) {}
  private account?: string;
  private async request<T>(path: string, method: string, body?: unknown) {
    if (!this.apply && method !== "GET") throw new PublicError("Dry run cannot write Cloudflare");
    const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
      method,
      redirect: "error",
      headers: { Authorization: `Bearer ${this.inputs.cloudflareToken}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return cloudflareEnvelope<T>(response, path);
  }
  /**
   * One Cloudflare result. A list answered only in part is refused: deciding that something is absent from one page
   * of a list would create it twice, so every list is read with `cfList`.
   */
  async cf<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const { result, info } = await this.request<T>(path, method, body);
    if (method === "GET" && listContinues(info, itemsOf(result)))
      throw new PublicError(`Cloudflare listed only part of ${cloudflareFamily(path)}; read it whole`);
    return result;
  }
  /** A whole Cloudflare list, read page by page, by page number or by cursor, until the list says it is done. */
  async cfList<T>(path: string, items: (result: unknown) => T[] = (result) => result as T[]): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    let cursor: string | undefined;
    for (let read = 0; read < PAGE_LIMIT; read++) {
      const query: Record<string, string | number> = cursor
        ? { per_page: PER_PAGE, cursor }
        : { page, per_page: PER_PAGE };
      const { result, info } = await this.request<unknown>(withQuery(path, query), "GET");
      const batch = items(result);
      all.push(...batch);
      if (!listContinues(info, all.length) || batch.length === 0) return all;
      cursor = info?.cursor || undefined;
      page += 1;
    }
    throw new PublicError(`Cloudflare listed more than ${PAGE_LIMIT} pages of ${cloudflareFamily(path)}`);
  }
  async accountId() {
    if (this.account) return this.account;
    const accounts = await this.cfList<{ id: string }>("/accounts");
    if (accounts.length !== 1) throw new PublicError("Scope the Cloudflare token to exactly one account");
    return (this.account = accounts[0]!.id);
  }
  async deployedVersion(worker: Worker) {
    const name = worker.name + this.target.workerSuffix;
    if (!(await this.scripts()).some((script) => script.id === name)) return undefined;
    // Cloudflare lists a script's deployments newest first, ten a page; the first is the one serving.
    const deployments = await this.cfList<{ versions: { version_id: string; percentage: number }[] }>(
      `/accounts/${await this.accountId()}/workers/scripts/${name}/deployments`,
      (result) => (result as { deployments: { versions: { version_id: string; percentage: number }[] }[] }).deployments,
    );
    const versions = deployments[0]?.versions;
    if (versions?.length !== 1 || versions[0]?.percentage !== 100) return undefined;
    const version = await this.cf<{ annotations?: Record<string, string> }>(
      `/accounts/${await this.accountId()}/workers/scripts/${name}/versions/${versions[0].version_id}`,
    );
    return { id: versions[0].version_id, revision: version.annotations?.["workers/tag"] };
  }
  async deployedRevision(worker: Worker) {
    return (await this.deployedVersion(worker))?.revision;
  }
  async clientRevision() {
    const project = await this.cf<{
      canonical_deployment?: {
        environment: string;
        latest_stage: { name: string; status: string };
        deployment_trigger: { metadata: { commit_hash: string } };
      };
    }>(`/accounts/${await this.accountId()}/pages/projects/${this.target.pages}`);
    const deployment = project.canonical_deployment;
    return deployment?.environment === "production" &&
      deployment.latest_stage.name === "deploy" &&
      deployment.latest_stage.status === "success"
      ? deployment.deployment_trigger.metadata.commit_hash
      : undefined;
  }
  async cloudflareEnvironment() {
    return {
      CLOUDFLARE_API_TOKEN: this.inputs.cloudflareToken,
      CLOUDFLARE_ACCOUNT_ID: await this.accountId(),
      WRANGLER_LOG_PATH: "/dev/null",
      XDG_CONFIG_HOME: this.store.directory,
    };
  }
  /** R2 lists its buckets inside the result, and pages them by cursor. */
  private buckets(account: string) {
    return this.cfList<{ name: string }>(`/accounts/${account}/r2/buckets`, (result) => {
      const buckets = (result as { buckets?: { name: string }[] } | undefined)?.buckets;
      if (!Array.isArray(buckets)) throw new PublicError("Cloudflare answered R2 buckets without a bucket list");
      return buckets;
    });
  }
  async scripts() {
    return this.cf<{ id: string }[]>(`/accounts/${await this.accountId()}/workers/scripts`);
  }
  async secretNames(worker: Worker) {
    const name = worker.name + this.target.workerSuffix;
    if (!(await this.scripts()).some((script) => script.id === name)) return [];
    const secrets = await this.cf<{ name: string }[]>(
      `/accounts/${await this.accountId()}/workers/scripts/${name}/secrets`,
    );
    return secrets.map((secret) => secret.name);
  }
  async wrangler(worker: Worker, args: string[], input?: string) {
    if (!this.apply) throw new PublicError("Dry run cannot invoke wrangler");
    return command({
      argv: [
        "pnpm",
        "exec",
        "wrangler",
        ...args,
        "--config",
        worker.config,
        ...(worker.id === "status" && !this.target.statusEnvironment ? [] : ["--env", this.target.worker]),
      ],
      cwd: resolve(root, worker.directory),
      input,
      env: {
        ...(await this.cloudflareEnvironment()),
      },
    });
  }
  async bootstrapWorkers() {
    if (!this.apply) throw new PublicError("Dry run cannot create Workers");
    const existing = new Set((await this.scripts()).map((script) => script.id));
    // Empty entrypoints break the first-install binding cycle. No routes or secrets are attached here.
    const module = `import { WorkerEntrypoint } from 'cloudflare:workers';
export default {fetch(){return new Response('Deployment pending',{status:503})}};
export class ValueIdentity extends WorkerEntrypoint {}
export class ValueLaunch extends WorkerEntrypoint {}
export class ValueLaunchDirectory extends WorkerEntrypoint {}
export class RosterMonitor extends WorkerEntrypoint {}
export class RelayDiagnostics extends WorkerEntrypoint {}`;
    for (const worker of workers) {
      const name = worker.name + this.target.workerSuffix;
      if (existing.has(name)) continue;
      const data = new FormData();
      data.append("metadata", JSON.stringify({ main_module: "bootstrap.js", compatibility_date: "2026-09-15" }));
      data.append("bootstrap.js", new Blob([module], { type: "application/javascript+module" }), "bootstrap.js");
      const path = `/accounts/${await this.accountId()}/workers/scripts/${name}`;
      const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
        method: "PUT",
        redirect: "error",
        headers: { Authorization: `Bearer ${this.inputs.cloudflareToken}` },
        body: data,
      });
      await cloudflareResult(response, path);
    }
  }
  private fingerprints(values: Record<string, string>) {
    return Object.fromEntries(
      Object.entries(values).map(([name, value]) => [name, createHash("sha256").update(value).digest("hex")]),
    );
  }
  async secretsPresent(worker: Worker, desired: Record<string, string>) {
    const existing = new Set(await this.secretNames(worker));
    const sent = this.store.read<Record<string, string>>(`uploaded-${worker.id}.json`) ?? {};
    return Object.entries(this.fingerprints(desired)).every(
      ([name, digest]) => existing.has(name) && (name === "GUARDIAN_PRIVATE_KEY" || sent[name] === digest),
    );
  }
  async installSecrets(worker: Worker, desired: Record<string, string>) {
    if (!this.apply) throw new PublicError("Dry run cannot write Worker secrets");
    const existing = new Set(await this.secretNames(worker));
    const sent = this.store.read<Record<string, string>>(`uploaded-${worker.id}.json`) ?? {};
    const fingerprints = this.fingerprints(desired);
    const missing = Object.fromEntries(
      Object.entries(desired).filter(([name]) => {
        if (name === "GUARDIAN_PRIVATE_KEY" && existing.has(name)) return false;
        return !existing.has(name) || sent[name] !== fingerprints[name];
      }),
    );
    if (Object.keys(missing).length) {
      await this.wrangler(worker, ["secret", "bulk"], JSON.stringify(missing));
      this.store.write(`uploaded-${worker.id}.json`, { ...sent, ...this.fingerprints(missing) });
    }
  }
  private async readResources() {
    const id = await this.accountId();
    const [databases, pages, buckets, zones] = await Promise.all([
      this.cfList<{ name: string }>(`/accounts/${id}/d1/database`),
      this.cfList<{ name: string }>(`/accounts/${id}/pages/projects`),
      this.buckets(id),
      this.cfList<{ id: string }>(`/zones?name=${this.target.zone}`),
      this.scripts(),
    ]);
    return { id, databases, pages, buckets, zones };
  }
  async checkAccess() {
    const { zones } = await this.readResources();
    if (zones.length !== 1)
      throw new PublicError("Cloudflare zone unavailable; check Zone read permission for the environment’s zone.");
    await this.cfList(`/zones/${zones[0]!.id}/rulesets`);
  }
  async resourcesPresent() {
    const { id, databases, pages, buckets, zones } = await this.readResources();
    const baseReady =
      databaseWorkers.every((worker) => databases.some((db) => db.name === databaseName(worker, this.target))) &&
      pages.some((page) => page.name === this.target.pages) &&
      buckets.some((bucket) => bucket.name === this.target.statusBucket);
    if (!baseReady) return false;
    const hostname = new URL(this.target.origin).hostname;
    const domains = await this.cfList<{ name: string }>(`/accounts/${id}/pages/projects/${this.target.pages}/domains`);
    if (zones.length !== 1) throw new PublicError("Cloudflare zone unavailable");
    const records = await this.cfList<{ type: string; content: string }>(
      `/zones/${zones[0]!.id}/dns_records?name=${hostname}`,
    );
    return (
      domains.some((domain) => domain.name === hostname) &&
      records.some((record) => record.type === "CNAME" && record.content === `${this.target.pages}.pages.dev`)
    );
  }
  async prepareResources() {
    if (!this.apply) throw new PublicError("Dry run cannot create deployment resources");
    const id = await this.accountId();
    const databases = await this.cfList<{ name: string }>(`/accounts/${id}/d1/database`);
    for (const worker of databaseWorkers)
      if (!databases.some((db) => db.name === databaseName(worker, this.target)))
        await this.cf(`/accounts/${id}/d1/database`, "POST", { name: databaseName(worker, this.target) });
    const pages = await this.cfList<{ name: string }>(`/accounts/${id}/pages/projects`);
    if (!pages.some((page) => page.name === this.target.pages))
      await this.cf(`/accounts/${id}/pages/projects`, "POST", { name: this.target.pages, production_branch: "main" });
    const buckets = await this.buckets(id);
    if (!buckets.some((bucket) => bucket.name === this.target.statusBucket))
      await this.cf(`/accounts/${id}/r2/buckets`, "POST", { name: this.target.statusBucket });
    const domains = await this.cfList<{ name: string }>(`/accounts/${id}/pages/projects/${this.target.pages}/domains`);
    const hostname = new URL(this.target.origin).hostname;
    if (!domains.some((domain) => domain.name === hostname))
      await this.cf(`/accounts/${id}/pages/projects/${this.target.pages}/domains`, "POST", { name: hostname });
    const zones = await this.cfList<{ id: string }>(`/zones?name=${this.target.zone}`);
    if (zones.length !== 1) throw new PublicError("Cloudflare zone is not available to this token");
    const records = await this.cfList<{ type: string; content: string }>(
      `/zones/${zones[0]!.id}/dns_records?name=${hostname}`,
    );
    if (!records.length)
      await this.cf(`/zones/${zones[0]!.id}/dns_records`, "POST", {
        type: "CNAME",
        name: hostname,
        content: `${this.target.pages}.pages.dev`,
        proxied: true,
      });
    else if (!records.some((record) => record.type === "CNAME" && record.content === `${this.target.pages}.pages.dev`))
      throw new PublicError("Existing client DNS differs; it was not overwritten");
  }
}
