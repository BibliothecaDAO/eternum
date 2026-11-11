import { describe, expect, it } from "vitest";

import { buildDetailTileTexels } from "./terrain-detail-tile";

const SIZE = 64;
const texels = buildDetailTileTexels(SIZE);
const channel = (index: number) => Array.from({ length: SIZE * SIZE }, (_, texel) => texels[texel * 4 + index]);
const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

describe("the ground's detail tile", () => {
  it("varies in every channel: stones with cracks, a grain, and the stones' slopes either way", () => {
    expect(spread(channel(0))).toBeGreaterThan(150);
    expect(spread(channel(1))).toBeGreaterThan(80);
    expect(spread(channel(2))).toBeGreaterThan(40);
    expect(spread(channel(3))).toBeGreaterThan(40);
  });

  it("meets itself without a seam: each edge is as close to the opposite edge as to its own neighbour", () => {
    const grain = (x: number, y: number) => texels[(y * SIZE + x) * 4 + 1];
    let across = 0;
    let within = 0;
    for (let y = 0; y < SIZE; y += 1) {
      across += Math.abs(grain(SIZE - 1, y) - grain(0, y));
      within += Math.abs(grain(SIZE - 2, y) - grain(SIZE - 1, y));
    }
    expect(across).toBeLessThan(within * 2 + SIZE);
  });

  it("is the same tile every time it is built", () => {
    expect(buildDetailTileTexels(SIZE)).toEqual(texels);
  });
});
