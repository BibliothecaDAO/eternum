// Orchestrator (Bun) – keeps TARGET_UPCOMING future worlds deployed/configured at fixed slots
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { generateWorldConfigCalldata } from "./config-calldata.ts";
import { generateFactoryCalldata } from "./factory-calldata.ts";

interface Params {
  chain: string;
  targetUpcoming: number;
  rpcUrl?: string;
  factoryAddress?: string;
  accountAddress?: string;
  privateKey?: string;
  adminAddress?: string;
  vrfProviderAddress?: string;
  toriiCreatorUrl?: string;
  toriiNamespaces?: string;
  cartridgeApiBase?: string;
}

const repoRoot = path.resolve(__dirname ?? import.meta.dir, "../../../");
const gameDir = path.join(repoRoot, "contracts/game");
const manifestFile = path.join(gameDir, "Scarb.toml");

const ts = () => new Date().toISOString().split("T")[1].replace("Z", "Z");
const log = (m: string) => console.log(`[${ts()}] ${m}`);
const fmt = (epoch: number) => new Date(epoch * 1000).toISOString().replace(".000Z", "Z");

function hexToAscii(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  let s = "";
  for (let i = 0; i < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16);
    if (!isNaN(byte) && byte !== 0) s += String.fromCharCode(byte);
  }
  return s;
}

function getVersion(cmd: string, args: string[] = ["--version"]): string {
  try {
    const r = spawnSync(cmd, args, { encoding: "utf-8" });
    return (r.stdout || r.stderr || "").trim();
  } catch {
    return "<unknown>";
  }
}

function redactArgs(argv: string[]): string[] {
  const a = [...argv];
  for (let i = 0; i < a.length; i++) {
    const t = a[i];
    if (t === "--private-key" && i + 1 < a.length) a[i + 1] = "<redacted>";
  }
  return a;
}

function sozo(args: string[], ctx?: { outDir?: string; label?: string }) {
  const env = { ...process.env, SCARB: process.env.SCARB || "scarb" } as NodeJS.ProcessEnv;
  const argv = ["execute", "--manifest-path", manifestFile, "-v", ...args];
  const res = spawnSync("sozo", argv, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });
  const out = (res.stdout || "") + (res.stderr || "");
  const safeCmd = `sozo ${redactArgs(argv).join(" ")}`;
  log(`sozo cmd: ${safeCmd}`);
  log(`cwd: ${repoRoot}`);
  log(`manifest: ${manifestFile}`);
  log(`scarb: ${getVersion("scarb")}`);
  log(`sozo: ${getVersion("sozo").split("\n")[0]}`);
  if (out.trim()) console.log(out.trim());
  if (res.status !== 0) {
    if (ctx?.outDir) {
      try {
        fs.mkdirSync(ctx.outDir, { recursive: true });
        fs.writeFileSync(
          path.join(ctx.outDir, `sozo_error_${ctx.label || "execute"}.log`),
          [
            `cmd: ${safeCmd}`,
            `status: ${res.status}`,
            `cwd: ${repoRoot}`,
            `manifest: ${manifestFile}`,
            `scarb: ${getVersion("scarb")}`,
            `sozo: ${getVersion("sozo").replace(/\n/g, " ")}`,
            `env.SCARB=${env.SCARB}`,
            "--- output ---",
            out,
          ].join("\n"),
        );
      } catch {}
    }
    throw new Error(`sozo failed (${res.status})`);
  }
  const m = out.match(/0x[0-9a-fA-F]+/);
  return m ? m[0] : undefined;
}

function slotsUTC(): number[] {
  const now = new Date();
  const def: Array<[number, number]> = [
    [0, 30],
    [9, 30],
    [15, 30],
    [19, 30],
  ];
  const out: number[] = [];
  for (let d = 0; d < 6; d++) {
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + d));
    for (const [h, m] of def) {
      const t = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, m, 0));
      if (t.getTime() > now.getTime()) out.push(Math.floor(t.getTime() / 1000));
    }
  }
  return out;
}

