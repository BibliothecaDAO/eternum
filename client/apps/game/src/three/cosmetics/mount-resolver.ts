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

// Pre-allocated reusable objects for mount transform calculations (avoids per-frame GC pressure)
const _tempOffsetVector = new Vector3();
const _tempPosition = new Vector3();
const _tempRotation = new Euler();
const _tempScale = new Vector3();

// Cache of reusable AttachmentTransform objects keyed by mount point name
// This avoids allocating new objects every frame
const _transformCache: Map<string, AttachmentTransform> = new Map();

function getOrCreateCachedTransform(mountPoint: string): AttachmentTransform {
  let transform = _transformCache.get(mountPoint);
  if (!transform) {
    transform = {
      position: new Vector3(),
      rotation: new Euler(),
      scale: new Vector3(),
    };
    _transformCache.set(mountPoint, transform);
  }
  return transform;
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

function applyDefinitions(
  definitions: Record<string, MountDefinition> | undefined,
  base: MountBaseTransform,
  out: Map<string, AttachmentTransform>,
) {
  if (!definitions) return;

  for (const [mountPoint, definition] of Object.entries(definitions)) {
    const offset = definition.offset ?? [0, 0, 0];
    const baseScale = base.scale ?? UNIT_SCALE_IDENTITY;

    // Use cached transform object to avoid allocations
    const transform = getOrCreateCachedTransform(mountPoint);

    // Calculate position using temp vectors (no allocations)
    _tempPosition.copy(base.position);
    _tempOffsetVector.set(offset[0], offset[1], offset[2]);
    _tempOffsetVector.x *= baseScale.x;
    _tempOffsetVector.y *= baseScale.y;
    _tempOffsetVector.z *= baseScale.z;

    if (base.rotation) {
      _tempOffsetVector.applyEuler(base.rotation);
    }

    _tempPosition.add(_tempOffsetVector);
    transform.position.copy(_tempPosition);

    // Calculate rotation
    if (base.rotation || definition.rotation) {
      if (base.rotation) {
        _tempRotation.copy(base.rotation);
      } else {
        _tempRotation.set(0, 0, 0);
      }
      if (definition.rotation) {
        _tempRotation.x += definition.rotation[0];
        _tempRotation.y += definition.rotation[1];
        _tempRotation.z += definition.rotation[2];
      }
      transform.rotation!.copy(_tempRotation);
    } else {
      transform.rotation!.set(0, 0, 0);
    }

    // Calculate scale
    if (base.scale || definition.scale) {
      if (base.scale) {
        _tempScale.copy(base.scale);
      } else {
        _tempScale.set(1, 1, 1);
      }
      if (definition.scale) {
        _tempScale.x *= definition.scale[0];
        _tempScale.y *= definition.scale[1];
        _tempScale.z *= definition.scale[2];
      }
      transform.scale!.copy(_tempScale);
    } else {
      transform.scale!.set(1, 1, 1);
    }

    out.set(mountPoint, transform);
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
