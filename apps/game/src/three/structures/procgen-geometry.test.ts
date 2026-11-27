import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { computeCreaseNormals } from "./procgen-geometry";

function hingedFold(bendDegrees: number): BufferGeometry {
  const rad = (bendDegrees * Math.PI) / 180;
  const x2 = Math.cos(rad);
  const y2 = Math.sin(rad);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, x2, y2, 0], 3),
  );
  return geometry;
}

describe("computeCreaseNormals", () => {
  it("recomputes hard 90-degree box normals and smooth 22.5-degree cylinder wall normals from missing normals", () => {
    const box = new BoxGeometry(1, 1, 1);
    box.deleteAttribute("normal");
    const creasedBox = computeCreaseNormals(box);
    const boxNormals = creasedBox.getAttribute("normal");
    expect(boxNormals).toBeDefined();
    for (let i = 0; i < boxNormals.count; i++) {
      const nx = Math.abs(boxNormals.getX(i));
      const ny = Math.abs(boxNormals.getY(i));
      const nz = Math.abs(boxNormals.getZ(i));
      expect(Math.max(nx, ny, nz)).toBeCloseTo(1, 5);
    }
    box.dispose();
    creasedBox.dispose();

    const cyl = new CylinderGeometry(0.4, 0.4, 1, 16, 1, true);
    cyl.deleteAttribute("normal");
    const smoothCyl = computeCreaseNormals(cyl);
    const pos = smoothCyl.getAttribute("position");
    const nrm = smoothCyl.getAttribute("normal");
    const radial = new Vector3();
    const normal = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      radial.set(pos.getX(i), 0, pos.getZ(i)).normalize();
      normal.fromBufferAttribute(nrm, i);
      expect(normal.dot(radial)).toBeGreaterThan(0.99);
    }
    cyl.dispose();
    smoothCyl.dispose();
  });

  it("smooths across folds below the 42-degree crease threshold and splits folds above it", () => {
    const smoothFold = hingedFold(30);
    const smoothed = computeCreaseNormals(smoothFold);
    const smoothPos = smoothed.getAttribute("position");
    const smoothNrm = smoothed.getAttribute("normal");
    const smoothHingeNormals: Vector3[] = [];
    for (let i = 0; i < smoothPos.count; i++) {
      if (Math.abs(smoothPos.getX(i)) < 1e-5 && Math.abs(smoothPos.getZ(i)) < 1e-5) {
        smoothHingeNormals.push(new Vector3().fromBufferAttribute(smoothNrm, i));
      }
    }
    const expectedMid = new Vector3(-Math.sin(Math.PI / 6), 1 + Math.cos(Math.PI / 6), 0).normalize();
    expect(smoothHingeNormals).toHaveLength(1);
    expect(smoothHingeNormals[0]!.dot(expectedMid)).toBeGreaterThan(0.9999);
    smoothFold.dispose();
    smoothed.dispose();

    const sharpFold = hingedFold(60);
    const creased = computeCreaseNormals(sharpFold);
    const sharpPos = creased.getAttribute("position");
    const sharpNrm = creased.getAttribute("normal");
    const sharpHingeNormals: Vector3[] = [];
    for (let i = 0; i < sharpPos.count; i++) {
      if (Math.abs(sharpPos.getX(i)) < 1e-5 && Math.abs(sharpPos.getZ(i)) < 1e-5) {
        sharpHingeNormals.push(new Vector3().fromBufferAttribute(sharpNrm, i));
      }
    }
    const faceA = new Vector3(0, 1, 0);
    const faceB = new Vector3(-Math.sin(Math.PI / 3), Math.cos(Math.PI / 3), 0).normalize();
    expect(sharpHingeNormals).toHaveLength(2);
    expect(sharpHingeNormals.some((n) => n.dot(faceA) > 0.9999)).toBe(true);
    expect(sharpHingeNormals.some((n) => n.dot(faceB) > 0.9999)).toBe(true);
    sharpFold.dispose();
    creased.dispose();
  });

  it("replaces stale normals after post-creation vertex deformation", () => {
    const fin = new BoxGeometry(1, 1, 0.08);
    const positions = fin.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const upper = positions.getY(i) > 0;
      const reach = upper ? 0.2 : 0.6;
      positions.setXYZ(i, (positions.getX(i) + 0.5) * reach, positions.getY(i) + 0.5, positions.getZ(i));
    }
    const recomputed = computeCreaseNormals(fin);
    const pos = recomputed.getAttribute("position");
    const nrm = recomputed.getAttribute("normal");
    const expectedSlant = new Vector3(1, 0.4, 0).normalize();
    let matchedSlantedFace = false;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getX(i) > 0.19 && pos.getY(i) > 0.99) {
        const candidate = new Vector3().fromBufferAttribute(nrm, i);
        if (candidate.dot(expectedSlant) > 0.999) {
          matchedSlantedFace = true;
        }
      }
    }
    expect(matchedSlantedFace).toBe(true);
    fin.dispose();
    recomputed.dispose();
  });
});
