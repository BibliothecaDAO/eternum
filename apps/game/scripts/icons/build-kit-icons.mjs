import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

/**
 * Icons 2, the kit's gilded family (asset-sources/icons/kit/SOURCE.md): each master trimmed to its subject, sized so
 * the subject fills one share of the square, its light and shade mapped onto one gold ramp, a dark keyline around it.
 * The masters are never edited; this step is the only treatment.
 */
const GAME_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "../..");
const KIT_DIRECTORY = join(GAME_DIRECTORY, "asset-sources/icons/kit");

/** A master's pixel counts as subject past this alpha; fainter edge haze is trimmed with the background. */
const SUBJECT_ALPHA = 16;

export async function loadKitIconManifest() {
  return JSON.parse(await readFile(join(KIT_DIRECTORY, "manifest.json"), "utf8"));
}

export async function buildKitIcons() {
  const manifest = await loadKitIconManifest();
  const outputDirectory = join(GAME_DIRECTORY, manifest.output.directory);
  await mkdir(outputDirectory, { recursive: true });
  const results = [];
  for (const icon of manifest.icons) {
    const output = join(outputDirectory, `${icon.slug}.png`);
    const png = await gildIcon(join(KIT_DIRECTORY, icon.master), manifest);
    await sharp(png).toFile(output);
    results.push({ slug: icon.slug, codes: icon.codes, output });
  }
  return results;
}

/** One master through the treatment, as a PNG of the output's size. */
export async function gildIcon(masterPath, { output, ramp, keyline }) {
  const subject = await trimmedSubject(masterPath, Math.round(output.size * output.subjectShare), keyline.width);
  const gilt = mapOntoRamp(
    subject,
    ramp.map(({ at, color }) => ({ at, rgb: hexToRgb(color) })),
  );
  const outline = dilatedOutline(subject, keyline.width, hexToRgb(keyline.color));
  const raw = { width: subject.width, height: subject.height, channels: 4 };
  const left = Math.floor((output.size - subject.width) / 2);
  const top = Math.floor((output.size - subject.height) / 2);
  return sharp({
    create: { width: output.size, height: output.size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: outline, raw, left, top },
      { input: gilt, raw, left, top },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

/**
 * The master cropped to its subject and fitted inside a box of the given side, as raw RGBA, with a transparent margin
 * as wide as the keyline so the keyline is not cut where the subject meets its box.
 */
async function trimmedSubject(masterPath, box, margin) {
  const { data, info } = await sharp(masterPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = alphaBounds(data, info.width, info.height);
  const { data: fitted, info: size } = await sharp(masterPath)
    .ensureAlpha()
    .extract(bounds)
    .resize(box, box, { fit: "inside", kernel: sharp.kernel.lanczos3 })
    .extend({ top: margin, bottom: margin, left: margin, right: margin, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: fitted, width: size.width, height: size.height };
}

function alphaBounds(data, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1)
      if (data[(y * width + x) * 4 + 3] > SUBJECT_ALPHA) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < 0) throw new Error("master has no subject: every pixel is transparent");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Each pixel's luminance, lifted a little (a 0.75 power and a 1.15 gain, so the painted mid-tones read as gilt rather
 * than shadow), placed on the ramp; its alpha is kept.
 */
function mapOntoRamp({ data }, stops) {
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const luminance = (0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]) / 255;
    const [r, g, b] = rampAt(stops, Math.min(1, luminance ** 0.75 * 1.15));
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = data[i + 3];
  }
  return out;
}

function rampAt(stops, at) {
  const upper = stops.findIndex((stop) => stop.at >= at);
  if (upper <= 0) return stops[Math.max(0, upper)].rgb;
  const from = stops[upper - 1];
  const to = stops[upper];
  const t = (at - from.at) / (to.at - from.at);
  return from.rgb.map((channel, index) => Math.round(channel + (to.rgb[index] - channel) * t));
}

/** The subject's silhouette grown by the keyline's width, in the keyline's colour. */
function dilatedOutline({ data, width, height }, radius, [r, g, b]) {
  const out = Buffer.alloc(data.length);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      let alpha = 0;
      for (let dy = -radius; dy <= radius; dy += 1)
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) alpha = Math.max(alpha, data[(ny * width + nx) * 4 + 3]);
        }
      const i = (y * width + x) * 4;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = alpha;
    }
  return out;
}

const hexToRgb = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  const results = await buildKitIcons();
  console.log(JSON.stringify({ count: results.length, results }, null, 2));
}
