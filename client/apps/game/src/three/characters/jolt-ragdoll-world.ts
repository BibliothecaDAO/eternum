import initJolt from "jolt-physics/wasm";
import joltWasmUrl from "jolt-physics/jolt-physics.wasm.wasm?url";
import { type Object3D, Quaternion, Vector3 } from "three";

export type JoltRagdollJoint =
  | { kind: "hinge"; maximum: number; minimum: number }
  | { kind: "swing-twist"; swing: number; twist: number };

export interface JoltRagdollPartDefinition<PartId extends string> {
  halfExtents?: readonly [number, number, number];
  id: PartId;
  joint?: JoltRagdollJoint;
  length?: number;
  mass: number;
  parentId?: PartId;
  radius?: number;
  shape: "box" | "capsule" | "sphere";
}

export interface JoltRagdollPartPose {
  jointAnchor: readonly [number, number, number];
  position: readonly [number, number, number];
  quaternion: readonly [number, number, number, number];
}

export interface JoltRagdollDefinition<PartId extends string> {
  partIds: readonly PartId[];
  parts: Readonly<Record<PartId, JoltRagdollPartDefinition<PartId>>>;
  pose: Readonly<Record<PartId, JoltRagdollPartPose>>;
}

export interface JoltRagdollBodyConfig {
  angularDamping: number;
  friction: number;
  linearDamping: number;
  massScale: number;
  restitution: number;
  selfCollision: boolean;
}

export interface JoltRagdollWorldConfig {
  collisionSteps: number;
  fixedStep: number;
  gravity: number;
}

export interface JoltRagdollStats {
  activeBodyCount: number;
  bodyCount: number;
  constraintCount: number;
  wasmHeapBytes: number;
}

type JoltApi = Awaited<ReturnType<typeof initJolt>>;
type JoltInterfaceInstance = InstanceType<JoltApi["JoltInterface"]>;
type JoltPhysicsSystem = InstanceType<JoltApi["PhysicsSystem"]>;
type JoltBodyInterface = InstanceType<JoltApi["BodyInterface"]>;
type JoltBody = InstanceType<JoltApi["Body"]>;
type JoltShape = InstanceType<JoltApi["Shape"]>;
type JoltConstraint = InstanceType<JoltApi["Constraint"]>;
type JoltSwingTwistConstraint = InstanceType<JoltApi["SwingTwistConstraint"]>;
type JoltHingeConstraint = InstanceType<JoltApi["HingeConstraint"]>;

interface JoltBodyRecord {
  body: JoltBody;
}

interface JoltConstraintRecord<PartId extends string> {
  constraint: JoltConstraint;
  partId: PartId;
  joint: JoltRagdollJoint;
}

interface JoltRagdollLifecycle {
  dispose(): void;
  getConstraintCount(): number;
}

const STATIC_LAYER = 0;
const MOVING_LAYER = 1;
const OBJECT_LAYER_COUNT = 2;
const BROAD_PHASE_LAYER_COUNT = 2;
const MAX_SIMULATION_STEPS = 4;
export const JOLT_RAGDOLL_GROUND_HALF_EXTENT = 1_024;

let joltModulePromise: Promise<JoltApi> | undefined;

export async function preloadJoltCharacterPhysics(): Promise<void> {
  await loadJoltModule();
}

export class JoltRagdollWorld {
  private readonly Jolt: JoltApi;
  private readonly jolt: JoltInterfaceInstance;
  private readonly physicsSystem: JoltPhysicsSystem;
  private readonly bodyInterface: JoltBodyInterface;
  private readonly instances = new Set<JoltRagdollLifecycle>();
  private readonly ground: JoltBodyRecord;
  private config: JoltRagdollWorldConfig;
  private nextCollisionGroupId = 1;
  private accumulator = 0;
  private lastStepCount = 0;
  private disposed = false;

  public static async create(config: JoltRagdollWorldConfig): Promise<JoltRagdollWorld> {
    return new JoltRagdollWorld(await loadJoltModule(), config);
  }

  private constructor(Jolt: JoltApi, config: JoltRagdollWorldConfig) {
    this.Jolt = Jolt;
    this.config = { ...config };
    this.jolt = createJoltInterface(Jolt);
    this.physicsSystem = this.jolt.GetPhysicsSystem();
    this.bodyInterface = this.physicsSystem.GetBodyInterface();
    this.setGravity(config.gravity);
    this.ground = this.createGround();
  }

