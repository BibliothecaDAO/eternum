import { mkdir, writeFile, readFile, readdir, open } from "node:fs/promises";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
const exec = promisify(execFile);
const repo = fileURLToPath(new URL("../../", import.meta.url));
const evidence = resolve(process.argv[2] ?? ".context/icon-study-evidence");
const run = `${evidence}/lab-proof-${new Date().toISOString().replaceAll(":", "-")}`;
await mkdir(run, { recursive: true });
await exec(process.execPath, [`${repo}/scripts/icon-study/paint-build.mjs`]);
const url = "https://127.0.0.1:4193/lab/kit/icons";
try {
  await exec("curl", ["-kfSs", url]);
} catch {
  const log = await open(`${run}/dev.log`, "w");
  const server = spawn("pnpm", ["--dir", "apps/game", "dev", "--host", "127.0.0.1", "--port", "4193"], {
    cwd: repo,
    detached: true,
    stdio: ["ignore", log.fd, log.fd],
  });
  server.unref();
  await writeFile(`${run}/server.pid`, String(server.pid));
  await log.close();
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await exec("curl", ["-kfSs", url]);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  if (!ready) throw new Error(`Client did not start; inspect ${run}/dev.log`);
}
const browserName = `icons-${process.pid}`;
const log = [],
  assertions = [];
