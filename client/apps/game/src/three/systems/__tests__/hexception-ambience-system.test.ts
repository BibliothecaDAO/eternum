import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  DataTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";
import { HexceptionAmbienceSystem } from "../hexception-ambience-system";

function createFixture(quality: "LOW" | "MID" | "HIGH" = "HIGH") {
  const scene = new Scene();
  const system = new HexceptionAmbienceSystem(scene, quality);
  return { scene, system };
}

function findPointLight(scene: Scene): PointLight | undefined {
  return scene.children.find((c) => c instanceof PointLight) as PointLight | undefined;
}

function findMeshWithPlane(scene: Scene): Mesh | undefined {
  return scene.children.find(
    (c) => c instanceof Mesh && c.geometry instanceof PlaneGeometry,
  ) as Mesh | undefined;
}

function findMeshWithSphere(scene: Scene): Mesh | undefined {
  return scene.children.find(
    (c) => c instanceof Mesh && c.geometry instanceof SphereGeometry,
  ) as Mesh | undefined;
}

function findAllPoints(scene: Scene): Points[] {
  return scene.children.filter((c) => c instanceof Points) as Points[];
}

function findPointsByColor(scene: Scene, colorHex: number): Points | undefined {
  return findAllPoints(scene).find((p) => {
    const mat = p.material as PointsMaterial;
    return mat.color.getHex() === colorHex;
  });
}

function findGroundFog(scene: Scene): Points | undefined {
  return findPointsByColor(scene, 0xeeddcc);
}

function findEdgeMist(scene: Scene): Points | undefined {
  return findPointsByColor(scene, 0x8866aa);
}

function findSeamGlowMesh(scene: Scene): Mesh | undefined {
  return scene.children.find((c) => {
    if (!(c instanceof Mesh)) return false;
    if (!(c.geometry instanceof PlaneGeometry)) return false;
    const mat = c.material as MeshBasicMaterial;
    return mat.blending === AdditiveBlending && (c as Mesh).renderOrder === 1;
  }) as Mesh | undefined;
}

// ───────── Feature 1: Central Settlement Light ─────────

describe("CentralSettlementLight", () => {
  it("creates a PointLight and adds it to scene", () => {
    const { scene } = createFixture("HIGH");
    const light = findPointLight(scene);
    expect(light).toBeDefined();
    expect(light).toBeInstanceOf(PointLight);
  });

  it("light has warm color (r > g > b)", () => {
    const { scene } = createFixture("HIGH");
    const light = findPointLight(scene)!;
    const c = light.color;
    expect(c.r).toBeGreaterThan(c.g);
    expect(c.g).toBeGreaterThan(c.b);
  });

  it("light position defaults to (0, 3, 0)", () => {
    const { scene } = createFixture("HIGH");
    const light = findPointLight(scene)!;
    expect(light.position.x).toBeCloseTo(0);
    expect(light.position.y).toBeCloseTo(3);
    expect(light.position.z).toBeCloseTo(0);
  });

  it("light.distance is 12 and light.decay is 2", () => {
    const { scene } = createFixture("HIGH");
    const light = findPointLight(scene)!;
    expect(light.distance).toBe(12);
    expect(light.decay).toBe(2);
  });

  it("light.castShadow is false", () => {
    const { scene } = createFixture("HIGH");
    const light = findPointLight(scene)!;
    expect(light.castShadow).toBe(false);
  });

  it("intensity is higher when timeProgress is in night range (80-20) than day range (30-70)", () => {
    const { system, scene } = createFixture("HIGH");
    const light = findPointLight(scene)!;

    system.setTimeProgress(50); // day
    const dayIntensity = light.intensity;

    system.setTimeProgress(0); // night
    const nightIntensity = light.intensity;

    expect(nightIntensity).toBeGreaterThan(dayIntensity);
  });

  it("setEnabled(false) sets intensity to 0 and visible to false", () => {
    const { system, scene } = createFixture("HIGH");
    const light = findPointLight(scene)!;

    system.setEnabled(false);
    expect(light.intensity).toBe(0);
    expect(light.visible).toBe(false);
  });

  it("setEnabled(true) restores intensity", () => {
    const { system, scene } = createFixture("HIGH");
    const light = findPointLight(scene)!;

    system.setTimeProgress(50);
    const beforeIntensity = light.intensity;

    system.setEnabled(false);
    system.setEnabled(true);

    expect(light.intensity).toBeCloseTo(beforeIntensity);
    expect(light.visible).toBe(true);
  });

  it("dispose() removes light from scene", () => {
    const { system, scene } = createFixture("HIGH");
    expect(findPointLight(scene)).toBeDefined();

    system.dispose();
    expect(findPointLight(scene)).toBeUndefined();
  });

  it("not created when quality is LOW", () => {
    const { scene } = createFixture("LOW");
    expect(findPointLight(scene)).toBeUndefined();
  });
});

