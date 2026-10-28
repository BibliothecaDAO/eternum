import { Vector3 } from "three";

/**
 * Where the key light aims: a little nearer the camera than the camera's target, so its shadow map covers the near
 * ground the view shows.
 */
const AIM_TOWARD_CAMERA = new Vector3(0, 0, 5.2);

/**
 * Where the key light stands from its aim: raised, in front of the board and to the left, on the camera's side. Every
 * face a player looks at (walls, doors, the slopes of roofs turned to the camera) takes the light, at any of a
 * building's six headings. Standing behind the board, it left those faces in their own shade, lit by the sky alone, so
 * a building's look came from its heading and its paint (owner, 28 October 2026: "weird lighting on the realm
 * buildings ?"). It stands 46° high, so a shadow is never longer than what casts it.
 */
const STANDS_FROM_AIM = new Vector3(-7.9, 13, 9.7);

/**
 * The key light's place around the camera's target, the same through the whole day and night: the day cycle colours
 * and dims the light, it never swings the shadows (an orbiting sun moved every shadow every frame, the flicker of bug
 * 26).
 */
export function placeKeyLight(cameraTarget: Vector3, position: Vector3, aim: Vector3): void {
  aim.copy(cameraTarget).add(AIM_TOWARD_CAMERA);
  position.copy(aim).add(STANDS_FROM_AIM);
}
