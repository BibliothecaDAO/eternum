import { mkdirSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const PANEL_WIDTH = 720;
const PANEL_HEIGHT = 450;
const LABEL_HEIGHT = 44;

export async function createTerrainContactSheet({ inputDirectory, outputPath }) {
  const filenames = orderTerrainContactSheetFilenames(readdirSync(inputDirectory), basename(outputPath));
  if (filenames.length === 0) throw new Error(`No terrain gallery PNG captures found in ${inputDirectory}`);
  const panels = await Promise.all(
    filenames.map((filename) => createPanel(join(inputDirectory, filename), formatCaptureLabel(filename))),
  );
  const columns = Math.min(4, panels.length);
  const rows = Math.ceil(panels.length / columns);
  mkdirSync(dirname(outputPath), { recursive: true });
  await sharp({
    create: {
      background: "#0c0c0b",
      channels: 4,
      height: (PANEL_HEIGHT + LABEL_HEIGHT) * rows,
      width: PANEL_WIDTH * columns,
    },
  })
    .composite(
      panels.map((input, index) => ({
        input,
        left: (index % columns) * PANEL_WIDTH,
        top: Math.floor(index / columns) * (PANEL_HEIGHT + LABEL_HEIGHT),
      })),
    )
    .png()
    .toFile(outputPath);
  return outputPath;
}

export function orderTerrainContactSheetFilenames(filenames, outputFilename) {
  return filenames
    .filter((filename) => filename.endsWith(".png") && filename !== outputFilename)
    .toSorted((left, right) => left.localeCompare(right, "en", { numeric: true }));
}

function formatCaptureLabel(filename) {
  return filename
    .replace(/\.png$/u, "")
    .replaceAll("webgpu-force-webgl", "WebGL2")
    .replaceAll("webgpu-auto", "WebGPU")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function createPanel(path, label) {
  const screenshot = await sharp(path)
    .resize(PANEL_WIDTH, PANEL_HEIGHT, { fit: "contain", background: "#d8d0ba" })
    .png()
    .toBuffer();
  const caption = Buffer.from(`
    <svg width="${PANEL_WIDTH}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0c0c0b"/>
      <text x="22" y="29" fill="#d7eadc" font-family="system-ui, sans-serif" font-size="16" font-weight="650">
        ${escapeXml(label)}
      </text>
    </svg>
  `);
  return sharp({
    create: { background: "#0c0c0b", channels: 4, height: PANEL_HEIGHT + LABEL_HEIGHT, width: PANEL_WIDTH },
  })
    .composite([
      { input: screenshot, left: 0, top: 0 },
      { input: caption, left: 0, top: PANEL_HEIGHT },
    ])
    .png()
    .toBuffer();
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

async function main(args) {
  const inputDirectory = resolve(readOption(args, "--input-dir", ".context/verification/procedural-terrain/gallery"));
  const outputPath = resolve(readOption(args, "--output", join(inputDirectory, "backend-contact-sheet.png")));
  await createTerrainContactSheet({ inputDirectory, outputPath });
  console.log(outputPath);
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) await main(process.argv.slice(2));
