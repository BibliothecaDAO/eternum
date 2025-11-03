// Orchestrator cleanup – remove Torii for stale worlds and prune deployment.json
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

interface Params {
  chain: string;
  retentionHours: number;
  deleteAll?: boolean;
}

const repoRoot = path.resolve(__dirname ?? import.meta.dir, "../../../");

const ts = () => new Date().toISOString().split("T")[1].replace("Z", "Z");
const log = (m: string) => console.log(`[${ts()}] ${m}`);

function readDeployment(chain: string): any[] {
  const file = path.join(repoRoot, `contracts/game/factory/${chain}/deployment.json`);
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
}

function writeDeployment(chain: string, s: any[]) {
  const dir = path.join(repoRoot, `contracts/game/factory/${chain}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `deployment.json`), JSON.stringify(s, null, 2));
}

function slotDeleteTorii(projectName: string): { ok: boolean; code: number; out: string } {
  // Prefer the short form alias `slot d delete <project> torii -f`
  const res = spawnSync("slot", ["d", "delete", projectName, "torii", "-f"], { encoding: "utf-8" });
  const code = typeof res.status === "number" ? res.status : 1;
  const out = `${res.stdout || ""}${res.stderr || ""}`.trim();
  if (code === 0) return { ok: true, code, out };
  // Consider "not found" semantics as success to be idempotent
  const text = out.toLowerCase();
  const idempotent = text.includes("not found") || text.includes("no such") || text.includes("does not exist");
  return { ok: idempotent, code, out };
}

export async function cleanupOrchestrator(p: Params) {
  const chain = p.chain;
  const cutoff = Math.floor(Date.now() / 1000) - p.retentionHours * 3600;
  const state = readDeployment(chain);
  if (!Array.isArray(state) || state.length === 0) {
    log(`No deployments found for chain=${chain}`);
    return;
  }
  const targets = p.deleteAll ? state : state.filter((e) => Number(e?.slotTimestamp) > 0 && Number(e.slotTimestamp) <= cutoff);
  if (targets.length === 0) { log("No entries to delete."); return; }

  log(p.deleteAll
    ? `Found ${targets.length} entries to delete (delete-all).`
    : `Found ${targets.length} stale entries (<= ${p.retentionHours}h ago).`);
  const toRemove: any[] = [];
  for (const entry of targets) {
    const name = entry?.name as string;
    if (!name) continue;
    const del = slotDeleteTorii(name);
    log(`slot delete ${name} -> ${del.ok ? "OK" : "FAIL"} (code=${del.code})`);
    if (del.ok) toRemove.push(entry);
  }
  const removeSet = new Set(toRemove.map((e) => e));
  const keep = state.filter((e) => !removeSet.has(e));
  writeDeployment(chain, keep);
  // Wipe calldata folders for successfully removed worlds
  for (const entry of toRemove) {
    const name = entry?.name as string;
    if (!name) continue;
    const dir = path.join(repoRoot, `contracts/game/factory/${chain}/calldata/${name}`);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      log(`Removed calldata directory: ${dir}`);
    } catch (err: any) {
      log(`Failed to remove calldata for ${name}: ${err?.message || String(err)}`);
    }
  }
  log(`Cleanup done. Removed ${toRemove.length} entries; remaining ${keep.length}.`);
}

// Allow running directly with Bun
if (import.meta.main) {
  const args = new Map<string, string>();
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args.set(k, v);
    }
  }
  const chain = args.get("chain") || "slot";
  const retention = Number(args.get("retention-hours") || 10);
  const delAll = args.has("all") || args.get("all") === "true";
  cleanupOrchestrator({ chain, retentionHours: retention, deleteAll: delAll }).catch((e) => {
    console.error(e?.stack || String(e));
    process.exit(1);
  });
}