function readState(chain: string): any[] {
  const primary = path.join(repoRoot, `contracts/game/factory/${chain}/deployment.json`);
  try { return JSON.parse(fs.readFileSync(primary, "utf8")); } catch {}
  return [];
}
function writeState(chain: string, s: any[]) {
  const dir = path.join(repoRoot, `contracts/game/factory/${chain}`); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `deployment.json`), JSON.stringify(s, null, 2));
}

function genName(): string {
  const WORDS = ["fire","wave","gale","mist","dawn","dusk","rain","snow","sand","clay","iron","gold","jade","ruby","opal","rush","flow","push","pull","burn","heal","grow","fade","rise","fall","soar","dive","gate","keep","tomb","fort","maze","peak","vale","cave","rift","void","shard","rune","bold","wild","vast","pure","dark","cold","warm","soft","hard","deep","high","true","myth","epic","sage","lore","fate","doom","fury","zeal","flux","echo","nova","apex"];
  const a = WORDS[Math.floor(Math.random() * WORDS.length)];
  let b = WORDS[Math.floor(Math.random() * WORDS.length)];
  if (b === a) b = WORDS[(WORDS.indexOf(b) + 1) % WORDS.length];
  const n = Math.floor(Math.random() * 90) + 10;
  return `bltz-${a}-${b}-${n}`;
}

