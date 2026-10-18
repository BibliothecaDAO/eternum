import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { runProof } from "../../apps/game/scripts/prove-run.mjs";

const pages = [
  ["catalog", "/lab/kit/icons", ".icon-card"],
  ["hud", "/lab/kit/hud/selected", "[data-icon]"],
  ["purse", "/lab/kit/hud/value-hud", "[data-icon=lords]"],
  ["frontier", "/lab/kit/hud/season-over", "[data-icon=lords]"],
  ["withdraw", "/lab/kit/hud/withdraw", "[data-icon=lords]"],
  ["hud-menu", "/lab/kit/hud/menu", "[data-icon]"],
  ["landing", "/lab/app/first-visit/?capture=1", "[data-layout]"],
  ["play", "/lab/app/home/?capture=1", "[data-layout]"],
  ["season", "/lab/app/season-running/season?capture=1", "[data-layout]"],
  ["results", "/lab/app/reward-sealed/results/0x5245414c4d53-7?capture=1", "[data-icon=lords]"],
  ["lords-prize", "/lab/app/reward-lords/results/0x5245414c4d53-7?capture=1", 'img[data-icon=lords][width="96"]'],
  ["entry", "/lab/app/entry-choose/blitz/slot-blitz-1630?capture=1", "[data-icon=lords]"],
  ["account", "/lab/app/home/profile?capture=1", "[data-layout]"],
  ["settings", "/lab/app/home/profile/settings?capture=1", "[data-layout]"],
  ["news", "/lab/app/home/scroll?capture=1", "[data-layout]"],
];

async function readRealmEmblems(selector) {
  const images = [...document.querySelectorAll(`${selector} image[data-icon^="map-realm-"]`)];
  return Promise.all(
    images.map(async (element) => {
      const image = new Image();
      image.src = element.getAttribute("href");
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      const style = getComputedStyle(element);
      const size = parseFloat(style.width);
      const x = parseFloat(style.x);
      const y = parseFloat(style.y);
      const marker = element.closest("[data-marker]");
      const rim = marker.querySelector("polygon");
      const radius = Math.max(...[...rim.points].map((point) => Math.hypot(point.x, point.y)));
      const innerApothem = (radius * Math.sqrt(3)) / 2 - Number(rim.getAttribute("stroke-width")) / 2;
      let clearance = Infinity;
      let paintedPixels = 0;
      for (let row = 0; row < canvas.height; row++) {
        for (let col = 0; col < canvas.width; col++) {
          if (data[(row * canvas.width + col) * 4 + 3] <= 8) continue;
          paintedPixels++;
          // Test all four corners of each visible source pixel against the six inner rim edges.
          for (const dx of [0, 1])
            for (const dy of [0, 1]) {
              const px = x + ((col + dx) / canvas.width) * size;
              const py = y + ((row + dy) / canvas.height) * size;
              const edgeDistance = Math.max(Math.abs(px), Math.abs(px) / 2 + (Math.abs(py) * Math.sqrt(3)) / 2);
              clearance = Math.min(clearance, innerApothem - edgeDistance);
            }
        }
      }
      const pip = marker.querySelector("text");
      const overlays = [...marker.children].slice([...marker.children].indexOf(element) + 1);
      return {
        meaning: element.dataset.icon,
        owner: marker.dataset.owner,
        size,
        x,
        y,
        screenPixels: element.getBoundingClientRect().width,
        rimColor: rim.getAttribute("stroke"),
        clearance,
        paintedPixels,
        value: pip?.textContent,
        pipAboveArt: overlays.some((overlay) => overlay.contains(pip)),
        ownershipAboveArt: overlays.some((overlay) => overlay.getAttribute("transform") === "translate(-7 8)"),
      };
    }),
  );
}

