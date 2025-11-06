// Orchestrator cleanup – remove Torii for stale worlds and prune deployment.json
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { readArchive, writeArchive, calldataDir } from "./io.ts";

interface Params {
  chain: string;
  retentionHours: number;
  deleteAll?: boolean;
}

const repoRoot = path.resolve(__dirname ?? import.meta.dir, "../../../");

const ts = () => new Date().toISOString().split("T")[1].replace("Z", "Z");
const log = (m: string) => console.log(`[${ts()}] ${m}`);

// read/write of archive handled via shared io.ts helpers

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
  // Perform deletion using the archive (old-deployments.json) as the source of truth.
  // Archiving of past deployments is handled by the maintain script.
  const archive = readArchive(chain);
  if (!Array.isArray(archive) || archive.length === 0) {
    log("Nothing in old-deployments.json to cleanup.");
    return;
  }

  log(`Cleaning up ${archive.length} archived entries from old-deployments.json`);
  const successfullyDeleted: any[] = [];
  for (const entry of archive) {
    const name = entry?.name as string;
    if (!name) continue;
    const del = slotDeleteTorii(name);
    log(`slot delete ${name} -> ${del.ok ? "OK" : "FAIL"} (code=${del.code})`);
    if (del.ok) successfullyDeleted.push(entry);
  }

  // Remove successfully deleted from archive
  if (successfullyDeleted.length > 0) {
    const successSet = new Set(successfullyDeleted.map((e) => e));
    const remaining = archive.filter((e) => !successSet.has(e));
    writeArchive(chain, remaining);

    // Wipe calldata folders for successfully removed worlds
    for (const entry of successfullyDeleted) {
      const name = entry?.name as string;
      if (!name) continue;
      const dir = calldataDir(chain, name);
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        log(`Removed calldata directory: ${dir}`);
      } catch (err: any) {
        log(`Failed to remove calldata for ${name}: ${err?.message || String(err)}`);
      }
    }
  }

  log(
    `Cleanup done. Deleted ${successfullyDeleted.length} archived entries; ` +
      `${readArchive(chain).length} archived remain.`,
  );
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
