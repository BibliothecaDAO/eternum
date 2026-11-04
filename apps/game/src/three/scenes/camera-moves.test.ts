import { describe, expect, it, vi } from "vitest";

import { claimCamera, startCameraMove, stopCameraMove } from "./camera-moves";

/** A write as a scene makes it: it stops the camera's move under way, then may start its own. */
const write = (camera: object, move?: () => void) => () => {
  stopCameraMove(camera);
  if (move) startCameraMove(camera, move);
};

describe("a camera claimed for a sequence of moves", () => {
  it("lets the sequence move the camera, each move stopping the one before, without giving up the claim", () => {
    const camera = {};
    const taken = vi.fn();
    const claim = claimCamera(camera, taken);
    const first = vi.fn();
    claim.move(write(camera, first));
    claim.move(write(camera));
    expect(first).toHaveBeenCalledOnce();
    expect(taken).not.toHaveBeenCalled();
  });

  it("is taken by the next writer from outside, which stops the sequence's move and the sequence", () => {
    const camera = {};
    const taken = vi.fn();
    const claim = claimCamera(camera, taken);
    const flight = vi.fn();
    claim.move(write(camera, flight));
    write(camera)();
    expect(flight).toHaveBeenCalledOnce();
    expect(taken).toHaveBeenCalledOnce();
    const late = vi.fn();
    claim.move(late);
    expect(late).not.toHaveBeenCalled();
  });

  it("ends by stopping its own move, leaving a newer writer's move alone", () => {
    const camera = {};
    const claim = claimCamera(camera, vi.fn());
    const flight = vi.fn();
    claim.move(write(camera, flight));
    claim.end();
    expect(flight).toHaveBeenCalledOnce();

    const newer = vi.fn();
    const later = claimCamera(camera, vi.fn());
    later.move(write(camera));
    write(camera, newer)();
    later.end();
    expect(newer).not.toHaveBeenCalled();
  });

  it("takes the camera from a claim before it", () => {
    const camera = {};
    const first = vi.fn();
    claimCamera(camera, first);
    claimCamera(camera, vi.fn());
    expect(first).toHaveBeenCalledOnce();
  });
});
