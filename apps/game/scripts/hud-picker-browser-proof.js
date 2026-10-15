async (page) => {
  const origin = "https://127.0.0.1:4192";
  const out = `/home/djizus/projects/eternum-lanes/evidence/hud/proof-${new Date().toISOString().replaceAll(":", "-")}`;
  const path = (name) => `${out}/${name}`;

  /* HUD_SAMPLER */
  /* HUD_REVIEW */
  function check(ok, message) {
    if (!ok) throw new Error(message);
  }

  async function capture(page, out, name, records) {
    await page.locator('.hud-live-map[data-renderer-state="ready"]').waitFor({ timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    const groups = await page.evaluate(readVisibleUnits);
    if (await page.locator(".hud-chat").isVisible())
      check(
        groups.some((group) => group.group === "Chat" && group.elements.length === 1),
        "Inventory must count standalone Chat control",
      );
    const viewport = page.viewportSize();
    const reading = await page.evaluate(() => ({
      layout: document.querySelector(".hud-scene")?.getAttribute("data-layout"),
      width: innerWidth,
      bodyWidth: document.documentElement.scrollWidth,
      height: innerHeight,
      sceneHeight: document.querySelector(".hud-scene")?.getBoundingClientRect().height,
      selected: document.querySelector(".tile-panel")?.textContent,
      missingImages: [...document.images].filter((img) => !img.complete || !img.naturalWidth).map((img) => img.src),
      primaryCount: document.querySelectorAll(".primary-suggestion button").length,
    }));
    await page.screenshot({ path: path(`${name}.png`), scale: "css" });
    const review = viewport.width === 1440 ? await page.evaluate(inspectHudReview) : null;
    const failures = review && reading.layout === "rails" ? judgeHudReview(review) : [];
    records.push({
      review,
      failures,
      covered: review ? coveredPixels(review.frames) : null,
      name,
      viewport,
      reading,
      groups,
      count: groups.reduce((sum, group) => sum + group.elements.length, 0),
    });
    check(failures.length === 0, `${name}: ${failures.join("; ")}`);
    check(reading.bodyWidth === reading.width, `${name}: horizontal overflow`);
    check(reading.sceneHeight === reading.height, `${name}: stage does not fit`);
    check(reading.missingImages.length === 0, `${name}: missing images`);
    check(reading.primaryCount === (reading.layout === "rails" ? 1 : 0), `${name}: expected one primary suggestion`);
  }

  async function baselineCaptures(page, out, records) {
    for (const layout of ["rails"]) {
      for (const count of [3, 25, 220]) {
        for (const [device, width, height] of [
          ["desktop", 1440, 900],
          ["phone", 390, 844],
        ]) {
          await page.setViewportSize({ width, height });
          await page.goto(`${origin}/lab/kit/hud/redesign?capture=1&variant=${layout}&count=${count}`);
          await page.getByRole("button", { name: "Build", exact: true }).waitFor();
          check(
            (await page.getByRole("button", { name: "Trade", exact: true }).count()) === (count === 220 ? 1 : 0),
            "Trade must follow the fixture command mask",
          );
          check(
            (await page.locator(".minimap polygon").count()) === 216,
            "Shipped minimap must render all 216 terrain fixture hexes",
          );
          check(
            (await page.locator(".minimap image").count()) === 5,
            "Shipped minimap must render three structures and two armies",
          );
          if (count === 3 && device === "desktop") {
            const fullyVisible = await page
              .locator(".structure-scroll")
              .evaluate((scroll) =>
                [...scroll.querySelectorAll(".holding-row")].every(
                  (row) => row.getBoundingClientRect().bottom <= scroll.getBoundingClientRect().bottom,
                ),
              );
            check(fullyVisible, "Three-structure fixture must show all three complete rows");
          }
          await capture(page, out, `${layout}-${count}-${device}`, records);
          await page.goto("about:blank");
        }
      }
    }
  }

  async function proveHoldings(page, out, records, device) {
    await page.setViewportSize(device === "phone" ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto(`${origin}/lab/kit/hud/redesign?capture=1&variant=rails&density=grouped&count=220`);
    if (device === "phone") await page.getByRole("button", { name: "Holdings", exact: true }).click();
    await page.getByRole("textbox", { name: "Find a structure" }).fill("Lastwatch");
    check((await page.locator(".holding-row").count()) === 1, "Search must leave exactly one result");
    await page.getByRole("button", { name: "Select Lastwatch 220" }).click();
    check(
      (await page.locator(".realm-panel").innerText()).includes("Lastwatch 220 · Camp"),
      "Selection must change realm context",
    );
    await capture(page, out, `search-select-${device}`, records);
    await page.getByRole("textbox", { name: "Find a structure" }).fill("no such structure");
    check(
      await page.getByText("No matching structures", { exact: true }).isVisible(),
      "Empty search must say no matches",
    );
    await page.getByRole("textbox", { name: "Find a structure" }).fill("");
    await page.getByRole("button", { name: "Camps", exact: true }).click();
    check(
      (await page.locator(".group-toggle").allTextContents()).some((text) => text.includes("Running · 38")) &&
        (await page.locator(".group-toggle").allTextContents()).some((text) => text.includes("Needs attention · 6")),
      "Camp filter must show exactly 44 fixtures",
    );
    await page.getByRole("combobox", { name: "Sort structures" }).selectOption("Name");
    await page.getByRole("button", { name: "All", exact: true }).click();
    check(
      (await page.locator(".holding-name").first().innerText()) === "Ashford 036",
      "Name sort must put Ashford 036 first in attention group",
    );
    await page.locator(".group-toggle").filter({ hasText: "Needs attention" }).click();
    await page.locator(".group-toggle").filter({ hasText: "Running" }).click();
    await page.getByRole("button", { name: "Select Lastwatch 220" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Select Lastwatch 220" }).click();
    await capture(page, out, `group-scroll-${device}`, records);
    await page.getByRole("combobox", { name: "Production automation" }).selectOption("Idle");
    check(
      (await page.locator(".resource-item small").allTextContents()).filter((text) => text === "Idle").length === 6,
      "Idle must pause all six circles",
    );
    await page.getByRole("combobox", { name: "Production automation" }).selectOption("Custom");
    check(
      (await page.locator(".resource-item small").allTextContents()).filter((text) => text === "Idle").length === 2,
      "Custom must restore the four producing readings",
    );
    await page.getByRole("button", { name: "Production detail ↗", exact: true }).click();
    check(await page.getByRole("dialog", { name: "Production detail" }).isVisible(), "Expert detail must open");
    check((await page.locator("tbody tr").count()) === 6, "Detail must show all six resources");
    await page.getByRole("button", { name: "Input rules", exact: true }).click();
    check(
      await page.getByText("Smart supplies each active building.", { exact: false }).isVisible(),
      "Input rules must expand",
    );
    await page.screenshot({ path: path(`production-detail-${device}.png`), scale: "css" });
    await page.keyboard.press("Escape");
    check((await page.getByRole("dialog").count()) === 0, "Escape must close detail");
    for (const name of ["Build", "Production", "Military", "Transfer", "Trade"]) {
      await page.getByRole("button", { name, exact: true }).click();
      check(await page.getByRole("dialog", { name, exact: true }).isVisible(), `${name} must open its own preview`);
      await page.getByRole("button", { name: "Back to map", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
    }
    if (device === "phone") await page.getByRole("button", { name: "Map", exact: true }).click();
    await page.getByRole("radio", { name: "Realm", exact: true }).click();
    check(
      (await page.getByRole("radio", { name: "Realm", exact: true }).getAttribute("aria-checked")) === "true",
      "Realm switch must select realm",
    );
    await page.getByRole("button", { name: "Scouts found grassland", exact: false }).click();
    check(
      (await page.locator(".tile-panel").innerText()).includes("Northern grassland"),
      "Event must change selected tile",
    );
    check(
      (await page.getByRole("radio", { name: "World map", exact: true }).getAttribute("aria-checked")) === "true",
      "Event must select world map",
    );
    await page.getByRole("button", { name: "enemy army, strength 120", exact: true }).click();
    check(
      await page.getByRole("dialog", { name: "Enemy army · strength 120" }).isVisible(),
      "Minimap value must open the named marker",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Level up to City", exact: false }).click();
    check(
      await page.getByRole("dialog", { name: "Level up to City" }).isVisible(),
      "Suggestion must open its named preview",
    );
    await page.keyboard.press("Escape");
    records.push({
      name: `interactions-${device}`,
      passed: [
        "search exact match",
        "empty search",
        "select realm",
        "filter 44 camps",
        "sort",
        "expand group",
        "scroll to final row",
        "Idle",
        "Custom",
        "production detail",
        "input rules",
        "Escape",
        "five command previews including Trade",
        "view switch",
        "event selection",
        "marker value",
        "suggestion",
      ],
    });
  }

  async function provePicker(page, out, records) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${origin}/lab/kit/hud/redesign`);
    await page.locator('.hud-live-map[data-renderer-state="ready"]').waitFor({ timeout: 30000 });
    check(
      (await page.getByRole("button", { name: "Current HUD", exact: true }).getAttribute("aria-pressed")) === "true",
      "Start on Current HUD",
    );
    const canvas = await page.locator(".hud-live-map canvas").elementHandle();
    await page.getByRole("button", { name: "A · Guided rails", exact: true }).click();
    await page.locator('.hud-scene[data-layout="rails"]').waitFor();
    check(
      await canvas.evaluate((node) => node === document.querySelector(".hud-live-map canvas")),
      "Switching HUD must retain the same renderer canvas",
    );
    check(
      await page.getByRole("button", { name: "Level up to City", exact: true }).isVisible(),
      "A must show the primary suggestion",
    );
    check((await page.getByRole("button", { name: "B · Resource shelf", exact: false }).count()) === 0, "Reject B");
    await page.getByRole("combobox", { name: "Fixture scale" }).selectOption("220");
    await page.getByRole("combobox", { name: "View names", exact: true }).selectOption("1");
    await page.getByRole("radio", { name: "Settlement", exact: true }).waitFor();
    await page.getByRole("combobox", { name: "View names", exact: true }).selectOption("2");
    await page.getByRole("radio", { name: "Build view", exact: true }).waitFor();
    await page.getByRole("combobox", { name: "List density", exact: true }).selectOption("grouped");
    await page.getByRole("combobox", { name: "Action placement", exact: true }).selectOption("right");
    check(await page.locator(".placement-right .action-dock").isVisible(), "Second dock placement");
    const before = await page.locator(".hud-live-map canvas").screenshot();
    await page.mouse.move(700, 500);
    await page.mouse.down();
    await page.mouse.move(800, 530, { steps: 6 });
    await page.mouse.up();
    const moved = await page.locator(".hud-live-map canvas").screenshot();
    check(before.toString("base64") !== moved.toString("base64"), "Drag must change the live terrain view");
    const viewBox = await page.locator(".minimap svg").getAttribute("viewBox");
    const mapBounds = await page.locator(".minimap svg").boundingBox();
    await page.mouse.move(mapBounds.x + 20, mapBounds.y + 90);
    await page.mouse.down();
    await page.mouse.move(mapBounds.x + 45, mapBounds.y + 100, { steps: 5 });
    await page.mouse.up();
    await page.waitForFunction(
      (previous) => document.querySelector(".minimap svg")?.getAttribute("viewBox") !== previous,
      viewBox,
    );
    check(
      await canvas.evaluate((node) => node === document.querySelector(".hud-live-map canvas")),
      "Minimap navigation must use the mounted game renderer",
    );
    await page.waitForFunction(() => {
      const map = document.querySelector(".minimap");
      if (!map) return false;
      const markers = [...map.querySelectorAll(".map-marker")];
      return (
        markers.length === 3 &&
        markers.every((marker, index) => {
          const id = ["3", "501", "999"][index];
          const art = map.querySelector(`image[data-entity-id="${id}"]`);
          if (!art) return marker.getBoundingClientRect().right < map.getBoundingClientRect().left;
          const a = art.getBoundingClientRect(),
            m = marker.getBoundingClientRect();
          return (
            Math.abs(a.x + a.width / 2 - m.x - m.width / 2) < 1 && Math.abs(a.y + a.height / 2 - m.y - m.height / 2) < 1
          );
        })
      );
    });
    await page.getByRole("button", { name: "Reset camera", exact: true }).click();
    await page.screenshot({ path: path("live-lab-controls.png"), scale: "css" });
    records.push({
      name: "live-lab",
      passed: [
        "current/A switch",
        "same renderer retained",
        "220 fixtures",
        "three naming pairs",
        "grouped list",
        "second command placement",
        "live camera drag",
        "reset camera",
        "minimap pans live camera",
      ],
    });
    await page.goto("about:blank");
  }

  const records = [],
    errors = [];
  const onError = (error) => errors.push(String(error));
  const onConsole = (message) => {
    if (message.type() === "error") errors.push(message.text());
  };
  let problem = null;
  page.on("pageerror", onError);
  page.on("console", onConsole);
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${origin}/lab/kit/hud/redesign?capture=1&variant=current&count=3`);
    await capture(page, out, "current-3-desktop", records);
    await page.goto("about:blank");
    await baselineCaptures(page, out, records);
    for (const device of ["desktop", "phone"]) await proveHoldings(page, out, records, device);
    await provePicker(page, out, records);
    check(errors.length === 0, "Browser errors recorded");
  } catch (error) {
    problem = String(error.stack ?? error);
  } finally {
    page.off("pageerror", onError);
    page.off("console", onConsole);
    await page.goto("about:blank");
  }
  return {
    references: Object.fromEntries(
      Object.entries(REFERENCE_FRAMES).map(([key, frames]) => [key, { frames, covered: coveredPixels(frames) }]),
    ),
    out,
    complete: problem === null,
    problem,
    errors,
    records,
  };
};
