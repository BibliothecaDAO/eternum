import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, it } from "vitest";

import festival from "../../../asset-sources/festival/manifest.json";
import { DIWALI_SPRITES } from "@/ui/design-system/icon-meaning";

const PUBLIC = resolve(__dirname, "../../../public");

it("serves each painted Diwali sheet exactly as the art's manifest delivered it", () => {
  const served = festival.items.map((item) => {
    const bytes = readFileSync(resolve(PUBLIC, "images/festival", item.sheet));
    return [item.sheet, bytes.length, createHash("sha256").update(bytes).digest("hex")];
  });
  expect(served).toEqual(festival.items.map((item) => [item.sheet, item.bytes, item.sha256]));
});

it("draws every sheet the manifest lists, and no other", () => {
  const drawn = [...Object.values(DIWALI_SPRITES.fireworks), DIWALI_SPRITES.diya]
    .map((sprite) => sprite.url)
    .toSorted();
  expect(drawn).toEqual(festival.items.map((item) => `/images/festival/${item.sheet}`).toSorted());
});
