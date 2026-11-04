/**
 * The move under way on each shared camera (keyed by its controls), whichever scene started it: the next writer of the
 * camera, an animation or a placement, stops it through it, so two scenes never drive one camera at once.
 */
const cameraMoves = new WeakMap<object, () => void>();

/** Stops the camera's move under way, if any: the next writer of the camera calls this before it writes. */
export function stopCameraMove(camera: object): void {
  const cancel = cameraMoves.get(camera);
  cameraMoves.delete(camera);
  cancel?.();
}

/** Makes `cancel` the camera's move under way, for the next writer to stop. */
export function startCameraMove(camera: object, cancel: () => void): void {
  cameraMoves.set(camera, cancel);
}

/** A move that ended by itself is no longer the camera's move under way. */
export function endCameraMove(camera: object, cancel: () => void): void {
  if (cameraMoves.get(camera) === cancel) cameraMoves.delete(camera);
}

/** A camera held for a sequence of its owner's moves. */
export interface CameraClaim {
  /** Writes the camera as the sequence's next move; once the camera is taken or the claim ended, writes nothing. */
  move(write: () => void): void;
  /** Ends the claim, stopping the sequence's own move under way: a newer writer that took the camera is left alone. */
  end(): void;
}

/**
 * Claims a camera for a sequence of moves (a dive through a spire): the claim stands as the camera's move under way
 * from move to move, so the next writer from outside the sequence, whichever scene, takes the camera from it as it
 * stops any move, and `onTaken` stops the sequence. Claiming stops the move under way, a previous claim's included.
 */
export function claimCamera(camera: object, onTaken: () => void): CameraClaim {
  let step: (() => void) | undefined;
  const claim = () => {
    step?.();
    onTaken();
  };
  stopCameraMove(camera);
  cameraMoves.set(camera, claim);
  const stands = () => cameraMoves.get(camera) === claim;
  return {
    move(write) {
      if (!stands()) return;
      if (step) cameraMoves.set(camera, step);
      else cameraMoves.delete(camera);
      write();
      step = cameraMoves.get(camera);
      cameraMoves.set(camera, claim);
    },
    end() {
      if (!stands()) return;
      cameraMoves.delete(camera);
      step?.();
    },
  };
}
