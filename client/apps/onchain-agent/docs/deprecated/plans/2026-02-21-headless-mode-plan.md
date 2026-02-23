# Headless Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Axis fully scriptable for AI orchestrators — headless runtime, structured JSON output, browser-free auth, HTTP/stdin steering.

**Architecture:** Add orthogonal layers (CLI arg parsing, JSON event emitter, HTTP server, auth-approve script) that compose with the existing TUI runtime. The `index.ts` main function splits into TUI and headless code paths based on parsed CLI flags. New subcommands (`worlds`, `auth`, `auth-status`, `auth-url`) are standalone functions in `cli.ts` that reuse existing `discovery.ts` and `controller-session.ts`.

**Tech Stack:** TypeScript, `node:http` for API server, `node:child_process` (`execFile` — NOT `exec`) for agent-browser shell-out, vitest for tests.

---

### Task 1: CLI Argument Parser

Extract CLI flags and subcommands into a structured options object so all subsequent tasks can read parsed flags.

**Files:**
- Create: `src/cli-args.ts`
- Modify: `src/cli.ts:173-208`
- Test: `test/cli/cli-args.test.ts`

**Step 1: Write the failing test**

```typescript
// test/cli/cli-args.test.ts
import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../../src/cli-args";

describe("parseCliArgs", () => {
  it("defaults to run command with TUI", () => {
    const opts = parseCliArgs([]);
    expect(opts.command).toBe("run");
    expect(opts.headless).toBe(false);
    expect(opts.json).toBe(false);
  });

  it("parses run --headless --world=my-world", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=my-world"]);
    expect(opts.command).toBe("run");
    expect(opts.headless).toBe(true);
    expect(opts.world).toBe("my-world");
  });

  it("parses run with --api-port and --stdin", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=x", "--api-port=3000", "--stdin"]);
    expect(opts.apiPort).toBe(3000);
    expect(opts.stdin).toBe(true);
  });

  it("parses run with --auth=privatekey", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=x", "--auth=privatekey"]);
    expect(opts.auth).toBe("privatekey");
  });

  it("parses run with --verbosity", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=x", "--verbosity=actions"]);
    expect(opts.verbosity).toBe("actions");
  });

  it("parses worlds --json", () => {
    const opts = parseCliArgs(["worlds", "--json"]);
    expect(opts.command).toBe("worlds");
    expect(opts.json).toBe(true);
  });

  it("parses auth <world> --approve --method=password", () => {
    const opts = parseCliArgs(["auth", "my-world", "--approve", "--method=password", "--username=bot", "--password=pass123"]);
    expect(opts.command).toBe("auth");
    expect(opts.world).toBe("my-world");
    expect(opts.approve).toBe(true);
    expect(opts.method).toBe("password");
    expect(opts.username).toBe("bot");
    expect(opts.password).toBe("pass123");
  });

  it("parses auth --all --json", () => {
    const opts = parseCliArgs(["auth", "--all", "--json"]);
    expect(opts.command).toBe("auth");
    expect(opts.all).toBe(true);
    expect(opts.json).toBe(true);
  });

  it("parses auth-status <world> --json", () => {
    const opts = parseCliArgs(["auth-status", "my-world", "--json"]);
    expect(opts.command).toBe("auth-status");
    expect(opts.world).toBe("my-world");
    expect(opts.json).toBe(true);
  });

  it("parses auth-url <world>", () => {
    const opts = parseCliArgs(["auth-url", "my-world"]);
    expect(opts.command).toBe("auth-url");
    expect(opts.world).toBe("my-world");
  });

  it("parses --api-host", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=x", "--api-port=3000", "--api-host=0.0.0.0"]);
    expect(opts.apiHost).toBe("0.0.0.0");
  });

  it("defaults auth to session", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=x"]);
    expect(opts.auth).toBe("session");
  });

  it("defaults verbosity to decisions", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=x"]);
    expect(opts.verbosity).toBe("decisions");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --dir client/apps/onchain-agent test -- test/cli/cli-args.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/cli-args.ts
export type Command = "run" | "worlds" | "auth" | "auth-status" | "auth-url" | "doctor" | "init" | "version" | "help" | "unknown";
export type AuthMode = "session" | "privatekey";
export type Verbosity = "quiet" | "actions" | "decisions" | "all";

export interface CliOptions {
  command: Command;
  world?: string;
  headless: boolean;
  json: boolean;
  auth: AuthMode;
  verbosity: Verbosity;
  apiPort?: number;
  apiHost?: string;
  stdin: boolean;
  all: boolean;
  approve: boolean;
  method?: string;
  username?: string;
  password?: string;
  rawArgs: string[];
}

const COMMANDS = new Set<Command>(["run", "worlds", "auth", "auth-status", "auth-url", "doctor", "init"]);

function extractFlag(args: string[], flag: string): string | undefined {
  const eqPrefix = `--${flag}=`;
  const eqArg = args.find((a) => a.startsWith(eqPrefix));
  if (eqArg) return eqArg.slice(eqPrefix.length);
  const idx = args.indexOf(`--${flag}`);
  if (idx !== -1 && idx + 1 < args.length && !args[idx + 1].startsWith("--")) {
    return args[idx + 1];
  }
  return undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.some((a) => a === `--${flag}` || a.startsWith(`--${flag}=`));
}

export function parseCliArgs(args: string[]): CliOptions {
  const firstArg = args[0] ?? "";
  let command: Command = "run";
  let positionalWorld: string | undefined;

  if (firstArg === "--version" || firstArg === "-v") {
    command = "version";
  } else if (firstArg === "--help" || firstArg === "-h" || firstArg === "help") {
    command = "help";
  } else if (COMMANDS.has(firstArg as Command)) {
    command = firstArg as Command;
    if (["auth", "auth-status", "auth-url"].includes(command)) {
      const secondArg = args[1];
      if (secondArg && !secondArg.startsWith("--")) {
        positionalWorld = secondArg;
      }
    }
  } else if (firstArg && !firstArg.startsWith("--")) {
    command = "unknown";
  }

  const world = extractFlag(args, "world") ?? positionalWorld;
  const apiPortStr = extractFlag(args, "api-port");
  const authStr = extractFlag(args, "auth");
  const verbStr = extractFlag(args, "verbosity");

  return {
    command,
    world,
    headless: hasFlag(args, "headless"),
    json: hasFlag(args, "json"),
    auth: (authStr === "privatekey" ? "privatekey" : "session") as AuthMode,
    verbosity: (["quiet", "actions", "decisions", "all"].includes(verbStr ?? "") ? verbStr : "decisions") as Verbosity,
    apiPort: apiPortStr ? parseInt(apiPortStr, 10) : undefined,
    apiHost: extractFlag(args, "api-host"),
    stdin: hasFlag(args, "stdin"),
    all: hasFlag(args, "all"),
    approve: hasFlag(args, "approve"),
    method: extractFlag(args, "method"),
    username: extractFlag(args, "username"),
    password: extractFlag(args, "password"),
    rawArgs: args,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --dir client/apps/onchain-agent test -- test/cli/cli-args.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/cli-args.ts test/cli/cli-args.test.ts
git commit -m "feat(onchain-agent): add CLI argument parser for headless mode"
```

