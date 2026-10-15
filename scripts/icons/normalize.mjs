import sharp from "sharp";

export async function normalizeMaster(file) {
  const image = sharp(file);
  const metadata = await image.metadata();
  if (!metadata.hasAlpha) throw new Error(`Transparent master required: ${file}`);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width,
    top = info.height,
    right = -1,
    bottom = -1,
    clear = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha < 8) clear++;
      if (alpha < 20) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0 || clear < info.width * info.height * 0.02) throw new Error(`Empty or opaque master: ${file}`);
  const square = await sharp(file)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(880, 880, { fit: "contain", background: "#00000000" })
    .png()
    .toBuffer();
  return sharp({ create: { width: 1024, height: 1024, channels: 4, background: "#00000000" } })
    .composite([{ input: square, left: 72, top: 72 }])
    .png()
    .toBuffer();
}