// ───────── Feature 2: Radial Color Temperature ─────────

describe("RadialColorTemperature", () => {
  it("creates a Mesh with PlaneGeometry added to scene", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findMeshWithPlane(scene);
    expect(mesh).toBeDefined();
    expect(mesh!.geometry).toBeInstanceOf(PlaneGeometry);
  });

  it("plane is at y=-0.03 (above ground at -0.05, below hex tiles)", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findMeshWithPlane(scene)!;
    expect(mesh.position.y).toBeCloseTo(-0.03);
  });

  it("material has transparent:true, depthWrite:false", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findMeshWithPlane(scene)!;
    const mat = mesh.material as MeshBasicMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
  });

  it("DataTexture center pixel RGB has higher R than B (warm)", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findMeshWithPlane(scene)!;
    const mat = mesh.material as MeshBasicMaterial;
    const tex = mat.map as DataTexture;
    const data = tex.image.data as Uint8Array;
    // Center pixel at (64, 64) in 128x128
    const cx = 64;
    const cy = 64;
    const idx = (cy * 128 + cx) * 4;
    expect(data[idx]).toBeGreaterThan(data[idx + 2]); // R > B
  });

  it("DataTexture edge pixel has near-zero alpha", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findMeshWithPlane(scene)!;
    const mat = mesh.material as MeshBasicMaterial;
    const tex = mat.map as DataTexture;
    const data = tex.image.data as Uint8Array;
    // Edge pixel at (0, 0)
    const idx = 0;
    expect(data[idx + 3]).toBeLessThan(5);
  });

  it("opacity modulates with timeProgress — higher at night", () => {
    const { system, scene } = createFixture("HIGH");
    const mesh = findMeshWithPlane(scene)!;
    const mat = mesh.material as MeshBasicMaterial;

    system.setTimeProgress(50); // day
    const dayOpacity = mat.opacity;

    system.setTimeProgress(0); // night
    const nightOpacity = mat.opacity;

    expect(nightOpacity).toBeGreaterThan(dayOpacity);
  });

  it("setEnabled(false) sets mesh.visible to false", () => {
    const { system, scene } = createFixture("HIGH");
    const mesh = findMeshWithPlane(scene)!;

    system.setEnabled(false);
    expect(mesh.visible).toBe(false);
  });

  it("dispose() removes mesh, disposes geometry/material/texture", () => {
    const { system, scene } = createFixture("HIGH");
    const mesh = findMeshWithPlane(scene)!;
    expect(mesh).toBeDefined();

    system.dispose();
    expect(findMeshWithPlane(scene)).toBeUndefined();
  });

  it("not created when quality is LOW", () => {
    const { scene } = createFixture("LOW");
    expect(findMeshWithPlane(scene)).toBeUndefined();
  });
});

// ───────── Feature 6: Subtle Background ─────────

