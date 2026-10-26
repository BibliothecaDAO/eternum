import { describe, expect, it } from "vitest";
import { Texture } from "three";
import { color, float, vec3 } from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { createRiftGroundMaterial } from "./rift-ground-material";

describe("the lab rift ground treatment", () => {
  it("keeps the biome's textures, normals and roughness without changing the original material", () => {
    const source = new MeshStandardNodeMaterial();
    source.map = new Texture();
    source.colorNode = color("#51733e");
    source.normalNode = vec3(0, 1, 0);
    source.roughnessNode = float(0.9);
    source.emissiveNode = vec3(0);
    const previous = { color: source.colorNode, emission: source.emissiveNode };
    const proposal = createRiftGroundMaterial(source);
    expect(proposal).not.toBe(source);
    expect(proposal.map).toBe(source.map);
    expect(proposal.normalNode).toBe(source.normalNode);
    expect(proposal.roughnessNode).toBe(source.roughnessNode);
    expect(proposal.positionNode).toBe(source.positionNode);
    expect(source.colorNode).toBe(previous.color);
    expect(source.emissiveNode).toBe(previous.emission);
    expect(proposal.colorNode).not.toBe(previous.color);
    expect(proposal.emissiveNode).not.toBe(previous.emission);
    proposal.dispose();
    source.dispose();
    source.map.dispose();
  });

  it("requires the real biome ground rather than silently drawing an unrelated surface", () => {
    expect(() => createRiftGroundMaterial(new MeshStandardNodeMaterial())).toThrow(
      "Rift ground requires the terrain's textured color",
    );
  });
});
