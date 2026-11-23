export function validateIcons({ icons, meanings, resources, verdicts }) {
  const paintings = new Set(icons.map((icon) => icon.id));
  if (meanings.lords?.token !== "lords" || "art" in meanings.lords || "rotation" in meanings.lords)
    throw new Error("LORDS must use the unmodified official token mark, not a painting.");
  if (resources[37]?.meaning !== "lords") throw new Error("Resource 37 must use the LORDS token meaning.");
  if (paintings.has("lords")) throw new Error("Remove the painted LORDS asset from the Facets catalog.");
  for (const [name, entry] of Object.entries(meanings)) {
    if (entry.rewardChest) {
      if (!/^reward-chest(?:-[0-4](?:-opened)?)?$/.test(name) || "art" in entry || "token" in entry)
        throw new Error(`Invalid reward chest meaning: ${name}`);
      continue;
    }
    if (entry.token) {
      if (!isOfficialMark(name, entry)) throw new Error(`Unexpected token mark: ${name}`);
      continue;
    }
    if (!paintings.has(entry.art)) throw new Error(`Missing painting for ${name}: ${entry.art}`);
  }
  for (const [name, expected] of [
    ["reward-chest", "band-4-sealed"],
    ...[0, 1, 2, 3, 4].flatMap((band) => [
      [`reward-chest-${band}`, `band-${band}-sealed`],
      [`reward-chest-${band}-opened`, `band-${band}-opened`],
    ]),
  ]) {
    if (meanings[name]?.rewardChest !== expected || "art" in meanings[name])
      throw new Error(`${name} must use its approved reward tier, not the in-game crate.`);
  }
  if (meanings.chest?.art !== "chest") throw new Error("The in-game crate must keep its model render.");
  for (const name of ["camp", ...Object.keys(meanings).filter((name) => name.startsWith("beast-"))]) {
    if (meanings[name]?.art !== name)
      throw new Error(
        `${name} must use its own painting; resolve Frontier guards by creature and Blitz sites by kind.`,
      );
  }
  for (let id = 1; id <= 58; id++) {
    if (!meanings[resources[id]?.meaning]) throw new Error(`Missing resource meaning: ${id}`);
  }
  for (const [meaning, art] of Object.entries({
    transfer: "transfer",
    move: "move",
    production: "production",
    settings: "settings",
  })) {
    if (meanings[meaning]?.art !== art)
      throw new Error(`${meaning} must use ${art}; use the semantic meaning instead of choosing another action's art.`);
  }
  if (resources[25]?.meaning !== "donkey" || meanings.donkey?.art !== "donkey")
    throw new Error("Resource 25 must retain the Donkey resource painting, separate from Transfer.");
  const utilityFamilies = new Set(["Controls", "Actions", "Statuses", "HUD", "Shell"]);
  for (const [name, entry] of Object.entries(meanings)) {
    if (!utilityFamilies.has(entry.family)) continue;
    if (icons.find((icon) => icon.id === entry.art)?.source?.kind !== "ivory-relief")
      throw new Error(`UI glyph ${name} must use the approved Ivory relief master through the Facets catalog.`);
  }
  for (const kind of ["knight", "crossbowman", "paladin"])
    for (const tier of [1, 2, 3])
      if (!paintings.has(`${kind}-t${tier}`)) throw new Error(`Missing soldier portrait: ${kind} T${tier}`);
  for (const level of [0, 1, 2, 3]) {
    for (const name of [`realm-${level}`, `map-realm-${level}`]) {
      if (meanings[name]?.art !== name) throw new Error(`${name} must use its own level painting`);
    }
  }
  const marks = Object.values(meanings).flatMap((entry) =>
    entry.token ? [[entry.label, `official/${entry.token}`]] : [],
  );
  for (const [id, key] of [...icons.map(({ id }) => [id, `faceted/${id}`]), ...marks]) {
    const review = verdicts[key];
    if (!review || !["equal", "beats shipped"].includes(review.verdict) || !review.reason?.trim())
      throw new Error(`Review ${id}: a missing, worse or unexplained verdict cannot ship.`);
  }
}

/**
 * An official mark shown as its owner publishes it, never painted: the LORDS token, and the brands the footer links
 * (`brand-<name>`, its own file). Each still needs its review.
 */
const isOfficialMark = (name, entry) =>
  name === "lords" || (entry.family === "Brands" && name.startsWith("brand-") && entry.token === name);