---

### Task 2: JSON Event Emitter

Create the NDJSON output layer that all headless code paths write through.

**Files:**
- Create: `src/output/json-emitter.ts`
- Test: `test/output/json-emitter.test.ts`

**Step 1: Write the failing test**

```typescript
// test/output/json-emitter.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { JsonEmitter } from "../../src/output/json-emitter";

describe("JsonEmitter", () => {
  let writtenLines: string[];
  let emitter: JsonEmitter;

  beforeEach(() => {
    writtenLines = [];
    emitter = new JsonEmitter({
      verbosity: "all",
      write: (line) => writtenLines.push(line),
    });
  });

  it("emits startup event as NDJSON", () => {
    emitter.emit({ type: "startup", world: "test-world", chain: "slot", address: "0x1" });
    expect(writtenLines).toHaveLength(1);
    const parsed = JSON.parse(writtenLines[0]);
    expect(parsed.type).toBe("startup");
    expect(parsed.world).toBe("test-world");
    expect(parsed.ts).toBeDefined();
  });

  it("filters tick events at actions verbosity", () => {
    emitter = new JsonEmitter({ verbosity: "actions", write: (line) => writtenLines.push(line) });
    emitter.emit({ type: "tick", id: 1, state: {} });
    expect(writtenLines).toHaveLength(0);
  });

  it("passes action events at actions verbosity", () => {
    emitter = new JsonEmitter({ verbosity: "actions", write: (line) => writtenLines.push(line) });
    emitter.emit({ type: "action", tick: 1, action: "guard_add", params: {}, status: "ok", txHash: "0x1" });
    expect(writtenLines).toHaveLength(1);
  });

  it("passes error events at quiet verbosity", () => {
    emitter = new JsonEmitter({ verbosity: "quiet", write: (line) => writtenLines.push(line) });
    emitter.emit({ type: "error", message: "something broke" });
    expect(writtenLines).toHaveLength(1);
  });

  it("filters decision events at quiet verbosity", () => {
    emitter = new JsonEmitter({ verbosity: "quiet", write: (line) => writtenLines.push(line) });
    emitter.emit({ type: "decision", tick: 1, reasoning: "thinking", actions: [] });
    expect(writtenLines).toHaveLength(0);
  });

  it("allows subscribing to events", () => {
    const received: any[] = [];
    emitter.subscribe((event) => received.push(event));
    emitter.emit({ type: "startup", world: "w", chain: "slot", address: "0x1" });
    expect(received).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --dir client/apps/onchain-agent test -- test/output/json-emitter.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/output/json-emitter.ts
export type EventType = "startup" | "tick" | "decision" | "action" | "heartbeat" | "prompt" | "session" | "error" | "shutdown";
export type Verbosity = "quiet" | "actions" | "decisions" | "all";

export interface AgentEvent {
  type: EventType;
  [key: string]: unknown;
}

const VERBOSITY_FILTER: Record<Verbosity, Set<EventType>> = {
  quiet: new Set(["error", "session", "shutdown"]),
  actions: new Set(["error", "session", "shutdown", "action"]),
  decisions: new Set(["error", "session", "shutdown", "action", "decision", "heartbeat", "prompt", "startup"]),
  all: new Set(["error", "session", "shutdown", "action", "decision", "heartbeat", "prompt", "startup", "tick"]),
};

type EventSubscriber = (event: AgentEvent) => void;

interface JsonEmitterOptions {
  verbosity: Verbosity;
  write: (line: string) => void;
}

export class JsonEmitter {
  private verbosity: Verbosity;
  private write: (line: string) => void;
  private subscribers: EventSubscriber[] = [];

  constructor(options: JsonEmitterOptions) {
    this.verbosity = options.verbosity;
    this.write = options.write;
  }

  emit(event: AgentEvent): void {
    const enriched = { ...event, ts: new Date().toISOString() };
    for (const sub of this.subscribers) {
      sub(enriched);
    }
    if (!VERBOSITY_FILTER[this.verbosity].has(event.type)) return;
    this.write(JSON.stringify(enriched));
  }

  subscribe(fn: EventSubscriber): () => void {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== fn);
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --dir client/apps/onchain-agent test -- test/output/json-emitter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/output/json-emitter.ts test/output/json-emitter.test.ts
git commit -m "feat(onchain-agent): add NDJSON event emitter with verbosity filtering"
```