  public createRagdoll<PartId extends string>(
    definition: JoltRagdollDefinition<PartId>,
    config: JoltRagdollBodyConfig,
  ): JoltRagdollInstance<PartId> {
    if (this.disposed) throw new Error("Cannot create a ragdoll in a disposed Jolt world");
    const instance = new JoltRagdollInstance(
      this.Jolt,
      this.physicsSystem,
      this.bodyInterface,
      definition,
      config,
      this.nextCollisionGroupId++,
      (disposedInstance) => this.instances.delete(disposedInstance),
      () => this.jolt.sGetTotalMemory(),
    );
    this.instances.add(instance);
    return instance;
  }

  public update(deltaSeconds: number): number {
    if (this.disposed) return 0;
    this.accumulator += Math.min(Math.max(0, deltaSeconds), 0.1);
    let steps = 0;
    while (this.accumulator >= this.config.fixedStep && steps < MAX_SIMULATION_STEPS) {
      this.jolt.Step(this.config.fixedStep, this.config.collisionSteps);
      this.accumulator -= this.config.fixedStep;
      steps += 1;
    }
    if (steps === MAX_SIMULATION_STEPS && this.accumulator >= this.config.fixedStep) this.accumulator = 0;
    this.lastStepCount = steps;
    return steps;
  }

  public stepOnce(): void {
    if (this.disposed) return;
    this.jolt.Step(this.config.fixedStep, this.config.collisionSteps);
    this.lastStepCount = 1;
  }

  public updateConfig(config: JoltRagdollWorldConfig): void {
    this.config = { ...config };
    this.setGravity(config.gravity);
  }

  public getLastStepCount(): number {
    return this.lastStepCount;
  }

  public getStats(): JoltRagdollStats {
    return {
      activeBodyCount: this.physicsSystem.GetNumActiveBodies(this.Jolt.EBodyType_RigidBody),
      bodyCount: this.physicsSystem.GetNumBodies(),
      constraintCount: [...this.instances].reduce((sum, instance) => sum + instance.getConstraintCount(), 0),
      wasmHeapBytes: this.jolt.sGetTotalMemory(),
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    [...this.instances].forEach((instance) => instance.dispose());
    this.instances.clear();
    this.destroyBody(this.ground);
    this.Jolt.destroy(this.jolt);
  }

  private createGround(): JoltBodyRecord {
    const halfExtents = new this.Jolt.Vec3(JOLT_RAGDOLL_GROUND_HALF_EXTENT, 0.12, JOLT_RAGDOLL_GROUND_HALF_EXTENT);
    const shape = new this.Jolt.BoxShape(halfExtents, 0.04);
    const position = new this.Jolt.RVec3(0, -0.12, 0);
    const rotation = new this.Jolt.Quat(0, 0, 0, 1);
    const settings = new this.Jolt.BodyCreationSettings(
      shape,
      position,
      rotation,
      this.Jolt.EMotionType_Static,
      STATIC_LAYER,
    );
    settings.mFriction = 0.72;
    const body = this.bodyInterface.CreateBody(settings);
    this.bodyInterface.AddBody(body.GetID(), this.Jolt.EActivation_DontActivate);
    this.Jolt.destroy(settings);
    this.Jolt.destroy(halfExtents);
    this.Jolt.destroy(position);
    this.Jolt.destroy(rotation);
    return { body };
  }

  private setGravity(gravity: number): void {
    const vector = new this.Jolt.Vec3(0, gravity, 0);
    this.physicsSystem.SetGravity(vector);
    this.Jolt.destroy(vector);
  }

  private destroyBody(record: JoltBodyRecord): void {
    const bodyId = record.body.GetID();
    if (this.bodyInterface.IsAdded(bodyId)) this.bodyInterface.RemoveBody(bodyId);
    this.bodyInterface.DestroyBody(bodyId);
  }
}

/** Collider dimensions use the largest axis when a parent applies non-uniform scale. */
export function resolveJoltColliderScale(coordinateSpace?: Object3D): number {
  if (!coordinateSpace) return 1;
  coordinateSpace.updateWorldMatrix(true, false);
  const scale = coordinateSpace.getWorldScale(new Vector3());
  return Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
}

export class JoltRagdollInstance<PartId extends string> {
  private readonly bodies = new Map<PartId, JoltBodyRecord>();
  private readonly constraints: JoltConstraintRecord<PartId>[] = [];
  private readonly scratchPosition: InstanceType<JoltApi["RVec3"]>;
  private readonly scratchRotation: InstanceType<JoltApi["Quat"]>;
  private config: JoltRagdollBodyConfig;
  private disposed = false;

