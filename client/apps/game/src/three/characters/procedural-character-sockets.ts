import type { Quaternion, Vector3 } from "three";

export type CharacterSocketId =
  | "drawRight"
  | "gripLeft"
  | "gripRight"
  | "handLeft"
  | "handRight"
  | "jawAnchor"
  | "projectileOrigin"
  | "quiver";

export interface ProceduralCharacterSocketReader {
  writeSocketWorldTransform(socketId: CharacterSocketId, outPosition: Vector3, outQuaternion: Quaternion): boolean;
}