try {
  await browser("open", url, "--ignore-https-errors");
  await browser("set", "viewport", "1440", "1100");
  await browser("wait", ".icon-card");
  await browser("eval", "document.fonts.ready.then(() => true)");
  await check("Shipped view compares all 52 candidates", "document.querySelectorAll('.icon-card').length===52");
  for (const direction of ["shipped", "grounded", "faceted"]) {
    await browser("click", `[data-art-choice='${direction}']`);
    await browser("eval", "Promise.all([...document.images].map(i=>i.decode())).then(()=>true)");
    await check(`${direction} images load`, "[...document.images].every(i=>i.complete && i.naturalWidth>0)");
    await check(
      `${direction} updates real price chips`,
      direction === "shipped"
        ? "document.querySelector('.icon-stores img').getAttribute('src')==='/image-icons/kit/wheat.png'"
        : `document.querySelector('.icon-stores img').getAttribute('src')==='/lab-icons/new/${direction}/32/wheat.png'`,
    );
    if (direction !== "shipped")
      await check(
        `${direction} preserves painted button colour`,
        "getComputedStyle(document.querySelector('.icon-order-bar .frontier-primary img')).filter === 'none'",
      );
    await browser("scrollintoview", ".icon-lab>header");
    await browser("screenshot", `${run}/${direction}-live.png`);
    for (const size of [24, 32, 64]) {
      await browser("click", `[data-size='${size}']`);
      await check(
        `${direction} pairs at ${size}px`,
        `[...document.querySelectorAll('.icon-pair img')].every(i=>i.getBoundingClientRect().width===${size} && i.getBoundingClientRect().height===${size})`,
      );
      await browser("scrollintoview", "[data-family='Resources']");
      await browser("screenshot", `${run}/${direction}-resources-${size}.png`);
    }
    if (direction !== "shipped")
      for (const family of ["Troops", "Structures", "Actions", "Statuses", "HUD"]) {
        await browser("scrollintoview", `[data-family='${family}']`);
        await browser("screenshot", `${run}/${direction}-${family.toLowerCase()}-64.png`);
      }
  }
  await browser("click", ".icon-order-bar .frontier-primary");
  await check(
    "Confirming explore spends fixture supplies",
    "document.querySelector('#action-result').textContent==='Explore confirmed · 30 stamina and 100 wheat spent.' && document.querySelector('.icon-stores [aria-label=\"2,300 wheat\"]') !== null",
  );
  for (const size of [12, 16]) {
    await browser("click", `[data-marker-size='${size}']`);
    await check(
      `${size}px emblems`,
      `[...document.querySelectorAll('.icon-marker img')].every(i=>i.getBoundingClientRect().width===${size})`,
    );
    await check(
      "Detailed map includes 20 sites and 6 armies",
      "document.querySelectorAll('.icon-marker-wrap[data-army=false]').length===20 && document.querySelectorAll('.icon-marker-wrap[data-army=true]').length===6",
    );
    await browser("scrollintoview", ".icon-minimap");
    await browser("screenshot", `${run}/minimap-${size}.png`);
  }
  await browser("click", "[data-density='220']");
  await check(
    "Grouped map preserves 220 sites and 18 armies",
    "document.querySelectorAll('.icon-cluster').length===12 && [...document.querySelectorAll('.icon-cluster')].reduce((n,e)=>n+Number(e.dataset.sites),0)===220 && [...document.querySelectorAll('.icon-cluster')].reduce((n,e)=>n+Number(e.dataset.armies),0)===18",
  );
  await browser("screenshot", `${run}/minimap-grouped.png`);
  const cluster = JSON.parse(
    await browser(
      "eval",
      "({sites:Number(document.querySelector('.icon-cluster').dataset.sites),armies:Number(document.querySelector('.icon-cluster').dataset.armies)})",
      "--json",
    ),
  ).data.result;
  await browser("click", ".icon-cluster[data-sector='0']");
  await check(
    "Sector opens every counted entity",
    `document.querySelectorAll('.icon-marker-wrap[data-army=false]').length===${cluster.sites} && document.querySelectorAll('.icon-marker-wrap[data-army=true]').length===${cluster.armies}`,
  );
  await browser("screenshot", `${run}/minimap-sector.png`);
  await browser("click", "#labels");
  await check(
    "Hide labels removes names and verdicts",
    "[...document.querySelectorAll('.icon-meaning')].every(e=>getComputedStyle(e).visibility==='hidden') && [...document.querySelectorAll('.icon-pair img')].every(i=>i.alt==='Unlabelled icon')",
  );
  await browser("click", ".icon-card[data-icon='stone'] .read-icon");
  await browser("fill", "#reading", "a pale stone block");
  await browser("click", "#reveal");
  await check(
    "Reading retained and meaning revealed",
    "document.querySelector('#readings').textContent==='a pale stone block → Stone (faceted)'",
  );
  await browser("download", "#download", `${run}/readings.json`);
  const readings = JSON.parse(await readFile(`${run}/readings.json`, "utf8"));
  if (readings[0]?.observed !== "a pale stone block" || readings[0]?.icon !== "stone")
    throw new Error("Reading download mismatch");
  await browser("screenshot", `${run}/reading.png`);
  await browser("click", "#close-reading");
  await check("Reading panel closes", "document.querySelector('.icon-reading') === null");
  await browser("click", "#labels");
  await browser("set", "viewport", "390", "844");
  await browser("scrollintoview", ".icon-lab>header");
  await check(
    "Phone has no page overflow",
    "document.documentElement.scrollWidth<=innerWidth && document.querySelector('.lab-tool').scrollWidth<=innerWidth",
  );
  await browser("screenshot", `${run}/phone.png`);
  const errors = await browser("errors", "--json");
  await writeFile(`${run}/errors.json`, errors);
  if (JSON.parse(errors).data?.errors?.length) throw new Error("Browser page errors");
  for (const file of (await readdir(run)).filter((file) => file.endsWith(".png"))) {
    const stats = await sharp(`${run}/${file}`).stats();
    if (stats.channels.every((channel) => channel.stdev < 5)) throw new Error(`Blank capture ${file}`);
  }
  assertions.push({ message: "Screenshots contain visible content; downloaded reading matches input", pass: true });
  await writeFile(
    `${run}/assertions.json`,
    JSON.stringify(
      {
        url,
        assertions,
        note: "One fixture run; interaction checks do not establish human recognition. No performance timings.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ run, url, passed: assertions.length }));
} catch (error) {
  await writeFile(`${run}/assertions.json`, JSON.stringify({ assertions, failure: String(error) }, null, 2));
  throw error;
} finally {
  await browser("close");
  await writeFile(`${run}/transcript.json`, JSON.stringify(log, null, 2));
}
async function browser(...args) {
  const { stdout, stderr } = await exec("npx", ["-y", "agent-browser", "--session", browserName, ...args], {
    cwd: evidence,
    maxBuffer: 4 * 1024 * 1024,
  });
  log.push({ command: args, stdout, stderr });
  return stdout;
}
async function check(message, expression) {
  const output = JSON.parse(await browser("eval", expression, "--json"));
  const pass = output.data?.result === true;
  assertions.push({ message, pass });
  if (!pass) throw new Error(`${message}: ${JSON.stringify(output)}`);
}
