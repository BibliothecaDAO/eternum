import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  buildLayout,
  corners,
  DIRECTIONS,
  disk,
  distance,
  halo,
  key,
  neighbors,
  project,
  RULES,
  scale,
} from "./geometry.mjs";

const out = fileURLToPath(new URL("./", import.meta.url));
const layout = buildLayout();
const C = {
  bg: "#0c0e10",
  panel: "#14191e",
  grid: "#29333c",
  text: "#eff2ee",
  muted: "#aab7bd",
  realm: "#69d9e8",
  spire: "#ff806f",
  bank: "#e8c574",
  mountain: "#647989",
  explored: "#293e46",
  route: "#f5e5b8",
};
const fmt = (n) => Number(n.toFixed(2));
const esc = (text) =>
  String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const xy = (point, size, cx = 800, cy = 770) => {
  const [x, y] = project(point, size);
  return [fmt(cx + x), fmt(cy + y)];
};
const points = (items) => items.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(" ");
const attrs = (values) =>
  Object.entries(values)
    .map(([name, value]) => `${name}="${esc(value)}"`)
    .join(" ");
const circle = (x, y, r, extra) => `<circle ${attrs({ cx: fmt(x), cy: fmt(y), r, ...extra })}/>`;
const text = (x, y, value, extra = {}) => `<text ${attrs({ x, y, ...extra })}>${esc(value)}</text>`;
const line = (a, b, extra = {}) => `<line ${attrs({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], ...extra })}/>`;
function hexPoints(center, radius) {
  return Array.from({ length: 6 }, (_, i) => [
    center[0] + Math.cos(((30 + i * 60) * Math.PI) / 180) * radius,
    center[1] + Math.sin(((30 + i * 60) * Math.PI) / 180) * radius,
  ]);
}
function hex(point, size, extra = {}, cx = 800, cy = 770) {
  return `<polygon ${attrs({ points: points(hexPoints(xy(point, size, cx, cy), size)), ...extra })}/>`;
}
function contour(radius, size, extra = {}) {
  return `<polygon ${attrs({ points: points(corners(radius).map((point) => xy(point, size))), fill: "none", ...extra })}/>`;
}
function spire(point, size, radius = 6) {
  const [x, y] = xy(point, size);
  return `<path d="M ${x} ${fmt(y - radius)} L ${fmt(x + radius * 0.8)} ${y} L ${x} ${fmt(y + radius)} L ${fmt(x - radius * 0.8)} ${y} Z" fill="${C.spire}" stroke="${C.bg}" stroke-width="1.2"/>`;
}
function bank(point, size, radius = 8) {
  const [x, y] = xy(point, size);
  return (
    circle(x, y, radius + 3, { fill: C.bg }) +
    circle(x, y, radius, { fill: C.bank, stroke: C.bank, "stroke-width": 1.5 })
  );
}
function head(title, subtitle, description, badge) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1580" viewBox="0 0 1600 1580" role="img" aria-labelledby="title desc">
<title id="title">${esc(title)}</title><desc id="desc">${esc(description)}</desc>
<defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z" fill="${C.route}"/></marker></defs>
<style>text{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:${C.text}}.muted{fill:${C.muted}}.small{font-size:18px}.label{font-size:20px;font-weight:600}.halo{paint-order:stroke;stroke:${C.bg};stroke-width:6px;stroke-linejoin:round}</style>
<rect width="1600" height="1580" fill="${C.bg}"/>
${text(58, 47, "ETERNUM / SEASON 2", { "font-size": 16, "letter-spacing": 3, fill: C.muted })}
${text(58, 96, title, { "font-size": 38, "font-weight": 650 })}
${text(58, 132, subtitle, { "font-size": 20, class: "muted" })}
${text(1542, 48, badge, { "font-size": 15, "letter-spacing": 2, "text-anchor": "end", fill: C.muted })}`;
}
function footer(items, note, secondNote) {
  let x = 64;
  let result = `<line x1="58" y1="1422" x2="1542" y2="1422" stroke="${C.grid}"/>`;
  for (const item of items) {
    result +=
      item.shape === "diamond"
        ? `<path d="M${x + 7},1445 l7,9 l-7,9 l-7,-9 Z" fill="${item.color}"/>`
        : item.shape === "square"
          ? `<rect x="${x}" y="1447" width="14" height="14" fill="${item.color}"/>`
          : circle(x + 7, 1454, 7, { fill: item.color });
    result += text(x + 25, 1461, item.label, { "font-size": 20 });
    x += item.width;
  }
  return (
    result +
    text(64, 1503, note, { "font-size": 19, class: "muted" }) +
    text(64, 1538, secondNote, { "font-size": 18, class: "muted" }) +
    "</svg>\n"
  );
}
function ringLabels(radii, size, conversion = 1) {
  return radii
    .map((radius) => {
      const [x, y] = xy([radius, -radius], size);
      return text(fmt(x + 17), fmt(y - 5), `${radius}${conversion > 1 ? ` / ${radius * conversion}` : ""}`, {
        "font-size": 17,
        class: "halo muted",
      });
    })
    .join("");
}
function primary(previous = false) {
  const extent = previous ? RULES.previousExtent : RULES.extent;
  const size = 700 / (Math.sqrt(3) * extent);
  const spires = previous ? layout.previousSpires : layout.etherealSpires;
  const spireKeys = new Set(spires.map(key));
  const banks = previous ? layout.previousBanks : [[0, 0]];
  const bankKeys = new Set(banks.map(key));
  let svg = head(
    previous ? "Primary layer · six banks" : "Primary layer · one centre of gravity",
    previous
      ? "Reproduction of the supplied layout · Realm rings 0–24 · 15 primary hexes per Realm-grid step"
      : "Realm rings 0–30 · 450 primary hexes to the outer spire ring · one bank at (0, 0)",
    previous
      ? "Reference layout with six banks at the corners of Realm ring 21, a central spire and a full spire lattice at spacing six Realm-grid steps."
      : "Proposed layout with a single origin bank, six inner spires on Realm ring two, a complete mountain barrier on primary rings 33 through 35, and the existing spire lattice extended through Realm ring thirty. Realm settlements begin at Realm ring three.",
    previous ? "REFERENCE / BEFORE" : "PROPOSED / AFTER",
  );
  for (const point of disk(extent)) {
    for (const direction of DIRECTIONS.slice(0, 3)) {
      const next = [point[0] + direction[0], point[1] + direction[1]];
      if (distance(next) <= extent)
        svg += line(xy(point, size), xy(next, size), { stroke: C.grid, "stroke-width": 0.7 });
    }
  }
  if (!previous) {
    const primarySize = size / RULES.realmSpacing;
    for (const point of layout.mountains) svg += hex(point, primarySize, { fill: C.mountain });
    svg += contour(RULES.firstRealmRing, size, {
      stroke: C.realm,
      "stroke-width": 1.3,
      "stroke-dasharray": "4 5",
      opacity: 0.65,
    });
  }
  for (const point of disk(extent)) {
    if (distance(point) < RULES.firstRealmRing || spireKeys.has(key(point)) || bankKeys.has(key(point))) continue;
    const [x, y] = xy(point, size);
    svg += circle(x, y, previous ? 2.45 : 2.2, { fill: C.realm });
  }
  svg += spires.map((point) => spire(point, size, previous ? 6.2 : 5.7)).join("");
  svg += banks.map((point) => bank(point, size, previous ? 7.4 : 7)).join("");
  svg += ringLabels(previous ? [6, 12, 18, 21, 24] : [6, 12, 18, 24, 30], size, 15);
  if (!previous) {
    svg += text(95, 235, "THE INNER ARENA", { "font-size": 16, "letter-spacing": 2, fill: C.muted });
    svg += text(95, 269, "Six spires · primary ring 30", { "font-size": 21 });
    svg += text(95, 301, "Mountains · primary rings 33–35", { "font-size": 21 });
    svg += text(95, 333, "See the separate 45-ring close-up.", { "font-size": 18, class: "muted" });
  } else {
    svg += text(95, 235, "BANK PLACEMENT", { "font-size": 16, "letter-spacing": 2, fill: C.muted });
    svg += text(95, 269, "Six corners of Realm ring 21", { "font-size": 21 });
    svg += text(95, 301, "315 primary hexes from the origin", { "font-size": 19, class: "muted" });
  }
  svg += footer(
    [
      { label: "Realm site", color: C.realm, width: 220 },
      { label: `Spire (${spires.length})`, color: C.spire, shape: "diamond", width: 240 },
      { label: `Bank (${banks.length})`, color: C.bank, width: 220 },
      ...(!previous ? [{ label: "Mountains", color: C.mountain, shape: "square", width: 230 }] : []),
    ],
    "Grid steps are Realm positions, not individual primary hexes. Spires replace Realm sites. Ring labels: Realm / primary.",
    previous
      ? "Reference extent follows the supplied image. Realm rings 0–2 have no settlement sites."
      : "Spire lattice retained at Realm rings 6, 12, 18, 24 and extended to 30; six additional inner spires sit on Realm ring 2.",
  );
  return svg;
}
function ethereal(previous = false) {
  const extent = previous ? RULES.previousExtent : RULES.extent + 1;
  const size = 700 / (Math.sqrt(3) * (extent + 0.6));
  const spires = previous ? layout.previousSpires : layout.etherealSpires;
  const spireKeys = new Set(spires.map(key));
  const explored = new Set(layout.etherealPreexplored.map(key));
  let svg = head(
    previous ? "Ethereal layer · original spire lattice" : "Ethereal layer · the route into the centre",
    previous
      ? "Reproduction of the supplied layout · hex rings 0–24 · every cell is one ethereal hex"
      : "Hex rings 0–30, with the outer exploration halo · Primary coordinates are 15× Ethereal coordinates",
    previous
      ? "Reference ethereal map with sixty-one spires on a complete spacing-six lattice including one at the origin."
      : "Proposed ethereal map with ninety-six spires, six on ring two and ninety on the spacing-six lattice through ring thirty. Every spire and its six neighbors are pre-explored, including the halo beyond ring thirty. The origin has no spire and is reserved and pre-explored to exclude a bitcoin mine.",
    previous ? "REFERENCE / BEFORE" : "PROPOSED / AFTER",
  );
  for (const point of disk(extent)) {
    const isSpire = spireKeys.has(key(point));
    const isOrigin = !previous && distance(point) === 0;
    const isExplored = !previous && explored.has(key(point));
    svg += hex(point, size * 0.95, {
      fill: isSpire ? C.spire : isOrigin ? C.bank : isExplored ? C.explored : C.panel,
      stroke: C.grid,
      "stroke-width": 0.7,
    });
    if (isOrigin) {
      const [x, y] = xy(point, size);
      svg +=
        line([x - 3, y - 3], [x + 3, y + 3], { stroke: C.bg, "stroke-width": 1.4 }) +
        line([x + 3, y - 3], [x - 3, y + 3], { stroke: C.bg, "stroke-width": 1.4 });
    }
  }
  svg += ringLabels(previous ? [6, 12, 18, 24] : [6, 12, 18, 24, 30], size);
  svg += text(90, 228, previous ? "61 SPIRES" : "96 PAIRED SPIRES", {
    "font-size": 17,
    "letter-spacing": 2,
    fill: C.muted,
  });
  svg += text(90, 261, previous ? "Including the origin spire" : "Six inner gateways on ethereal ring 2", {
    "font-size": 21,
  });
  if (!previous) {
    svg += text(90, 294, "Origin reserved · no bitcoin mine", { "font-size": 19, class: "muted" });
    svg += text(90, 326, "No bank on this layer", { "font-size": 19, class: "muted" });
  }
  svg += footer(
    [
      { label: `Spire (${spires.length})`, color: C.spire, shape: "square", width: 230 },
      ...(!previous
        ? [
            { label: "Pre-explored neighbor", color: C.explored, shape: "square", width: 340 },
            { label: "Reserved origin", color: C.bank, shape: "square", width: 320 },
          ]
        : []),
      { label: "Other ethereal hex", color: C.panel, shape: "square", width: 300 },
    ],
    previous
      ? "Reference extent follows the supplied image. Every sixth coordinate forms the retained spire lattice."
      : "Travel to an inner spire at radius 2, teleport to its primary counterpart at radius 30, then march to the bank.",
    previous
      ? "The proposed plan removes the origin spire and adds six gateways on ethereal ring 2."
      : "667 unique ethereal hexes are pre-explored: spires, adjacent hexes and the reserved origin. No central teleport endpoint.",
  );
  return svg;
}
function closeup() {
  const size = 700 / (Math.sqrt(3) * 45.7);
  const innerSpires = layout.primarySpires.filter((point) => distance(point) < 45);
  const spireKeys = new Set(innerSpires.map(key));
  const explored = new Set(layout.primaryPreexplored.map(key));
  const realmSites = disk(3)
    .filter((point) => distance(point) === 3)
    .map((point) => scale(point, 15));
  let svg = head(
    "The inner 45 rings · a sealed arena",
    "Primary layer at individual-hex scale · bank at 0 · spires at 30 · mountains at 33–35 · first Realm sites at 45",
    "Close-up of primary rings zero through forty-five. A bank sits at the origin. Six spires sit on ring thirty, each with six adjacent pre-explored hexes. A continuous three-hex-thick mountain barrier fills rings thirty-three through thirty-five. Realm settlement begins at Realm ring three, primary ring forty-five. Hyperstructure foundation discovery is zero throughout rings zero to thirty-five.",
    "PROPOSED / CLOSE-UP",
  );
  for (const point of disk(45)) {
    const radius = distance(point);
    const mountain = radius >= RULES.mountainFirstRing && radius <= RULES.mountainLastRing;
    svg += hex(point, size * 0.98, {
      fill: mountain ? C.mountain : explored.has(key(point)) ? C.explored : radius <= 35 ? "#171e23" : C.panel,
      stroke: mountain ? "#81929c" : C.grid,
      "stroke-width": mountain ? 0.35 : 0.45,
    });
  }
  svg += contour(45, size, { stroke: C.realm, "stroke-width": 1.7, "stroke-dasharray": "6 7" });
  svg += contour(30, size, { stroke: C.spire, "stroke-width": 1.5, "stroke-dasharray": "5 8", opacity: 0.7 });
  for (const point of realmSites) {
    const [x, y] = xy(point, size);
    svg += circle(x, y, 6, { fill: C.realm, stroke: C.bg, "stroke-width": 2 });
  }
  svg += innerSpires.map((point) => spire(point, size, 10)).join("") + bank([0, 0], size, 12);
  const start = xy([27, 0], size),
    end = xy([3, 0], size);
  svg += line(start, end, {
    stroke: C.route,
    "stroke-width": 2.3,
    "stroke-dasharray": "7 6",
    "marker-end": "url(#arrow)",
  });
  svg += text(993, 746, "30-hex march", { "font-size": 20, "text-anchor": "middle", class: "halo", fill: C.route });
  svg += text(800, 808, "ONE BANK", {
    "font-size": 18,
    "font-weight": 650,
    "text-anchor": "middle",
    class: "halo",
    fill: C.bank,
  });
  svg += text(800, 836, "(0, 0)", { "font-size": 18, "text-anchor": "middle", class: "halo muted" });
  svg += text(800, 908, "NO HYPERSTRUCTURE FOUNDATIONS", {
    "font-size": 18,
    "letter-spacing": 1,
    "text-anchor": "middle",
    class: "halo",
  });
  svg += text(800, 938, "Discovery chance is zero on rings 0–35", {
    "font-size": 19,
    "text-anchor": "middle",
    class: "halo muted",
  });
  svg += text(800, 978, "Other eligible structures can still be discovered", {
    "font-size": 17,
    "text-anchor": "middle",
    class: "halo muted",
  });
  svg += text(800, 1004, "on traversable interior hexes.", {
    "font-size": 17,
    "text-anchor": "middle",
    class: "halo muted",
  });
  svg += text(92, 236, "HOW ARMIES ENTER", { "font-size": 16, "letter-spacing": 2, fill: C.muted });
  svg += text(92, 270, "Ethereal ring 2 → primary ring 30", { "font-size": 22 });
  svg += text(92, 306, "Every inner spire lands inside the mountains.", { "font-size": 19, class: "muted" });
  svg += text(92, 338, "No primary-layer ground route crosses the barrier.", { "font-size": 19, class: "muted" });
  const callout = (point, x, y, label, sub) => {
    const position = xy(point, size);
    return (
      line(position, [x - 14, y - 8], { stroke: C.muted, "stroke-width": 1.4 }) +
      circle(...position, 3, { fill: C.muted }) +
      text(x, y, label, { "font-size": 21, class: "halo", "font-weight": 600 }) +
      text(x, y + 29, sub, { "font-size": 18, class: "halo muted" })
    );
  };
  svg += callout([30, -30], 1110, 326, "PRIMARY RING 30", "Six paired inner spires");
  svg += callout([34, -34], 1164, 414, "RINGS 33–35", "612 mountain hexes");
  svg += callout([45, -45], 1195, 220, "PRIMARY RING 45", "Realm ring 3 · first settlements");
  svg += footer(
    [
      { label: "Realm site", color: C.realm, width: 210 },
      { label: "Spire", color: C.spire, shape: "diamond", width: 180 },
      { label: "Bank", color: C.bank, width: 180 },
      { label: "Mountain", color: C.mountain, shape: "square", width: 230 },
      { label: "Pre-explored hex", color: C.explored, shape: "square", width: 280 },
    ],
    "The bank, all spires and their six neighbors are pre-explored. Mountains are fully pre-explored, impassable and spawn-free.",
    "Rings 33–35 form a three-hex-wide barrier. Ring 32 is ordinary terrain; inner-spire neighbors on ring 31 stay clear.",
  );
  return svg;
}

await mkdir(out, { recursive: true });
const outputs = {
  "primary-before.svg": primary(true),
  "primary.svg": primary(),
  "ethereal-before.svg": ethereal(true),
  "ethereal.svg": ethereal(),
  "primary-closeup.svg": closeup(),
};
const metadata = {
  schemaVersion: 1,
  coordinateSystem: "pointy-top axial (q,r); radius = max(abs(q), abs(r), abs(q+r))",
  rules: RULES,
  interpretation: {
    mountains: "Inclusive radii 33–35: three occupied rings; ring32 is ordinary terrain inside the barrier.",
    spireLattice:
      "Retain the full spacing-six lattice shown in the source images, extend it through radius30, remove origin, add six radius2 corners.",
    settlementSites:
      "Realm-grid candidates are schematic; sites occupied by preplaced structures are removed. Realm/Village placement retains other eligibility rules.",
    exploration: "All six neighbors are included even beyond outer spire ring30; ethereal radius31 halo is shown.",
  },
  counts: {
    previousBanks: layout.previousBanks.length,
    previousSpirePairs: layout.previousSpires.length,
    banks: 1,
    spirePairs: layout.etherealSpires.length,
    spiresByRealmOrEtherealRing: Object.fromEntries(
      [2, 6, 12, 18, 24, 30].map((radius) => [
        radius,
        layout.etherealSpires.filter((point) => distance(point) === radius).length,
      ]),
    ),
    mountainHexes: layout.mountains.length,
    primaryStructureExploration: layout.primaryStructureExploration.length,
    primaryPreexplored: layout.primaryPreexplored.length,
    etherealPreexplored: layout.etherealPreexplored.length,
    primaryInnerTraversableHexes: disk(RULES.mountainFirstRing - 1).length,
    realmSitesOnFirstSettlementRing: 18,
  },
  bank: layout.bank,
  previousBankRealmCoordinates: layout.previousBanks,
  spireEtherealCoordinates: layout.etherealSpires,
  spirePrimaryCoordinates: layout.primarySpires,
  files: Object.keys(outputs),
};
for (const [name, content] of Object.entries(outputs)) await writeFile(new URL(name, import.meta.url), content);
await writeFile(new URL("metadata.json", import.meta.url), JSON.stringify(metadata, null, 2) + "\n");
console.log(JSON.stringify({ generated: Object.keys(outputs), counts: metadata.counts }, null, 2));
