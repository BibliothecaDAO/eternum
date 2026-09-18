import { AdditiveBlending, Camera, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { cameraPosition, positionWorld, uniform, vec4 } from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";

const LIGHT_PARTS = new Set(["portalAccretion", "portalCorona", "portalCurrentSurface"]);

export interface SpirePortalState {
  inverseCore: Matrix4;
}

export function isPortalSurface(mesh: Mesh): boolean {
  return mesh.userData.spirePart === "portal" || LIGHT_PARTS.has(mesh.userData.spirePart);
}

/** One portal is composed back-to-front as a unit; additive light has no ordering within each half. */
export class SpirePortalMaterials {
  private readonly materials = new Map<
    MeshStandardMaterial,
    { front: MeshStandardNodeMaterial; rear: MeshStandardNodeMaterial }
  >();
  private readonly inverseCore = uniform(new Matrix4()).onObjectUpdate(
    ({ object }) => (object!.userData.spirePortal as SpirePortalState).inverseCore,
  );
  private readonly direction = uniform(new Vector3()).onRenderUpdate(({ camera }, node) =>
    camera!.getWorldDirection(node.value),
  );
  private readonly orthographic = uniform(false).onRenderUpdate(
    ({ camera }) => camera !== null && "isOrthographicCamera" in camera && camera.isOrthographicCamera === true,
  );

  constructor(private readonly radius: number) {}

  create(sources: Mesh[]): { group: Group; surfaces: Mesh[]; state: SpirePortalState } {
    const group = new Group();
    group.name = "Spire dimensional portal";
    const state = { inverseCore: new Matrix4() };
    const surfaces = sources.map((source) => {
      const mesh = new Mesh(source.geometry, source.material);
      mesh.name = source.name;
      mesh.userData = { ...source.userData, spirePortal: state };
      mesh.matrixAutoUpdate = false;
      mesh.castShadow = false;
      mesh.raycast = () => {};
      if (LIGHT_PARTS.has(source.userData.spirePart)) this.addLightLayers(mesh);
      else mesh.renderOrder = 2;
      group.add(mesh);
      return mesh;
    });
    return { group, surfaces, state };
  }

  dispose(): void {
    for (const { front, rear } of this.materials.values()) {
      front.dispose();
      rear.dispose();
    }
    this.materials.clear();
  }

  private addLightLayers(mesh: Mesh): void {
    const source = mesh.material;
    if (!(source instanceof MeshStandardMaterial)) throw new Error("Spire portal requires standard glTF materials");
    let pair = this.materials.get(source);
    if (!pair) {
      pair = { front: this.createLightMaterial(source, false), rear: this.createLightMaterial(source, true) };
      this.materials.set(source, pair);
    }
    mesh.material = pair.front;
    mesh.renderOrder = 3;
    const rear = new Mesh(mesh.geometry, pair.rear);
    rear.name = `${mesh.name} / rear light`;
    rear.userData.spirePortal = mesh.userData.spirePortal;
    rear.renderOrder = 1;
    rear.raycast = () => {};
    mesh.add(rear);
  }

  private createLightMaterial(source: MeshStandardMaterial, rear: boolean): MeshStandardNodeMaterial {
    const material = new MeshStandardNodeMaterial();
    // Match Three's standard-to-node conversion, preserving every authored PBR and texture property.
    Object.assign(material, source.clone());
    material.name = `${source.name} / ${rear ? "rear" : "front"} light`;
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = true;
    material.blending = AdditiveBlending;
    material.forceSinglePass = true;
    const point = this.inverseCore.mul(vec4(positionWorld, 1)).xyz;
    const eye = this.inverseCore.mul(vec4(cameraPosition, 1)).xyz;
    const perspectiveRay = point.sub(eye).normalize();
    const parallelRay = this.inverseCore.mul(vec4(this.direction, 0)).xyz.normalize();
    const ray = this.orthographic.select(parallelRay, perspectiveRay);
    const origin = this.orthographic.select(
      point.sub(
        ray.mul(
          eye
            .length()
            .add(point.length())
            .add(this.radius * 2),
        ),
      ),
      eye,
    );
    const b = origin.dot(ray);
    const discriminant = b.mul(b).sub(origin.dot(origin).sub(this.radius ** 2));
    const root = discriminant.max(0).sqrt();
    const near = b.negate().sub(root);
    const far = b.negate().add(root);
    const distance = point.sub(origin).dot(ray);
    const behind = discriminant
      .greaterThanEqual(0)
      .and(far.greaterThan(0))
      .and(distance.greaterThan(near.max(0).add(0.00001)));
    material.maskNode = rear ? behind : behind.not();
    return material;
  }
}

/** Disjoint portal volumes can overlap on screen. Sort whole volumes, then their rear/core/front passes. */
export function sortSpirePortals(portals: Iterable<Group>, camera: Camera): void {
  camera.updateMatrixWorld();
  const position = new Vector3();
  for (const portal of portals) {
    portal.updateWorldMatrix(true, false);
    position.setFromMatrixPosition(portal.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    portal.renderOrder = position.z;
  }
}
