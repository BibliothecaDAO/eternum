async (page) => {
  /* HUD_WATCH_URL */
  /* HUD_LIVE_SAMPLE */
  if (WATCH_URL) return watchLive(page);

  const origin = "https://127.0.0.1:4192";
  const out = `/home/djizus/projects/eternum-lanes/evidence/hud/proof-${new Date().toISOString().replaceAll(":", "-")}`;
  /* HUD_SAMPLER */
  /* HUD_REVIEW */
  const records = [],
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const check = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  async function ready() {
    await page.locator('.hud-live-map[data-renderer-state="ready"]').waitFor({ timeout: 45000 });
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".action-dock img").first().waitFor();
    await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  }
  async function capture(name) {
    const groups = await page.evaluate(readVisibleUnits);
    const review = await page.evaluate(inspectHudReview);
    const layout = await page.locator(".hud-scene").getAttribute("data-layout");
    const failures = page.viewportSize().width === 1440 && layout === "rails" ? judgeHudReview(review) : [];
    const missing = await page
      .locator("img")
      .evaluateAll((images) => images.filter((img) => !img.complete || !img.naturalWidth).map((img) => img.src));
    const svgMissing = await page.locator("svg image").evaluateAll(async (images) => {
      const checks = await Promise.all(
        images.map(async (element) => {
          const src = element.getAttribute("href");
          const image = new Image();
          image.src = src;
          try {
            await image.decode();
            return null;
          } catch {
            return src;
          }
        }),
      );
      return checks.filter(Boolean);
    });
    check(!missing.length && !svgMissing.length, `Missing paintings: ${[...missing, ...svgMissing]}`);
    check(!failures.length, `${name}: ${failures.join("; ")}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), "Horizontal overflow");
    await page.screenshot({ path: `${out}/${name}.png`, scale: "css" });
    records.push({
      name,
      viewport: page.viewportSize(),
      groups,
      count: groups.reduce((sum, group) => sum + group.elements.length, 0),
      review,
      covered: coveredPixels(review.frames, ...review.viewport),
      failures,
    });
  }
  async function inspectBubbles() {
    const result = await page.locator(".action-dock").evaluate((dock) => {
      const css = getComputedStyle(dock);
      return {
        background: css.backgroundImage,
        color: css.backgroundColor,
        shadow: css.boxShadow,
        border: css.borderTopWidth,
        bubbles: [...dock.querySelectorAll(".action-circle")].map((circle) => {
          const r = circle.getBoundingClientRect(),
            image = circle.querySelector("img").getBoundingClientRect();
          return {
            src: circle.querySelector("img").getAttribute("src"),
            fit: Math.hypot(image.width, image.height) <= r.width - 2,
            clip: getComputedStyle(circle).overflow,
          };
        }),
      };
    });
    check(
      result.background === "none" &&
        result.color === "rgba(0, 0, 0, 0)" &&
        result.shadow === "none" &&
        result.border === "0px",
      "Commands must float without a shared panel",
    );
    check(
      result.bubbles.every((item) => item.fit && item.clip === "hidden"),
      "A painting crosses its circular rim",
    );
    check(
      result.bubbles.some((item) => item.src.endsWith("/donkey.webp")),
      "Transfer must be a donkey",
    );
    check(!result.bubbles.some((item) => item.src.endsWith("/move.webp")), "Move art must not stand for Transfer");
    return result;
  }
  try {
    for (const count of [3, 25, 220])
      for (const [device, width, height] of [
        ["desktop", 1440, 900],
        ["phone", 390, 844],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto(`${origin}/lab/kit/hud/redesign?capture=1&variant=rails&count=${count}`);
        await ready();
        check(
          (await page.locator('[data-production-hud="ArenaHudView"]').count()) === 1,
          "Mount the production ArenaHudView",
        );
        check(
          (await page.getByRole("button", { name: "Trade", exact: true }).count()) === Number(count === 220),
          "Trade command mask",
        );
        check((await page.locator("[data-terrain-hex]").count()) === 216, "Use shipped terrain hex rendering");
        check((await page.locator(".map-marker").count()) === 0, "Delete the rectangular marker path");
        check(
          (await page.locator(".minimap [data-marker]").count()) === 5,
          "One shared badge for each of five occupants",
        );
        check(
          (await page.locator('select[aria-label="Sort structures"]').count()) === 0,
          "Remove unneeded attention filter",
        );
        await inspectBubbles();
        await capture(`a-${count}-${device}`);
        if (device === "phone") {
          await page.getByRole("button", { name: "Holdings", exact: true }).click();
          await capture(`a-${count}-phone-holdings`);
        }
        if (count === 220) {
          check((await page.locator(".category-chips button").count()) === 11, "All ten structure categories plus All");
          await page.getByRole("button", { name: "Mines", exact: true }).click();
          check((await page.locator(".holding-row").count()) === 22, "Mine category count must match filtered rows");
          await page.getByRole("button", { name: "All structures", exact: true }).click();
          await page.getByRole("textbox", { name: "Find a structure" }).fill("Lastwatch");
          check((await page.locator(".holding-row").count()) === 1, "Search must reach the last structure");
          await capture(`a-220-${device}-search`);
          await page.getByRole("textbox", { name: "Find a structure" }).fill("");
        }
        if (device === "desktop" && count === 3) {
          const markers = await page.locator(".minimap [data-marker-kind]").evaluateAll((markers) =>
            markers.map((mark) => {
              const badge = mark.querySelector("polygon").getBoundingClientRect(),
                hex = mark.parentElement.querySelector("[data-terrain-hex]").getBoundingClientRect();
              return {
                kind: mark.getAttribute("data-marker-kind"),
                owner: mark.querySelector("[data-marker]").getAttribute("data-owner"),
                fit: badge.width <= hex.width && badge.height <= hex.height,
              };
            }),
          );
          check(
            markers.every((marker) => marker.fit),
            "Badge must fit one native minimap hex",
          );
          check(
            markers.some((marker) => marker.owner === "ally"),
            "Allied square cue must survive the renderer facts boundary",
          );
          await page.getByRole("combobox", { name: "Production automation" }).selectOption("idle");
          check(
            (await page.locator(".realm-panel .resource-item small").count()) === 0,
            "Idle belongs in details only",
          );
          await page.getByRole("button", { name: "Stone production", exact: true }).click();
          check(
            (await page.locator(".resource-detail").innerText()).includes("2 buildings"),
            "Tap reveals production detail",
          );
          await page.getByRole("button", { name: "Stone production", exact: true }).click();
          await page.getByRole("button", { name: "Military", exact: true }).click();
          const troopArt = await page
            .locator("[data-kit-sheet] img")
            .evaluateAll((images) => [
              ...new Set(images.map((img) => img.getAttribute("src")).filter((src) => /-t[123]\.webp$/.test(src))),
            ]);
          check(troopArt.length === 9, "All nine type/tier portraits in production tokens and troop rows");
          await page.screenshot({ path: `${out}/troops-nine.png` });
          await page.getByRole("button", { name: "Back to map", exact: true }).click();
          await page.getByRole("button", { name: "Settings", exact: true }).click();
          check(
            (await page.getByRole("heading", { name: "Settings", exact: true }).count()) === 1,
            "Settings remains accessible",
          );
          await page.getByRole("button", { name: "Back to map", exact: true }).click();
        }
        await page.goto("about:blank");
      }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${origin}/lab/kit/hud/redesign?variant=rails&count=3`);
    await ready();
    const canvas = await page.locator(".hud-live-map canvas").elementHandle();
    await page.getByRole("button", { name: "Current HUD", exact: true }).click();
    await page.locator(".hud-scene.current").waitFor();
    check(
      await page.locator(".hud-live-map canvas").evaluate((el, old) => el === old, canvas),
      "Switch preserves the renderer and camera",
    );
    check(
      (await page.locator('.hud-scene img[src*="/icons/facets/"]').count()) > 0,
      "Current uses the origin icon system",
    );
    await page.goto(`${origin}/lab/kit/hud/redesign?capture=1&variant=current&count=3`);
    await ready();
    await capture("current-desktop");
    await page.goto("about:blank");
    await page.goto(
      `${origin}/lab/kit/hud/redesign?capture=1&variant=rails&count=220&density=grouped&placement=right&names=2`,
    );
    await ready();
    check(
      (await page.getByRole("button", { name: "Build view", exact: true }).count()) === 1,
      "Naming options remain available",
    );
    await page.getByRole("button", { name: /Other structures ·/ }).click();
    check((await page.locator(".holding-row").count()) === 220, "Grouped rows open without dropping structures");
    check(
      await page
        .locator(".action-dock")
        .evaluate((el) => Math.abs(el.getBoundingClientRect().right - (innerWidth - 12)) < 1),
      "Right dock placement",
    );
    await capture("a-220-grouped-right");
    await page.locator(".minimap").screenshot({ path: `${out}/hud-minimap.png` });
    await page.goto("about:blank");
    await page.goto(`${origin}/lab/kit/icons`);
    await page.locator(".icon-minimap").waitFor();
    await page.locator(".icon-minimap").screenshot({ path: `${out}/icons-lab-minimap.png` });
    await page.locator('[data-density="220"]').click();
    check((await page.locator(".marker-clusters .icon-cluster").count()) === 12, "Shared crowded grouping");
    await page.locator(".icon-minimap").screenshot({ path: `${out}/icons-lab-grouped.png` });
    check(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
    return {
      out,
      records,
      errors,
      reference: { current: coveredPixels(REFERENCE_FRAMES.current), warroom: coveredPixels(REFERENCE_FRAMES.warroom) },
      liveGame: "Not exercised by fixtures; use prepare:hud-proof --watch <chain>:<game>",
    };
  } finally {
    await page.goto("about:blank");
  }

  async function watchLive(page) {
    const out = `/home/djizus/projects/eternum-lanes/evidence/hud/live-${new Date().toISOString().replaceAll(":", "-")}`;
    const context = await page.context().browser().newContext({ ignoreHTTPSErrors: true });
    const live = await context.newPage();
    const errors = [],
      records = [],
      failures = [],
      connections = new Set();
    let orderSends = 0;
    live.on("pageerror", (error) => errors.push(error.message));
    live.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    live.on("request", (request) => {
      if (request.postData()?.includes("starknet_addInvokeTransaction")) orderSends += 1;
      const url = new URL(request.url());
      if (url.hostname.endsWith("dev-realms.party")) connections.add(url.origin);
    });
    const check = (ok, reason) => {
      if (!ok) failures.push(reason);
    };
    async function capture(name) {
      const reading = await live.evaluate(() => {
        const hud = document.querySelector('[data-production-hud="ArenaHudView"]');
        const box = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const { x, y, width, height, bottom, right } = element.getBoundingClientRect();
          return { x, y, width, height, bottom, right };
        };
        return {
          url: location.href,
          boot: document.documentElement.dataset.bootState,
          hud: Boolean(hud),
          identity: document.querySelector(".identity-chip")?.textContent,
          text: hud?.textContent,
          canvas: Boolean(document.querySelector("canvas")),
          commands: hud?.querySelectorAll("[data-command]").length,
          hexes: hud?.querySelectorAll("[data-terrain-hex]").length,
          markers: [...(hud?.querySelectorAll("[data-marker]") ?? [])].map((marker) => ({
            name: marker.getAttribute("data-marker"),
            owner: marker.getAttribute("data-owner"),
            value: marker.textContent,
          })),
          header: box('header[aria-label="Game controls"]'),
          standings: box('[aria-label="Spectator standings"]'),
          chat: box('.hud-chat-host button[aria-label="Chat"]'),
          version: box('a[href="https://github.com/BibliothecaDAO/eternum"]'),
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      const sample = await live.evaluate(LIVE_SAMPLE);
      await live.screenshot({ path: `${out}/${name}.png` });
      records.push({ name, viewport: live.viewportSize(), reading, sample });
      check(reading.identity === "Spectating", `${name}: signed-out spectator identity`);
      check(reading.hud && reading.canvas && reading.hexes > 0, `${name}: native HUD/map not ready`);
      check(reading.url.includes("spectate=true") && reading.commands === 0, `${name}: spectator command isolation`);
      check(!reading.horizontalOverflow, `${name}: horizontal overflow`);
      if (reading.chat && reading.version) {
        const a = reading.chat,
          b = reading.version;
        check(!(a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom), `${name}: version overlaps Chat`);
      }
      if (name === "phone-holdings")
        check(
          Boolean(reading.standings && reading.header && reading.standings.y >= reading.header.bottom),
          "Phone standings overlap the match header",
        );
    }
    try {
      for (const [device, width, height] of [
        ["desktop", 1440, 900],
        ["phone", 390, 844],
      ]) {
        await live.setViewportSize({ width, height });
        await live.goto(WATCH_URL);
        await live.locator('[data-production-hud="ArenaHudView"]').waitFor({ timeout: 60000 });
        await live.locator("[data-terrain-hex]").first().waitFor({ timeout: 30000 });
        await live.waitForTimeout(2000);
        await capture(`${device}-map`);
        await live.getByRole("button", { name: "Settings", exact: true }).click();
        await live.getByRole("heading", { name: "Video & Graphics", exact: true }).waitFor();
        await capture(`${device}-settings`);
        await live.keyboard.press("Escape");
        await live.getByRole("button", { name: "Log", exact: true }).click();
        await live.locator('[aria-label="Event filters"]').waitFor();
        await capture(`${device}-log`);
        await live.keyboard.press("Escape");
        if (device === "phone") {
          await live.getByRole("button", { name: "Holdings", exact: true }).click();
          await capture("phone-holdings");
          await live.getByRole("button", { name: "Map", exact: true }).click();
        }
        await live.goto("about:blank");
      }
      check(errors.length === 0, "Browser errors occurred");
      check(orderSends === 0, "Spectator sent an order");
      return {
        out,
        watchUrl: WATCH_URL,
        signedOutContext: true,
        orderSends,
        records,
        connections: [...connections],
        errors,
        failures,
      };
    } finally {
      await context.close();
    }
  }
};
