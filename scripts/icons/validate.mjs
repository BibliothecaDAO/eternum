export function validateIcons({ icons, meanings, resources, verdicts }) {
  const paintings = new Set(icons.map((icon) => icon.id));
  for (const [name, entry] of Object.entries(meanings)) {
    if (!paintings.has(entry.art)) throw new Error(`Missing painting for ${name}: ${entry.art}`);
  }
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
  for (const icon of icons) {
    const review = verdicts[`faceted/${icon.id}`];
    if (!review || !["equal", "beats shipped"].includes(review.verdict) || !review.reason?.trim())
      throw new Error(`Review ${icon.id}: a missing, worse or unexplained verdict cannot ship.`);
  }
}
