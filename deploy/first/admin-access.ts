import { PublicError } from "./errors";
import type { Platform } from "./platform";
import type { PrivateStore } from "./private-store";
import type { Environment } from "./settings";

/**
 * Who may use the admin page, as the owner keeps it in the private directory's `admin-access.json`: `operators` open
 * the page; on production, `writers` alone may act. Setup makes Cloudflare Access hold the operators, and the admin
 * Worker, which re-checks the Access token on every call, holds the writers. One Access application covers the whole
 * page: the page's writes are fetches, which could not follow a second application's sign-in.
 */
export interface AdminAccessList {
  operators: string[];
  writers?: string[];
}

/** What setup last made Access hold, which the admin Worker's secrets carry. */
export interface AdminAccess {
  teamDomain: string;
  audience: string;
  operators: string[];
  writers: string[];
}

export const ADMIN_ACCESS_LIST = "admin-access.json";
export const ADMIN_ACCESS = "admin-access-applied.json";
const SESSION = "8h";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emails = (value: unknown, name: string): string[] => {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((email) => typeof email === "string" && EMAIL.test(email))
  )
    throw new PublicError(`${ADMIN_ACCESS_LIST} needs ${name}: a list of one or more email addresses`);
  return [...new Set(value.map((email: string) => email.toLowerCase()))].sort();
};

/** The owner's lists, or undefined before the owner has written them. */
export function readAdminAccessList(store: PrivateStore, environment: Environment): AdminAccessList | undefined {
  const list = store.read<AdminAccessList>(ADMIN_ACCESS_LIST);
  if (!list) return undefined;
  const operators = emails(list.operators, "operators");
  if (environment === "dev") {
    if (list.writers !== undefined)
      throw new PublicError(`Dev's ${ADMIN_ACCESS_LIST} takes no writers; operators act there`);
    return { operators };
  }
  const writers = emails(list.writers, "writers (production's owner-only list)");
  if (!writers.every((email) => operators.includes(email)))
    throw new PublicError(`Every writer in ${ADMIN_ACCESS_LIST} must also be an operator, to open the page`);
  return { operators, writers };
}

export const adminAccessListExample = (environment: Environment) =>
  JSON.stringify(
    environment === "dev"
      ? { operators: ["owner@example.com"] }
      : { operators: ["owner@example.com"], writers: ["owner@example.com"] },
  );

interface Policy {
  id: string;
  name: string;
  decision: string;
  include: { email?: { email: string } }[];
}
interface App {
  id: string;
  name: string;
  domain: string;
  aud: string;
  policies?: { id: string }[];
}

const policyBody = (name: string, members: string[]) => ({
  name,
  decision: "allow",
  include: members.map((email) => ({ email: { email } })),
});
const sameMembers = (policy: Policy, members: string[]) =>
  policy.decision === "allow" &&
  policy.include
    .map((rule) => rule.email?.email ?? "")
    .sort()
    .join() === members.join();

/**
 * Makes Access hold the admin's login method, operators' policy and application, and records what it holds with the
 * writers. With `write` false it only reads and answers whether anything differs; with `write` true it changes only
 * what differs, so a second run writes nothing. Removing an operator also ends that person's Access sessions
 * account-wide (Cloudflare revokes a user for every application, not one).
 */
export async function syncAdminAccess(
  platform: Platform,
  store: PrivateStore,
  environment: Environment,
  list: AdminAccessList,
  write: boolean,
): Promise<{ changed: boolean }> {
  const account = `/accounts/${await platform.accountId()}/access`;
  const host = new URL(platform.target.admin).hostname;
  let changed = false;
  const change = async <T>(path: string, method: string, body?: unknown): Promise<T | undefined> => {
    changed = true;
    return write ? platform.cf<T>(path, method, body) : undefined;
  };

  const organization = await platform.cf<{ auth_domain?: string }>(`${account}/organizations`);
  if (!organization.auth_domain)
    throw new PublicError("Turn on Cloudflare Zero Trust once for this account; Access needs its team domain");

  const providers = await platform.cfList<{ type: string }>(`${account}/identity_providers`);
  if (!providers.some((provider) => provider.type === "onetimepin"))
    await change(`${account}/identity_providers`, "POST", { name: "One-time PIN", type: "onetimepin", config: {} });

  const policies = await platform.cfList<Policy>(`${account}/policies`);
  const ensurePolicy = async (name: string, members: string[]) => {
    const existing = policies.find((policy) => policy.name === name);
    if (existing && sameMembers(existing, members)) return existing.id;
    const saved = existing
      ? await change<Policy>(`${account}/policies/${existing.id}`, "PUT", policyBody(name, members))
      : await change<Policy>(`${account}/policies`, "POST", policyBody(name, members));
    return saved?.id ?? existing?.id;
  };

  const apps = await platform.cfList<App>(`${account}/apps`);
  const ensureApp = async (name: string, domain: string, policy: string | undefined) => {
    const existing = apps.find((app) => app.name === name);
    const body = {
      name,
      domain,
      type: "self_hosted",
      session_duration: SESSION,
      app_launcher_visible: false,
      policies: policy ? [{ id: policy, precedence: 1 }] : [],
    };
    const current =
      existing?.domain === domain && existing.policies?.length === 1 && existing.policies[0]!.id === policy;
    if (existing && current) return existing.aud;
    const saved = existing
      ? await change<App>(`${account}/apps/${existing.id}`, "PUT", body)
      : await change<App>(`${account}/apps`, "POST", body);
    return saved?.aud ?? existing?.aud;
  };

  const operatorsPolicy = await ensurePolicy(`Realms admin operators (${environment})`, list.operators);
  const audience = await ensureApp(`Realms admin (${environment})`, host, operatorsPolicy);

  const previous = store.read<AdminAccess>(ADMIN_ACCESS);
  for (const email of previous?.operators ?? [])
    if (!list.operators.includes(email)) await change(`${account}/organizations/revoke_user`, "POST", { email });

  const applied: AdminAccess = {
    teamDomain: organization.auth_domain,
    audience: audience ?? "",
    operators: list.operators,
    writers: list.writers ?? [],
  };
  if (JSON.stringify(previous) !== JSON.stringify(applied)) {
    changed = true;
    if (write) store.write(ADMIN_ACCESS, applied);
  }
  return { changed };
}
