import { Camera, Group, Mesh, Vector3 } from "three";

export function isPortalSurface(mesh: Mesh): boolean {
  return mesh.userData.spirePart === "portal";
}

export function createSpirePortal(sources: Mesh[]): { group: Group; surfaces: Mesh[] } {
  const group = new Group();
  group.name = "Spire dimensional portal";
  const surfaces = sources.map((source) => {
    const mesh = new Mesh(source.geometry, source.material);
    mesh.name = source.name;
    mesh.userData = { ...source.userData };
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = false;
    mesh.raycast = () => {};
    mesh.renderOrder = 2;
    group.add(mesh);
    return mesh;
  });
  return { group, surfaces };
}

export function sortSpirePortals(portals: Iterable<Group>, camera: Camera): void {
  camera.updateMatrixWorld();
  const position = new Vector3();
  for (const portal of portals) {
    portal.updateWorldMatrix(true, false);
    position.setFromMatrixPosition(portal.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    portal.renderOrder = position.z;
  }
}
