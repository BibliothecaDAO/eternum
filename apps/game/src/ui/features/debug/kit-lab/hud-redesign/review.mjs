export const REFERENCE_FRAMES = {
  current: [
    { name: "Structures", x: 12, y: 62, width: 320, height: 268 },
    { name: "Realm and commands", x: 12, y: 342, width: 320, height: 230 },
    { name: "Minimap", x: 12, y: 584, width: 320, height: 300 },
    { name: "Match bar", x: 368, y: 4, width: 704, height: 40 },
    { name: "Log", x: 1360, y: 60, width: 68, height: 36 },
    { name: "Chat", x: 1140, y: 852, width: 288, height: 32 },
  ],
  warroom: [
    { name: "Realm and structures", x: 12, y: 62, width: 320, height: 610 },
    { name: "Minimap", x: 12, y: 684, width: 320, height: 200 },
    { name: "Match bar", x: 424, y: 4, width: 592, height: 40 },
    { name: "Suggestion", x: 1128, y: 60, width: 300, height: 158 },
    { name: "Events", x: 1128, y: 226, width: 300, height: 176 },
    { name: "Chat", x: 1128, y: 852, width: 300, height: 32 },
  ],
};

export function coveredPixels(rectangles, width = 1440, height = 900) {
  let area = 0;
  for (let y = 0; y < height; y++) {
    const spans = rectangles
      .filter((r) => r.y < y + 1 && r.y + r.height > y)
      .map((r) => [Math.max(0, r.x), Math.min(width, r.x + r.width)])
      .toSorted((a, b) => a[0] - b[0]);
    let end = 0;
    for (const [left, right] of spans) {
      area += Math.max(0, right - Math.max(end, left));
      end = Math.max(end, right);
    }
  }
  return area;
}

export function inspectHudReview() {
  const visible = (element) => {
    const r = element.getBoundingClientRect();
    return (
      r.width > 0 &&
      r.height > 0 &&
      r.bottom > 0 &&
      r.top < innerHeight &&
      getComputedStyle(element).visibility !== "hidden"
    );
  };
  const backdrop = document.querySelector(".map-backdrop");
  const canvas = document.querySelector(".hud-live-map canvas");
  return {
    viewport: [innerWidth, innerHeight],
    liveMap: canvas
      ? [canvas.width, canvas.height, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height]
      : null,
    rendererState: document.querySelector(".hud-live-map")?.getAttribute("data-renderer-state"),
    backdrop:
      backdrop instanceof HTMLImageElement
        ? [
            backdrop.naturalWidth,
            backdrop.naturalHeight,
            backdrop.getBoundingClientRect().width,
            backdrop.getBoundingClientRect().height,
          ]
        : null,
    kitImages: [...document.images]
      .filter((img) => visible(img) && img.src.includes("/image-icons/kit/"))
      .map((img) => img.getAttribute("src")),
    minimapHexes: document.querySelectorAll(".minimap [data-terrain-hex]").length,
    primary: document.querySelectorAll(".primary-suggestion .frontier-primary").length,
    dockArt: [...document.querySelectorAll(".action-dock img")].map((img) => ({
      src: img.getAttribute("src"),
      width: img.getBoundingClientRect().width,
      height: img.getBoundingClientRect().height,
    })),
    frames: [...document.querySelectorAll(".hud-scene [data-group]")]
      .flatMap((el) =>
        el.matches(".rails .action-dock")
          ? [...el.querySelectorAll(":scope > button")]
          : el.matches('header[aria-label="Game controls"]')
            ? [
                ...el.querySelectorAll(
                  '.identity-chip, [aria-label="Map view"], [aria-label="Game clock"], .settings-selector',
                ),
              ]
            : [el],
      )
      .filter(visible)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { name: el.getAttribute("data-group"), x: r.x, y: r.y, width: r.width, height: r.height };
      }),
  };
}

export function judgeHudReview(reading) {
  const failures = [];
  if (
    !(reading.liveMap?.join(",") === "1440,900,1440,900" && reading.rendererState === "ready") &&
    reading.backdrop?.join(",") !== "1440,900,1440,900"
  )
    failures.push("Use the full 1440×900 comparison capture at 1:1 in .map-backdrop; do not crop or zoom it.");
  if (reading.kitImages.length)
    failures.push("Replace visible KitIcon artwork with existing painted images in the HUD picker.");
  if (!reading.minimapHexes)
    failures.push("Render HexMinimap on tile fixtures; do not replace the shipped map with a dot grid.");
  if (reading.primary !== 1) failures.push("Use the War room primary Button for the one suggestion.");
  if (
    ![4, 5].includes(reading.dockArt.length) ||
    reading.dockArt.some((image) => image.width < 44 || image.height < 44)
  )
    failures.push("Render the command dock painted art at least 44px.");
  if (coveredPixels(reading.frames) >= coveredPixels(REFERENCE_FRAMES.current))
    failures.push("Reduce visible HUD frames below the current HUD coverage before offering this option.");
  return failures;
}
