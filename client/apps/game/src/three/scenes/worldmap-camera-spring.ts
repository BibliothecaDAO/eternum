import { Vector3 } from "three";

export interface WorldmapCameraSpringState {
  cameraPosition: Vector3;
  cameraTarget: Vector3;
  cameraVelocity: Vector3;
  targetVelocity: Vector3;
}

export interface WorldmapCameraSpringGoal {
  cameraPosition: Vector3;
  cameraTarget: Vector3;
}

interface WorldmapCameraSpringConfig {
  angularFrequency: number;
  settleDistance: number;
  settleVelocity: number;
  maxDeltaSeconds: number;
}

interface AdvanceWorldmapCameraSpringInput {
  state: WorldmapCameraSpringState;
  goal: WorldmapCameraSpringGoal;
  config: WorldmapCameraSpringConfig;
  deltaSeconds: number;
}

interface SpringAxisStepResult {
  value: number;
  velocity: number;
}

export function createWorldmapCameraSpringState(): WorldmapCameraSpringState {
  return {
    cameraPosition: new Vector3(),
    cameraTarget: new Vector3(),
    cameraVelocity: new Vector3(),
    targetVelocity: new Vector3(),
  };
}

export function createWorldmapCameraSpringGoal(): WorldmapCameraSpringGoal {
  return {
    cameraPosition: new Vector3(),
    cameraTarget: new Vector3(),
  };
}

export function advanceWorldmapCameraSpring(input: AdvanceWorldmapCameraSpringInput): boolean {
  const deltaSeconds = resolveSpringDeltaSeconds(input.deltaSeconds, input.config.maxDeltaSeconds);
  if (deltaSeconds > 0) {
    advanceSpringVector(
      input.state.cameraPosition,
      input.state.cameraVelocity,
      input.goal.cameraPosition,
      deltaSeconds,
      input.config.angularFrequency,
    );
    advanceSpringVector(
      input.state.cameraTarget,
      input.state.targetVelocity,
      input.goal.cameraTarget,
      deltaSeconds,
      input.config.angularFrequency,
    );
  }

  if (!isWorldmapCameraSpringSettled(input.state, input.goal, input.config)) {
    return false;
  }

  input.state.cameraPosition.copy(input.goal.cameraPosition);
  input.state.cameraTarget.copy(input.goal.cameraTarget);
  input.state.cameraVelocity.set(0, 0, 0);
  input.state.targetVelocity.set(0, 0, 0);
  return true;
}

function advanceSpringVector(
  value: Vector3,
  velocity: Vector3,
  goal: Vector3,
  deltaSeconds: number,
  angularFrequency: number,
): void {
  const nextX = advanceSpringAxis(value.x, velocity.x, goal.x, deltaSeconds, angularFrequency);
  const nextY = advanceSpringAxis(value.y, velocity.y, goal.y, deltaSeconds, angularFrequency);
  const nextZ = advanceSpringAxis(value.z, velocity.z, goal.z, deltaSeconds, angularFrequency);

  value.set(nextX.value, nextY.value, nextZ.value);
  velocity.set(nextX.velocity, nextY.velocity, nextZ.velocity);
}

function advanceSpringAxis(
  value: number,
  velocity: number,
  goal: number,
  deltaSeconds: number,
  angularFrequency: number,
): SpringAxisStepResult {
  const frequency = Math.max(0.001, angularFrequency);
  const displacement = value - goal;
  const springTerm = velocity + frequency * displacement;
  const decay = Math.exp(-frequency * deltaSeconds);

  return {
    value: goal + (displacement + springTerm * deltaSeconds) * decay,
    velocity: (velocity - frequency * springTerm * deltaSeconds) * decay,
  };
}

function resolveSpringDeltaSeconds(deltaSeconds: number, maxDeltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return 0;
  }

  return Math.min(deltaSeconds, Math.max(0, maxDeltaSeconds));
}

function isWorldmapCameraSpringSettled(
  state: WorldmapCameraSpringState,
  goal: WorldmapCameraSpringGoal,
  config: WorldmapCameraSpringConfig,
): boolean {
  return (
    state.cameraPosition.distanceTo(goal.cameraPosition) <= config.settleDistance &&
    state.cameraTarget.distanceTo(goal.cameraTarget) <= config.settleDistance &&
    state.cameraVelocity.length() <= config.settleVelocity &&
    state.targetVelocity.length() <= config.settleVelocity
  );
}
