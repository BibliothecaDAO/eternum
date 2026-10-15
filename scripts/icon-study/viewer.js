const { themes, icons } = await fetch("catalog.json").then((response) => response.json());
let size = 24;
let density = 20;
let labels = true;
let selectedSample;
const readings = [];
const owners = ["you", "ally", "enemy"];
const colors = { you: "#86d8df", ally: "#c3b6fa", enemy: "#ffb083" };
const structures = [
  "realm-0",
  "village",
  "camp",
  "ruin",
  "shrine",
  "well",
  "mine",
  "hyperstructure",
  "spire",
  "bitcoinMine",
  "stragglers",
];
const svg = (theme, id, className = "icon") =>
  `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true"><use href="#${theme}-${id}"/></svg>`;
const groups = [...new Set(icons.map((icon) => icon.family))];

renderThemes();
wireControls();

function renderThemes() {
  document.getElementById("themes").innerHTML = themes
    .map(
      (theme) =>
        `<article class="theme" data-theme="${theme.id}"><div class="theme-head"><h2>${theme.name}</h2><p>${theme.note}</p><p class="grammar">${theme.grammar}</p><p>${theme.risk}</p><label class="choice"><input type="radio" name="theme" value="${theme.id}"> Choose ${theme.name}</label></div><h3>In the HUD</h3><div class="hud">${[
          ["resource-35", "2,400"],
          ["resource-23", "840"],
          ["resource-38", "120"],
          ["stamina", "6/8"],
          ["timer", "04:20"],
        ]
          .map(([id, value]) => `<span>${svg(theme.id, id)}${value}</span>`)
          .join(
            "",
          )}</div><h3>On the minimap</h3><div class="map-title"><span class="density-title">Blitz · 20 structures + 6 armies</span><span>320 × 240 px</span></div><div class="map-wrap" data-map="${theme.id}"></div><p class="map-note"></p><div class="legend">${renderLegend(theme.id)}</div>${groups
          .map(
            (family) =>
              `<section class="catalog-group"><h3>${family} <span>· ${icons.filter((i) => i.family === family).length}</span></h3><div class="grid">${icons
                .filter((i) => i.family === family)
                .map(
                  (icon) =>
                    `<button class="sample" data-icon="${icon.id}" data-theme="${theme.id}" aria-label="${icon.label}">${svg(theme.id, icon.id)}<span class="name">${icon.label}</span></button>`,
                )
                .join("")}</div></section>`,
          )
          .join("")}</article>`,
    )
    .join("");
  renderMaps();
}

function ownerShape(owner) {
  if (owner === "you") return '<circle cx="0" cy="0" r="9"/>';
  if (owner === "ally") return '<rect x="-9" y="-9" width="18" height="18"/>';
  return '<path d="M0-11 11 9H-11Z"/>';
}

function marker(theme, { x, y, owner, army, level, band, type, index }, markerSize = size) {
  const symbol = army ? "military" : type;
  const value = army ? band : level;
  const description = `${owner} ${army ? `army, strength band ${band}` : `${type.replaceAll("-", " ")}${type.startsWith("realm") ? `, level ${level}` : ""}`}`;
  const showLevel = !army && type.startsWith("realm");
  const bars = Array.from({ length: band }, (_, i) => `<rect x="${-5 + i * 4}" y="10" width="3" height="3"/>`).join("");
  return `<g class="marker" data-army="${army}" data-owner="${owner}" data-value="${value}" data-index="${index}" transform="translate(${x} ${y}) scale(${markerSize / 24})" role="img" aria-label="${description}"><title>${description}</title><g fill="#101719" stroke="${colors[owner]}" stroke-width="1.5">${ownerShape(owner)}</g><svg x="-8" y="-8" width="16" height="16" viewBox="0 0 24 24" color="#eee5ce"><use href="#${theme}-${symbol}"/></svg>${army ? `<g fill="${colors[owner]}" stroke="#101719" stroke-width=".4">${bars}</g>` : showLevel ? `<rect x="3" y="2" width="10" height="12" rx="1" fill="#101719"/><text x="8" y="12" text-anchor="middle" fill="${colors[owner]}" font-family="Atkinson" font-weight="700" font-size="11">${level}</text>` : ""}</g>`;
}

function fixture() {
  const count = density;
  const columns = density === 20 ? 5 : 20;
  const rows = count / columns;
  const items = Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const level = Math.floor(index / structures.length) % 4;
    let type = structures[index % structures.length];
    if (type === "realm-0") type = `realm-${level}`;
    return {
      x: 14 + column * (292 / (columns - 1)) + Math.sin(index * 11) * 3,
      y: 17 + row * (202 / (rows - 1)) + Math.cos(index * 7) * 3,
      owner: owners[(index * 7) % 3],
      army: false,
      type,
      level,
      band: 1 + (index % 3),
      index,
    };
  });
  for (let index = 0; index < (density === 20 ? 6 : 12); index++)
    items.push({
      x: 29 + ((index * 83) % 265),
      y: 45 + ((index * 47) % 173),
      owner: owners[index % 3],
      army: true,
      type: "military",
      level: 0,
      band: 1 + (index % 3),
      index: count + index,
    });
  return items;
}

