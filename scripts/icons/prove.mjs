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
    const record = { name: `${layout}-resource-icons`, ready: false, presses: [], checks: [] };
    records.push(record);
    const check = async (name, expression) =>
      record.checks.push({ check: name, ok: (await b.evaluate(expression)) === true });
    const decode = async () =>
      check(
        "Every visible painting decodes at its exact HUD size",
        `(async () => {
      const images = [...document.querySelectorAll('.rss-sample img')];
      try { await Promise.all(images.map(image => image.decode())); } catch { return false; }
      return images.length > 0 && images.every(image => image.naturalWidth > 0 &&
        image.getBoundingClientRect().width === Number(image.closest('[data-size]').dataset.size) &&
        image.getBoundingClientRect().height === Number(image.closest('[data-size]').dataset.size));
    })()`,
      );
    const fit = async () => check("No horizontal overflow", "document.documentElement.scrollWidth <= innerWidth");
    const sheet = async (name) => {
      const sheetHeight = await b.evaluate("Math.ceil(document.querySelector('.rss-lab').scrollHeight + 80)");
      await b.run("set", "viewport", String(width), String(sheetHeight));
      await b.run("scrollintoview", ".rss-lab header");
      await b.run("screenshot", join(out, `${layout}-${name}.png`));
      await b.run("set", "viewport", String(width), String(height));
    };
    await b.run("set", "viewport", String(width), String(height));
    await b.run("open", `${baseUrl}/lab/kit/resource-icons`, "--ignore-https-errors");
    await b.run("wait", "[data-resource-history='58']");
    await decode();
    await fit();
    await check(
      "All 58 rows compare exact historical art, shipped art and available A/B proposals",
      `(async () => {
        const { resources, meanings } = await (await fetch('/icons/facets/manifest.json')).json();
        const variants = await (await fetch('/lab/rss-icons/manifest.json')).json();
        const rows = [...document.querySelectorAll('[data-resource-history]')];
        return rows.length === 58 && rows.every((row, index) => {
          if (Number(row.dataset.resourceHistory) !== index + 1) return false;
          const meaning = resources[row.dataset.resourceHistory].meaning;
          const old = row.querySelector('[data-version=old]');
          const historical = [...old.querySelectorAll('img')];
          if (meaning === 's-a-t') {
            if (historical.length || old.querySelectorAll('[data-history-glyph=s-a-t]').length !== 3 ||
              [...old.querySelectorAll('[data-history-glyph]')].some(node => node.textContent !== '₿')) return false;
          } else if (historical.length !== 3 || historical.some(image => image.getAttribute('src') !==
            '/lab/rss-icons/history/' + meaning + '.png')) return false;
          return ['shipped','a','b'].every(version => {
            const images = [...row.querySelectorAll('[data-version='+version+'] img')];
            if (version !== 'shipped' && !variants[meaning+'-'+version]) return images.length === 0;
            return images.length === 3 && images.every(image => {
              const pixels = image.width > 32 ? 128 : 64;
              const expected = version !== 'shipped' ? '/lab/rss-icons/'+pixels+'/'+meaning+'-'+version+'.webp'
                : meanings[meaning].token ? '/tokens/lords.svg' : '/icons/facets/'+pixels+'/'+meanings[meaning].art+'.webp';
              return image.getAttribute('src') === expected;
            });
          });
        });
      })()`,
    );
    await b.run("screenshot", join(out, `${layout}-old-vs-new.png`));
    for (const id of [9, 25, 28, 37, 40, 58]) {
      await b.run("scrollintoview", `[data-resource-history="${id}"]`);
      await b.run("screenshot", join(out, `${layout}-history-${id}.png`));
    }
    await b.run("click", 'nav[aria-label="Resource review sections"] button:has-text("Inventory")');
    await b.run("wait", ".rss-inventory [data-resource-id='58']");
    record.ready = true;
    await b.run("select", '[aria-label="Inventory artwork"]', "old");
    await decode();
    await fit();
    await check(
      "Old inventory contains 57 archived paintings and the SAT glyph",
      `(() => {
      const rows = [...document.querySelectorAll('[data-resource-id]')];
      return rows.length === 58 && rows.every(row => row.dataset.resourceId === '58'
        ? row.querySelectorAll('[data-history-glyph]').length === 3 && row.querySelectorAll('img').length === 0
        : row.querySelectorAll('[data-history-art]').length === 3) && document.querySelectorAll('[data-proposal-art]').length === 0;
    })()`,
    );
    await sheet("inventory-old");
    for (const art of ["shipped", "a", "b"]) {
      await b.run("select", '[aria-label="Inventory artwork"]', art);
      await decode();
      await check(
        `All 58 resources; only reviewed art changes for ${art}`,
        `(async () => {
        const { resources, meanings } = await (await fetch('/icons/facets/manifest.json')).json();
        const variants = await (await fetch('/lab/rss-icons/manifest.json')).json();
        const rows = [...document.querySelectorAll('[data-resource-id]')];
        const ids = rows.map(row => Number(row.dataset.resourceId)).sort((a,b)=>a-b);
        return rows.every(row => {
          const meaning = resources[row.dataset.resourceId].meaning;
          const option = meaning + '-${art}';
          return [...row.querySelectorAll('img')].every(image => {
            const pixels = image.width > 32 ? 128 : 64;
            const expected = '${art}' !== 'shipped' && variants[option]
              ? '/lab/rss-icons/' + pixels + '/' + option + '.webp'
              : meanings[meaning].token ? '/tokens/lords.svg' : '/icons/facets/' + pixels + '/' + meanings[meaning].art + '.webp';
            return image.getAttribute('src') === expected;
          });
        }) && ids.length === 58 && ids.every((id, index) => id === index + 1) &&
          document.querySelectorAll('.rss-inventory [data-proposal-art]').length === ${art === "shipped" ? 0 : 51} &&
          document.querySelectorAll('.rss-inventory [data-icon=lords][src="/tokens/lords.svg"]').length === 3;
      })()`,
      );
      await fit();
      await sheet(`inventory-${art}`);
    }
    await b.run("select", '[aria-label="Inventory artwork"]', "shipped");
    await b.run("click", 'button:has-text("Hide names")');
    await check(
      "Hide names conceals the inventory names",
      `[...document.querySelectorAll('.rss-name')].every(node => getComputedStyle(node).visibility === 'hidden')`,
    );
    for (const view of ["greyscale", "silhouette", "colour"]) {
      await b.run("select", '[aria-label="Resource view"]', view);
      await check(
        `The ${view} control changes image rendering`,
        `(() => {
        const filter = getComputedStyle(document.querySelector('.rss-sample img')).filter;
        return ${view === "greyscale" ? "filter.includes('grayscale(1)')" : view === "silhouette" ? "filter.includes('brightness(0)') && filter.includes('invert(1)')" : "filter === 'none'"};
      })()`,
      );
      if (view !== "colour") await sheet(`inventory-${view}`);
    }
    await b.run("click", 'button:has-text("Show names")');
    for (const [family, count] of [
      ["Materials", 5],
      ["Troops", 3],
      ["Relics", 9],
    ]) {
      await b.run("click", `nav[aria-label="Resource review sections"] button:has-text("${family}")`);
      await decode();
      await fit();
      await check(
        `${family} shows old, shipped and two options for every reviewed resource`,
        `(() => {
        const rows = [...document.querySelectorAll('[data-resource-study]')];
        return rows.length === ${count} && rows.every(row => ['old','shipped','a','b'].every(version =>
          row.querySelectorAll('[data-version='+version+'] img').length === 3));
      })()`,
      );
      const meanings = await b.evaluate(
        "[...document.querySelectorAll('[data-resource-study]')].map(node => node.dataset.resourceStudy)",
      );
      for (const meaning of meanings) {
        await b.run("scrollintoview", `[data-resource-study="${meaning}"]`);
        await b.run("screenshot", join(out, `${layout}-${meaning}.png`));
      }
    }
    await b.run("click", 'nav[aria-label="Resource review sections"] button:has-text("Kept pairs")');
    await decode();
    await fit();
    await check(
      "Six kept groups remain unchanged",
      "document.querySelectorAll('.rss-comparison').length === 6 && document.querySelectorAll('[data-proposal-art]').length === 0",
    );
    await sheet("kept-pairs");
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