---

### Task 3: Artifact Persistence Layer

Create functions to write/read world artifacts (profile, manifest, policy, auth metadata) to the session directory.

**Files:**
- Create: `src/session/artifacts.ts`
- Test: `test/session/artifacts.test.ts`

**Step 1: Write the failing test**

```typescript
// test/session/artifacts.test.ts
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { writeArtifacts, readArtifacts, readAuthStatus } from "../../src/session/artifacts";

describe("artifacts", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "axis-artifacts-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes profile, manifest, policy, and auth to world dir", () => {
    const worldDir = path.join(tmpDir, "test-world");
    writeArtifacts(worldDir, {
      profile: { name: "test-world", chain: "slot", toriiBaseUrl: "http://example.com", rpcUrl: "http://rpc", worldAddress: "0x1", contractsBySelector: {}, fetchedAt: 1000 },
      manifest: { contracts: [{ tag: "test", address: "0x2" }] },
      policy: { contracts: { "0x2": { methods: [{ name: "test", entrypoint: "test" }] } } },
      auth: { url: "https://auth.example.com", status: "pending", worldName: "test-world", chain: "slot", createdAt: new Date().toISOString() },
    });

    const profile = JSON.parse(readFileSync(path.join(worldDir, "profile.json"), "utf-8"));
    expect(profile.name).toBe("test-world");

    const manifest = JSON.parse(readFileSync(path.join(worldDir, "manifest.json"), "utf-8"));
    expect(manifest.contracts).toHaveLength(1);

    const policy = JSON.parse(readFileSync(path.join(worldDir, "policy.json"), "utf-8"));
    expect(policy.contracts["0x2"]).toBeDefined();

    const auth = JSON.parse(readFileSync(path.join(worldDir, "auth.json"), "utf-8"));
    expect(auth.status).toBe("pending");
  });

  it("reads artifacts back from world dir", () => {
    const worldDir = path.join(tmpDir, "test-world");
    const original = {
      profile: { name: "test-world", chain: "slot" as const, toriiBaseUrl: "http://example.com", rpcUrl: "http://rpc", worldAddress: "0x1", contractsBySelector: {}, fetchedAt: 1000 },
      manifest: { contracts: [{ tag: "test", address: "0x2" }] },
      policy: { contracts: {} },
      auth: { url: "https://auth.example.com", status: "pending" as const, worldName: "test-world", chain: "slot", createdAt: new Date().toISOString() },
    };
    writeArtifacts(worldDir, original);

    const read = readArtifacts(worldDir);
    expect(read.profile.name).toBe("test-world");
    expect(read.manifest.contracts).toHaveLength(1);
  });

  it("reads auth status", () => {
    const worldDir = path.join(tmpDir, "test-world");
    writeArtifacts(worldDir, {
      profile: { name: "w", chain: "slot", toriiBaseUrl: "", worldAddress: "0x1", contractsBySelector: {}, fetchedAt: 0 },
      manifest: { contracts: [] },
      policy: { contracts: {} },
      auth: { url: "https://auth.example.com", status: "active", worldName: "w", chain: "slot", createdAt: new Date().toISOString(), address: "0xabc" },
    });

    const status = readAuthStatus(worldDir);
    expect(status.status).toBe("active");
    expect(status.address).toBe("0xabc");
  });

  it("returns status none when dir does not exist", () => {
    const status = readAuthStatus(path.join(tmpDir, "nonexistent"));
    expect(status.status).toBe("none");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --dir client/apps/onchain-agent test -- test/session/artifacts.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/session/artifacts.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { WorldProfile } from "../world/types";

export interface AuthMetadata {
  url: string;
  status: "pending" | "active" | "expired" | "none";
  worldName: string;
  chain: string;
  createdAt: string;
  expiresAt?: string;
  address?: string;
}

export interface WorldArtifacts {
  profile: WorldProfile;
  manifest: { contracts: unknown[] };
  policy: Record<string, unknown>;
  auth: AuthMetadata;
}

export function writeArtifacts(worldDir: string, artifacts: WorldArtifacts): void {
  mkdirSync(worldDir, { recursive: true });
  writeFileSync(path.join(worldDir, "profile.json"), JSON.stringify(artifacts.profile, null, 2));
  writeFileSync(path.join(worldDir, "manifest.json"), JSON.stringify(artifacts.manifest, null, 2));
  writeFileSync(path.join(worldDir, "policy.json"), JSON.stringify(artifacts.policy, null, 2));
  writeFileSync(path.join(worldDir, "auth.json"), JSON.stringify(artifacts.auth, null, 2));
}

export function readArtifacts(worldDir: string): WorldArtifacts {
  return {
    profile: JSON.parse(readFileSync(path.join(worldDir, "profile.json"), "utf-8")),
    manifest: JSON.parse(readFileSync(path.join(worldDir, "manifest.json"), "utf-8")),
    policy: JSON.parse(readFileSync(path.join(worldDir, "policy.json"), "utf-8")),
    auth: JSON.parse(readFileSync(path.join(worldDir, "auth.json"), "utf-8")),
  };
}

export function readAuthStatus(worldDir: string): AuthMetadata {
  const authPath = path.join(worldDir, "auth.json");
  if (!existsSync(authPath)) {
    return { url: "", status: "none", worldName: "", chain: "", createdAt: "" };
  }
  return JSON.parse(readFileSync(authPath, "utf-8"));
}

export function updateAuthStatus(worldDir: string, updates: Partial<AuthMetadata>): void {
  const current = readAuthStatus(worldDir);
  const updated = { ...current, ...updates };
  writeFileSync(path.join(worldDir, "auth.json"), JSON.stringify(updated, null, 2));
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --dir client/apps/onchain-agent test -- test/session/artifacts.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/session/artifacts.ts test/session/artifacts.test.ts
git commit -m "feat(onchain-agent): add artifact persistence layer for world sessions"
```