describe("SubtleBackground", () => {
  it("creates an inverted SphereGeometry mesh (material.side === BackSide)", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findMeshWithSphere(scene);
    expect(mesh).toBeDefined();
    const mat = mesh!.material as MeshBasicMaterial;
    expect(mat.side).toBe(BackSide);
  });

  it("sphere radius is large (>= 200)", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findMeshWithSphere(scene)!;
    const geo = mesh.geometry as SphereGeometry;
    expect(geo.parameters.radius).toBeGreaterThanOrEqual(200);
  });

  it("mesh.frustumCulled is false", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findMeshWithSphere(scene)!;
    expect(mesh.frustumCulled).toBe(false);
  });

  it("DataTexture has some bright pixels (stars) against dark background", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findMeshWithSphere(scene)!;
    const mat = mesh.material as MeshBasicMaterial;
    const tex = mat.map as DataTexture;
    const data = tex.image.data as Uint8Array;

    // Count pixels brighter than threshold (stars)
    let brightCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 100 || data[i + 1] > 100 || data[i + 2] > 100) {
        brightCount++;
      }
    }
    expect(brightCount).toBeGreaterThan(50);
  });

  it("base color of texture is darker than 0x2a1a3e", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findMeshWithSphere(scene)!;
    const mat = mesh.material as MeshBasicMaterial;
    const tex = mat.map as DataTexture;
    const data = tex.image.data as Uint8Array;

    // Sample a non-star pixel near center
    const size = 256;
    const cx = 128;
    const cy = 128;
    const idx = (cy * size + cx) * 4;
    // 0x2a1a3e = r:42 g:26 b:62
    // Base center is 0x1a0e2a = r:26 g:14 b:42 which is darker
    expect(data[idx]).toBeLessThanOrEqual(42);
    expect(data[idx + 1]).toBeLessThanOrEqual(26);
    expect(data[idx + 2]).toBeLessThanOrEqual(62);
  });

  it("material opacity is higher during night timeProgress than day", () => {
    const { system, scene } = createFixture("HIGH");
    const mesh = findMeshWithSphere(scene)!;
    const mat = mesh.material as MeshBasicMaterial;

    system.setTimeProgress(50); // day
    const dayOpacity = mat.opacity;

    system.setTimeProgress(0); // night
    const nightOpacity = mat.opacity;

    expect(nightOpacity).toBeGreaterThan(dayOpacity);
  });

  it("setEnabled(false) sets visible to false", () => {
    const { system, scene } = createFixture("HIGH");
    const mesh = findMeshWithSphere(scene)!;

    system.setEnabled(false);
    expect(mesh.visible).toBe(false);
  });

  it("dispose() removes sphere, disposes geometry/material/texture", () => {
    const { system, scene } = createFixture("HIGH");
    expect(findMeshWithSphere(scene)).toBeDefined();

    system.dispose();
    expect(findMeshWithSphere(scene)).toBeUndefined();
  });

  it("works on all quality tiers (including LOW)", () => {
    const { scene: lowScene } = createFixture("LOW");
    const { scene: midScene } = createFixture("MID");
    const { scene: highScene } = createFixture("HIGH");

    expect(findMeshWithSphere(lowScene)).toBeDefined();
    expect(findMeshWithSphere(midScene)).toBeDefined();
    expect(findMeshWithSphere(highScene)).toBeDefined();
  });
});

// ───────── Feature 3: Ground Fog Layer ─────────

