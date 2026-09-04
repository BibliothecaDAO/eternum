import { Scene, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { AmbientParticleSystem } from "./ambient-particle-system";

describe("ambient-particle-system", () => {
  it("keeps weather fade applied after frame updates", () => {
    const system = new AmbientParticleSystem(new Scene());

    system.setTimeProgress(50);
    system.setWeatherIntensity(1);
    system.update(0.016, new Vector3(0, 5, 0));

    const dustOpacity = (system as any).dustMaterial.opacity as number;
    const fireflyOpacity = (system as any).fireflyMaterial.opacity as number;

    expect(dustOpacity).toBe(0);
    expect(fireflyOpacity).toBe(0);

    system.dispose();
  });
});
