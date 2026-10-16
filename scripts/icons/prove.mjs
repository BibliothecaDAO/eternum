import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { runProof } from "../../apps/game/scripts/prove-run.mjs";

const pages = [
  ["catalog", "/lab/kit/icons", ".icon-card"],
  ["hud", "/lab/kit/hud/selected", "[data-icon]"],
  ["hud-menu", "/lab/kit/hud/menu", "[data-icon]"],
  ["landing", "/lab/app/first-visit/?capture=1", "[data-layout]"],
  ["play", "/lab/app/home/?capture=1", "[data-layout]"],
  ["season", "/lab/app/season-running/season?capture=1", "[data-layout]"],
  ["results", "/lab/app/reward-sealed/results/0x5245414c4d53-7?capture=1", "[data-layout]"],
  ["entry", "/lab/app/entry-choose/blitz/slot-blitz-1630?capture=1", "[data-layout]"],
  ["account", "/lab/app/home/profile?capture=1", "[data-layout]"],
  ["settings", "/lab/app/home/profile/settings?capture=1", "[data-layout]"],
  ["news", "/lab/app/home/scroll?capture=1", "[data-layout]"],
];

export async function proveIcons(b, out, records, baseUrl, onlyLayout, onlyPages, missingSvg = false) {
  mkdirSync(out, { recursive: true });
  for (const [layout, width, height] of [
    ["desktop", 1440, 1000],
    ["phone", 390, 844],
  ]) {
    if (onlyLayout && layout !== onlyLayout) continue;
    await b.run("set", "viewport", String(width), String(height));
    for (const [name, path, ready] of pages) {
      if (onlyPages && !onlyPages.includes(name)) continue;
      const record = { name: `${layout}-${name}`, ready: false, presses: [], checks: [] };
      records.push(record);
      await b.run("open", `${baseUrl}${path}`, "--ignore-https-errors");
      await b.run("wait", ready);
      record.ready = true;
      if (missingSvg) {
        await b.evaluate(`(() => {
          const marker = document.querySelector('image[data-icon]');
          if (!marker) throw new Error('The negative control requires an SVG icon');
          marker.setAttribute('href', '/icons/facets/64/missing-svg-negative-control.webp');
          return true;
        })()`);
      }
      const state = await b.evaluate(`(async () => {
        const icons = await Promise.all([...document.querySelectorAll('img[data-icon],image[data-icon]')].map(async element => {
          const html = element instanceof HTMLImageElement;
          const url = element.getAttribute(html ? 'src' : 'href');
          const result = {meaning: element.dataset.icon, kind: html ? 'html' : 'svg', url, loaded: false};
          try {
            if (!url) throw new Error('Missing artwork URL');
            result.resolvedUrl = new URL(url, document.baseURI).href;
            const image = html ? element : new Image();
            if (!html) image.src = result.resolvedUrl;
            await image.decode();
            result.loaded = image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
            result.width = image.naturalWidth;
            result.height = image.naturalHeight;
          } catch (error) {
            result.error = String(error);
          }
          return result;
        }));
        return {icons, overflow: document.documentElement.scrollWidth > innerWidth,
          resources: performance.getEntriesByType('resource').map(r => r.name).filter(url => new URL(url).pathname.startsWith('/icons/facets/'))};
      })()`);
      record.state = state;
      record.checks.push({
        check: "All rendered HTML and SVG icon URLs decode as semantic artwork",
        ok: state.icons.length > 0 && state.icons.every((i) => i.loaded && i.url.startsWith("/icons/facets/")),
      });
      record.checks.push({ check: "Page fits viewport width", ok: !state.overflow });
      await b.run("screenshot", join(out, `${record.name}.png`));
      if (missingSvg) return;
      if (name !== "catalog") continue;
      const check = async (label, expression) =>
        record.checks.push({ check: label, ok: (await b.evaluate(expression)) === true });
      await check("All 252 meanings are visible", "document.querySelectorAll('.icon-card').length===252");
      for (const size of [24, 32, 64]) {
        await b.run("click", `[data-size='${size}']`);
        await check(
          `Icons display at ${size}px`,
          `[...document.querySelectorAll('.icon-card img')].every(i=>i.width===${size} && parseFloat(getComputedStyle(i).width)===${size})`,
        );
      }
      for (const meaning of ["production", "transfer"]) {
        await b.run("click", `section[aria-label='Action meanings'] button:has([data-icon='${meaning}'])`);
        await check(
          `${meaning} action responds`,
          `document.querySelector('[role=status]').textContent.toLowerCase()==='${meaning === "transfer" ? "transfer resources" : meaning} selected'`,
        );
      }
      await b.run("select", "select[aria-label='Icon family']", "Troops");
      await check(
        "Nine soldiers cover all types and tiers",
        "document.querySelectorAll('.icon-card').length===9 && ['knight','crossbowman','paladin'].every(k=>[1,2,3].every(t=>document.querySelector('[data-meaning='+k+'-t'+t+']'))) ",
      );
      await b.run("scrollintoview", ".icon-cards");
      await b.run("screenshot", join(out, `${layout}-troops.png`));
      await b.run("click", "[data-density='220']");
      await check(
        "Grouped map retains 220 sites and 18 armies",
        "[...document.querySelectorAll('.icon-cluster')].reduce((s,e)=>s+Number(e.dataset.sites),0)===220 && [...document.querySelectorAll('.icon-cluster')].reduce((s,e)=>s+Number(e.dataset.armies),0)===18",
      );
      await b.run("click", ".icon-cluster[data-sector='0']");
      await check(
        "Opening a sector shows hex markers",
        "document.querySelectorAll('.icon-marker-wrap polygon').length>0 && [...document.querySelectorAll('.icon-marker-wrap polygon')].every(p=>p.points.numberOfItems===6)",
      );
      await b.run("screenshot", join(out, `${layout}-minimap.png`));
      await b.run("click", "#labels");
      await check("Hide labels removes names", "document.querySelectorAll('.icon-card h4').length===0");
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const baseUrl = process.argv[3] ?? "https://127.0.0.1:4193";
  const missingSvg = process.argv.includes("--missing-svg");
  await runProof(
    {
      parent: resolve(process.argv[2] ?? ".context/icons-proof"),
      name: "icons-proof",
      baseUrl,
      where: (r) => ({ name: r.name }),
    },
    (b, out, records) =>
      proveIcons(
        b,
        out,
        records,
        baseUrl,
        missingSvg ? "desktop" : undefined,
        missingSvg ? ["catalog"] : undefined,
        missingSvg,
      ),
  );
}
