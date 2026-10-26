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
        await page.goto(new URL(`/lab/kit/research-balance?part=${part}`, entry).href);
        await page.getByRole("heading", { name: "Make each research pick count" }).waitFor();
        if (part === "storage") {
          await page.getByLabel("Realm level").selectOption("2");
          const granary = page.getByRole("button", { name: /^Granary/ });
          await assertText(granary, "40,000 wheat capacity → 60,000 wheat capacity");
          await granary.click();
          await page.getByRole("button", { name: "Add Granary to plan", exact: true }).click();
          await assertText(granary, "60,000 wheat capacity → 80,000 wheat capacity");
        } else if (part === "tree") {
          await page.getByRole("button", { name: "Add Drill to plan", exact: true }).click();
          await assertText(page.getByRole("button", { name: /^Drill/ }), "level 3");
          const rations = page.getByRole("button", { name: /^Rations/ });
          await assertText(rations, "4,000 Essence + 3,000 labor");
          await rations.click();
          await page.getByRole("button", { name: "Add Rations to plan", exact: true }).click();
          await assertText(rations, "level 2");
          await assertText(page.locator("[data-plan-cost]"), "20,000 Essence · 12,000 labor");
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
    }
    if (errors.length) throw new Error(errors.join("\n"));
    return { captures, errors };
  } finally {
    page.off("pageerror", onError);
    await page.goto("about:blank");
  }
};