export async function maintainOrchestrator(p: Params) {
  const chain = p.chain;
  const target = p.targetUpcoming;
  const rpcUrl = p.rpcUrl || "";
  const factory = p.factoryAddress || "";
  const acct = p.accountAddress || "";
  const pk = p.privateKey || "";
  const admin = p.adminAddress || acct;
  if (!rpcUrl || !factory || !acct || !pk) {
    throw new Error("Missing rpcUrl/factoryAddress/accountAddress/privateKey for orchestrator maintenance");
  }
  const state0 = readState(chain).filter((e) => e.slotTimestamp >= Math.floor(Date.now()/1000));
  let state = state0;
  const upcoming = slotsUTC();
  log(`Orchestrator start | chain=${chain} target=${target}`);
  log(`Existing future entries: ${state0.length}`);
  const used = new Set(state.map((e) => e.slotTimestamp));
  let added = 0;
  for (const ts of upcoming) {
    if (state.length >= target) break;
    if (!used.has(ts)) {
      state.push({ name: genName(), slotTimestamp: ts, deployed: false, configured: false, indexed: false });
      used.add(ts);
      added++;
    }
  }
  log(`Top-up added: ${added}, total planned: ${state.length}`);
  state.sort((a, b) => a.slotTimestamp - b.slotTimestamp);
  writeState(chain, state);

  // Phase 1: Deploy all that need deploying
  log(`\n--- Phase 1: Deploy ---`);
  for (const entry of state) {
    if (entry.deployed) continue;
    const name = entry.name as string;
    const startTs = entry.slotTimestamp as number;
    log(`World ${name} @ ${fmt(startTs)} | Deploy`);
    await generateFactoryCalldata({
      chain,
      worldName: name,
      version: process.env.VERSION || "180",
      namespace: process.env.NAMESPACE || "s1_eternum",
      maxActions: Number(process.env.MAX_ACTIONS || 300),
      defaultNamespaceWriterAll: (process.env.DEFAULT_NAMESPACE_WRITER_ALL || "1") === "1",
    });
    const deployPath = path.join(repoRoot, `contracts/game/factory/${chain}/calldata/${name}/deploy_calldata.txt`);
    if (!fs.existsSync(deployPath)) throw new Error(`Missing deploy calldata: ${deployPath}`);
    const args = (await Bun.file(deployPath).text()).trim().split(/\s+/);
    log(`Deploy calldata file: ${deployPath}`);
    log(`Deploy calldata: ${args.join(" ")}`);
    let depHash: string | undefined;
    try {
      depHash = sozo([
        "--profile", chain,
        "--rpc-url", rpcUrl,
        "--account-address", acct,
        "--private-key", pk,
        factory,
        "deploy",
        ...args,
      ], { outDir: path.join(repoRoot, `contracts/game/factory/${chain}/calldata/${name}`), label: "deploy" });
    } catch (e) {
      // Fallback: retry with sstr if first arg is hex felt
      if (args[0] && /^0x[0-9a-fA-F]+$/.test(args[0])) {
        const ascii = hexToAscii(String(args[0]));
        const retryArgs = [
          ...["--profile", chain, "--rpc-url", rpcUrl, "--account-address", acct, "--private-key", pk],
          factory, "deploy", `sstr:'${ascii}'`, ...args.slice(1),
        ];
        log(`Primary deploy failed; retrying with sstr:'${ascii}'`);
        depHash = sozo(retryArgs, { outDir: path.join(repoRoot, `contracts/game/factory/${chain}/calldata/${name}`), label: "deploy_retry_sstr" });
      } else {
        throw e;
      }
    }
    log(`Deployed: tx=${depHash ?? '<unknown>'}`);
    entry.deployed = true; writeState(chain, state);
  }

  // Phase 2: Configure all deployed worlds that need it
  log(`\n--- Phase 2: Configure ---`);
  for (const entry of state) {
    if (!entry.deployed || entry.configured) continue;
    const name = entry.name as string;
    const startTs = entry.slotTimestamp as number;
    log(`World ${name} @ ${fmt(startTs)} | Configure`);
    await generateWorldConfigCalldata({
      chain,
      worldName: name,
      adminAddress: admin,
      startMainAt: startTs,
      vrfProviderAddress: p.vrfProviderAddress || undefined,
      cartridgeApiBase: p.cartridgeApiBase || "https://api.cartridge.gg",
    });
    const cfgPath = path.join(repoRoot, `contracts/game/factory/${chain}/calldata/${name}/world_config_multicall.txt`);
    if (!fs.existsSync(cfgPath)) throw new Error(`Missing config multicall: ${cfgPath}`);
    const payload = (await Bun.file(cfgPath).text()).trim().split(/\s+/);
    const cfgHash = sozo([
      "--profile", chain,
      "--rpc-url", rpcUrl,
      "--account-address", acct,
      "--private-key", pk,
      ...payload,
    ], { outDir: path.join(repoRoot, `contracts/game/factory/${chain}/calldata/${name}`), label: "configure" });
    log(`Configured: tx=${cfgHash ?? '<unknown>'}`);
    entry.configured = true; writeState(chain, state);
  }

  // Phase 3: Create Torii for all configured worlds
  log(`\n--- Phase 3: Torii ---`);
  for (const entry of state) {
    if (!entry.configured || entry.indexed) continue;
    const name = entry.name as string;
    const startTs = entry.slotTimestamp as number;
    const base = path.join(repoRoot, `contracts/game/factory/${chain}/calldata/${name}`);
    let world = ""; try { world = await Bun.file(path.join(base, `world_address.txt`)).text(); } catch {}
    if (world) {
      const tc = p.toriiCreatorUrl || "https://torii-creator.zerocredence.workers.dev/dispatch/torii";
      const ns = p.toriiNamespaces || "s1_eternum";
      log(`World ${name} @ ${fmt(startTs)} | Torii create`);
      const curl = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", "POST",
        `${tc}?env=${chain}&rpc_url=${rpcUrl}&torii_namespaces=${ns}&torii_prefix=${name}&torii_world_address=${world.trim()}`], { encoding: "utf-8" });
      const code = (curl.stdout || "").trim();
      log(`Torii HTTP: ${code || '<unknown>'}`);
    } else {
      log(`World ${name} | No world address found; skipping Torii`);
    }
    entry.indexed = true; writeState(chain, state);
  }
  log(`\nSummary: total planned=${state.length}, deployed=${state.filter(e=>e.deployed).length}, configured=${state.filter(e=>e.configured).length}, indexed=${state.filter(e=>e.indexed).length}`);
}
