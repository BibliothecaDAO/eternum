import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Particles } from "./particles";

const PARTICLE_START_Y = -0.5;
const PARTICLE_RANGE = 3.0;
const PARTICLE_BASE_SPEED = 0.75;

const getFirstParticleY = (scene: THREE.Scene): number => {
  const points = scene.children.find((child): child is THREE.Points => child instanceof THREE.Points);
  if (!points) {
    throw new Error("Particles points mesh not found in scene");
  }

  const position = points.geometry.getAttribute("position") as THREE.BufferAttribute;
  return (position.array as Float32Array)[1];
};

describe("Particles", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses 60hz frame deltas without over-clamping animation speed", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const scene = new THREE.Scene();
    const particles = new Particles(scene);

    particles.update(1 / 60);

    const expectedVelocity = PARTICLE_BASE_SPEED * (1 / 60);
    const expectedY = PARTICLE_START_Y + PARTICLE_RANGE * expectedVelocity;
    expect(getFirstParticleY(scene)).toBeCloseTo(expectedY, 6);

    particles.dispose();
  });

  it("caps very large frame deltas to keep particle jumps bounded", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const scene = new THREE.Scene();
    const particles = new Particles(scene);

    particles.update(1); // Simulate long frame stall

    const expectedVelocity = PARTICLE_BASE_SPEED * (1 / 30);
    const expectedY = PARTICLE_START_Y + PARTICLE_RANGE * expectedVelocity;
    expect(getFirstParticleY(scene)).toBeCloseTo(expectedY, 6);

    particles.dispose();
  });
});
