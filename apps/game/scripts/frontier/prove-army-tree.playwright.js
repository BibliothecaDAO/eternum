async (page) => {
  const url = new URL(page.url());
  const out = url.searchParams.get("evidence");
  const repo = url.searchParams.get("repo");
  if (!out?.startsWith("/") || !repo?.startsWith("/"))
    throw new Error("Open the army-tree lab with absolute evidence and repo paths in its query");
  const artwork = `${repo}/apps/game/asset-sources/lab/army-tree`;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const scenes = ["Research", "Army", "Level up", "Troops"];
  const captures = [];
  await page.setViewportSize({ width: 440, height: 900 });
  for (const option of ["today", "a", "b", "c"]) {
    for (const scene of scenes) {
      const capture = new URL("/lab/kit/army-tree", url.origin);
      capture.searchParams.set("capture", scene);
      capture.searchParams.set("option", option);
      await page.goto(capture.href);
      const panel = page.locator("[data-tree-capture]");
      await panel.waitFor();
      await page.evaluate(() => document.fonts.ready);
      const bounds = await panel.boundingBox();
      await page.setViewportSize({ width: 440, height: Math.ceil(bounds.height + 150) });
      const footer = await panel.locator("footer").boundingBox();
      if (!footer || footer.y + footer.height > (await page.viewportSize()).height)
        throw new Error(`Capture footer clipped: ${option} ${scene}`);
      const file = `${option}-${scene.toLowerCase().replaceAll(" ", "-")}.png`;
      await panel.screenshot({ path: `${out}/${file}` });
      await panel.screenshot({ path: `${artwork}/${file}` });
      captures.push({ option, scene, file, text: await panel.innerText() });
    }
  }
  const checks = [];
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(new URL("/lab/kit/army-tree", url.origin).href);
    for (const option of ["a", "b", "c"]) {
      await page.getByRole("button", { name: new RegExp(`^${option.toUpperCase()} ·`) }).click();
      for (const scene of scenes) {
        await page.getByRole("button", { name: scene, exact: true }).click();
        await page.waitForFunction(() =>
          [...document.querySelectorAll("figure img")].every((img) => img.complete && img.naturalWidth > 0),
        );
        const state = await page.evaluate(() => ({
          images: [...document.querySelectorAll("figure img")].map((img) => ({
            src: img.getAttribute("src"),
            width: img.naturalWidth,
          })),
          liveFrames: document.querySelectorAll("canvas,iframe").length,
          overflow: document.documentElement.scrollWidth > innerWidth,
          choice: document.querySelector('[aria-label="Selected proposal"]').textContent,
        }));
        if (
          state.images.length !== 2 ||
          state.liveFrames ||
          state.overflow ||
          !state.images[1].src.includes(`/${option}-`)
        )
          throw new Error(`Broken comparison: ${JSON.stringify({ option, scene, width, state })}`);
        checks.push({ option, scene, width, ...state });
        if (width === 1440 && option === "a" && scene !== "Troops") {
          const contentHeight = await page.locator('[data-lab="army-tree"]').evaluate((node) => node.scrollHeight);
          await page.setViewportSize({ width, height: contentHeight + 150 });
          await page.screenshot({
            path: `${out}/a-${scene.toLowerCase().replaceAll(" ", "-")}-desktop.png`,
            fullPage: true,
          });
          await page.setViewportSize({ width, height });
        }
      }
      const contentHeight = await page.locator('[data-lab="army-tree"]').evaluate((node) => node.scrollHeight);
      await page.setViewportSize({ width, height: contentHeight + 150 });
      await page.screenshot({ path: `${out}/${option}-${width}.png`, fullPage: true });
      await page.setViewportSize({ width, height });
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  await page.goto("about:blank");
  return { captures, checks, errors, out };
};
