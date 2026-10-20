import { proveFrontierChestRoute } from "./prove-frontier-chest-route.mjs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBrowserSession, openPageDevTools } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";

const option = (key, fallback) => (process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback);
const port = option("--port", "4199"),
  base = option("--base-url", null),
  out = option("--out", ".context/relic-chest-" + Date.now());
const backends = option("--backends", "webgpu-auto,webgpu-force-webgl").split(",");
mkdirSync(out, { recursive: false });
const games = option("--games", "blitz,frontier").split(",");
if (!games.every((game) => ["blitz", "frontier"].includes(game))) throw new Error("Unknown chest proof game");
const records = [];
const check = (value, reason) => {
  if (!value) throw new Error(reason);
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const snapshot = `({rewards:[...document.querySelectorAll('[data-chest-panel] [aria-label="Relics"] li')].map(x=>x.textContent),text:document.querySelector('[data-chest-panel]')?.textContent,renderer:document.querySelector('canvas')?.dataset.renderer,plate:document.querySelector('[aria-label="Focus relic chest"]')?.textContent,mapRewards:[...document.querySelectorAll('[data-chest-rewards] img')].map(img=>({name:img.alt,opacity:Number(img.parentElement.style.opacity)}))})`;
await withDevClient({ base, port, out }, async (baseUrl) => {
  for (const game of games)
    for (const backend of backends) {
      const profile = mkdtempSync(join(tmpdir(), "relic-chest-proof-"));
      const browser = createBrowserSession("relic-chest-" + Date.now(), { profile, headed: false });
      let devtools;
      try {
        if (game === "frontier") {
          records.push(await proveFrontierChestRoute(browser, { baseUrl, backend, out }));
          writeFileSync(join(out, "proof.json"), JSON.stringify({ ok: false, records }, null, 2) + "\n");
          continue;
        }
        browser.run([
          "open",
          `${baseUrl}/lab/relic-chest?capture=1&rendererMode=${backend}&gameMode=${game}`,
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
        const wait = async (expression) => {
          const deadline = Date.now() + 15000;
          while (!(await read(expression))) {
            check(Date.now() < deadline, `Chest state timed out: ${expression}`);
            await pause(100);
          }
        };
        const capture = async (phase) => {
          const { data } = await devtools.send("Page.captureScreenshot", { format: "png" });
          writeFileSync(join(out, `${game}-${backend}-${phase}.png`), Buffer.from(data, "base64"));
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
        check(sealed.plate.includes(game === "frontier" ? "Reward Chest" : "Relic Crate"), "Wrong chest label");
        check(sealed.rewards.length === 0 && sealed.mapRewards.length === 0, "Sealed chest leaks relics");
        let revealed, receipt, lucky, luckyOpened;
        check(
          sealed.text.includes("Three relics. Open to reveal them.") && sealed.text.includes("250"),
          "Missing sealed panel or points",
        );
        await capture("focused-sealed");
        await click("[data-chest-panel] button", "Open");
        await wait(
          "document.querySelectorAll('[data-chest-rewards] img').length === 3 && [...document.querySelectorAll('[data-chest-rewards] img')].every(img=>Number(img.parentElement.style.opacity) > 0.2)",
        );
        revealed = await read(snapshot);
        const war = ["Damage Relic I", "Damage Reduction Relic I", "Stamina Relic I"];
        check(
          revealed.rewards.join("|") === war.join("|") && revealed.text.includes("Crate opened"),
          "Opening receipt differs",
        );
        check(
          revealed.mapRewards.length === 3 &&
            revealed.mapRewards.every((icon, index) => icon.opacity > 0.2 && icon.name === war[index]),
          "Opening did not reveal the exact awarded icons",
        );
        await capture("reveal");
        await wait("!document.querySelector('[data-chest-rewards]')");
        receipt = await read(snapshot);
        check(
          receipt.rewards.join("|") === war.join("|") && receipt.mapRewards.length === 0,
          "Reveal cleanup or persistent receipt failed",
        );
        await capture("receipt");
        browser.click("Reset chest");
        browser.run(["select", '[aria-label="Fixture pack"]', "Fortress"]);
        browser.run(["click", 'input[type="checkbox"]']);
        browser.click("Focus relic chest");
        lucky = await read(snapshot);
        check(lucky.rewards.length === 0 && lucky.mapRewards.length === 0, "Lucky pack leaked");
        await click("[data-chest-panel] button", "Open");
        luckyOpened = await read(snapshot);
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
          "!document.querySelector('canvas') && !document.querySelector('[data-chest-rewards]')",
        ]);
        const errors = browser.run(["errors"]);
        check(!errors.trim(), errors);
        records.push({
          game,
          backend,
          sealed,
          revealed,
          receipt,
          lucky,
          luckyOpened,
          released: true,
          errors,
        });
        writeFileSync(join(out, "proof.json"), JSON.stringify({ ok: false, records }, null, 2) + "\n");
      } catch (error) {
        writeFileSync(
          join(out, `${game}-${backend}-failure.txt`),
          String(error) +
            "\n" +
            browser.run(["snapshot"]) +
            "\n" +
            browser.run(["errors"]) +
            "\n" +
            browser.run(["console"]),
        );
        browser.run(["screenshot", join(out, `${game}-${backend}-failure.png`)], { allowFailure: true });
        throw error;
      } finally {
        devtools?.close();
        browser.close();
        rmSync(profile, { recursive: true, force: true });
      }
    }
  writeFileSync(join(out, "proof.json"), JSON.stringify({ ok: true, records }, null, 2) + "\n");
});
