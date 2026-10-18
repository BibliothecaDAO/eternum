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
      if (name !== "lords") throw new Error(`Unexpected token mark: ${name}`);
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
  for (let id = 1; id <= 58; id++) {
    if (!meanings[resources[id]?.meaning]) throw new Error(`Missing resource meaning: ${id}`);
  }
  for (const [meaning, art] of Object.entries({
    transfer: "donkey",
    move: "move",
    production: "production",
    settings: "settings",
  })) {
    if (meanings[meaning]?.art !== art)
      throw new Error(`${meaning} must use ${art}; use the semantic meaning instead of choosing another action's art.`);
  }
  for (const kind of ["knight", "crossbowman", "paladin"])
    for (const tier of [1, 2, 3])
      if (!paintings.has(`${kind}-t${tier}`)) throw new Error(`Missing soldier portrait: ${kind} T${tier}`);
  for (const level of [0, 1, 2, 3]) {
    for (const name of [`realm-${level}`, `map-realm-${level}`]) {
      if (meanings[name]?.art !== name) throw new Error(`${name} must use its own level painting`);
    }
  }
  for (const [id, key] of [...icons.map(({ id }) => [id, `faceted/${id}`]), ["LORDS", "official/lords"]]) {
    const review = verdicts[key];
    if (!review || !["equal", "beats shipped"].includes(review.verdict) || !review.reason?.trim())
      throw new Error(`Review ${id}: a missing, worse or unexplained verdict cannot ship.`);
  }
}
