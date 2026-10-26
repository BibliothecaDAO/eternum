async (page) => {
  const entry = new URL(page.url());
  const output = entry.searchParams.get("evidence");
  if (!output?.startsWith("/")) throw new Error("Provide ?evidence=/absolute/capture/directory on the lab URL");
  const assets = entry.searchParams.get("asset")
    ? [entry.searchParams.get("asset")]
    : ["camp", "village", "shrine", "well", "ruin"];
  if (assets.some((asset) => !["camp", "village", "shrine", "well", "ruin"].includes(asset)))
    throw new Error("Unknown outpost");
  const captures = [];
  const errors = [];
  const onError = (error) => errors.push(error.message);
  page.on("pageerror", onError);
  await page.setViewportSize({ width: 1500, height: 1000 });
  try {
    for (const asset of assets) {
      const owned = ["camp", "village"].includes(asset);
      const cases = [
        { biome: "Grassland", relationship: "enemy" },
        ...(owned ? [{ biome: "Grassland", relationship: "owned" }] : []),
        { biome: "Scene biomes", relationship: "enemy" },
      ];
      for (const scenario of cases) {
        const url = new URL("/lab/terrain?scene=tropical-coast&rendererMode=webgpu-force-webgl", entry);
        const requests = [];
        const onResponse = (response) => {
          if (response.url().includes("/models/outposts/"))
            requests.push({ url: response.url(), status: response.status() });
        };
        page.on("response", onResponse);
        try {
          await page.goto(url.href);
          await page.locator('[data-debug-route="procedural-terrain"][data-ready="true"]').waitFor();
          await page.getByRole("combobox", { name: "Building model" }).selectOption(`/models/outposts/${asset}.glb`);
          await page.getByRole("combobox", { name: "Preview biome" }).selectOption({ label: scenario.biome });
          await page.getByRole("combobox", { name: "Preview fog" }).selectOption("clear");
          if (owned) await page.getByRole("combobox", { name: "Ownership" }).selectOption(scenario.relationship);
          await page.getByRole("button", { name: "Place on selected tile", exact: true }).click();
          await page.getByText("Buildings and chests · 1", { exact: true }).waitFor();
          await page.getByRole("button", { name: "Place on selected tile", exact: true }).waitFor();
          await page.getByRole("button", { name: "Focus selected tile", exact: true }).click();
          if (!requests.some((request) => request.url.endsWith(`/${asset}.glb`) && request.status === 200))
            throw new Error(`The runtime did not load the approved ${asset}`);
          const screenshot = `${output}/${asset}-${scenario.biome.replaceAll(" ", "-")}-${scenario.relationship}.png`;
          await page.screenshot({ path: screenshot });
          captures.push({ asset, ...scenario, requests, screenshot });
        } finally {
          await page.goto("about:blank");
          page.off("response", onResponse);
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
