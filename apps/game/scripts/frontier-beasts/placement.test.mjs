import { it, expect } from "vitest";
import { measurePlacement } from "../frontier/verify-beast-placement.mjs";

const mesh = (vertices) => ({ vertices, triangles: [[0, 1, 2]] });
const body = mesh([
  [-0.3, 0.2, -0.3],
  [0.3, 0.2, -0.3],
  [0, 0.2, 0.3],
]);
const measure = (ruin, beast = body, scale = 1) => measurePlacement({ assetId: "fixture", ruin, beast, scale });

it("rejects crossing masonry even when no triangle vertex lies in the other triangle", () => {
  const wall = mesh([
    [0, 0.1, -0.4],
    [0, 0.3, -0.4],
    [0, 0.2, 0.4],
  ]);
  expect(measure(wall)).toMatchObject({ fitsTile: true, masonryContacts: 1, passed: false });
});

it("distinguishes coplanar overlap from disjoint triangles with overlapping bounds", () => {
  expect(measure(body)).toMatchObject({ masonryContacts: 1, passed: false });
  const corner = mesh([
    [0.2, 0.2, 0.2],
    [0.3, 0.2, 0.2],
    [0.3, 0.2, 0.3],
  ]);
  expect(measure(corner)).toMatchObject({ masonryContacts: 0, passed: true });
});

it("keeps a 0.001 clearance tolerance and applies runtime scale before measuring", () => {
  const shifted = (height) => mesh(body.vertices.map(([x, , z]) => [x, height, z]));
  expect(measure(shifted(0.2005)).masonryContacts).toBe(1);
  expect(measure(shifted(0.202)).masonryContacts).toBe(0);
  expect(measure(shifted(0.4), body, 2)).toMatchObject({ masonryContacts: 1, passed: false });
});

it("excludes painted ground support, but rejects a beast beyond the pointy hex", () => {
  const ground = mesh(body.vertices.map(([x, , z]) => [x, 0, z]));
  expect(measure(ground, ground)).toMatchObject({ fitsTile: true, masonryContacts: 0, passed: true });
  expect(measure(ground, body, 4)).toMatchObject({ fitsTile: false, masonryContacts: 0, passed: false });
});
