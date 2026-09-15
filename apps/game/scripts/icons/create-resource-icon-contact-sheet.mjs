import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { readPathOption } from "./icon-cli.mjs";
import {
  loadResourceIconManifest,
  REPOSITORY_DIRECTORY,
  selectResourceIcons,
  STAGED_RESOURCE_ICON_DIRECTORY,
} from "./resource-icon-manifest.mjs";

const PREVIEW_SIZES = [16, 24, 32, 48, 64, 80];
const BACKGROUNDS = ["#17130f", "#d8d0ba", "#476d51"];
const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 300;
const LABEL_HEIGHT = 36;
const ROW_HEIGHT = 88;

export async function createResourceIconContactSheet({ imageDirectory, outputPath, pilotOnly = false }) {
  const manifest = await loadResourceIconManifest();
  const resources = selectResourceIcons(manifest, pilotOnly);
  const panels = await Promise.all(
    resources.map((resource) => createResourceIconPanel(join(imageDirectory, `${resource.id}.png`), resource)),
  );
  const columns = Math.min(4, panels.length);
  const rows = Math.ceil(panels.length / columns);
  await mkdir(dirname(outputPath), { recursive: true });
  await sharp({
    create: {
      background: "#0c0c0b",
      channels: 4,
      height: PANEL_HEIGHT * rows,
      width: PANEL_WIDTH * columns,
    },
  })
    .composite(
      panels.map((input, index) => ({
        input,
        left: (index % columns) * PANEL_WIDTH,
        top: Math.floor(index / columns) * PANEL_HEIGHT,
      })),
    )
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
  return { columns, count: resources.length, outputPath, rows };
}

async function createResourceIconPanel(path, resource) {
  const composites = [{ input: createLabel(resource), left: 0, top: 0 }];
  for (const [row, background] of BACKGROUNDS.entries()) {
    composites.push({ input: createBackground(background), left: 0, top: LABEL_HEIGHT + row * ROW_HEIGHT });
    let left = 18;
    for (const size of PREVIEW_SIZES) {
      const icon = await sharp(path).resize(size, size, { fit: "contain" }).png().toBuffer();
      composites.push({
        input: icon,
        left,
        top: LABEL_HEIGHT + row * ROW_HEIGHT + Math.floor((ROW_HEIGHT - size) / 2),
      });
      left += size + 14;
    }
  }
  return sharp({
    create: { background: "#0c0c0b", channels: 4, height: PANEL_HEIGHT, width: PANEL_WIDTH },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

function createLabel(resource) {
  return Buffer.from(`
    <svg width="${PANEL_WIDTH}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0c0c0b"/>
      <text x="14" y="24" fill="#ead9b5" font-family="system-ui, sans-serif" font-size="15" font-weight="650">
        ${resource.id}. ${escapeXml(resource.name)}
      </text>
    </svg>
  `);
}

function createBackground(color) {
  return Buffer.from(`
    <svg width="${PANEL_WIDTH}" height="${ROW_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}"/>
    </svg>
  `);
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function main(args) {
  const result = await createResourceIconContactSheet({
    imageDirectory: readPathOption(args, "--input-dir", STAGED_RESOURCE_ICON_DIRECTORY),
    outputPath: readPathOption(
      args,
      "--output",
      join(REPOSITORY_DIRECTORY, ".context/icon-generation/resource-icons-contact-sheet.png"),
    ),
    pilotOnly: args.includes("--pilot"),
  });
  console.log(JSON.stringify(result, null, 2));
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) await main(process.argv.slice(2));
