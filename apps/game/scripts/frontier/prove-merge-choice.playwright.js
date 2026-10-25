/** Open /lab/kit/hud/merge?evidence=<new-absolute-directory>, then run this page function through Playwright. */
async (page) => {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const out = new URL(page.url()).searchParams.get("evidence");
  if (!out?.startsWith("/")) throw new Error("Set an absolute evidence directory in the page URL");
  await mkdir(out, { recursive: false });
  const transcript = [];
  try {
    for (const [width, height] of [
      [1440, 1000],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.reload();
      const sheet = page.getByRole("dialog", { name: "Transfer troops" });
      await sheet.waitFor();
      const text = await sheet.innerText();
      if (!text.includes("Army 2 survives") || !text.includes("Army 1’s XP and upgrades are not carried over")) {
        throw new Error("The chosen target and the loss must be visible before merging");
      }
      await page.getByRole("button", { name: "Merge into Army 2", exact: true }).click();
      const confirm = page.getByRole("button", { name: "Confirm merge into Army 2", exact: true });
      await confirm.waitFor();
      if (!(await sheet.innerText()).includes("Army 1 loses 200 progression value")) {
        throw new Error("The confirmation must name the exact loss");
      }
      const box = await confirm.boundingBox();
      if (!box || box.x < 0 || box.x + box.width > width || box.y < 0 || box.y + box.height > height) {
        throw new Error("Confirmation must be reachable within the viewport");
      }
      await page.screenshot({ path: `${out}/confirm-${width}.png`, fullPage: true });
      transcript.push({ width, height, action: "Merge into Army 2", result: await sheet.innerText() });
      await page.getByRole("button", { name: "Even", exact: true }).click();
      if (await confirm.count()) throw new Error("Changing the split must clear confirmation");
      await page.getByRole("button", { name: "Move 50 to Army 2", exact: true }).waitFor();
      await page.getByRole("button", { name: "All to Army 1", exact: true }).click();
      await page.getByRole("button", { name: "Merge into Army 1", exact: true }).waitFor();
      if (!(await sheet.innerText()).includes("Army 1 survives"))
        throw new Error("Both merge directions must remain available");
      transcript.push({ width, height, action: "Even, then All to Army 1", result: await sheet.innerText() });
      await page.screenshot({ path: `${out}/reverse-${width}.png`, fullPage: true });
    }
    await writeFile(`${out}/transcript.json`, JSON.stringify(transcript, null, 2));
    return transcript;
  } finally {
    await page.goto("about:blank");
  }
};
