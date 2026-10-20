import { frontierChestRouteReady } from "./frontier-chest-route-contract.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openPageDevTools } from "./client-playtest/browser-session.mjs";

const { schemaIdentity } = JSON.parse(
  readFileSync(new URL("../../../contracts/l3/world-native/schema/bindings.json", import.meta.url), "utf8"),
);
const panel = '[data-kit-sheet][aria-label="Reward Chest"]';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

/** Exercise the game route and mounted Frontier HUD, with local reward facts and no signed commands. */
export async function proveFrontierChestRoute(browser, { baseUrl, backend, out }) {
  browser.run([
    "open",
    "about:blank",
    "--ignore-https-errors",
    "--args",
    "--ignore-gpu-blocklist,--enable-gpu,--use-angle=vulkan,--enable-features=Vulkan,--enable-unsafe-webgpu",
  ]);
  browser.run(["set", "viewport", "1920", "1080"]);
  const devtools = await openPageDevTools(browser);
  const read = async (expression) => {
    const result = await devtools.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    check(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const wait = async (expression) => {
    const deadline = Date.now() + 60_000;
    while (!(await read(expression))) {
      check(Date.now() < deadline, `Route proof timed out: ${expression}`);
      await pause(250);
    }
  };
  const tap = async (point) => {
    await devtools.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    await devtools.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
    await devtools.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
    await pause(100);
  };
  const click = async (selector, text) => {
    const point = await read(
      `(()=>{const element=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>${text ? `e.textContent.trim()===${JSON.stringify(text)}` : "true"});if(!element)throw Error('Missing proof control');const r=element.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
    );
    await tap(point);
  };
  const capture = async (phase) => {
    const { data } = await devtools.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(out, `frontier-${backend}-route-${phase}.png`), Buffer.from(data, "base64"));
  };
  const snapshot = () =>
    read(
      `(async()=>({url:location.href,text:document.querySelector(${JSON.stringify(panel)})?.textContent ?? '',selection:(await import('/src/hooks/store/use-ui-store.ts')).useUIStore.getState().selectedHex,fixture:window.__frontierChestFixture.summary,renderer:(await import('/src/three/renderer-diagnostics.ts')).snapshotRendererDiagnostics().activeMode}))()`,
    );
  try {
    await devtools.send("Page.enable");
    await devtools.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
      window.__frontierRouteProofCatalogue = ${JSON.stringify(schemaIdentity)};
      const originalFetch=window.fetch;
      window.fetch=async(input,init)=>{
        const requestUrl=new URL(typeof input==='string'?input:input.url,location.href);
        if(init?.body && /starknet_add(?:Invoke|DeployAccount)Transaction/.test(String(init.body)))
          throw Error('The chest route proof cannot submit a transaction');
        const response=await originalFetch(input,init);
        if(requestUrl.pathname!=='/api/directory')return response;
        const directory=await response.json();
        for(const shard of directory.shards ?? [])if(shard.manifest)
          for(const id of Object.keys(shard.manifest.releaseSchemas))shard.manifest.releaseSchemas[id]=${JSON.stringify(schemaIdentity)};
        return new Response(JSON.stringify(directory),{status:response.status,headers:{'content-type':'application/json'}});
      };
    `,
    });
    await devtools.send("Page.navigate", { url: `${baseUrl}/` });
    await wait(`location.origin===${JSON.stringify(new URL(baseUrl).origin)} && document.readyState === 'complete'`);
    check(
      await read(`window.__frontierRouteProofCatalogue===${JSON.stringify(schemaIdentity)}`),
      "Fixture preload did not run",
    );
    const game = await read(
      `(async()=>{const directory=await(await fetch('/api/directory')).json();for(const shard of directory.shards ?? []){const game=shard.games?.find(g=>g.mode==='frontier'&&g.status==='Live');if(game)return {chainId:shard.chainId,gameId:game.game_id};}throw Error('No live Frontier route available');})()`,
    );
    const route = `${baseUrl}/g/${game.chainId}/${game.gameId}/map?spectate=true&rendererMode=${backend}`;
    await devtools.send("Page.navigate", { url: route });
    await wait("Boolean(document.querySelector('#main-canvas')) && Boolean(document.querySelector('[data-hud-rail]'))");
    if (!(await read("location.pathname.endsWith('/map')"))) {
      await click('[role="tab"]', "World");
      await wait("location.pathname.endsWith('/map')");
    }
    await wait(`(${frontierChestRouteReady.toString()})()`);
    await wait("window.__rendererDiagnostics?.sceneName === 'map'");
    const fixture = await read(
      "(async()=>{window.__frontierChestFixture=(await import('/scripts/relic-chest-route-fixture.mjs')).stageFrontierChest();return window.__frontierChestFixture.summary;})()",
    );
    await pause(1500);
    let selections = 0;
    const selectChest = async () => {
      const selection = ++selections;
      if (!(await read("location.pathname.endsWith('/map') && window.__rendererDiagnostics?.sceneName === 'map'")))
        await click('[role="tab"]', "World");
      await wait("location.pathname.endsWith('/map') && window.__rendererDiagnostics?.sceneName === 'map'");
      const deadline = Date.now() + 15000;
      const framed = `(async()=>{const state=(await import('/src/hooks/store/use-ui-store.ts')).useUIStore.getState();return window.__rendererDiagnostics?.sceneName === 'map' && state.cameraTargetHex?.col === ${fixture.hex.col} && state.cameraTargetHex?.row === ${fixture.hex.row}})()`;
      do {
        await read(
          "window.dispatchEvent(new CustomEvent('minimapCameraMove', {detail: window.__frontierChestFixture.position}))",
        );
        await pause(300);
        check(Date.now() < deadline, "Map camera did not reach the fixture chest");
      } while (!(await read(framed)));
      await capture(`framed-${selection}`);
      writeFileSync(
        join(out, `frontier-${backend}-framed-${selection}.json`),
        JSON.stringify(
          await read(
            "(async()=>({url:location.href, scene:window.__rendererDiagnostics?.sceneName,fixture:window.__frontierChestFixture.summary,camera:(await import('/src/hooks/store/use-ui-store.ts')).useUIStore.getState().cameraTargetHex}))()",
          ),
          null,
          2,
        ),
      );
      const point = await read(
        "(()=>{const r=document.querySelector('#main-canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()",
      );
      await tap(point);
      const selected = await snapshot();
      writeFileSync(join(out, `frontier-${backend}-selected-${selection}.json`), JSON.stringify(selected, null, 2));
      check(
        selected.selection?.col === fixture.hex.col && selected.selection?.row === fixture.hex.row,
        "The framed map tile did not select the fixture chest",
      );
    };
    await selectChest();
    await wait(`Boolean(document.querySelector(${JSON.stringify(panel)}))`);
    await read("window.__frontierChestFixture.missing()");
    await wait(`document.querySelector(${JSON.stringify(panel)})?.textContent.includes('Syncing chest reward')`);
    const missing = await snapshot();
    await capture("missing");
    await read("window.__frontierChestFixture.fund()");
    await wait(`document.querySelector(${JSON.stringify(panel)})?.textContent.includes('17 LORDS')`);
    const sealed = await snapshot();
    check(sealed.text.includes("Expires at day rollover"), "Missing expiry in Frontier selection");
    check(sealed.renderer === (backend === "webgpu-auto" ? "webgpu" : "webgl2-fallback"), "Wrong route renderer");
    await capture("funded");
    await click(`${panel} button`, "Open");
    await wait("document.querySelector('[data-lords-receipt]')?.textContent.includes('17 LORDS')");
    const receipt = await snapshot();
    check(receipt.fixture.sends === 1, "Open did not use the map command path exactly once");
    await capture("receipt");
    browser.press("Escape");
    await selectChest();
    const reselected = await snapshot();
    check(reselected.text.includes("17 LORDS paid to the army's realm"), "Receipt lost after occupancy disappeared");
    browser.press("Escape");
    await read("window.__frontierChestFixture.reset();window.__frontierChestFixture.expire()");
    await pause(250);
    if (await read("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Continue')"))
      await click("button", "Continue");
    await selectChest();
    const expired = await snapshot();
    check(
      expired.text.includes("0 LORDS") && expired.text.includes("Reservation expired"),
      "Expired reservation still advertises payment",
    );
    await capture("expired");
    await click(`${panel} button`, "Open");
    await wait("document.querySelector('[data-lords-receipt]')?.textContent.includes('No LORDS paid')");
    const expiredOpened = await snapshot();
    check(expiredOpened.fixture.sends === 2, "Expired opening did not use the same command path");
    await capture("expired-receipt");
    await devtools.send("Page.navigate", { url: `${baseUrl}/` });
    await wait("!document.querySelector('canvas')");
    const errors = browser.run(["errors"]);
    check(!errors.trim(), errors);
    return {
      game: "frontier",
      backend,
      route,
      fixtureCatalogue: schemaIdentity,
      localTransport: true,
      missing,
      sealed,
      receipt,
      reselected,
      expired,
      expiredOpened,
      released: true,
      errors,
    };
  } finally {
    devtools.close();
  }
}
