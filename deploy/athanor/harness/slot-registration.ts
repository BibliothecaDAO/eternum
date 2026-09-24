import { setTimeout as sleep } from "node:timers/promises";

/**
 * The slot shape: bots register into a free Blitz slot the way players do, and the launch service creates and settles
 * the games. The harness only learns which game each account landed in.
 */
export interface SlotLaunchApi {
  /** The app origin the launch Worker is served under; it is also the Origin header launch mutations require. */
  origin: string;
  /** The environment's operator token; sent as a bearer and never logged. */
  token: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
}

export interface SlotRegistrationOptions {
  slotName: string;
  accounts: readonly string[];
  /** How far ahead the slot closes; the cron freezes it within a minute of that. */
  closesInSeconds: number;
  pollMs?: number;
  timeoutMs?: number;
}

export interface SlotGame {
  gameNumber: number;
  gameName: string;
  gameId: number;
  settlementTransactions: number | null;
  /** The game's roster in registration order: the split the launch service made. */
  accounts: string[];
}

interface SlotRecord {
  name: string;
  frozenAt: string | null;
  registrations: Array<{ account: string; gameNumber: number | null; position: number }>;
}

interface FactoryRunRecord {
  gameName: string;
  /** A game run creates the game; its result run, listed under the same name once the game is live, finalizes it. */
  kind: "game" | "result";
  status: "queued" | "running" | "attention" | "complete";
  artifacts: { gameId?: number; settlementTransactions?: number };
  steps: Array<{ errorMessage?: string }>;
}

const MAX_ACCOUNTS_PER_REGISTRATION = 96;
const SLOT_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,23}$/;

export async function registerBotsThroughSlot(api: SlotLaunchApi, options: SlotRegistrationOptions): Promise<SlotGame[]> {
  if (!SLOT_NAME_PATTERN.test(options.slotName)) throw new Error(`Slot name ${options.slotName} is not [a-z0-9][a-z0-9-]{0,23}`);
  const closesAt = new Date(Date.now() + options.closesInSeconds * 1_000).toISOString();
  await createSlot(api, options.slotName, closesAt);
  for (const batch of batches(options.accounts, MAX_ACCOUNTS_PER_REGISTRATION)) {
    await registerAccounts(api, options.slotName, batch);
  }
  const deadline = Date.now() + (options.timeoutMs ?? 15 * 60_000);
  const pollMs = options.pollMs ?? 5_000;
  const slot = await pollUntil(() => readFrozenSlot(api, options.slotName), deadline, pollMs, "freeze");
  const rosters = rostersByGame(slot, options.accounts);
  const games: SlotGame[] = [];
  for (const [gameNumber, accounts] of rosters) {
    games.push(await readSlotGame(api, options.slotName, gameNumber, accounts, deadline, pollMs));
  }
  return games;
}

async function readSlotGame(
  api: SlotLaunchApi,
  slotName: string,
  gameNumber: number,
  accounts: string[],
  deadline: number,
  pollMs: number,
): Promise<SlotGame> {
  const gameName = `${slotName}-${gameNumber}`;
  const run = await pollUntil(() => readCompletedRun(api, gameName), deadline, pollMs, `launch of ${gameName}`);
  return {
    gameNumber,
    gameName,
    gameId: run.artifacts.gameId!,
    settlementTransactions: run.artifacts.settlementTransactions ?? null,
    accounts,
  };
}

async function createSlot(api: SlotLaunchApi, name: string, closesAt: string): Promise<void> {
  await launchRequest(api, "POST", "/api/slots", { name, closesAt });
}

async function registerAccounts(api: SlotLaunchApi, slotName: string, accounts: readonly string[]): Promise<void> {
  await launchRequest(api, "POST", `/api/slots/${slotName}/register`, { accounts });
}

/** The slot once the cron froze it and every registration knows its game; null while registration is still open. */
async function readFrozenSlot(api: SlotLaunchApi, slotName: string): Promise<SlotRecord | null> {
  const { slots } = (await launchRequest(api, "GET", "/api/slots")) as { slots: SlotRecord[] };
  const slot = slots.find((candidate) => candidate.name === slotName);
  if (!slot) throw new Error(`Slot ${slotName} disappeared from the launch service`);
  const dispatched = slot.frozenAt !== null && slot.registrations.every(({ gameNumber }) => gameNumber !== null);
  return dispatched ? slot : null;
}

/** The game's launch run once it is complete; null while it is creating or settling; a failed run is a failed run. */
async function readCompletedRun(api: SlotLaunchApi, gameName: string): Promise<FactoryRunRecord | null> {
  const { runs } = (await launchRequest(api, "GET", "/api/factory/runs?environment=madara.blitz")) as {
    runs: FactoryRunRecord[];
  };
  const run = runs.find((candidate) => candidate.kind === "game" && candidate.gameName === gameName);
  if (!run) return null;
  if (run.status === "attention") {
    const reason = run.steps.map((step) => step.errorMessage).find(Boolean) ?? "no error recorded";
    throw new Error(`Launch of ${gameName} failed: ${reason}`);
  }
  if (run.status !== "complete") return null;
  if (!Number.isSafeInteger(run.artifacts.gameId)) throw new Error(`Completed launch of ${gameName} has no game id`);
  return run;
}

function rostersByGame(slot: SlotRecord, registered: readonly string[]): Map<number, string[]> {
  const ours = new Set(registered.map(normalizeAddress));
  const rosters = new Map<number, string[]>();
  for (const registration of [...slot.registrations].sort((left, right) => left.position - right.position)) {
    if (!ours.has(normalizeAddress(registration.account))) continue;
    const roster = rosters.get(registration.gameNumber!) ?? [];
    roster.push(registration.account);
    rosters.set(registration.gameNumber!, roster);
  }
  const placed = [...rosters.values()].reduce((sum, roster) => sum + roster.length, 0);
  if (placed !== ours.size) throw new Error(`Slot ${slot.name} placed ${placed} of ${ours.size} registered bots`);
  return rosters;
}

async function pollUntil<T>(
  read: () => Promise<T | null>,
  deadline: number,
  pollMs: number,
  waitingFor: string,
): Promise<T> {
  while (true) {
    const value = await read();
    if (value !== null) return value;
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for the slot ${waitingFor}`);
    await sleep(pollMs);
  }
}

async function launchRequest(api: SlotLaunchApi, method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
  const response = await (api.fetch ?? fetch)(`${api.origin}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${api.token}`,
      origin: api.origin,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${method} ${path} failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  return response.json();
}

function batches<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

const normalizeAddress = (address: string) => `0x${BigInt(address).toString(16)}`;