describe("GroundFogLayer", () => {
  it("creates Points mesh added to scene", () => {
    const { scene } = createFixture("HIGH");
    const fog = findGroundFog(scene);
    expect(fog).toBeDefined();
    expect(fog).toBeInstanceOf(Points);
  });

  it("all initial particle Y positions are between 0.05 and 0.4", () => {
    const { scene } = createFixture("HIGH");
    const fog = findGroundFog(scene)!;
    const positions = fog.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      expect(y).toBeGreaterThanOrEqual(0.05);
      expect(y).toBeLessThanOrEqual(0.4);
    }
  });

  it("all particle positions are within spawnRadius of center", () => {
    const { scene } = createFixture("HIGH");
    const fog = findGroundFog(scene)!;
    const positions = fog.geometry.getAttribute("position");
    const spawnRadius = 8;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const dist = Math.sqrt(x * x + z * z);
      expect(dist).toBeLessThanOrEqual(spawnRadius + 0.01);
    }
  });

  it("particle count is 80 on HIGH, 40 on MID, 0 on LOW", () => {
    const { scene: highScene } = createFixture("HIGH");
    const { scene: midScene } = createFixture("MID");
    const { scene: lowScene } = createFixture("LOW");

    const highFog = findGroundFog(highScene)!;
    expect(highFog.geometry.getAttribute("position").count).toBe(80);

    const midFog = findGroundFog(midScene)!;
    expect(midFog.geometry.getAttribute("position").count).toBe(40);

    expect(findGroundFog(lowScene)).toBeUndefined();
  });

  it("material uses AdditiveBlending and depthWrite:false", () => {
    const { scene } = createFixture("HIGH");
    const fog = findGroundFog(scene)!;
    const mat = fog.material as PointsMaterial;
    expect(mat.blending).toBe(AdditiveBlending);
    expect(mat.depthWrite).toBe(false);
  });

  it("after update(), particles have moved (positions changed)", () => {
    const { system, scene } = createFixture("HIGH");
    const fog = findGroundFog(scene)!;
    const positions = fog.geometry.getAttribute("position");

    // Capture initial positions
    const initialPositions: number[] = [];
    for (let i = 0; i < positions.count * 3; i++) {
      initialPositions.push((positions.array as Float32Array)[i]);
    }

    // Run several updates
    for (let i = 0; i < 10; i++) {
      system.update(0.016);
    }

    // Check that at least some positions changed
    let changed = false;
    for (let i = 0; i < positions.count * 3; i++) {
      if (Math.abs((positions.array as Float32Array)[i] - initialPositions[i]) > 0.0001) {
        changed = true;
        break;
      }
    }
    expect(changed).toBe(true);
  });

  it("setWeatherIntensity(1.0) sets material opacity to 0", () => {
    const { system, scene } = createFixture("HIGH");
    const fog = findGroundFog(scene)!;
    const mat = fog.material as PointsMaterial;

    system.setWeatherIntensity(1.0);
    system.update(0.016); // trigger opacity update
    expect(mat.opacity).toBeCloseTo(0);
  });

  it("setTimeProgress in dawn/dusk range increases opacity vs noon", () => {
    const { system, scene } = createFixture("HIGH");
    const fog = findGroundFog(scene)!;
    const mat = fog.material as PointsMaterial;

    system.setTimeProgress(50); // noon
    system.update(0.016);
    const noonOpacity = mat.opacity;

    system.setTimeProgress(25); // dawn
    system.update(0.016);
    const dawnOpacity = mat.opacity;

    expect(dawnOpacity).toBeGreaterThan(noonOpacity);
  });

  it("setEnabled(false) sets Points.visible to false", () => {
    const { system, scene } = createFixture("HIGH");
    const fog = findGroundFog(scene)!;

    system.setEnabled(false);
    expect(fog.visible).toBe(false);
  });

  it("dispose() removes Points, disposes geometry and material", () => {
    const { system, scene } = createFixture("HIGH");
    expect(findGroundFog(scene)).toBeDefined();

    system.dispose();
    expect(findGroundFog(scene)).toBeUndefined();
  });
});

// ───────── Feature 4: Edge Boundary Mist ─────────