---

### Task 4: `axis worlds` Subcommand

Wire up world discovery as a standalone CLI subcommand with JSON output.

**Files:**
- Create: `src/commands/worlds.ts`
- Modify: `src/cli.ts` (add command routing)
- Test: `test/commands/worlds.test.ts`

**Step 1: Write the failing test**

```typescript
// test/commands/worlds.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/world/discovery", () => ({
  discoverAllWorlds: vi.fn().mockResolvedValue([
    { name: "eternum-s1", chain: "slot", status: "ongoing" },
    { name: "eternum-s2", chain: "sepolia", status: "upcoming" },
  ]),
}));

import { runWorlds } from "../../src/commands/worlds";

describe("axis worlds", () => {
  it("outputs JSON array when --json", async () => {
    const output: string[] = [];
    const code = await runWorlds({ json: true, write: (s) => output.push(s) });
    expect(code).toBe(0);
    const parsed = JSON.parse(output.join(""));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("eternum-s1");
  });

  it("outputs human-readable when no --json", async () => {
    const output: string[] = [];
    const code = await runWorlds({ json: false, write: (s) => output.push(s) });
    expect(code).toBe(0);
    expect(output.some((l) => l.includes("eternum-s1"))).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --dir client/apps/onchain-agent test -- test/commands/worlds.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/commands/worlds.ts
import { discoverAllWorlds } from "../world/discovery";

interface WorldsOptions {
  json: boolean;
  write: (s: string) => void;
}

export async function runWorlds(options: WorldsOptions): Promise<number> {
  const worlds = await discoverAllWorlds();

  if (options.json) {
    options.write(JSON.stringify(worlds, null, 2));
    return 0;
  }

  if (worlds.length === 0) {
    options.write("No active worlds found.");
    return 0;
  }

  options.write("Discovered worlds:\n");
  for (const world of worlds) {
    options.write(`  [${world.chain}] ${world.name} (${world.status})\n`);
  }
  return 0;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --dir client/apps/onchain-agent test -- test/commands/worlds.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/worlds.ts test/commands/worlds.test.ts
git commit -m "feat(onchain-agent): add axis worlds subcommand with JSON output"
```

