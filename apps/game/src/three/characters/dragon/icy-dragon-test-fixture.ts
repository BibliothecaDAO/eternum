import { Bone, Group, type Object3D } from "three";

import { IcyDragonLibrary } from "./icy-dragon-assets";
import { resolveIcyDragonRequiredBoneNames } from "./icy-dragon-rig-adapter";

export function createIcyDragonTestLibrary(): IcyDragonLibrary {
  const scene = new Group();
  let parent: Object3D = scene;
  resolveIcyDragonRequiredBoneNames().forEach((name, index) => {
    const bone = new Bone();
    bone.name = name;
    bone.position.set(index === 0 ? 0 : 0.1, index === 0 ? 0 : 0.05, index === 0 ? 0 : 0.12);
    parent.add(bone);
    parent = bone;
  });
  return new IcyDragonLibrary({ scene });
}
