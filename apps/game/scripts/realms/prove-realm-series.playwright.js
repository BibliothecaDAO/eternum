(async function proveRealmSeries(shared, { baseUrl, output, reference }) {
  const page = await shared.context().newPage();
  const errors = [];
  const requests = new Set();
  const captures = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes(".glb")) {
      requests.add(response.url());
      if (!response.ok()) errors.push(`${response.status()}: ${response.url()}`);
    }
  });
  async function ready() {
    await page.waitForFunction(
      () => {
        const host = document.querySelector('[data-realm-ready="true"]');
        if (!host?.dataset.realmLoaded) return false;
        const loaded = JSON.parse(host.dataset.realmLoaded);
        const params = new URL(location.href).searchParams;
        return ["level", "wonder", "seed", "order", "owned", "distance", "lineup", "reference", "comparison"].every(
          (key) => {
            const value = params.get(key);
            if (value === null) return true;
            return String(typeof loaded[key] === "boolean" ? Number(loaded[key]) : loaded[key]) === value;
          },
        );
      },
      null,
      { timeout: 60000 },
    );
    await page.waitForTimeout(350);
  }
  async function select(label, value) {
    const key = {
      Age: "level",
      Distance: "distance",
      Revision: "comparison",
      Series: "wonder",
      Entity: "seed",
      Order: "order",
      Ownership: "owned",
    }[label];
    if (!key) throw new Error(`Unknown realm control: ${label}`);
    await page.getByLabel(label, { exact: true }).selectOption(String(value));
    await page.waitForURL((url) => url.searchParams.get(key) === String(value));
    await ready();
  }
  async function capture(name) {
    await ready();
    if ((await page.getByRole("status").innerText()).startsWith("Loading"))
      throw new Error("Capture attempted before the selected models rendered");
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    captures.push({ name, url: page.url(), label: await page.getByRole("status").innerText() });
  }
  try {
    await page.setViewportSize({ width: 1800, height: 1100 });
    const comparisonQuery = reference ? `&reference=${encodeURIComponent(reference)}&comparison=pair` : "";
    await page.goto(`${baseUrl}/lab/models?family=realms&level=${reference ? 1 : 0}&distance=20${comparisonQuery}`);
    await ready();
    if (reference) {
      for (const level of [1, 2, 3]) {
        await select("Age", level);
        for (const distance of [20, 6]) {
          await select("Distance", distance);
          await capture(`revision-${level}-${distance}-pair`);
        }
      }
      if (errors.length) throw new Error(errors.join("\n"));
      return { captures, requests: [...requests], errors };
    }
    for (const level of [0, 1, 2, 3]) {
      await select("Age", level);
      for (const distance of [20, 6, 45]) {
        await select("Distance", distance);
        await capture(`normal-${level}-${distance}`);
      }
    }
    await select("Series", 1);
    for (const [level, seed] of [
      [0, 1003],
      [1, 1002],
      [1, 1003],
      [2, 1002],
      [2, 1003],
      [3, 1003],
    ]) {
      await select("Age", level);
      await select("Entity", seed);
      for (const distance of [20, 6, 45]) {
        await select("Distance", distance);
        await capture(`wonder-${level}-${seed}-${distance}`);
      }
    }
    for (const seed of [1009, 1043, 1002, 1042, 1008, 1010]) {
      await select("Entity", seed);
      await select("Distance", 20);
      await capture(`sanctum-${seed}`);
    }
    await select("Entity", 1003);
    await page.getByLabel("All ages").click();
    await page.waitForURL((url) => url.searchParams.get("lineup") === "1");
    await ready();
    await capture("wonder-ladder");
    await select("Series", 0);
    await capture("normal-ladder");
    await page.getByLabel("All ages").click();
    await page.waitForURL((url) => url.searchParams.get("lineup") === "0");
    await ready();
    await select("Distance", 6);
    const orderValues = await page
      .getByLabel("Order", { exact: true })
      .locator("option")
      .evaluateAll((options) => options.slice(0, 3).map((option) => option.value));
    for (const order of orderValues) {
      await select("Order", order);
      for (const owned of [0, 1]) {
        await select("Ownership", owned);
        await capture(`heraldry-${order}-${owned}`);
      }
    }
    await select("Series", 1);
    await select("Age", 2);
    for (const seed of [1002, 1003, 1004]) {
      await select("Entity", seed);
      await capture(`aura-${seed}-a`);
      await page.waitForTimeout(1500);
      await capture(`aura-${seed}-b`);
    }
    if (errors.length) throw new Error(errors.join("\n"));
    if ([...requests].some((path) => path.includes("wonder2.glb") || path.includes("/settlements/")))
      throw new Error("Retired model requested");
    return { captures, requests: [...requests], errors };
  } finally {
    await page.close();
  }
});