export async function proveMinimapEmblems(b, out, records, url) {
  mkdirSync(out, { recursive: true });
  const record = { name: "live-minimap-emblems", ready: false, presses: [], checks: [] };
  records.push(record);
  await b.run("set", "viewport", "1440", "1000");
  await b.run("open", url, "--ignore-https-errors");
  await b.run("wait", '[aria-label="Minimap"] [data-marker^="map-realm-"]');
  record.ready = true;
  record.emblems = await b.evaluate(`(${readRealmEmblems})('[aria-label="Minimap"]')`);
  record.view = await b.evaluate(`(() => {
    const svg = document.querySelector('[aria-label="Minimap"] svg');
    return { url: location.href, viewport: [innerWidth, innerHeight], viewBox: svg.getAttribute('viewBox'),
      minimap: svg.getBoundingClientRect().toJSON(), scale: svg.getScreenCTM().a };
  })()`);
  record.checks.push({
    check: "Live realm paintings fill their hex without crossing the inner rim",
    ok:
      record.emblems.length > 0 &&
      record.emblems.every((emblem) => emblem.size >= 23 && emblem.paintedPixels > 0 && emblem.clearance >= 0),
  });
  record.checks.push({
    check: "Level pips and ownership cues remain above the paintings",
    ok: record.emblems.every(
      (emblem) => emblem.value === emblem.meaning.slice(-1) && emblem.pipAboveArt && emblem.ownershipAboveArt,
    ),
  });
  await b.run("screenshot", join(out, "live-minimap-page.png"));
  await b.run("open", "about:blank");
}

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
        ok:
          state.icons.length > 0 &&
          state.icons.every(
            (i) =>
              i.loaded && (i.meaning === "lords" ? i.url === "/tokens/lords.svg" : i.url.startsWith("/icons/facets/")),
          ),
      });
      const lords = state.icons.filter((icon) => icon.meaning === "lords");
      if (["catalog", "purse", "frontier", "withdraw", "entry", "results", "lords-prize"].includes(name)) {
        record.checks.push({
          check: "LORDS displays the official token mark",
          ok: lords.length > 0 && lords.every((icon) => icon.loaded && icon.url === "/tokens/lords.svg"),
        });
      }
      record.checks.push({ check: "Page fits viewport width", ok: !state.overflow });
      if (name === "lords-prize") {
        await b.run("scrollintoview", 'img[data-icon="lords"][width="96"]');
        record.checks.push({
          check: "Large LORDS reward uses the official SVG at 96px",
          ok: await b.evaluate(`(() => {
          const mark = document.querySelector('img[data-icon="lords"][width="96"]');
          return mark?.getAttribute('src') === '/tokens/lords.svg' && mark.getBoundingClientRect().width === 96;
        })()`),
        });
      }
      if (name === "catalog" || name === "results") await b.run("scrollintoview", '[data-icon="lords"]');
      await b.run("screenshot", join(out, `${record.name}.png`));
      if (missingSvg) return;
      if (name !== "catalog") continue;
      const check = async (label, expression) =>
        record.checks.push({ check: label, ok: (await b.evaluate(expression)) === true });
      await check(
        "Every delivered meaning is visible",
        `(async () => {
        const {meanings} = await (await fetch('/icons/facets/manifest.json')).json();
        const shown = [...document.querySelectorAll('.icon-card')].map(card => card.dataset.meaning);
        return shown.length === Object.keys(meanings).length && shown.every(name => meanings[name]);
      })()`,
      );
      await check(
        "Four current model renders and shipped comparisons decode",
        `(async () => {
        const rows = [...document.querySelectorAll('[data-realm-level]')];
        if (rows.length !== 4) return false;
        try {
          await Promise.all(rows.flatMap(row => [...row.querySelectorAll('img')]).map(image => image.decode()));
          return rows.every(row => [...row.querySelectorAll('img')].every(image => image.naturalWidth > 0));
        } catch { return false; }
      })()`,
      );
      await b.run("click", "[data-realm-art='shipped']");
      await check(
        "Shipped switch restores the old icons and universal hex emblem",
        "document.querySelectorAll('[data-realm-preview=shipped]').length===4 && document.querySelectorAll('#realm-levels [data-marker=map-realm]').length===16",
      );
      await b.run("click", "[data-realm-art='levels']");
      await check(
        "Every level has its own painting and four ownership hex badges",
        "[0,1,2,3].every(level=>document.querySelector('[data-realm-level=\"'+level+'\"] [data-icon=realm-'+level+']') && document.querySelectorAll('#realm-levels [data-marker=map-realm-'+level+']').length===4)",
      );
      record.realmFill = await b.evaluate(`(${readRealmEmblems})('#hex-fill [data-hex-fill="after"]')`);
      record.checks.push({
        check: "All four enlarged emblems clear their rims and retain ownership and level pips",
        ok:
          record.realmFill.length === 32 &&
          record.realmFill.every(
            (emblem) =>
              emblem.size >= 23 &&
              emblem.clearance >= 0 &&
              emblem.value === emblem.meaning.slice(-1) &&
              emblem.pipAboveArt &&
              emblem.ownershipAboveArt,
          ),
      });
      await check(
        "Before comparison retains the previous 18px inset",
        `
        [...document.querySelectorAll('#hex-fill [data-hex-fill="before"] image')].every(image =>
          parseFloat(getComputedStyle(image).width) === 18 && parseFloat(getComputedStyle(image).x) === -9 && parseFloat(getComputedStyle(image).y) === -10)`,
      );
      for (const level of [0, 1, 2, 3]) {
        await b.run("scrollintoview", `[data-hex-fill-level='${level}']`);
        await b.run("screenshot", join(out, `${layout}-hex-fill-${level}.png`));
      }
      for (const size of [24, 32, 64]) {
        await b.run("click", `[data-realm-size='${size}']`);
        await check(
          `Realm portraits display at ${size}px`,
          `[...document.querySelectorAll('[data-realm-preview] img')].every(image=>image.width===${size})`,
        );
      }
      await b.run("click", "[data-realm-size='32']");
      for (const level of [0, 1, 2, 3]) {
        await b.run("scrollintoview", `[data-realm-level='${level}']`);
        await b.run("screenshot", join(out, `${layout}-realm-${level}.png`));
      }
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