  public constructor(
    private readonly Jolt: JoltApi,
    private readonly physicsSystem: JoltPhysicsSystem,
    private readonly bodyInterface: JoltBodyInterface,
    private readonly definition: JoltRagdollDefinition<PartId>,
    config: JoltRagdollBodyConfig,
    collisionGroupId: number,
    private readonly release: (instance: JoltRagdollInstance<PartId>) => void,
    private readonly readWasmHeapBytes: () => number,
  ) {
    this.config = { ...config };
    this.scratchPosition = new Jolt.RVec3();
    this.scratchRotation = new Jolt.Quat();
    this.createBodies(collisionGroupId);
    this.createConstraints();
  }

  public updateConfig(config: JoltRagdollBodyConfig): void {
    this.config = { ...config };
    this.bodies.forEach(({ body }) => {
      body.SetFriction(config.friction);
      body.SetRestitution(config.restitution);
      const motion = body.GetMotionProperties();
      motion.SetLinearDamping(config.linearDamping);
      motion.SetAngularDamping(config.angularDamping);
    });
    this.updateConstraintLimits();
  }

  public applyImpulse(partId: PartId, impulse: readonly [number, number, number]): void {
    const record = this.bodies.get(partId);
    if (!record) return;
    const vector = new this.Jolt.Vec3(...impulse);
    this.bodyInterface.AddImpulse(record.body.GetID(), vector);
    this.Jolt.destroy(vector);
    this.bodyInterface.ActivateBody(record.body.GetID());
  }

  public writePartTransforms(
    write: (partId: PartId, x: number, y: number, z: number, qx: number, qy: number, qz: number, qw: number) => void,
  ): void {
    this.bodies.forEach(({ body }, partId) => {
      this.bodyInterface.GetPositionAndRotation(body.GetID(), this.scratchPosition, this.scratchRotation);
      write(
        partId,
        this.scratchPosition.GetX(),
        this.scratchPosition.GetY(),
        this.scratchPosition.GetZ(),
        this.scratchRotation.GetX(),
        this.scratchRotation.GetY(),
        this.scratchRotation.GetZ(),
        this.scratchRotation.GetW(),
      );
    });
  }

  public hasFiniteTransforms(): boolean {
    let finite = true;
    this.writePartTransforms((_partId, ...values) => {
      finite = finite && values.every(Number.isFinite);
    });
    return finite;
  }

  public getStats(): JoltRagdollStats {
    return {
      activeBodyCount: [...this.bodies.values()].filter(({ body }) => body.IsActive()).length,
      bodyCount: this.bodies.size,
      constraintCount: this.constraints.length,
      wasmHeapBytes: this.readWasmHeapBytes(),
    };
  }

  public getConstraintCount(): number {
    return this.constraints.length;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const { constraint } of this.constraints) this.physicsSystem.RemoveConstraint(constraint);
    this.constraints.length = 0;
    this.bodies.forEach((record) => this.destroyBody(record));
    this.bodies.clear();
    this.Jolt.destroy(this.scratchPosition);
    this.Jolt.destroy(this.scratchRotation);
    this.release(this);
  }

  private createBodies(collisionGroupId: number): void {
    const groupFilter = new this.Jolt.GroupFilterTable(this.definition.partIds.length);
    groupFilter.AddRef();
    configureSelfCollision(groupFilter, this.definition, this.config.selfCollision);

    this.definition.partIds.forEach((partId, partIndex) => {
      const definition = this.definition.parts[partId];
      const transform = this.definition.pose[partId];
      const shape = createPartShape(this.Jolt, definition);
      const position = new this.Jolt.RVec3(...transform.position);
      const rotation = new this.Jolt.Quat(...transform.quaternion);
      const settings = new this.Jolt.BodyCreationSettings(
        shape,
        position,
        rotation,
        this.Jolt.EMotionType_Dynamic,
        MOVING_LAYER,
      );
      const collisionGroup = new this.Jolt.CollisionGroup(groupFilter, collisionGroupId, partIndex);
      settings.mCollisionGroup = collisionGroup;
      settings.mFriction = this.config.friction;
      settings.mRestitution = this.config.restitution;
      settings.mLinearDamping = this.config.linearDamping;
      settings.mAngularDamping = this.config.angularDamping;
      settings.mOverrideMassProperties = this.Jolt.EOverrideMassProperties_CalculateInertia;
      settings.mMassPropertiesOverride.mMass = definition.mass * this.config.massScale;
      settings.mNumVelocityStepsOverride = 10;
      settings.mNumPositionStepsOverride = 3;
      const body = this.bodyInterface.CreateBody(settings);
      this.bodyInterface.AddBody(body.GetID(), this.Jolt.EActivation_Activate);
      this.bodies.set(partId, { body });
      this.Jolt.destroy(collisionGroup);
      this.Jolt.destroy(settings);
      this.Jolt.destroy(position);
      this.Jolt.destroy(rotation);
    });
    groupFilter.Release();
  }