---

### Task 5: `axis auth` Subcommand

Discover world, resolve manifest, build policies, generate auth URL, persist all artifacts. Optionally auto-approve via agent-browser.

**Files:**
- Create: `src/commands/auth.ts`
- Modify: `src/session/controller-session.ts:380-388` (suppress browser open, capture URL)
- Modify: `src/cli.ts` (add command routing)
- Test: `test/commands/auth.test.ts`

**Step 1: Write the failing test**

Test that `runAuth` calls discovery, builds profile, resolves manifest, builds policies, writes artifacts, and returns JSON with the auth URL. Mock `discoverAllWorlds`, `buildWorldProfile`, `buildResolvedManifest`, `buildSessionPoliciesFromManifest`, and `SessionProvider`.

**Step 2: Modify ControllerSession to support headless URL capture**

In `src/session/controller-session.ts`, modify the constructor to accept an `onAuthUrl?: (url: string) => void` callback. When present, patch `backend.openLink` to call this callback instead of `execFile(open, ...)`. This allows `auth` command to capture the URL without opening a browser.

Also add a `getAuthUrl()` method variant that triggers the SessionProvider but captures the URL instead of opening a browser.

**Step 3: Implement runAuth**

```typescript
// src/commands/auth.ts — core structure
import { discoverAllWorlds, buildWorldProfile, buildResolvedManifest } from "../world/discovery";
import { buildSessionPoliciesFromManifest } from "../session/controller-session";
import { writeArtifacts, updateAuthStatus } from "../session/artifacts";
import { loadConfig } from "../config";
import path from "node:path";

interface AuthOptions {
  world?: string;
  all: boolean;
  approve: boolean;
  method?: string;
  username?: string;
  password?: string;
  json: boolean;
  write: (s: string) => void;
}

export async function runAuth(options: AuthOptions): Promise<number> {
  const config = loadConfig();
  const worlds = await discoverAllWorlds();

  const targets = options.all
    ? worlds
    : worlds.filter((w) => w.name === options.world);

  if (targets.length === 0) {
    const msg = options.world
      ? `World "${options.world}" not found`
      : "No worlds discovered";
    if (options.json) {
      options.write(JSON.stringify({ error: msg }));
    } else {
      options.write(msg + "\n");
    }
    return 1;
  }

  const results = [];

  for (const world of targets) {
    const profile = await buildWorldProfile(world.chain, world.name);
    const manifest = await buildResolvedManifest(world.chain, profile);
    const policies = buildSessionPoliciesFromManifest(manifest, {
      gameName: config.gameName,
      worldProfile: profile,
    });

    const worldDir = path.join(config.sessionBasePath, world.name);

    // Create session with URL capture (not browser open)
    // ... ControllerSession with onAuthUrl callback ...
    // ... capture authUrl ...

    writeArtifacts(worldDir, {
      profile,
      manifest,
      policy: policies as Record<string, unknown>,
      auth: {
        url: authUrl,
        status: "pending",
        worldName: world.name,
        chain: world.chain,
        createdAt: new Date().toISOString(),
      },
    });

    // If --approve, run auth-approve
    if (options.approve) {
      // ... shell out to agent-browser ...
      // ... updateAuthStatus(worldDir, { status: "active", address }) ...
    }

    // Poll for approval (up to 6 min)
    // ... await session.connect() ...
    // ... updateAuthStatus on success ...

    results.push({ world: world.name, chain: world.chain, status: "pending", url: authUrl, artifactDir: worldDir });
  }

  if (options.json) {
    options.write(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
  } else {
    for (const r of results) {
      options.write(`[${r.chain}] ${r.world}: ${r.url}\n`);
    }
  }

  return 0;
}
```

