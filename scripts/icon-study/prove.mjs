import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const repo = fileURLToPath(new URL("../../", import.meta.url));
const evidence = resolve(process.argv[2] ?? ".context/icon-study-evidence");
const run = `${evidence}/proof-${new Date().toISOString().replaceAll(":", "-")}`;
await mkdir(run, { recursive: true });
await exec("python3", [`${repo}/scripts/icon-study/inventory.py`, `${evidence}/inventory`]);
await exec(process.execPath, [`${repo}/scripts/icon-study/verify.mjs`, `${run}/raster`]);
await exec(process.execPath, [`${repo}/scripts/icon-study/build.mjs`, `${evidence}/viewer`]);
const browserName = `icons-${process.pid}`;
const log = [];
const assertions = [];
const server = spawn(process.execPath, [`${repo}/scripts/icon-study/serve.mjs`, evidence], {
  stdio: ["ignore", "pipe", "pipe"],
});
const ready = new Promise((resolveReady, reject) => {
  server.stdout.once("data", resolveReady);
  server.once("error", reject);
  server.once("exit", (code) => reject(new Error(`Picker server exited ${code}`)));
});
try {
  await ready;
  await browser("open", "http://127.0.0.1:4193/viewer/");
  await browser("set", "viewport", "1440", "1100");
  await browser("wait", ".sample");
  await browser("eval", "document.fonts.ready.then(() => true)");
  await check(
    "Three theme columns and 107 icons each",
    "document.querySelectorAll('.theme').length === 3 && [...document.querySelectorAll('.theme')].every(t => t.querySelectorAll('.sample').length === 107)",
  );
  await check(
    "Every theme renders all 58 resources",
    "[...document.querySelectorAll('.theme')].every(t => t.querySelectorAll('.sample[data-icon^=resource-]').length === 58)",
  );
  await check(
    "All SVG references resolve",
    "[...document.querySelectorAll('svg use')].every(u => document.getElementById(u.getAttribute('href').slice(1)))",
  );
  for (const size of [16, 24, 32]) {
    await browser("click", `[data-size='${size}']`);
    await check(
      `${size}px uses exact CSS width`,
      `document.querySelector('.sample .icon').getBoundingClientRect().width === ${size}`,
    );
    await check(
      `${size}px Blitz contains 20 structures per theme`,
      "document.querySelectorAll('.minimap .marker[data-army=false]').length === 60",
    );
    await browser("screenshot", `${run}/blitz-${size}.png`, "--full");
    if (size !== 24) {
      for (const [group, index] of [
        ["resources", 1],
        ["relics", 3],
      ]) {
        await browser("scrollintoview", `.theme[data-theme='survey'] .catalog-group:nth-of-type(${index})`);
        await browser("screenshot", `${run}/${group}-${size}.png`);
      }
    }
    await browser("click", "[data-density='220']");
    await check(
      `${size}px Eternum contains 220 structures and 12 armies per theme`,
      "document.querySelectorAll('.minimap .marker[data-army=false]').length === 660 && document.querySelectorAll('.minimap .marker[data-army=true]').length === 36",
    );
    await browser("screenshot", `${run}/eternum-${size}.png`);
    await browser("click", "[data-density='20']");
  }
  await browser("click", "[data-size='16']");
  await browser("click", "#labels");
  await check(
    "Blind comparison hides names",
    "getComputedStyle(document.querySelector('.sample .name')).visibility === 'hidden'",
  );
  await browser("click", ".sample[data-theme='banner'][data-icon='mine']");
  await browser("fill", "#reading", "a mine entrance");
  await browser("click", "#reveal");
  await check(
    "Reveal names exact selected meaning and retains reading",
    "document.querySelector('#intended').textContent.includes('A mine entrance') && document.querySelectorAll('#readings li').length === 1",
  );
  await browser("screenshot", `${run}/reading.png`);
  await browser("download", "#download", `${run}/readings.json`);
  const readings = JSON.parse(await readFile(`${run}/readings.json`, "utf8"));
  if (readings[0]?.observed !== "a mine entrance" || readings[0]?.icon !== "mine")
    throw new Error("Downloaded readings differ from entered text");
  assertions.push({ message: "Download retains entered text and sample identity", pass: true });
  await browser("check", "input[value='banner']");
  await check(
    "Theme choice shows the selected direction",
    "document.querySelector('#selection').textContent === 'Selected for review: Banner.'",
  );
  await browser("click", "#labels");
  await browser("set", "viewport", "390", "844");
  await browser("scrollintoview", "header");
  await check("Phone has no page overflow", "document.documentElement.scrollWidth <= innerWidth");
  await browser("screenshot", `${run}/phone.png`);
  await browser("set", "viewport", "1440", "1100");
  await browser("click", "nav a");
  await browser("wait", "figure");
  await check(
    "Inventory link opens the existing source contact sheet",
    "document.querySelectorAll('figure').length === 26 && [...document.images].every(image => image.complete && image.naturalWidth > 0)",
  );
  await browser("screenshot", `${run}/existing-styles.png`, "--full");
  for (const file of (await readdir(run)).filter((file) => file.endsWith(".png"))) {
    const stats = await sharp(`${run}/${file}`).stats();
    if (stats.channels.every((channel) => channel.stdev < 5)) throw new Error(`Blank screenshot: ${file}`);
  }
  assertions.push({ message: "Every screenshot contains visible content", pass: true });
  await browser("open", `file://${evidence}/viewer/index.html`);
  await browser("wait", ".sample");
  await check(
    "Picker opens directly from disk without a server",
    "document.querySelectorAll('.sample').length === 321",
  );
  await browser("click", "[data-size='32']");
  await check("Offline controls work", "document.querySelector('.sample .icon').getBoundingClientRect().width === 32");
  const errors = await browser("errors", "--json");
  await writeFile(`${run}/errors.json`, errors);
  const errorData = JSON.parse(errors);
  if (errorData.data?.errors?.length) throw new Error("Browser reports page errors");
  await writeFile(
    `${run}/assertions.json`,
    JSON.stringify(
      {
        assertions,
        note: "One fixture run; entered reading verifies interaction only, not human recognition. No performance timing.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ run, passed: assertions.length }));
} catch (error) {
  await writeFile(`${run}/assertions.json`, JSON.stringify({ assertions, failure: String(error) }, null, 2));
  throw error;
} finally {
  try {
    await browser("close");
  } finally {
    server.kill("SIGTERM");
    if (server.exitCode === null) await new Promise((resolveExit) => server.once("exit", resolveExit));
    await writeFile(`${run}/transcript.json`, JSON.stringify(log, null, 2));
  }
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
