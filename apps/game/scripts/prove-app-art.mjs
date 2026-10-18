import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBrowserSession } from "./client-playtest/browser-session.mjs";

const option = (key, fallback) => (process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback);
const out = option("--out", ".context/app-art-" + Date.now());
const port = option("--port", "4199");
mkdirSync(out, { recursive: false });
const profile = mkdtempSync(join(tmpdir(), "app-art-proof-"));
const browser = createBrowserSession("app-art-" + Date.now(), { profile, headed: false });
const records = [];
let log = "";
const server = spawn("pnpm", ["dev", "--host", "127.0.0.1", "--port", port, "--strictPort"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (chunk) => {
  log += chunk;
});
server.stderr.on("data", (chunk) => {
  log += chunk;
});
const check = (value, reason) => {
  if (!value) throw new Error(reason);
};
const lab = `https://127.0.0.1:${port}/lab/kit/app-art?capture=1`;
try {
  const deadline = Date.now() + 30_000;
  while (!log.includes("Local:")) {
    check(server.exitCode === null && Date.now() < deadline, log || "Client did not start");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  browser.run(["open", lab, "--ignore-https-errors"]);
  browser.run(["set", "viewport", "1920", "1080"]);
  browser.run([
    "wait",
    "--fn",
    "document.querySelectorAll('[data-app-art] img').length === 4 && [...document.querySelectorAll('[data-app-art] img')].every(i=>i.complete && i.naturalWidth > 0)",
  ]);
  const comparisons = browser.read(
    "JSON.stringify([...document.querySelectorAll('[data-art-study]')].map(s=>({id:s.dataset.artStudy,images:[...s.querySelectorAll('img')].map(i=>({src:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight}))})))",
  );
  for (const study of comparisons) {
    check(study.images.length === 2 && study.images.some((i) => i.src.includes(study.id)), "Missing painting pair");
    browser.run(["eval", `document.querySelector('[data-art-study="${study.id}"]').scrollIntoView({block:'start'})`]);
    browser.screenshot(join(out, `${study.id}-comparison.png`));
  }
  records.push({ comparison: comparisons });
  for (const [title, id] of [
    ["Season", "season-citadel"],
    ["Blitz Results", "blitz-aftermath"],
  ]) {
    browser.run(["open", lab, "--ignore-https-errors"]);
    browser.run(["find", "role", "link", "click", "--name", `Open ${title} on the real page`, "--exact"]);
    browser.run([
      "wait",
      "--fn",
      `!![...document.images].find(i=>i.currentSrc.includes('${id}') && i.complete && i.naturalWidth > 0)`,
    ]);
    browser.run(["wait", "800"]);
    const page = browser.read(
      `JSON.stringify({url:location.href,painting:[...document.images].find(i=>i.currentSrc.includes('${id}')).currentSrc,failed:[...document.images].filter(i=>!i.complete || i.naturalWidth===0).map(i=>i.src),body:document.body.innerText})`,
    );
    check(page.failed.length === 0, "A page image failed to load");
    check(
      title === "Season"
        ? page.body.includes("Frontier") && page.body.includes("Blitz")
        : page.body.includes("Results"),
      "Wrong page content",
    );
    browser.screenshot(join(out, `${id}-page.png`));
    delete page.body;
    records.push({ title, ...page });
  }
  const errors = browser.run(["errors"]);
  check(!errors.trim(), errors);
  writeFileSync(join(out, "proof.json"), JSON.stringify({ ok: true, records, errors }, null, 2) + "\n");
} catch (error) {
  writeFileSync(join(out, "failure.txt"), String(error));
  browser.run(["screenshot", join(out, "failure.png")], { allowFailure: true });
  writeFileSync(join(out, "proof.json"), JSON.stringify({ ok: false, records, error: String(error) }, null, 2) + "\n");
  throw error;
} finally {
  browser.close();
  rmSync(profile, { recursive: true, force: true });
  if (server.exitCode === null) {
    process.kill(-server.pid, "SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  writeFileSync(join(out, "client.log"), log);
}