**Step 4: Run tests, verify pass**

**Step 5: Wire into cli.ts**

**Step 6: Commit**

```bash
git add src/commands/auth.ts src/session/controller-session.ts src/cli.ts test/commands/auth.test.ts
git commit -m "feat(onchain-agent): add axis auth subcommand with artifact persistence"
```

---

### Task 6: `axis auth-status` and `axis auth-url` Subcommands

Simple read-only commands that read from persisted artifacts.

**Files:**
- Create: `src/commands/auth-status.ts`
- Create: `src/commands/auth-url.ts`
- Modify: `src/cli.ts` (add routing)
- Test: `test/commands/auth-status.test.ts`

**Step 1: Write failing tests**

Test `runAuthStatus` reads `auth.json` + probes session via `ControllerSession.probe()`. Test `runAuthUrl` reads `auth.json` and prints just the URL.

**Step 2: Implement**

`auth-status`: Read artifacts, create a ControllerSession from stored profile/manifest, call `probe()`. If probe returns an account, status is "active". Otherwise read auth.json status.

`auth-url`: Read `auth.json`, print `auth.url` to stdout. Exit 1 if no auth.json exists.

**Step 3: Wire into cli.ts, run tests**

**Step 4: Commit**

```bash
git add src/commands/auth-status.ts src/commands/auth-url.ts test/commands/auth-status.test.ts src/cli.ts
git commit -m "feat(onchain-agent): add axis auth-status and auth-url subcommands"
```

---

### Task 7: Auth Approve Script (agent-browser shell-out)

Implement the `--approve` flag that automates the Cartridge Controller browser auth flow via `agent-browser`.

**Files:**
- Create: `src/session/auth-approve.ts`
- Test: `test/session/auth-approve.test.ts`

**Step 1: Write failing test**

Test that `runAuthApprove` shells out to `agent-browser` commands in the correct sequence using `execFile` (NOT `exec` — see security note). Mock `node:child_process` `execFileSync` to capture commands. Test that it fails gracefully when `agent-browser` is not found.

**Step 2: Implement**

```typescript
// src/session/auth-approve.ts
import { execFileSync } from "node:child_process";

interface ApproveOptions {
  authUrl: string;
  method: string;
  username?: string;
  password?: string;
}

function agentBrowser(...args: string[]): string {
  return execFileSync("agent-browser", args, { encoding: "utf-8", timeout: 60000 });
}

export function checkAgentBrowserInstalled(): boolean {
  try {
    execFileSync("which", ["agent-browser"], { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

export async function runAuthApprove(options: ApproveOptions): Promise<void> {
  if (!checkAgentBrowserInstalled()) {
    throw new Error(
      `agent-browser not found -- install it or complete auth manually at: ${options.authUrl}`
    );
  }

  agentBrowser("open", options.authUrl);
  agentBrowser("wait", "--load", "networkidle");

  const snapshot = agentBrowser("snapshot", "-i");

  if (options.method === "password") {
    // Parse @eN refs from snapshot, fill username/password, click submit
    // Exact refs depend on Cartridge auth page structure — will need
    // refinement after testing against the real page
  }

  agentBrowser("wait", "--load", "networkidle");
  const policySnapshot = agentBrowser("snapshot", "-i");
  // Find and click approve button

  agentBrowser("close");
}
```

