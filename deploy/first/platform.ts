import { resolve } from "node:path";
import { randomBytes, createECDH, createHash } from "node:crypto";
import { accountIdentity, newKey, type Keys } from "./chain";
import { root, type Inputs, type Target } from "./settings";
import type { PrivateStore } from "./private-store";
import { command } from "./process";

export const workers = [
  { id: "guardian", directory: "apps/guardian", config: "wrangler.jsonc", name: "realms-guardian" },
  { id: "identity", directory: "apps/realms", config: "wrangler.jsonc", name: "realms-identity" },
  { id: "relay", directory: "apps/value-relay", config: "wrangler.jsonc", name: "realms-value-relay" },
  { id: "monitor", directory: "apps/value-relay", config: "monitor.wrangler.jsonc", name: "realms-value-monitor" },
  { id: "launch", directory: "apps/launch-service", config: "wrangler.jsonc", name: "realms-launch" },
  { id: "status", directory: "apps/status-monitor", config: "wrangler.jsonc", name: "realms-status-monitor" },
] as const;
export type Worker = (typeof workers)[number];
export interface Secrets {
  operator: string;
  auth: string;
  vapidPublic: string;
  vapidPrivate: string;
  guardian?: string;
}
export function generateSecrets(operator: string, guardianExists: boolean): Secrets {
  const vapid = createECDH("prime256v1");
  vapid.generateKeys();
  return {
    operator: operator || randomBytes(32).toString("hex"),
    auth: randomBytes(32).toString("hex"),
    vapidPublic: vapid.getPublicKey().toString("base64url"),
    vapidPrivate: vapid.getPrivateKey().toString("base64url"),
    ...(guardianExists ? {} : { guardian: newKey() }),
  };
}
export function workerSecrets(worker: Worker, inputs: Inputs, secrets: Secrets, keys: Keys): Record<string, string> {
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
      return { L2_RPC_URL: inputs.rpc };
  }
}
export class Platform {
  constructor(
    readonly target: Target,
    readonly inputs: Inputs,
    readonly store: PrivateStore,
    readonly apply: boolean,
  ) {}
  private account?: string;
  async cf<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    if (!this.apply && method !== "GET") throw new Error("Dry run cannot write Cloudflare");
    const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
      method,
      redirect: "error",
      headers: { Authorization: `Bearer ${this.inputs.cloudflareToken}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = (await response.json()) as { success: boolean; result: T };
    if (!response.ok || !result.success) throw new Error("Cloudflare request failed");
    return result.result;
  }
  async accountId() {
    if (this.account) return this.account;
    const accounts = await this.cf<{ id: string }[]>("/accounts");
    if (accounts.length !== 1) throw new Error("Scope the Cloudflare token to exactly one account");
    return (this.account = accounts[0]!.id);
  }
  async deployedVersion(worker: Worker) {
    const name = worker.name + this.target.workerSuffix;
    if (!(await this.scripts()).some((script) => script.id === name)) return undefined;
    const deployments = await this.cf<{ deployments: { versions: { version_id: string; percentage: number }[] }[] }>(
      `/accounts/${await this.accountId()}/workers/scripts/${name}/deployments`,
    );
    const versions = deployments.deployments[0]?.versions;
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
    if (!this.apply) throw new Error("Dry run cannot invoke wrangler");
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
    if (!this.apply) throw new Error("Dry run cannot create Workers");
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
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${await this.accountId()}/workers/scripts/${name}`,
        {
          method: "PUT",
          redirect: "error",
          headers: { Authorization: `Bearer ${this.inputs.cloudflareToken}` },
          body: data,
        },
      );
      if (!response.ok || !((await response.json()) as { success: boolean }).success)
        throw new Error("Worker bootstrap failed");
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
    if (!this.apply) throw new Error("Dry run cannot write Worker secrets");
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
  async resourcesPresent() {
    const id = await this.accountId();
    const databases = await this.cf<{ name: string }[]>(`/accounts/${id}/d1/database`);
    const pages = await this.cf<{ name: string }[]>(`/accounts/${id}/pages/projects`);
    const buckets = await this.cf<{ buckets: { name: string }[] }>(`/accounts/${id}/r2/buckets`);
    const baseReady =
      ["realms-identity", "realms-launch"].every((name) =>
        databases.some((db) => db.name === `${name}-${this.target.worker}`),
      ) &&
      pages.some((page) => page.name === this.target.pages) &&
      buckets.buckets.some((bucket) => bucket.name === this.target.statusBucket);
    if (!baseReady) return false;
    const hostname = new URL(this.target.origin).hostname;
    const domains = await this.cf<{ name: string }[]>(`/accounts/${id}/pages/projects/${this.target.pages}/domains`);
    const zones = await this.cf<{ id: string }[]>(`/zones?name=${this.target.zone}`);
    if (zones.length !== 1) throw new Error("Cloudflare zone unavailable");
    const records = await this.cf<{ type: string; content: string }[]>(
      `/zones/${zones[0]!.id}/dns_records?name=${hostname}`,
    );
    return (
      domains.some((domain) => domain.name === hostname) &&
      records.some((record) => record.type === "CNAME" && record.content === `${this.target.pages}.pages.dev`)
    );
  }
  async prepareResources() {
    if (!this.apply) throw new Error("Dry run cannot create deployment resources");
    const id = await this.accountId();
    const databases = await this.cf<{ name: string }[]>(`/accounts/${id}/d1/database`);
    for (const name of ["realms-identity", "realms-launch"])
      if (!databases.some((db) => db.name === `${name}-${this.target.worker}`))
        await this.cf(`/accounts/${id}/d1/database`, "POST", { name: `${name}-${this.target.worker}` });
    const pages = await this.cf<{ name: string }[]>(`/accounts/${id}/pages/projects`);
    if (!pages.some((page) => page.name === this.target.pages))
      await this.cf(`/accounts/${id}/pages/projects`, "POST", { name: this.target.pages, production_branch: "main" });
    const buckets = await this.cf<{ buckets: { name: string }[] }>(`/accounts/${id}/r2/buckets`);
    if (!buckets.buckets.some((bucket) => bucket.name === this.target.statusBucket))
      await this.cf(`/accounts/${id}/r2/buckets`, "POST", { name: this.target.statusBucket });
    const domains = await this.cf<{ name: string }[]>(`/accounts/${id}/pages/projects/${this.target.pages}/domains`);
    const hostname = new URL(this.target.origin).hostname;
    if (!domains.some((domain) => domain.name === hostname))
      await this.cf(`/accounts/${id}/pages/projects/${this.target.pages}/domains`, "POST", { name: hostname });
    const zones = await this.cf<{ id: string }[]>(`/zones?name=${this.target.zone}`);
    if (zones.length !== 1) throw new Error("Cloudflare zone is not available to this token");
    const records = await this.cf<{ type: string; content: string }[]>(
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
      throw new Error("Existing client DNS differs; it was not overwritten");
  }
}
