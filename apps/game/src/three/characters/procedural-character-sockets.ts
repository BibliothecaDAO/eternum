import type { Quaternion, Vector3 } from "three";

export type CharacterSocketId =
  | "drawRight"
  | "forearmLeft"
  | "gripLeft"
  | "gripRight"
  | "handLeft"
  | "handRight"
  | "jawAnchor"
  | "projectileOrigin"
  | "quiver";

/** Sockets a rig may lack: gear that needs one is fitted to a rig that has it. */
export const OPTIONAL_CHARACTER_SOCKET_IDS = ["forearmLeft"] as const;
export type OptionalCharacterSocketId = (typeof OPTIONAL_CHARACTER_SOCKET_IDS)[number];

/** One value per socket the rig must have, and per optional socket it has. */
export type CharacterSocketRecord<T> = Record<Exclude<CharacterSocketId, OptionalCharacterSocketId>, T> &
  Partial<Record<OptionalCharacterSocketId, T>>;

export function isOptionalCharacterSocketId(socketId: CharacterSocketId): socketId is OptionalCharacterSocketId {
  return (OPTIONAL_CHARACTER_SOCKET_IDS as readonly CharacterSocketId[]).includes(socketId);
}

export interface ProceduralCharacterSocketReader {
  writeSocketWorldTransform(socketId: CharacterSocketId, outPosition: Vector3, outQuaternion: Quaternion): boolean;
}
