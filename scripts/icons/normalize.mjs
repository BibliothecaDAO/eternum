import sharp from "sharp";

const SUBJECT_ALPHA = 128;
const MIN_ICON_FILL = 0.85;

/** Measure connected subject pixels; isolated export specks and faint glow cannot set the crop. */
async function iconBounds(file) {
  const image = sharp(file);
  const metadata = await image.metadata();
  if (!metadata.hasAlpha) throw new Error(`Transparent master required: ${typeof file === "string" ? file : "image"}`);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  const mask = new Uint8Array(pixels);
  let clear = 0,
    opaque = 0;
  for (let i = 0; i < pixels; i++) {
    const alpha = data[i * 4 + 3];
    if (alpha < 8) clear++;
    if (alpha >= SUBJECT_ALPHA) {
      mask[i] = 1;
      opaque++;
    }
  }
  if (!opaque || clear < pixels * 0.02) throw new Error("Empty or opaque icon; supply transparent subject artwork.");
  const stack = new Int32Array(pixels);
  let left = info.width,
    top = info.height,
    right = -1,
    bottom = -1;
  const minimumComponent = Math.max(4, Math.ceil(opaque * 0.001));
  for (let start = 0; start < pixels; start++) {
    if (!mask[start]) continue;
    let count = 0,
      depth = 1,
      l = info.width,
      t = info.height,
      r = -1,
      b = -1;
    stack[0] = start;
    mask[start] = 0;
    while (depth) {
      const i = stack[--depth],
        x = i % info.width,
        y = Math.floor(i / info.width);
      count++;
      l = Math.min(l, x);
      r = Math.max(r, x);
      t = Math.min(t, y);
      b = Math.max(b, y);
      for (const next of [
        x ? i - 1 : -1,
        x < info.width - 1 ? i + 1 : -1,
        y ? i - info.width : -1,
        y < info.height - 1 ? i + info.width : -1,
        x && y ? i - info.width - 1 : -1,
        x < info.width - 1 && y ? i - info.width + 1 : -1,
        x && y < info.height - 1 ? i + info.width - 1 : -1,
        x < info.width - 1 && y < info.height - 1 ? i + info.width + 1 : -1,
      ]) {
        if (next >= 0 && mask[next]) {
          mask[next] = 0;
          stack[depth++] = next;
        }
      }
    }
    if (count < minimumComponent) continue;
    left = Math.min(left, l);
    right = Math.max(right, r);
    top = Math.min(top, t);
    bottom = Math.max(bottom, b);
  }
  if (right < 0) throw new Error("Icon has no readable connected subject.");
  const width = right - left + 1,
    height = bottom - top + 1;
  return { left, top, width, height, fill: Math.max(width, height) / Math.max(info.width, info.height) };
}

export async function assertIconFill(file, label = "icon") {
  const bounds = await iconBounds(file);
  if (bounds.fill < MIN_ICON_FILL)
    throw new Error(
      `Undersized icon ${label}: ${(bounds.fill * 100).toFixed(1)}% subject fill; minimum 85%. Rebuild with normalizeMaster; remove any tile or base around the subject.`,
    );
  return bounds;
}

export async function normalizeMaster(file) {
  const { left, top, width, height } = await iconBounds(file);
  const square = await sharp(file)
    .extract({ left, top, width, height })
    .resize(920, 920, { fit: "contain", background: "#00000000" })
    .png()
    .toBuffer();
  const output = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: "#00000000" } })
    .composite([{ input: square, left: 52, top: 52 }])
    .png()
    .toBuffer();
  await assertIconFill(output, "normalized master");
  return output;
}

export async function deliverIcon(master, size, label) {
  const preview = await sharp(master).resize(size, size).png().toBuffer();
  const bounds = await iconBounds(preview);
  const metadata = await sharp(master).metadata();
  const scale = metadata.width / size;
  const left = Math.floor(bounds.left * scale),
    top = Math.floor(bounds.top * scale);
  const width = Math.min(metadata.width - left, Math.ceil(bounds.width * scale));
  const height = Math.min(metadata.height - top, Math.ceil(bounds.height * scale));
  const interior = Math.round(size * 0.9),
    inset = Math.floor((size - interior) / 2);
  const subject = await sharp(master)
    .extract({ left, top, width, height })
    .resize(interior, interior, { fit: "contain", background: "#00000000" })
    .png()
    .toBuffer();
  const bytes = await sharp({ create: { width: size, height: size, channels: 4, background: "#00000000" } })
    .composite([{ input: subject, left: inset, top: inset }])
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toBuffer();
  await assertIconFill(bytes, `${label}/${size}`);
  return bytes;
}
