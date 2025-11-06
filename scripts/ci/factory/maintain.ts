// Orchestrator (Bun) – keeps TARGET_UPCOMING future worlds deployed/configured at fixed slots
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { generateWorldConfigCalldata } from "./config-calldata.ts";
import { generateFactoryCalldata } from "./factory-calldata.ts";
import { readArchive, readDeployment, writeArchive, writeDeployment } from "./io.ts";

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

function sozo(args: string[]) {
  const env = { ...process.env, SCARB: process.env.SCARB || "scarb" } as NodeJS.ProcessEnv;
  const res = spawnSync("sozo", ["execute", "--manifest-path", manifestFile, ...args], {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });
  const out = (res.stdout || "") + (res.stderr || "");
  if (out.trim()) console.log(out.trim());
  if (res.status !== 0) throw new Error(`sozo failed (${res.status})`);
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

// read/write of deployment and archive state factored into io.ts

function genName(): string {
  const WORDS = [
    // original set
    "fire","wave","gale","mist","dawn","dusk","rain","snow","sand","clay","iron","gold","jade","ruby","opal","rush","flow","push","pull","burn","heal","grow","fade","rise","fall","soar","dive","gate","keep","tomb","fort","maze","peak","vale","cave","rift","void","shard","rune","bold","wild","vast","pure","dark","cold","warm","soft","hard","deep","high","true","myth","epic","sage","lore","fate","doom","fury","zeal","flux","echo","nova","apex",
    // expanded set (no repeats)
    "ember","blaze","flame","spark","cinder","ash","soot","smoke","steam","vapor","cloud","storm","squall","gust","breeze","zephyr","tempest","cyclone","typhoon","monsoon","deluge","torrent","flood","surge","tide","surf","foam","spray","haze","fog","drift",
    "river","brook","creek","spring","lake","pond","sea","ocean","bay","gulf","reef","shoal","dune","delta","fjord",
    "stone","rock","boulder","pebble","gravel","soil","loam","mud","mire","bog","swamp","marsh","fen","moss","root","bark","leaf","thorn","bloom","bud","seed","vine","ivy","fern","grove","glade","woods","forest","jungle","thicket","copse","meadow","prairie","steppe","field","plain","plateau","ridge","cliff","bluff","crag","spire","pinnacle","pillar","arch","bridge","causeway",
    "hill","mount","summit","crest","crown","vertex","horn","abutment",
    "sky","star","moon","sun","aurora","comet","meteor","galaxy","nebula","cosmos","ether","aether","astral","eclipse","solstice","equinox","zenith","nadir","horizon",
    "light","glow","gleam","glint","shine","flare","beam","ray","lumen","shadow","shade","gloom","murk","dim","glimmer","shimmer","sparkle",
    "copper","bronze","silver","platinum","steel","nickel","cobalt","chrome","mercury","lead","tin","brass","diamond","pearl","sapphire","emerald","topaz","amethyst","onyx","obsidian","quartz","crystal","amber","garnet","tourmaline","peridot","citrine","aquamarine","beryl","agate","jasper",
    "arcane","mystic","eldritch","sigil","ward","charm","hex","oath","boon","bane","curse","spell","spirit","wisp","ghost","specter","phantom","sprite","fae","faery","totem","relic","idol","cairn","barrow","mound","crypt","sepulcher","ossuary","catacomb","shrine","altar","temple",
    "titan","giant","dragon","drake","wyrm","leviathan","kraken","hydra","chimera","phoenix","griffin","wyvern","basilisk","sphinx","minotaur","gorgon","pegasus","yeti",
    "castle","citadel","bastion","bulwark","rampart","trench","moat","wall","tower","stronghold","outpost","camp","encampment","redoubt","keepfast",
    "march","charge","leap","dash","surge","sprint","stride",
    "hope","glory","pride","honor","valor","virtue","wrath","envy","greed","zephyrum","ire","rage","calm","peace","war","strife","truce","vigor","grit","nerve",
    "frost","ice","glacier","tundra","polar","boreal","hail","sleet","icicle","permafrost",
    "crimson","scarlet","amber","azure","cobalt","cyan","teal","violet","purple","indigo","magenta","pink","rose","ivory","ebony","umber","ochre","sable","vermilion","cerulean","chartreuse","turquoise","maroon","coral","peach","mint","olive","navy",
    "wolf","fox","bear","elk","stag","deer","boar","lion","tiger","panther","lynx","hawk","falcon","eagle","raven","crow","rook","owl","dove","swan","crane","heron","lark","wren","kite","viper","adder","cobra","python","salmon","trout","shark","whale","manta","ray","otter","seal","walrus","orca","narwhal","moth","bee","wasp","ant","scarab","stagbeetle",
    "thunder","lightning","bolt","thunderhead","boom","rumble","roar","clap",
    "portal","nexus","breach","fissure","crack","chasm","abyss","trench","gorge","canyon","gulch","ravine","riftway","runegate",
    "ford","crossing","pass","gap","notch","saddle",
    "emberfall","stormwake","frostvale","shadowfen","moonveil","sunspire","starfall","dawngate","duskvale","mistwood","ironhold","goldhaven","jadecrest","opalreach","rubyshore",
    "thornwall","vinegate","stonehearth","rockfall","riverbend","brookmere","lakewatch","seabreak","oceanreach","reefcrest","shoalside",
    "quarry","foundry","forge","anvil","kiln","smelter","loom","mill","granary","bakery","brewery","winery","distillery",
    "warden","keeper","watch","sentinel","vanguard","harbinger","herald","oracle","seer","prophet","sagewood",
    "wander","roam","quest","venture","odyssey","journey","pilgrim","nomad","ranger","scout",
    "harbor","quay","dock","pier","wharf","jetty","moorage","anchorage",
    "aven","way","path","trail","track","road","lane","causey","byway","highway","skyway",
    "lumenvault","gloomreach","voidspire","shardkeep","runeforge","stormgate","frostgate","flamegate",
    "suncrest","mooncrest","starcrest","skytide","seamist","snowveil","rainfall","sandstorm",
    "hearth","homestead","freehold","stead","manor","hall","lodge","abbey","monastery",
    "oraclegate","zealot","paragon","arbiter","warlord","chieftain","suzerain","thane","reeve","marshal",
    "sentience","aegis","bulwarkum","bastille","citadelum","arcanum","sanctum","nexusum","atrium","orium",
    // terrain and niche features
    "heath","moor","downs","wold","fell","tor","knoll","butte","mesa","badland","outwash","moraine","drumlin","esker",
    "glen","valecrest","ravenswood","eaglecrest","liongate","wolfden","foxglove","bearclaw","tigerfang","serpentis",
  ];
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
  const nowEpoch = Math.floor(Date.now()/1000);
  const existing = readDeployment(chain);
  // Move past entries to the archive instead of silently dropping them
  const past = existing.filter((e) => Number(e?.slotTimestamp) > 0 && Number(e.slotTimestamp) < nowEpoch);
  if (past.length > 0) {
    const archive = readArchive(chain);
    const byName = new Map<string, any>(archive.map((e) => [e?.name as string, e]));
    const toAppend = past
      .filter((e) => e && e.name && !byName.has(e.name))
      .map((e) => ({ ...e, archivedAt: nowEpoch }));
    if (toAppend.length > 0) {
      writeArchive(chain, [...archive, ...toAppend]);
      log(`Archived ${toAppend.length} past entries to old-deployments.json`);
    }
  }
  // Keep only future entries in the active state file
  const state0 = existing.filter((e) => e.slotTimestamp >= nowEpoch);
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
  writeDeployment(chain, state);

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
    const depHash = sozo([
      "--profile", chain,
      "--rpc-url", rpcUrl,
      "--account-address", acct,
      "--private-key", pk,
      factory,
      "deploy",
      ...args,
    ]);
    log(`Deployed: tx=${depHash ?? '<unknown>'}`);
    entry.deployed = true; writeDeployment(chain, state);
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
    ]);
    log(`Configured: tx=${cfgHash ?? '<unknown>'}`);
    entry.configured = true; writeDeployment(chain, state);
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
    entry.indexed = true; writeDeployment(chain, state);
  }
  log(`\nSummary: total planned=${state.length}, deployed=${state.filter(e=>e.deployed).length}, configured=${state.filter(e=>e.configured).length}, indexed=${state.filter(e=>e.indexed).length}`);
}