**Important:** Uses `execFileSync` (not `exec`) to prevent shell injection. All arguments are passed as an array.

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git add src/session/auth-approve.ts test/session/auth-approve.test.ts
git commit -m "feat(onchain-agent): add auth-approve script for automated browser auth"
```

---

### Task 8: Headless Runtime Path

Split the runtime into TUI and headless code paths. The headless path skips TUI creation, uses JsonEmitter for output, and reads artifacts from disk.

**Files:**
- Create: `src/headless.ts`
- Modify: `src/index.ts:228-555` (extract shared setup into reusable functions)
- Modify: `src/cli.ts` (route --headless to headless.ts)
- Test: `test/headless.test.ts`

**Step 1: Write failing test**

Test that `mainHeadless` reads artifacts from the world directory, creates the agent, emits a startup event to the JsonEmitter, and runs the tick loop.

**Step 2: Extract shared setup from index.ts**

Move `createRuntimeServices`, config management logic, and agent setup into functions that both `main()` (TUI) and `mainHeadless()` can call. Keep `main()` behavior identical.

**Step 3: Implement headless.ts**

Key differences from TUI path:
- No TUI creation — no `createApp()`, no `ProcessTerminal`
- Uses `JsonEmitter` for all output to stdout
- Reads artifacts from `sessionBasePath/<world>/` instead of running discovery
- Subscribes to agent events and maps them to emitter events
- Supports `--auth=privatekey` path (Task 11)
- Wires stdin reader (Task 10) and HTTP API (Task 9) if flags set

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add src/headless.ts src/index.ts src/cli.ts test/headless.test.ts
git commit -m "feat(onchain-agent): add headless runtime path with NDJSON output"
```

---

### Task 9: HTTP Steering API

Lightweight HTTP server using `node:http` for the headless runtime.

**Files:**
- Create: `src/api/server.ts`
- Test: `test/api/server.test.ts`

**Step 1: Write failing test**

Test `POST /prompt`, `GET /status`, `POST /shutdown` endpoints using `node:http` client requests to a running server.

**Step 2: Implement**

```typescript
// src/api/server.ts
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { JsonEmitter } from "../output/json-emitter";

interface ApiDeps {
  enqueuePrompt: (content: string) => Promise<void>;
  getStatus: () => Record<string, unknown>;
  getState: () => Record<string, unknown>;
  shutdown: () => Promise<void>;
  applyConfig: (changes: any[]) => Promise<any>;
  emitter: JsonEmitter;
}

export function createApiServer(deps: ApiDeps, port: number, host: string = "127.0.0.1") {
  const server = createServer(async (req, res) => {
    try {
      if (req.method === "POST" && req.url === "/prompt") {
        const body = await collectBody(req);
        const { content } = JSON.parse(body);
        await deps.enqueuePrompt(content);
        respond(res, 200, { queued: true });
      } else if (req.method === "GET" && req.url === "/status") {
        respond(res, 200, deps.getStatus());
      } else if (req.method === "GET" && req.url === "/state") {
        respond(res, 200, deps.getState());
      } else if (req.method === "GET" && req.url === "/events") {
        // SSE stream
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
        const unsub = deps.emitter.subscribe((event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        });
        req.on("close", unsub);
      } else if (req.method === "POST" && req.url === "/config") {
        const body = await collectBody(req);
        const { changes } = JSON.parse(body);
        const result = await deps.applyConfig(changes);
        respond(res, 200, result);
      } else if (req.method === "POST" && req.url === "/shutdown") {
        respond(res, 200, { ok: true });
        await deps.shutdown();
      } else {
        respond(res, 404, { error: "not found" });
      }
    } catch (err) {
      respond(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  server.listen(port, host);
  return { server, close: () => new Promise<void>((r) => server.close(() => r())) };
}

function respond(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function collectBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}
```

**Step 3: Wire into headless.ts**

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add src/api/server.ts test/api/server.test.ts src/headless.ts
git commit -m "feat(onchain-agent): add HTTP steering API for headless mode"
```

---

### Task 10: Stdin Steering

Accept JSON commands from stdin in headless mode.

**Files:**
- Create: `src/input/stdin-reader.ts`
- Modify: `src/headless.ts` (wire stdin reader)
- Test: `test/input/stdin-reader.test.ts`

**Step 1: Write failing test**

Test that `StdinReader` parses NDJSON lines and dispatches prompt/config/shutdown commands to the provided callbacks.

**Step 2: Implement**

```typescript
// src/input/stdin-reader.ts
import { createInterface } from "node:readline";

