async (page) => {
  const url = new URL(page.url());
  const out = url.searchParams.get("evidence"),
    repo = url.searchParams.get("repo");
  if (!out?.startsWith("/") || !repo?.startsWith("/"))
    throw new Error("Open the lab with absolute repo and fresh evidence paths");
  const artwork = `${repo}/apps/game/asset-sources/lab/army-tree`;
  const routes = ["display", "insert"],
    branches = ["Economy", "Barracks", "Training", "Castle"];
  const viewports = [
    { width: 1180, height: 1000, device: "desktop" },
    { width: 390, height: 844, device: "phone" },
  ];
  const errors = [],
    captures = [],
    checks = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const viewport of viewports)
    for (const route of routes)
      for (const branch of branches) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const capture = new URL("/lab/kit/army-tree", url.origin);
        capture.searchParams.set("route", route);
        capture.searchParams.set("capture", branch);
        await page.goto(capture.href);
        const panel = page.locator("[data-tree-capture]");
        await panel.waitFor();
        await page.evaluate(() => document.fonts.ready);
        const box = await panel.boundingBox();
        await page.setViewportSize({ width: viewport.width, height: Math.ceil(box.height + 150) });
        const footer = await panel.locator("footer").boundingBox();
        if (!footer || footer.y + footer.height > (await page.viewportSize()).height)
          throw new Error("Clipped capture footer");
        const file = `${route}-${branch.toLowerCase()}-${viewport.device}.png`;
        await panel.screenshot({ path: `${out}/${file}` });
        await panel.screenshot({ path: `${artwork}/${file}` });
        captures.push({ route, branch, device: viewport.device, file, text: await panel.innerText() });
      }
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(new URL("/lab/kit/army-tree", url.origin).href);
    for (const [index, route] of routes.entries()) {
      await page.getByRole("navigation", { name: "Tier route" }).getByRole("button").nth(index).click();
      for (const branch of branches) {
        await page.getByRole("button", { name: branch, exact: true }).click();
        const file = `${route}-${branch.toLowerCase()}-${viewport.device}.png`;
        await page.waitForFunction((file) => {
          const img = document.querySelector("figure img");
          return img?.complete && img.naturalWidth > 0 && img.currentSrc.endsWith(file);
        }, file);
        const state = await page.evaluate(() => ({
          images: document.querySelectorAll("figure img").length,
          src: document.querySelector("figure img").currentSrc,
          liveFrames: document.querySelectorAll("canvas,iframe").length,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }));
        if (state.images !== 1 || state.liveFrames || state.overflow) throw new Error(JSON.stringify(state));
        checks.push({ route, branch, viewport, ...state });
        const contentHeight = await page.locator('[data-lab="army-tree"]').evaluate((node) => node.scrollHeight);
        await page.setViewportSize({ width: viewport.width, height: contentHeight + 150 });
        await page.screenshot({ path: `${out}/page-${file}`, fullPage: true });
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      }
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  await page.goto("about:blank");
  return { captures, checks, errors, out };
};
