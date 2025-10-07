import { Euler, Vector3 } from "three";
import { ModelType } from "../types/army";
import { StructureType } from "@bibliothecadao/types";
import type { AttachmentTransform } from "./types";

type MountDefinition = {
  offset?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

export interface MountBaseTransform {
  position: Vector3;
  rotation?: Euler;
  scale?: Vector3;
}

const HUMANOID_DEFAULTS: Record<string, MountDefinition> = {
  origin: {
    offset: [0, 0, 0],
  },
  root: {
    offset: [0, 0.35, 0],
  },
  weapon_r: {
    offset: [0.35, 0.95, 0.12],
    rotation: [0, Math.PI / 2, 0],
  },
  weapon_l: {
    offset: [-0.35, 0.95, 0.12],
    rotation: [0, -Math.PI / 2, 0],
  },
  spine: {
    offset: [0, 1.25, -0.2],
  },
};

const BOAT_OVERRIDES: Record<string, MountDefinition> = {
  origin: {
    offset: [0, 0, 0],
  },
  root: {
    offset: [0, 0.25, 0],
  },
  spine: {
    offset: [0, 0.9, 0],
  },
};

const ARMY_MOUNT_OVERRIDES: Partial<Record<ModelType, Record<string, MountDefinition>>> = {
  [ModelType.Boat]: BOAT_OVERRIDES,
};

const DEFAULT_STRUCTURE_MOUNTS: Record<string, MountDefinition> = {
  origin: {
    offset: [0, 0, 0],
  },
  root: {
    offset: [0, 0.5, 0],
  },
};

const REALM_OVERRIDES: Record<string, MountDefinition> = {
  root: {
    offset: [0, 1.6, 0],
  },
};

const STRUCTURE_MOUNT_OVERRIDES: Partial<Record<StructureType, Record<string, MountDefinition>>> = {
  [StructureType.Realm]: REALM_OVERRIDES,
};

const UNIT_SCALE_IDENTITY = new Vector3(1, 1, 1);
const ZERO_ROTATION = new Euler(0, 0, 0);

function applyDefinitions(
  definitions: Record<string, MountDefinition> | undefined,
  base: MountBaseTransform,
  out: Map<string, AttachmentTransform>,
) {
  if (!definitions) return;

  for (const [mountPoint, definition] of Object.entries(definitions)) {
    const offset = definition.offset ?? [0, 0, 0];
    const baseScale = base.scale ?? UNIT_SCALE_IDENTITY;

    const position = base.position.clone();
    const offsetVector = new Vector3(offset[0], offset[1], offset[2]);
    offsetVector.x *= baseScale.x;
    offsetVector.y *= baseScale.y;
    offsetVector.z *= baseScale.z;

    if (base.rotation) {
      offsetVector.applyEuler(base.rotation);
    }

    position.add(offsetVector);

    let rotation: Euler | undefined;
    if (base.rotation || definition.rotation) {
      rotation = base.rotation ? base.rotation.clone() : ZERO_ROTATION.clone();
      if (definition.rotation) {
        rotation.x += definition.rotation[0];
        rotation.y += definition.rotation[1];
        rotation.z += definition.rotation[2];
      }
    }

    let scale: Vector3 | undefined;
    if (base.scale || definition.scale) {
      scale = base.scale ? base.scale.clone() : UNIT_SCALE_IDENTITY.clone();
      if (definition.scale) {
        scale.x *= definition.scale[0];
        scale.y *= definition.scale[1];
        scale.z *= definition.scale[2];
      }
    }

    out.set(mountPoint, {
      position,
      rotation,
      scale,
    });
  }
}

export function resolveArmyMountTransforms(
  modelType: ModelType | undefined,
  base: MountBaseTransform,
  target?: Map<string, AttachmentTransform>,
): Map<string, AttachmentTransform> {
  const out = target ?? new Map<string, AttachmentTransform>();
  out.clear();

  applyDefinitions(HUMANOID_DEFAULTS, base, out);

  if (modelType) {
    applyDefinitions(ARMY_MOUNT_OVERRIDES[modelType], base, out);
  }

  return out;
}

export function resolveStructureMountTransforms(
  structureType: StructureType | undefined,
  base: MountBaseTransform,
  target?: Map<string, AttachmentTransform>,
): Map<string, AttachmentTransform> {
  const out = target ?? new Map<string, AttachmentTransform>();
  out.clear();

  applyDefinitions(DEFAULT_STRUCTURE_MOUNTS, base, out);

  if (structureType !== undefined) {
    applyDefinitions(STRUCTURE_MOUNT_OVERRIDES[structureType], base, out);
  }

  return out;
}