function renderMaps() {
  for (const theme of themes) {
    document.querySelector(`[data-map="${theme.id}"]`).innerHTML =
      `<svg class="minimap" viewBox="0 0 320 240" aria-label="${density} structures and ${density === 20 ? 6 : 12} armies, ${theme.name}"><path d="M0 35 60 12 120 46 175 25 220 60 320 21V240H0Z" fill="#1b2929"/><path d="M0 190 60 158 92 205 135 173 180 213 250 160 320 198V240H0Z" fill="#23302a"/><path d="M175-10Q90 45 185 90T150 250" fill="none" stroke="#273e49" stroke-width="15"/>${fixture()
        .map((item) => marker(theme.id, item))
        .join("")}</svg>`;
  }
  document.querySelectorAll(".density-title").forEach((element) => {
    element.textContent = `${density === 20 ? "Blitz" : "Eternum"} · ${density} structures + ${density === 20 ? 6 : 12} armies`;
  });
  document.querySelectorAll(".map-note").forEach((element) => {
    element.textContent =
      density === 20
        ? `Same ${size} px marker footprint as the grid. Ownership uses shape; army bars show strength; realm numerals show level 0–3.`
        : `${size} px markers at 220 structures deliberately expose overlap. At this extent, a full per-site value cannot stay readable: zoom or aggregation is required before adoption.`;
  });
}

function renderLegend(theme) {
  const example = (army, value, owner) =>
    `<svg viewBox="0 0 42 32">${marker(theme, { x: 18, y: 14, owner, army, level: value, band: value, type: `realm-${value}`, index: -1 }, 24)}</svg>`;
  return `<div class="legend-row">${example(true, 1, "you")}${example(true, 2, "ally")}${example(true, 3, "enemy")}<span>Army strength · 1 / 2 / 3 bars</span></div><div class="legend-row">${example(false, 0, "you")}${example(false, 1, "ally")}${example(false, 3, "enemy")}<span>Realm level · 0 / 1 / 2 / 3</span></div><p>Strength bands: &lt;1k / 1k–5k / &gt;5k (illustration only). Bars mean strength, never troop tier. Troop ranks remain inside troop icons.</p>`;
}

function wireControls() {
  document.querySelectorAll("[data-size]").forEach((button) =>
    button.addEventListener("click", () => {
      size = Number(button.dataset.size);
      document.documentElement.style.setProperty("--icon-size", `${size}px`);
      document
        .querySelectorAll("[data-size]")
        .forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      renderMaps();
    }),
  );
  document.querySelectorAll("[data-density]").forEach((button) =>
    button.addEventListener("click", () => {
      density = Number(button.dataset.density);
      document
        .querySelectorAll("[data-density]")
        .forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      renderMaps();
    }),
  );
  document.getElementById("labels").addEventListener("click", (event) => {
    labels = !labels;
    document.body.classList.toggle("blind", !labels);
    event.target.textContent = labels ? "Hide labels" : "Show labels";
    event.target.setAttribute("aria-pressed", String(labels));
    document
      .querySelectorAll(".sample")
      .forEach((sample, index) =>
        sample.setAttribute(
          "aria-label",
          labels ? icons.find((icon) => icon.id === sample.dataset.icon).label : `Unlabelled sample ${index + 1}`,
        ),
      );
  });
  document.querySelectorAll(".sample").forEach((sample) =>
    sample.addEventListener("click", () => {
      selectedSample = { theme: sample.dataset.theme, icon: icons.find((icon) => icon.id === sample.dataset.icon) };
      document.querySelectorAll(".sample").forEach((item) => item.classList.toggle("active", item === sample));
      document.getElementById("sample-name").innerHTML =
        `${svg(selectedSample.theme, selectedSample.icon.id)} <span>${themes.find((theme) => theme.id === selectedSample.theme).name} · ${labels ? selectedSample.icon.label : "Unlabelled sample"}</span>`;
      document.getElementById("intended").textContent = "";
      document.getElementById("reading").value = "";
      document.getElementById("reveal").disabled = false;
      document.querySelector(".reading").scrollIntoView({ behavior: "instant", block: "center" });
      document.getElementById("reading").focus();
    }),
  );
  document.getElementById("reading-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const observed = document.getElementById("reading").value.trim();
    if (!selectedSample || !observed) return;
    const { theme, icon } = selectedSample;
    const reading = { theme, icon: icon.id, size, observed, intended: icon.reading };
    readings.push(reading);
    document.getElementById("intended").textContent = `${icon.label}: ${icon.reading}. ${icon.ambiguity ?? ""}`;
    const item = document.createElement("li");
    item.textContent = `${theme} · ${size}px · “${observed}” → ${icon.label}: ${icon.reading}`;
    document.getElementById("readings").append(item);
  });
  document.querySelectorAll('input[name="theme"]').forEach((input) =>
    input.addEventListener("change", () => {
      document
        .querySelectorAll(".theme")
        .forEach((card) => card.classList.toggle("selected", card.dataset.theme === input.value));
      document.getElementById("selection").textContent =
        `Selected for review: ${themes.find((theme) => theme.id === input.value).name}.`;
    }),
  );
  document.getElementById("download").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(readings, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "icon-readings.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
