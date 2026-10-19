async (page) => {
  const entry = new URL(page.url());
  const output = entry.searchParams.get("evidence");
  if (!output?.startsWith("/")) throw new Error("Provide ?evidence=/absolute/new/capture/directory");
  const errors = [];
  const captures = [];
  const onError = (error) => errors.push(error.message);
  page.on("pageerror", onError);
  try {
    await page.setViewportSize({ width: 1500, height: 1000 });
    for (const kind of ["camp", "stragglers"]) {
      for (const distance of [20, 8]) {
        const url = new URL(
          `/lab/models?family=cleared-sites&site=${kind}&distance=${distance}&rendererMode=webgpu-force-webgl`,
          entry,
        );
        const requests = [];
        const onResponse = (response) => {
          if (/\/models\/outposts\//.test(response.url()))
            requests.push({ url: response.url(), status: response.status() });
        };
        page.on("response", onResponse);
        try {
          await page.goto(url.href);
          await page.locator(".cleared-site-lab[data-ready=true]").waitFor({ timeout: 60000 });
          await page.getByRole("button", { name: "Select current site", exact: true }).click();
          await page
            .getByRole("complementary", { name: "Selected site" })
            .getByText("Standing", { exact: true })
            .waitFor();
          // The cloth's visible centre at the fixed viewport and the two authored camera views.
          await page.mouse.click(distance === 20 ? 850 : 995, distance === 20 ? 505 : 444);
          const receipt = page.getByRole("complementary", { name: "Selected site" });
          await receipt.getByRole("region", { name: "Clear reward" }).waitFor();
          const rewards = (await receipt.locator("[data-site-rewards]").innerText()).replace(/\s+/g, " ").trim();
          const expected = kind === "camp" ? "550 Labor 82 XP" : "82 XP";
          if (rewards !== expected) throw new Error(`Expected ${expected}; selected site showed ${rewards}`);
          for (const path of [`/models/outposts/${kind}.glb`, "/models/outposts/cleared-standard.glb"]) {
            if (!requests.some((request) => request.url.endsWith(path) && request.status === 200))
              throw new Error(`Missing delivered model ${path}`);
          }
          const screenshot = `${output}/${kind}-${distance}-selected.png`;
          await page.screenshot({ path: screenshot });
          await page.getByRole("button", { name: "Close site", exact: true }).click();
          if (await receipt.count()) throw new Error("Closing the site did not remove its panel");
          captures.push({ kind, distance, requests, screenshot });
        } finally {
          page.off("response", onResponse);
          await page.goto("about:blank");
        }
      }
    }
    if (errors.length) throw new Error(JSON.stringify(errors));
    return { passed: true, captures, errors };
  } finally {
    page.off("pageerror", onError);
    await page.goto("about:blank");
  }
};