  private createConstraints(): void {
    this.definition.partIds.forEach((partId) => {
      const part = this.definition.parts[partId];
      if (!part.parentId || !part.joint) return;
      const parent = this.bodies.get(part.parentId)?.body;
      const child = this.bodies.get(partId)?.body;
      if (!parent || !child) return;
      const pose = this.definition.pose[partId];
      const constraint =
        part.joint.kind === "hinge"
          ? this.createHingeConstraint(parent, child, pose.jointAnchor, part.joint)
          : this.createSwingTwistConstraint(parent, child, pose, part.joint);
      this.physicsSystem.AddConstraint(constraint);
      this.constraints.push({ constraint, joint: part.joint, partId });
    });
  }

  private createHingeConstraint(
    parent: JoltBody,
    child: JoltBody,
    anchor: readonly [number, number, number],
    limits: Extract<JoltRagdollJoint, { kind: "hinge" }>,
  ): JoltHingeConstraint {
    const settings = new this.Jolt.HingeConstraintSettings();
    const retainedValues: object[] = [];
    settings.mSpace = this.Jolt.EConstraintSpace_WorldSpace;
    settings.mPoint1 = retainJoltValue(retainedValues, new this.Jolt.RVec3(...anchor));
    settings.mPoint2 = retainJoltValue(retainedValues, new this.Jolt.RVec3(...anchor));
    settings.mHingeAxis1 = retainJoltValue(retainedValues, new this.Jolt.Vec3(1, 0, 0));
    settings.mHingeAxis2 = retainJoltValue(retainedValues, new this.Jolt.Vec3(1, 0, 0));
    settings.mNormalAxis1 = retainJoltValue(retainedValues, new this.Jolt.Vec3(0, 1, 0));
    settings.mNormalAxis2 = retainJoltValue(retainedValues, new this.Jolt.Vec3(0, 1, 0));
    settings.mLimitsMin = limits.minimum;
    settings.mLimitsMax = limits.maximum;
    const constraint = this.Jolt.castObject(settings.Create(parent, child), this.Jolt.HingeConstraint);
    retainedValues.forEach((value) => this.Jolt.destroy(value));
    this.Jolt.destroy(settings);
    return constraint;
  }

  private createSwingTwistConstraint(
    parent: JoltBody,
    child: JoltBody,
    pose: JoltRagdollPartPose,
    limits: Extract<JoltRagdollJoint, { kind: "swing-twist" }>,
  ): JoltSwingTwistConstraint {
    const settings = new this.Jolt.SwingTwistConstraintSettings();
    const retainedValues: object[] = [];
    settings.mSpace = this.Jolt.EConstraintSpace_WorldSpace;
    settings.mPosition1 = retainJoltValue(retainedValues, new this.Jolt.RVec3(...pose.jointAnchor));
    settings.mPosition2 = retainJoltValue(retainedValues, new this.Jolt.RVec3(...pose.jointAnchor));
    const orientation = new Quaternion(...pose.quaternion);
    const twist = new Vector3(0, 1, 0).applyQuaternion(orientation).normalize();
    const plane = resolvePerpendicularAxis(twist);
    settings.mTwistAxis1 = retainJoltValue(retainedValues, new this.Jolt.Vec3(twist.x, twist.y, twist.z));
    settings.mTwistAxis2 = retainJoltValue(retainedValues, new this.Jolt.Vec3(twist.x, twist.y, twist.z));
    settings.mPlaneAxis1 = retainJoltValue(retainedValues, new this.Jolt.Vec3(plane.x, plane.y, plane.z));
    settings.mPlaneAxis2 = retainJoltValue(retainedValues, new this.Jolt.Vec3(plane.x, plane.y, plane.z));
    settings.mNormalHalfConeAngle = limits.swing;
    settings.mPlaneHalfConeAngle = limits.swing;
    settings.mTwistMinAngle = -limits.twist;
    settings.mTwistMaxAngle = limits.twist;
    const constraint = this.Jolt.castObject(settings.Create(parent, child), this.Jolt.SwingTwistConstraint);
    retainedValues.forEach((value) => this.Jolt.destroy(value));
    this.Jolt.destroy(settings);
    return constraint;
  }

