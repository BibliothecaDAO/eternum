/**
 * Shrines and Wells on the real Frontier route, driven as a player drives them: the dev client's live Frontier game,
 * a live army of today's map with a Shrine and a Well staged beside it and a Shrine three tiles off
 * (frontier-sites-route-fixture.mjs), the army's owner as the viewer with an account that cannot sign, and the site
 * command recorded instead of sent.
 *   desktop: tap the army, hover each site (the order line), right-click the Shrine (Use, the army stays), tap the Well
 *            (its card, the army kept) and press Use.
 *   phone:   tap the army, press and hold the Shrine (the touch right-click), tap the Well and press Use.
 * Each step checks the recorded command and the army's tile, and leaves a screenshot and the page's state in --out.
 *   node scripts/prove-frontier-sites.mjs [--base-url https://127.0.0.1:4195] [--out dir] [--viewports desktop,phone]
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBrowserSession, openPageDevTools } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";

const option = (key, fallback) => (process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback);
const base = option("--base-url", null);
const port = option("--port", "4199");
const out = option("--out", ".context/frontier-sites-" + Date.now());
const viewports = option("--viewports", "desktop,phone").split(",");
const SIZES = { desktop: [1920, 1080], phone: [390, 844] };
mkdirSync(out, { recursive: true });
const { schemaIdentity } = JSON.parse(
  readFileSync(new URL("../../../contracts/l3/world-native/schema/bindings.json", import.meta.url), "utf8"),
);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const proveViewport = async (baseUrl, viewport) => {
  const profile = mkdtempSync(join(tmpdir(), "frontier-sites-proof-"));
  const browser = createBrowserSession("frontier-sites-" + Date.now(), { profile, headed: false });
  const steps = [];
  browser.run([
    "open",
    "about:blank",
    "--ignore-https-errors",
    "--args",
    "--ignore-gpu-blocklist,--enable-gpu,--use-angle=vulkan,--enable-features=Vulkan,--enable-unsafe-webgpu",
  ]);
  browser.run(["set", "viewport", ...SIZES[viewport].map(String)]);
  const devtools = await openPageDevTools(browser);
  const read = async (expression) => {
    const result = await devtools.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    check(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const wait = async (expression, what, ms = 60_000) => {
    const deadline = Date.now() + ms;
    while (!(await read(expression))) {
      check(Date.now() < deadline, `${viewport}: timed out waiting for ${what}`);
      await pause(250);
    }
  };
  const capture = async (phase) => {
    const { data } = await devtools.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(out, `${viewport}-${phase}.png`), Buffer.from(data, "base64"));
  };
  const mouse = async (type, point, button = "none") =>
    devtools.send("Input.dispatchMouseEvent", { type, ...point, button, clickCount: button === "none" ? 0 : 1 });
  const click = async (point, button = "left") => {
    await mouse("mouseMoved", point);
    await mouse("mousePressed", point, button);
    await mouse("mouseReleased", point, button);
    await pause(150);
  };
  const touch = async (point, holdMs) => {
    await devtools.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await pause(holdMs);
    await devtools.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await pause(150);
  };
  const tap = (point) => (viewport === "phone" ? touch(point, 60) : click(point));
  const state = () =>
    read(`(async()=>{const ui=(await import('/src/hooks/store/use-ui-store.ts')).useUIStore.getState();return {
      selectedArmy: ui.entityActions.selectedEntityId, selectedHex: ui.selectedHex,
      sheet: document.querySelector('[data-kit-sheet]')?.getAttribute('aria-label') ?? null,
      sheetText: document.querySelector('[data-kit-sheet]')?.innerText.replace(/\\s+/g,' ').trim() ?? null,
      tooltip: document.querySelector('[role="tooltip"]')?.innerText.replace(/\\s+/g,' ').trim() ?? null,
      fixture: window.__frontierSites.summary }})()`);
  // The camera centred on the army or a site, as the minimap moves it: that tile is then the map canvas's centre.
  const focus = async (name) => {
    const framed = (tile) =>
      read(
        `(async()=>{const s=(await import('/src/hooks/store/use-ui-store.ts')).useUIStore.getState();return s.cameraTargetHex?.col===${tile.x}&&s.cameraTargetHex?.row===${tile.y}})()`,
      );
    // Sent again until the map takes it, as the chest proof does: a scene still loading drops the first one.
    const deadline = Date.now() + 20_000;
    for (;;) {
      const tile = await read(`window.__frontierSites.focus(${JSON.stringify(name)})`);
      await pause(300);
      if (await framed(tile)) break;
      check(Date.now() < deadline, `${viewport}: timed out waiting for the camera at the ${name}`);
    }
    await pause(1500);
    return read(
      "(()=>{const r=document.querySelector('#main-canvas').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()",
    );
  };

  const record = async (name, extra = {}) => {
    const shown = await state();
    await capture(name);
    steps.push({ step: name, ...extra, ...shown });
    writeFileSync(join(out, `${viewport}-steps.json`), JSON.stringify(steps, null, 2) + "\n");
    return shown;
  };
  try {
    await devtools.send("Page.enable");
    if (viewport === "phone")
      await devtools.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await devtools.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
      const originalFetch=window.fetch;
      window.fetch=async(input,init)=>{
        const requestUrl=new URL(typeof input==='string'?input:input.url,location.href);
        if(init?.body && /starknet_add(?:Invoke|DeployAccount)Transaction/.test(String(init.body)))
          throw Error('The sites proof cannot submit a transaction');
        const response=await originalFetch(input,init);
        if(requestUrl.pathname!=='/api/directory')return response;
        const directory=await response.json();
        for(const shard of directory.shards ?? [])if(shard.manifest)
          for(const id of Object.keys(shard.manifest.releaseSchemas))shard.manifest.releaseSchemas[id]=${JSON.stringify(schemaIdentity)};
        return new Response(JSON.stringify(directory),{status:response.status,headers:{'content-type':'application/json'}});
      };`,
    });
    await devtools.send("Page.navigate", { url: `${baseUrl}/` });
    await wait("document.readyState === 'complete'", "the app");
    const game = await read(
      `(async()=>{const directory=await(await fetch('/api/directory')).json();for(const shard of directory.shards ?? []){const game=shard.games?.find(g=>g.mode==='frontier'&&g.status==='Live');if(game)return {chainId:shard.chainId,gameId:game.game_id};}throw Error('No live Frontier game');})()`,
    );
    const route = `${baseUrl}/g/${game.chainId}/${game.gameId}/map?spectate=true`;
    await devtools.send("Page.navigate", { url: route });
    await wait(
      "Boolean(document.querySelector('#main-canvas')) && window.__rendererDiagnostics?.sceneName === 'map'",
      "the map",
    );
    await pause(4000);
    const staged = await read(
      "(async()=>{window.__frontierSites=(await import('/scripts/frontier-sites-route-fixture.mjs')).stageFrontierSites();return window.__frontierSites.summary;})()",
    );
    await wait(
      "(async()=>(await import('/src/utils/can-issue-orders.ts')).canIssueOrders())()",
      "orders allowed for the army's owner",
      15_000,
    );
    await record("staged", { route });

    // The player selects their army.
    await tap(await focus("army"));
    await wait(
      `(async()=>(await import('/src/hooks/store/use-ui-store.ts')).useUIStore.getState().entityActions.selectedEntityId===${staged.armyId})()`,
      "the army selected",
    );
    await pause(1000);
    await record("army-selected");

    if (viewport === "desktop") {
      for (const [name, site] of [
        ["hover-shrine", "shrine"],
        ["hover-well", "well"],
        ["hover-far-shrine", "far"],
      ]) {
        const point = await focus(site);
        await mouse("mouseMoved", { x: point.x + 1, y: point.y });
        await mouse("mouseMoved", point);
        await wait("Boolean(document.querySelector('[role=\"tooltip\"]'))", `the order line at ${name}`, 10_000);
        await record(name);
      }
      const shrineLine = steps.find((step) => step.step === "hover-shrine").tooltip;
      check(/^Use \+\d[\d,]* XP$/.test(shrineLine), `Shrine hover reads "${shrineLine}"`);
      const wellLine = steps.find((step) => step.step === "hover-well").tooltip;
      check(
        /^Use (\+\d+ stamina(, to full)?|Stamina full: the well would be wasted)$/.test(wellLine),
        `Well hover reads "${wellLine}"`,
      );
      const farLine = steps.find((step) => step.step === "hover-far-shrine").tooltip;
      check(farLine === "Too far: move next to it", `Far Shrine hover reads "${farLine}"`);
      // Right-click: the order runs at once.
      await click(await focus("shrine"), "right");
    } else {
      // Press and hold: the touch right-click.
      await touch(await focus("shrine"), 800);
    }
    await wait("window.__frontierSites.summary.sent.length === 1", "the Shrine's use", 15_000);
    const used = await record("shrine-used");
    check(
      used.fixture.sent[0].kind === "Shrine" && used.fixture.sent[0].explorerId === staged.armyId,
      "Wrong use sent",
    );
    check(JSON.stringify(used.fixture.armyTile) === JSON.stringify(staged.armyTile), "The army moved on a use");
    check(!used.fixture.sites[0].standing, "The Shrine still stands after its use");

    // A tap on the Well opens its card with the army kept; its Use sends the same order.
    await tap(await focus("well"));
    await wait(
      "document.querySelector('[data-kit-sheet]')?.getAttribute('aria-label')==='Well'",
      "the Well's card",
      10_000,
    );
    const card = await record("well-card");
    check(card.selectedArmy === staged.armyId, "The tap on the Well dropped the army");
    const use = await read(
      `(()=>{const b=[...document.querySelectorAll('[data-kit-sheet] button')].find(e=>e.textContent.trim()==='Use');if(!b)return null;const r=b.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`,
    );
    check(use, "The Well's card offers no Use");
    await tap(use);
    await wait("window.__frontierSites.summary.sent.length === 2", "the Well's use", 15_000);
    const wellUsed = await record("well-used");
    check(wellUsed.fixture.sent[1].kind === "Well", "Wrong second use");
    check(JSON.stringify(wellUsed.fixture.armyTile) === JSON.stringify(staged.armyTile), "The army moved on a use");
    await devtools.send("Page.navigate", { url: `${baseUrl}/` });
    await wait("!document.querySelector('#main-canvas')", "the map closed");
    return {
      viewport,
      ok: true,
      route,
      steps: steps.map(({ step, tooltip, sheet, selectedArmy, fixture }) => ({
        step,
        tooltip,
        sheet,
        selectedArmy,
        sent: fixture.sent.length,
        armyTile: fixture.armyTile,
      })),
    };
  } catch (error) {
    await capture("failure").catch(() => {});
    const seen = await read(
      `(async()=>{const ui=(await import('/src/hooks/store/use-ui-store.ts')).useUIStore.getState();const {canIssueOrders}=await import('/src/utils/can-issue-orders.ts');return {mapSelection:ui.mapSelection,selectedArmy:ui.entityActions.selectedEntityId,selectedHex:ui.selectedHex,ordersAllowed:canIssueOrders(ui),spectating:ui.isSpectating,account:(await import('/src/hooks/store/use-account-store.ts')).useAccountStore.getState().account?.address??null}})()`,
    ).catch((reason) => ({ unreadable: String(reason) }));
    writeFileSync(
      join(out, `${viewport}-failure-state.json`),
      JSON.stringify(seen, (_, v) => (typeof v === "bigint" ? String(v) : v), 2),
    );
    return { viewport, ok: false, error: error.message, steps };
  } finally {
    devtools.close();
    browser.close();
    rmSync(profile, { recursive: true, force: true });
  }
};

await withDevClient({ base, port, out }, async (baseUrl) => {
  const records = [];
  for (const viewport of viewports) {
    records.push(await proveViewport(baseUrl, viewport));
    writeFileSync(join(out, "proof.json"), JSON.stringify({ ok: records.every((r) => r.ok), records }, null, 2) + "\n");
  }
  const ok = records.every((record) => record.ok);
  console.log(
    JSON.stringify({ ok, out, records: records.map(({ viewport, ok, error }) => ({ viewport, ok, error })) }),
  );
  if (!ok) process.exitCode = 1;
});
