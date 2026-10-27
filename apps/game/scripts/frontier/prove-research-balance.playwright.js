async (page) => {
  const entry = new URL(page.url());
  const output = entry.searchParams.get("evidence");
  if (!output?.startsWith("/")) throw new Error("Provide ?evidence=/absolute/new/capture/directory");
  const errors = [];
  const captures = [];
  const onError = (error) => errors.push(error.message);
  const assertText = async (locator, expected) => {
    const actual = await locator.innerText();
    if (!actual.includes(expected)) throw new Error(`Expected ${expected}; got ${actual}`);
  };
  page.on("pageerror", onError);
  try {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      for (const part of ["storage", "tree", "beasts"]) {
        await page.goto(new URL(`/lab/data?mode=frontier&view=balance&part=${part}`, entry).href);
        await page.getByRole("heading", { name: "Make each research pick count" }).waitFor();
        if (part === "storage") {
          await page.getByLabel("Realm level").selectOption("2");
          const granary = page.getByRole("button", { name: /^Granary/ });
          await assertText(granary, "40,000 wheat capacity → 56,000 wheat capacity");
          await granary.click();
          await page.getByRole("button", { name: "Add Granary to plan", exact: true }).click();
          await assertText(granary, "56,000 wheat capacity → 72,000 wheat capacity");
        } else if (part === "tree") {
          await page.getByRole("button", { name: "Add Drill to plan", exact: true }).click();
          await assertText(page.getByRole("button", { name: /^Drill/ }), "rank 2");
          const rations = page.getByRole("button", { name: /^Rations/ });
          await assertText(rations, "2,000 Essence + 1,500 labor");
          await rations.click();
          await page.getByRole("button", { name: "Add Rations to plan", exact: true }).click();
          await assertText(rations, "rank 1");
          await assertText(page.locator("[data-plan-cost]"), "6,000 Essence · 4,500 labor");
        } else {
          await assertText(page.locator("main"), "2,807.25 extra labor");
          await page.getByLabel("Depth", { exact: true }).selectOption("3");
          await assertText(page.locator("main"), "1,500–1,750 labor");
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        if (overflow) throw new Error(`Horizontal overflow: ${part} at ${viewport.width}`);
        const screenshot = `${output}/${part}-${viewport.width}.png`;
        await page.screenshot({ path: screenshot, fullPage: true });
        captures.push(screenshot);
      }
      await page.goto(new URL("/lab/kit/hud/selected", entry).href);
      const army = page.locator("[data-army-step]");
      await army.waitFor();
      await assertText(army, "620 / 900 XP");
      if ((await army.locator('.ui-tier[data-tier="0"]').count()) !== 3)
        throw new Error("Expected three untrained sockets");
      const stats = `${output}/army-${viewport.width}.png`;
      await page.screenshot({ path: stats });
      captures.push(stats);
      await army.getByRole("button", { name: "Level up", exact: true }).click();
      await army.locator('[data-attribute="logistics"]').click();
      await assertText(army, "+20");
      const rank = `${output}/level-up-${viewport.width}.png`;
      await page.screenshot({ path: rank });
      captures.push(rank);
      await army.locator('[data-attribute="stamina"]').click();
      await army.getByRole("button", { name: "Spend III point", exact: true }).click();
      await assertText(army, "+24");
      if (await army.getByRole("button", { name: "Refill", exact: true }).isDisabled())
        throw new Error("Held point cannot refill");
      const stamina = `${output}/stamina-${viewport.width}.png`;
      await page.screenshot({ path: stamina });
      captures.push(stamina);
      await page.goto("about:blank");
      await page.goto(new URL("/lab/kit/hud/research", entry).href);
      const farm = page.locator('[data-node="row-0"]');
      await farm.waitFor();
      if ((await farm.locator(".ui-tier").count()) !== 2) throw new Error("Research sides need separate gems");
      const research = `${output}/research-${viewport.width}.png`;
      await page.screenshot({ path: research });
      captures.push(research);
      await page.goto("about:blank");
      for (const state of ["site-ruin", "build-training"]) {
        await page.goto(new URL(`/lab/kit/hud/${state}`, entry).href);
        const sheet = page.locator("[data-kit-sheet]");
        await sheet.waitFor();
        if (state === "site-ruin") {
          await assertText(sheet, "First ruin clear or day end");
          await assertText(sheet, "+128");
        } else {
          await assertText(sheet, "6,000");
          await assertText(sheet, "1,500");
          if ((await sheet.locator('.ui-tier[aria-label="Common"]').count()) < 4)
            throw new Error("Training ranks missing");
        }
        const outside = await sheet.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight;
        });
        if (outside) throw new Error(`${state} exceeds ${viewport.width} viewport`);
        const screenshot = `${output}/${state}-${viewport.width}.png`;
        await page.screenshot({ path: screenshot });
        captures.push(screenshot);
        await page.goto("about:blank");
      }
    }
    if (errors.length) throw new Error(errors.join("\n"));
    return { captures, errors };
  } finally {
    page.off("pageerror", onError);
    await page.goto("about:blank");
  }
};