  private updateConstraintLimits(): void {
    this.constraints.forEach(({ constraint, joint }) => {
      if (joint.kind === "hinge") {
        const hinge = this.Jolt.castObject(constraint, this.Jolt.HingeConstraint);
        hinge.SetLimits(joint.minimum, joint.maximum);
        return;
      }
      const swingTwist = this.Jolt.castObject(constraint, this.Jolt.SwingTwistConstraint);
      swingTwist.SetNormalHalfConeAngle(joint.swing);
      swingTwist.SetPlaneHalfConeAngle(joint.swing);
      swingTwist.SetTwistMinAngle(-joint.twist);
      swingTwist.SetTwistMaxAngle(joint.twist);
    });
  }

  private destroyBody(record: JoltBodyRecord): void {
    const bodyId = record.body.GetID();
    if (this.bodyInterface.IsAdded(bodyId)) this.bodyInterface.RemoveBody(bodyId);
    this.bodyInterface.DestroyBody(bodyId);
  }
}

async function loadJoltModule(): Promise<JoltApi> {
  joltModulePromise ??= initJolt({ locateFile: () => joltWasmUrl });
  return joltModulePromise;
}

function createJoltInterface(Jolt: JoltApi): JoltInterfaceInstance {
  const objectFilter = new Jolt.ObjectLayerPairFilterTable(OBJECT_LAYER_COUNT);
  objectFilter.EnableCollision(STATIC_LAYER, MOVING_LAYER);
  objectFilter.EnableCollision(MOVING_LAYER, MOVING_LAYER);
  const staticBroadPhaseLayer = new Jolt.BroadPhaseLayer(0);
  const movingBroadPhaseLayer = new Jolt.BroadPhaseLayer(1);
  const broadPhase = new Jolt.BroadPhaseLayerInterfaceTable(OBJECT_LAYER_COUNT, BROAD_PHASE_LAYER_COUNT);
  broadPhase.MapObjectToBroadPhaseLayer(STATIC_LAYER, staticBroadPhaseLayer);
  broadPhase.MapObjectToBroadPhaseLayer(MOVING_LAYER, movingBroadPhaseLayer);
  Jolt.destroy(staticBroadPhaseLayer);
  Jolt.destroy(movingBroadPhaseLayer);
  const settings = new Jolt.JoltSettings();
  settings.mObjectLayerPairFilter = objectFilter;
  settings.mBroadPhaseLayerInterface = broadPhase;
  settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(
    broadPhase,
    BROAD_PHASE_LAYER_COUNT,
    objectFilter,
    OBJECT_LAYER_COUNT,
  );
  settings.mMaxBodies = 4096;
  settings.mMaxBodyPairs = 16384;
  settings.mMaxContactConstraints = 8192;
  settings.mMaxWorkerThreads = 1;
  const jolt = new Jolt.JoltInterface(settings);
  Jolt.destroy(settings);
  return jolt;
}

function configureSelfCollision<PartId extends string>(
  groupFilter: InstanceType<JoltApi["GroupFilterTable"]>,
  definition: JoltRagdollDefinition<PartId>,
  selfCollision: boolean,
): void {
  for (let left = 0; left < definition.partIds.length; left += 1) {
    for (let right = left + 1; right < definition.partIds.length; right += 1) {
      const leftId = definition.partIds[left];
      const rightId = definition.partIds[right];
      const directlyLinked =
        definition.parts[leftId].parentId === rightId || definition.parts[rightId].parentId === leftId;
      if (!selfCollision || directlyLinked) groupFilter.DisableCollision(left, right);
    }
  }
}

function createPartShape<PartId extends string>(
  Jolt: JoltApi,
  definition: JoltRagdollPartDefinition<PartId>,
): JoltShape {
  if (definition.shape === "sphere") return new Jolt.SphereShape(definition.radius ?? 0.15);
  if (definition.shape === "box") {
    const [x, y, z] = definition.halfExtents ?? [0.2, 0.2, 0.2];
    const halfExtents = new Jolt.Vec3(x, y, z);
    const shape = new Jolt.BoxShape(halfExtents, Math.min(x, y, z) * 0.18);
    Jolt.destroy(halfExtents);
    return shape;
  }
  const radius = definition.radius ?? 0.08;
  const halfHeight = Math.max(0.01, ((definition.length ?? 0.4) - radius * 2) * 0.5);
  return new Jolt.CapsuleShape(halfHeight, radius);
}

function resolvePerpendicularAxis(axis: Vector3): Vector3 {
  const reference = Math.abs(axis.z) < 0.85 ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
  return reference.addScaledVector(axis, -reference.dot(axis)).normalize();
}

function retainJoltValue<T extends object>(retainedValues: object[], value: T): T {
  retainedValues.push(value);
  return value;
}