describe("EdgeBoundaryMist", () => {
  it("creates Points mesh added to scene", () => {
    const { system, scene } = createFixture("HIGH");
    system.setup(new Vector3(0, 0, 0), 10);
    const mist = findEdgeMist(scene);
    expect(mist).toBeDefined();
    expect(mist).toBeInstanceOf(Points);
  });

  it("no particles placed within 60% of grid radius from center", () => {
    const { system, scene } = createFixture("HIGH");
    const gridRadius = 10;
    system.setup(new Vector3(0, 0, 0), gridRadius);
    const mist = findEdgeMist(scene)!;
    const positions = mist.geometry.getAttribute("position");
    const innerLimit = gridRadius * 0.6;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const dist = Math.sqrt(x * x + z * z);
      expect(dist).toBeGreaterThanOrEqual(innerLimit - 0.01);
    }
  });

  it("all particles placed between 60% and 120% of grid radius", () => {
    const { system, scene } = createFixture("HIGH");
    const gridRadius = 10;
    system.setup(new Vector3(0, 0, 0), gridRadius);
    const mist = findEdgeMist(scene)!;
    const positions = mist.geometry.getAttribute("position");
    const innerLimit = gridRadius * 0.6;
    const outerLimit = gridRadius * 1.2;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const dist = Math.sqrt(x * x + z * z);
      expect(dist).toBeGreaterThanOrEqual(innerLimit - 0.01);
      expect(dist).toBeLessThanOrEqual(outerLimit + 0.01);
    }
  });

  it("particle count is 100 on HIGH, 50 on MID, 0 on LOW", () => {
    const highFixture = createFixture("HIGH");
    highFixture.system.setup(new Vector3(0, 0, 0), 10);
    const highMist = findEdgeMist(highFixture.scene)!;
    expect(highMist.geometry.getAttribute("position").count).toBe(100);

    const midFixture = createFixture("MID");
    midFixture.system.setup(new Vector3(0, 0, 0), 10);
    const midMist = findEdgeMist(midFixture.scene)!;
    expect(midMist.geometry.getAttribute("position").count).toBe(50);

    const lowFixture = createFixture("LOW");
    lowFixture.system.setup(new Vector3(0, 0, 0), 10);
    expect(findEdgeMist(lowFixture.scene)).toBeUndefined();
  });

  it("material uses AdditiveBlending", () => {
    const { system, scene } = createFixture("HIGH");
    system.setup(new Vector3(0, 0, 0), 10);
    const mist = findEdgeMist(scene)!;
    const mat = mist.material as PointsMaterial;
    expect(mat.blending).toBe(AdditiveBlending);
  });

  it("after multiple updates, particles have drifted (slow circular motion)", () => {
    const { system, scene } = createFixture("HIGH");
    system.setup(new Vector3(0, 0, 0), 10);
    const mist = findEdgeMist(scene)!;
    const positions = mist.geometry.getAttribute("position");

    const initialPositions: number[] = [];
    for (let i = 0; i < positions.count * 3; i++) {
      initialPositions.push((positions.array as Float32Array)[i]);
    }

    for (let i = 0; i < 20; i++) {
      system.update(0.016);
    }

    let changed = false;
    for (let i = 0; i < positions.count * 3; i++) {
      if (Math.abs((positions.array as Float32Array)[i] - initialPositions[i]) > 0.0001) {
        changed = true;
        break;
      }
    }
    expect(changed).toBe(true);
  });

  it("setEnabled(false) sets visible to false", () => {
    const { system, scene } = createFixture("HIGH");
    system.setup(new Vector3(0, 0, 0), 10);
    const mist = findEdgeMist(scene)!;

    system.setEnabled(false);
    expect(mist.visible).toBe(false);
  });

  it("dispose() cleans up geometry, material, removes from scene", () => {
    const { system, scene } = createFixture("HIGH");
    system.setup(new Vector3(0, 0, 0), 10);
    expect(findEdgeMist(scene)).toBeDefined();

    system.dispose();
    expect(findEdgeMist(scene)).toBeUndefined();
  });
});

// ───────── Feature 5: Hex Seam Glow ─────────

