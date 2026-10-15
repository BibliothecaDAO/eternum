async (page) => {
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
      liveGame: "Pending fresh-chain rollout",
    };
  } finally {
    await page.goto("about:blank");
  }
};