interface StdinDeps {
  enqueuePrompt: (content: string) => Promise<void>;
  applyConfig: (changes: any[]) => Promise<any>;
  shutdown: () => Promise<void>;
}

export function startStdinReader(deps: StdinDeps): () => void {
  const rl = createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    try {
      const cmd = JSON.parse(line);
      switch (cmd.type) {
        case "prompt":
          await deps.enqueuePrompt(cmd.content);
          break;
        case "config":
          await deps.applyConfig(cmd.changes);
          break;
        case "shutdown":
          await deps.shutdown();
          break;
      }
    } catch {
      // Ignore malformed lines
    }
  });
  return () => rl.close();
}
```

**Step 3: Wire into headless.ts, run tests**

**Step 4: Commit**

```bash
git add src/input/stdin-reader.ts test/input/stdin-reader.test.ts src/headless.ts
git commit -m "feat(onchain-agent): add stdin steering for headless mode"
```

---

### Task 11: Private Key Auth Path

Support `--auth=privatekey` for fully autonomous operation without Controller sessions.

**Files:**
- Create: `src/session/privatekey-auth.ts`
- Modify: `src/headless.ts` (use privatekey services when --auth=privatekey)
- Test: `test/session/privatekey-auth.test.ts`

**Step 1: Write failing test**

Test that `createPrivateKeyAccount` creates a starknet `Account` from a private key and RPC URL.

**Step 2: Implement**

```typescript
// src/session/privatekey-auth.ts
import { Account, RpcProvider } from "starknet";

export function createPrivateKeyAccount(rpcUrl: string, privateKey: string, address: string): Account {
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  return new Account(provider, address, privateKey);
}
```

Note: `address` is required — the account address must be known (can be derived from the private key or provided via env var `ACCOUNT_ADDRESS`).

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git add src/session/privatekey-auth.ts test/session/privatekey-auth.test.ts src/headless.ts
git commit -m "feat(onchain-agent): add private key auth path for headless mode"
```

---

### Task 12: Wire Everything Into cli.ts

Replace the manual arg parsing in `cli.ts` with `parseCliArgs`, route all new subcommands.

**Files:**
- Modify: `src/cli.ts:173-208`
- Modify: `test/cli/commands.test.ts`

**Step 1: Rewrite runCli routing**

Replace the `if/else` chain with a `switch` on `opts.command`. Route:
- `version` → print version
- `help` → print usage (update to show new commands)
- `doctor` → existing `runDoctor` (add `--json` support)
- `init` → existing `runInit`
- `worlds` → `runWorlds`
- `auth` → `runAuth`
- `auth-status` → `runAuthStatus`
- `auth-url` → `runAuthUrl`
- `run` + `--headless` → `mainHeadless`
- `run` (default) → existing `main`
- `unknown` → error + usage

**Step 2: Update printUsage to document all commands**

**Step 3: Update and run all tests**

Run: `pnpm --dir client/apps/onchain-agent test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/cli.ts test/cli/commands.test.ts
git commit -m "feat(onchain-agent): wire all headless subcommands into CLI router"
```

---

### Task 13: Integration Test — Full Headless Flow

End-to-end test that exercises the full pipeline: worlds → auth → headless run → stdin prompt → shutdown.

**Files:**
- Create: `test/e2e/headless-flow.test.ts`

Mock the network layer and SessionProvider but exercise the real CLI → headless → emitter → stdin pipeline.

**Step 1: Write the test**

**Step 2: Run and verify**

Run: `pnpm --dir client/apps/onchain-agent test -- test/e2e/headless-flow.test.ts`

**Step 3: Commit**

```bash
git add test/e2e/headless-flow.test.ts
git commit -m "test(onchain-agent): add headless flow integration test"
```

---

### Task 14: Update Documentation

**Files:**
- Modify: `client/apps/onchain-agent/CLAUDE.md` (add headless mode section)

**Step 1: Add headless mode section to CLAUDE.md under "Build & Run"**

Document:
- New CLI commands and flags
- Artifact directory structure
- Auth flows (session vs privatekey vs --approve)
- JSON output format
- HTTP API endpoints
- Stdin protocol
- Fleet setup example

**Step 2: Commit**

```bash
git add client/apps/onchain-agent/CLAUDE.md
git commit -m "docs(onchain-agent): document headless mode CLI and architecture"
```