describe("HexSeamGlow", () => {
  it("creates a Mesh with PlaneGeometry added to scene", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findSeamGlowMesh(scene);
    expect(mesh).toBeDefined();
    expect(mesh!.geometry).toBeInstanceOf(PlaneGeometry);
  });

  it("mesh is at y=0.02 (between ground and hex tiles)", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findSeamGlowMesh(scene)!;
    expect(mesh.position.y).toBeCloseTo(0.02);
  });

  it("material uses AdditiveBlending and depthWrite:false", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findSeamGlowMesh(scene)!;
    const mat = mesh.material as MeshBasicMaterial;
    expect(mat.blending).toBe(AdditiveBlending);
    expect(mat.depthWrite).toBe(false);
  });

  it("DataTexture has bright pixels at hex edge positions (SDF boundary)", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findSeamGlowMesh(scene)!;
    const mat = mesh.material as MeshBasicMaterial;
    const tex = mat.map as DataTexture;
    const data = tex.image.data as Uint8Array;
    const size = 256;

    // Pixel (128,128) maps to world (0,0) which is exactly on a hex edge (SDF=0).
    // This should be a bright pixel (edge glow).
    const edgeIdx = (128 * size + 128) * 4;
    const edgeBrightness = Math.max(data[edgeIdx], data[edgeIdx + 1], data[edgeIdx + 2]);

    // Pixel (112,128) maps to a hex center (deepest inside a hex, SDF most negative).
    // This should be a dark pixel.
    const hexCenterIdx = (128 * size + 112) * 4;
    const centerBrightness = Math.max(data[hexCenterIdx], data[hexCenterIdx + 1], data[hexCenterIdx + 2]);

    expect(edgeBrightness).toBeGreaterThan(centerBrightness);
  });

  it("DataTexture has dark/zero pixels at hex centers", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findSeamGlowMesh(scene)!;
    const mat = mesh.material as MeshBasicMaterial;
    const tex = mat.map as DataTexture;
    const data = tex.image.data as Uint8Array;
    const size = 256;

    // Pixel (112,128) is at a hex center (SDF most negative) — should be dark
    const centerIdx = (128 * size + 112) * 4;
    const r = data[centerIdx];
    const g = data[centerIdx + 1];
    const b = data[centerIdx + 2];
    // All channels should be very low at hex center
    expect(r).toBeLessThan(30);
    expect(g).toBeLessThan(30);
    expect(b).toBeLessThan(30);
  });

  it("glow color modulates with timeProgress — brighter at night", () => {
    const { system, scene } = createFixture("HIGH");
    const mesh = findSeamGlowMesh(scene)!;
    const mat = mesh.material as MeshBasicMaterial;

    system.setTimeProgress(50); // day
    const dayOpacity = mat.opacity;

    system.setTimeProgress(0); // night
    const nightOpacity = mat.opacity;

    expect(nightOpacity).toBeGreaterThan(dayOpacity);
  });

  it("setEnabled(false) sets mesh.visible to false", () => {
    const { system, scene } = createFixture("HIGH");
    const mesh = findSeamGlowMesh(scene)!;

    system.setEnabled(false);
    expect(mesh.visible).toBe(false);
  });

  it("dispose() cleans up mesh, geometry, material, texture", () => {
    const { system, scene } = createFixture("HIGH");
    expect(findSeamGlowMesh(scene)).toBeDefined();

    system.dispose();
    expect(findSeamGlowMesh(scene)).toBeUndefined();
  });

  it("not created when quality is LOW", () => {
    const { scene } = createFixture("LOW");
    expect(findSeamGlowMesh(scene)).toBeUndefined();
  });

  it("renderOrder is 1 (below biome tiles at 2-3)", () => {
    const { scene } = createFixture("HIGH");
    const mesh = findSeamGlowMesh(scene)!;
    expect(mesh.renderOrder).toBe(1);
  });
});
