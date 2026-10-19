import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBrowserSession, openPageDevTools } from "./client-playtest/browser-session.mjs";

const option = (key, fallback) => (process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback);
const port = option("--port", "4199"),
  out = option("--out", ".context/relic-chest-" + Date.now());
const backends = option("--backends", "webgpu-auto,webgpu-force-webgl").split(",");
mkdirSync(out, { recursive: false });
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
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const snapshot = `({rewards:[...document.querySelectorAll('[data-chest-panel] [aria-label="Relics"] li')].map(x=>x.textContent),text:document.querySelector('[data-chest-panel]')?.textContent,renderer:document.querySelector('canvas')?.dataset.renderer,mapRelics:[...document.querySelectorAll('[data-chest-relics] img')].map(img=>({name:img.alt,opacity:Number(img.parentElement.style.opacity)}))})`;
try {
  const deadline = Date.now() + 30_000;
  while (!log.includes("Local:")) {
    check(server.exitCode === null && Date.now() < deadline, log || "Client did not start");
    await pause(200);
  }
  for (const backend of backends) {
    const profile = mkdtempSync(join(tmpdir(), "relic-chest-proof-"));
    const browser = createBrowserSession("relic-chest-" + Date.now(), { profile, headed: false });
    let devtools;
    try {
      browser.run([
        "open",
        `https://127.0.0.1:${port}/lab/relic-chest?capture=1&rendererMode=${backend}`,
        "--ignore-https-errors",
        "--args",
        "--ignore-gpu-blocklist,--enable-gpu,--use-angle=vulkan,--enable-features=Vulkan,--enable-unsafe-webgpu",
      ]);
      browser.run(["set", "viewport", "1920", "1080"]);
      browser.run(["wait", "--fn", "document.querySelector('[data-relic-chest-lab]')?.dataset.ready === 'true'"]);
      devtools = await openPageDevTools(browser);
      const read = async (expression) => {
        const result = await devtools.send("Runtime.evaluate", { expression, returnByValue: true });
        check(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
        return result.result.value;
      };
      const capture = async (phase) => {
        const { data } = await devtools.send("Page.captureScreenshot", { format: "png" });
        writeFileSync(join(out, `${backend}-${phase}.png`), Buffer.from(data, "base64"));
      };
      const click = async (selector, text) => {
        const point = await read(
          `(()=>{const r=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
        );
        await devtools.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
        await devtools.send("Input.dispatchMouseEvent", {
          type: "mousePressed",
          button: "left",
          clickCount: 1,
          ...point,
        });
        await devtools.send("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          button: "left",
          clickCount: 1,
          ...point,
        });
        await pause(100);
      };
      await capture("rest");
      browser.click("Focus relic chest");
      const sealed = await read(snapshot);
      check(sealed.renderer === (backend === "webgpu-auto" ? "webgpu" : "webgl2-fallback"), "Wrong backend");
      check(sealed.rewards.length === 0 && sealed.mapRelics.length === 0, "Sealed chest leaks relics");
      check(
        sealed.text.includes("Three relics. Open to reveal them.") && sealed.text.includes("250"),
        "Missing sealed panel or points",
      );
      await capture("focused-sealed");
      await click("[data-chest-panel] button", "Open");
      await pause(750);
      const revealed = await read(snapshot);
      const war = ["Damage Relic I", "Damage Reduction Relic I", "Stamina Relic I"];
      check(
        revealed.rewards.join("|") === war.join("|") && revealed.text.includes("Crate opened"),
        "Opening receipt differs",
      );
      check(
        revealed.mapRelics.length === 3 &&
          revealed.mapRelics.every((icon, index) => icon.opacity > 0.2 && icon.name === war[index]),
        "Opening did not reveal the exact awarded icons",
      );
      await capture("reveal");
      await pause(2400);
      const receipt = await read(snapshot);
      check(
        receipt.rewards.join("|") === war.join("|") && receipt.mapRelics.length === 0,
        "Reveal cleanup or persistent receipt failed",
      );
      await capture("receipt");
      browser.click("Reset chest");
      browser.run(["select", '[aria-label="Fixture pack"]', "Fortress"]);
      browser.run(["click", 'input[type="checkbox"]']);
      browser.click("Focus relic chest");
      const lucky = await read(snapshot);
      check(lucky.rewards.length === 0 && lucky.mapRelics.length === 0, "Lucky pack leaked");
      await click("[data-chest-panel] button", "Open");
      const luckyOpened = await read(snapshot);
      check(
        luckyOpened.rewards.join("|") ===
          "Structure Defense Relic II|Damage Reduction Relic II|Troop Production Relic II",
        "Lucky opening differs from its actual pack",
      );
      browser.click("Reset chest");
      browser.click("Close 3D proof");
      browser.run([
        "wait",
        "--fn",
        "!document.querySelector('canvas') && !document.querySelector('[data-chest-relics]')",
      ]);
      const errors = browser.run(["errors"]);
      check(!errors.trim(), errors);
      records.push({ backend, sealed, revealed, receipt, lucky, luckyOpened, released: true, errors });
      writeFileSync(join(out, "proof.json"), JSON.stringify({ ok: false, records }, null, 2) + "\n");
    } catch (error) {
      writeFileSync(
        join(out, `${backend}-failure.txt`),
        String(error) +
          "\n" +
          browser.run(["snapshot"]) +
          "\n" +
          browser.run(["errors"]) +
          "\n" +
          browser.run(["console"]),
      );
      browser.run(["screenshot", join(out, `${backend}-failure.png`)], { allowFailure: true });
      throw error;
    } finally {
      devtools?.close();
      browser.close();
      rmSync(profile, { recursive: true, force: true });
    }
  }
  writeFileSync(join(out, "proof.json"), JSON.stringify({ ok: true, records }, null, 2) + "\n");
} finally {
  if (server.exitCode === null) {
    process.kill(-server.pid, "SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  writeFileSync(join(out, "client.log"), log);
}