export async function proveResourceIcons(b, out, records, baseUrl) {
  mkdirSync(out, { recursive: true });
  for (const [layout, width, height] of [
    ["desktop", 1440, 1000],
    ["phone", 390, 844],
  ]) {
    const record = { name: layout + "-resource-icons", ready: false, presses: [], checks: [] };
    records.push(record);
    const check = async (name, expression) =>
      record.checks.push({ check: name, ok: (await b.evaluate(expression)) === true });
    const decode = async (name) =>
      check(
        name + ": all art decodes at exact size",
        `(async () => {
      const images = [...document.querySelectorAll('.rss-art-slot img')];
      try { await Promise.all(images.map(image => image.decode())); } catch { return false; }
      return images.length > 0 && images.every(image => image.naturalWidth > 0 &&
        image.getBoundingClientRect().width === Number(image.closest('[data-size]').dataset.size) &&
        image.getBoundingClientRect().height === Number(image.closest('[data-size]').dataset.size));
    })()`,
      );
    const fit = async (name) =>
      check(name + ": no horizontal overflow", "document.documentElement.scrollWidth <= innerWidth");
    const sheet = async (name) => {
      const fullHeight = await b.evaluate("Math.ceil(document.querySelector('.rss-lab').scrollHeight + 80)");
      await b.run("set", "viewport", String(width), String(fullHeight));
      await b.run("scrollintoview", ".rss-lab > header");
      await b.run("screenshot", join(out, layout + "-" + name + ".png"));
      await b.run("set", "viewport", String(width), String(height));
    };
    const select = async (label, value) => {
      record.presses.push({ select: label, value });
      await b.run("select", '[aria-label="' + label + '"]', value);
    };
    const tab = async (name) => {
      record.presses.push({ tab: name });
      await b.run("click", 'nav[aria-label="Resource review sections"] button:has-text("' + name + '")');
    };
    await b.run("set", "viewport", String(width), String(height));
    await b.run("open", baseUrl + "/lab/kit/resource-icons", "--ignore-https-errors");
    await b.run("wait", '[data-template="retained"]');
    record.ready = true;
    await check(
      "All 58 resources assigned once; nine templates and 21 samples",
      `(() => {
      const assigned = [...document.querySelectorAll('[data-template-member]')].map(n=>n.dataset.templateMember)
        .concat([...document.querySelectorAll('[data-retained]')].map(n=>n.dataset.retained));
      return assigned.length === 58 && new Set(assigned).size === 58 &&
        document.querySelectorAll('[data-template]').length === 10 &&
        document.querySelectorAll('[data-template-sample]').length === 21;
    })()`,
    );
    const categories = await b.evaluate(
      "(async()=> (await (await fetch('/lab/rss-icons/manifest.json')).json()).categories.map(c=>c.id))()",
    );
    for (const category of categories) {
      await select("Template category", category);
      await decode(category);
      await fit(category);
      await check(
        category + ": exact old, shipped and template URLs at four sizes",
        `(async () => {
        const manifest = await (await fetch('/lab/rss-icons/manifest.json')).json();
        const { meanings } = await (await fetch('/icons/facets/manifest.json')).json();
        const category = manifest.categories.find(c=>c.id===${JSON.stringify(category)});
        const rows = [...document.querySelectorAll('[data-resource-comparison]')];
        return rows.length === category.samples.reduce((n,s)=>n+s.meanings.length,0) && category.samples.every(sample =>
          sample.meanings.every(meaning => {
            const row = rows.find(r=>r.dataset.resourceComparison===meaning);
            return row && ['old','shipped','proposal'].every(version => {
              const group = row.querySelector('[data-version='+version+']');
              const images = [...group.querySelectorAll('img')];
              const tier = meaning.match(/-relic-([12])$/)?.[1];
              if (tier && (group.querySelectorAll('[data-tier]').length !== 4 ||
                [...group.querySelectorAll('[data-tier]')].some(n=>n.textContent !== (tier==='1'?'I':'II')))) return false;
              return images.length === 4 && images.every((image,i)=>{
                const size = [16,24,32,40][i], pixels = size>32?128:64;
                const expected = version==='old' ? '/lab/rss-icons/history/'+meaning+'.png'
                  : version==='proposal' ? '/lab/rss-icons/'+pixels+'/'+sample.art+'.webp'
                  : '/icons/facets/'+pixels+'/'+meanings[meaning].art+'.webp';
                return image.width===size && image.getAttribute('src')===expected;
              });
            });
          }));
      })()`,
      );
      await sheet(category);
    }
    await b.run("click", 'button:has-text("Hide names")');
    await check(
      "Hide names conceals labels",
      "[...document.querySelectorAll('.rss-name')].every(n=>getComputedStyle(n).visibility==='hidden')",
    );
    for (const view of ["greyscale", "silhouette", "colour"]) {
      await select("Resource view", view);
      await check(
        view + " changes rendering",
        `(() => {
        const f = getComputedStyle(document.querySelector('.rss-art-slot img')).filter;
        return ${view === "greyscale" ? "f.includes('grayscale(1)')" : view === "silhouette" ? "f.includes('brightness(0)') && f.includes('invert(1)')" : "f==='none'"};
      })()`,
      );
      if (view !== "colour") await sheet("relics-" + view);
    }
    await b.run("click", 'button:has-text("Show names")');
    await select("Template category", "retained");
    await decode("Retained");
    await fit("Retained");
    await check(
      "LORDS is official SVG; historical SAT stays a glyph",
      `document.querySelectorAll('[data-version=shipped] [data-icon=lords][src="/tokens/lords.svg"]').length===4 &&
      document.querySelectorAll('[data-history-glyph=s-a-t]').length===4 && document.querySelectorAll('[data-proposal-art]').length===0`,
    );
    await sheet("retained");
    await tab("Inventory");
    for (const art of ["old", "shipped"]) {
      await select("Inventory artwork", art);
      await decode("Inventory " + art);
      await fit("Inventory " + art);
      await check(
        "Inventory " + art + ": all 58 exact resource mappings",
        `(async () => {
        const {resources,meanings}=await (await fetch('/icons/facets/manifest.json')).json();
        const rows=[...document.querySelectorAll('[data-resource-id]')];
        return rows.length===58 && rows.every((row,i)=>{
          if(Number(row.dataset.resourceId)!==i+1) return false;
          const meaning=resources[i+1].meaning;
          if(${JSON.stringify(art)}==='old' && meaning==='s-a-t') return row.querySelectorAll('[data-history-glyph]').length===4;
          const images=[...row.querySelectorAll('img')];
          return images.length===4 && images.every(image=>{
            const pixels=image.width>32?128:64;
            const expected=${JSON.stringify(art)}==='old'?'/lab/rss-icons/history/'+meaning+'.png'
              :meanings[meaning].token?'/tokens/lords.svg':'/icons/facets/'+pixels+'/'+meanings[meaning].art+'.webp';
            return image.getAttribute('src')===expected;
          });
        });
      })()`,
      );
      await sheet("inventory-" + art);
    }
    await tab("Other families");
    await decode("Other families");
    await fit("Other families");
    await check(
      "Three shipped families retain their exact artwork",
      `(async()=>{
      const m=await (await fetch('/lab/rss-icons/manifest.json')).json();
      const {meanings}=await (await fetch('/icons/facets/manifest.json')).json();
      return document.querySelectorAll('[data-shipped-family]').length===3 && m.shippedFamilies.every(f=>
        f.members.every(meaning=>{
          const images=[...document.querySelectorAll('[data-shipped-family='+f.id+'] [data-meaning='+meaning+'] img')];
          return images.length===4 && images.every(image=>image.getAttribute('src')==='/icons/facets/'+(image.width>32?128:64)+'/'+meanings[meaning].art+'.webp');
        }));
    })()`,
    );
    await sheet("other-families");
    await tab("Findings");
    await decode("Findings");
    await fit("Findings");
    await check(
      "17 shipped confusion findings retained",
      "document.querySelectorAll('[data-confusion]').length===17 && document.querySelectorAll('[data-proposal-art]').length===0",
    );
    await b.run("scrollintoview", ".rss-lab > header");
    await b.run("screenshot", join(out, layout + "-findings.png"));
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
      process.argv.includes("--resources")
        ? proveResourceIcons(b, out, records, baseUrl)
        : process.argv.includes("--minimap-url")
          ? proveMinimapEmblems(b, out, records, process.argv[process.argv.indexOf("--minimap-url") + 1])
          : proveIcons(
              b,
              out,
              records,
              baseUrl,
              missingSvg ? "desktop" : undefined,
              missingSvg || process.argv.includes("--catalog")
                ? ["catalog"]
                : process.argv.includes("--lords")
                  ? ["catalog", "purse", "frontier", "withdraw", "entry", "results", "lords-prize"]
                  : undefined,
              missingSvg,
            ),
  );
}
