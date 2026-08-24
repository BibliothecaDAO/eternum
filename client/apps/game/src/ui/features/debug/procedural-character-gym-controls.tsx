import {
  Activity,
  Check,
  ChevronRight,
  Copy,
  Crosshair,
  Dices,
  FlaskConical,
  RotateCcw,
  Shield,
  Swords,
  Target,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  PROCEDURAL_CHARACTER_PRESETS,
  PROCEDURAL_MELEE_OFFHANDS,
  PROCEDURAL_MELEE_WEAPONS,
  PROCEDURAL_UNIT_KINDS,
  type ProceduralCharacterConfig,
  type ProceduralCharacterMotionMode,
  type ProceduralCharacterPresetId,
  type ProceduralArcherConfig,
  type ProceduralHorseConfig,
  type ProceduralHorseGait,
  type ProceduralHorseLead,
  type ProceduralHorseTerrainPreset,
  type ProceduralMeleeConfig,
  type ProceduralMeleeOffhandId,
  type ProceduralMeleeWeaponId,
  type ProceduralUnitConfig,
  type ProceduralUnitConfigPatch,
  type ProceduralUnitKind,
} from "@/three/characters";
import {
  PROCEDURAL_COLLISION_GYM_SCENARIOS,
  type ProceduralCollisionGymConfig,
  type ProceduralCollisionGymScenario,
} from "@/three/characters/gym/procedural-collision-gym-config";
import { cn } from "@/ui/design-system/atoms/lib/utils";

type NumericConfigKey = {
  [Key in keyof ProceduralCharacterConfig]: ProceduralCharacterConfig[Key] extends number ? Key : never;
}[keyof ProceduralCharacterConfig];

interface NumericField {
  key: NumericConfigKey;
  label: string;
  min: number;
  max: number;
  step: number;
}

type NumericHorseConfigKey = {
  [Key in keyof ProceduralHorseConfig]: ProceduralHorseConfig[Key] extends number ? Key : never;
}[keyof ProceduralHorseConfig];

interface HorseNumericField {
  key: NumericHorseConfigKey;
  label: string;
  min: number;
  max: number;
  step: number;
}

interface CharacterGymControlsProps {
  collisionConfig: ProceduralCollisionGymConfig;
  config: ProceduralUnitConfig;
  copied: boolean;
  selectedPreset: ProceduralCharacterPresetId | "custom";
  onApplyPreset(presetId: ProceduralCharacterPresetId): void;
  onCopyConfig(): void;
  onPatchCollisionConfig(patch: Partial<ProceduralCollisionGymConfig>): void;
  onPatchConfig(patch: ProceduralUnitConfigPatch): void;
  onResetCamera(): void;
}

type NumericArcherConfigKey = {
  [Key in keyof ProceduralArcherConfig]: ProceduralArcherConfig[Key] extends number ? Key : never;
}[keyof ProceduralArcherConfig];

interface ArcherNumericField {
  key: NumericArcherConfigKey;
  label: string;
  min: number;
  max: number;
  step: number;
}

type NumericMeleeConfigKey = {
  [Key in keyof ProceduralMeleeConfig]: ProceduralMeleeConfig[Key] extends number ? Key : never;
}[keyof ProceduralMeleeConfig];

interface MeleeNumericField {
  key: NumericMeleeConfigKey;
  label: string;
  min: number;
  max: number;
  step: number;
}

const APPEARANCE_FIELDS: readonly NumericField[] = [
  { key: "metalness", label: "Metalness", min: 0, max: 1, step: 0.01 },
  { key: "roughness", label: "Roughness", min: 0.04, max: 1, step: 0.01 },
  { key: "runeGlow", label: "Rune glow", min: 0, max: 2, step: 0.01 },
];

const MOTION_FIELDS: readonly NumericField[] = [
  { key: "animationSpeed", label: "Speed", min: 0, max: 3, step: 0.01 },
  { key: "stride", label: "Stride", min: 0, max: 1.4, step: 0.01 },
  { key: "stepHeight", label: "Step height", min: 0, max: 0.8, step: 0.01 },
  { key: "stepWidthRatio", label: "Step width / leg", min: 0.04, max: 0.3, step: 0.005 },
  { key: "dutyFactorOffset", label: "Contact duty", min: -0.16, max: 0.16, step: 0.005 },
  { key: "footPlant", label: "Foot planting", min: 0, max: 1, step: 0.01 },
  { key: "footProgressionDegrees", label: "Toe-out angle", min: -10, max: 25, step: 0.5 },
  { key: "motionVariation", label: "Motion variation", min: 0, max: 0.3, step: 0.005 },
  { key: "secondaryMotion", label: "Follow-through", min: 0, max: 1.5, step: 0.01 },
  { key: "armSwing", label: "Arm swing", min: 0, max: 1.5, step: 0.01 },
  { key: "hipSway", label: "Hip sway", min: 0, max: 0.2, step: 0.001 },
  { key: "torsoTwist", label: "Torso twist", min: 0, max: 0.6, step: 0.01 },
  { key: "bob", label: "Root bob", min: 0, max: 0.18, step: 0.001 },
  { key: "lean", label: "Forward lean", min: -0.3, max: 0.45, step: 0.01 },
  { key: "breathing", label: "Breathing", min: 0, max: 0.08, step: 0.001 },
];

const HORSE_MOTION_FIELDS: readonly HorseNumericField[] = [
  { key: "speed", label: "Ground speed", min: 0, max: 8, step: 0.05 },
  { key: "strideScale", label: "Stride scale", min: 0.45, max: 1.8, step: 0.01 },
  { key: "stepHeight", label: "Hoof clearance", min: 0, max: 0.8, step: 0.01 },
  { key: "dutyFactorOffset", label: "Contact duty", min: -0.2, max: 0.2, step: 0.01 },
  { key: "diagonalDissociation", label: "Trot dissociation", min: -0.04, max: 0.04, step: 0.002 },
  { key: "hoofPlant", label: "Hoof planting", min: 0, max: 1, step: 0.01 },
  { key: "motionVariation", label: "Motion variation", min: 0, max: 0.3, step: 0.005 },
  { key: "secondaryMotion", label: "Follow-through", min: 0, max: 1.5, step: 0.01 },
  { key: "terrainResponse", label: "Terrain response", min: 0, max: 1, step: 0.01 },
  { key: "suspension", label: "Suspension", min: 0, max: 0.3, step: 0.005 },
  { key: "turnRate", label: "Turn rate", min: -2, max: 2, step: 0.01 },
  { key: "bodyPitch", label: "Barrel pitch", min: -0.35, max: 0.35, step: 0.01 },
  { key: "bodyRoll", label: "Barrel roll", min: -0.35, max: 0.35, step: 0.01 },
  { key: "neckMotion", label: "Neck motion", min: 0, max: 0.6, step: 0.01 },
  { key: "tailMotion", label: "Tail response", min: 0, max: 0.8, step: 0.01 },
  { key: "terrainAmplitude", label: "Terrain amplitude", min: 0, max: 0.8, step: 0.01 },
];

const HORSE_GAIT_PREVIEW_SPEEDS: Readonly<Record<ProceduralHorseGait, number>> = {
  idle: 0,
  walk: 1.35,
  trot: 2.6,
  canter: 3.8,
  gallop: 6.2,
};

const BODY_FIELDS: readonly NumericField[] = [
  { key: "gravity", label: "Gravity", min: -30, max: 0, step: 0.1 },
  { key: "collisionSteps", label: "Collision steps", min: 1, max: 4, step: 1 },
  { key: "massScale", label: "Mass scale", min: 0.25, max: 4, step: 0.05 },
  { key: "linearDamping", label: "Linear damping", min: 0, max: 2, step: 0.01 },
  { key: "angularDamping", label: "Angular damping", min: 0, max: 2, step: 0.01 },
  { key: "friction", label: "Friction", min: 0, max: 1, step: 0.01 },
  { key: "restitution", label: "Restitution", min: 0, max: 1, step: 0.01 },
];

const JOINT_FIELDS: readonly NumericField[] = [
  { key: "shoulderSwingDegrees", label: "Shoulder swing°", min: 5, max: 170, step: 1 },
  { key: "shoulderTwistDegrees", label: "Shoulder twist°", min: 0, max: 170, step: 1 },
  { key: "hipSwingDegrees", label: "Hip swing°", min: 5, max: 130, step: 1 },
  { key: "hipTwistDegrees", label: "Hip twist°", min: 0, max: 120, step: 1 },
  { key: "spineSwingDegrees", label: "Spine swing°", min: 0, max: 60, step: 1 },
  { key: "neckSwingDegrees", label: "Neck swing°", min: 0, max: 70, step: 1 },
  { key: "elbowMinDegrees", label: "Elbow minimum°", min: -15, max: 100, step: 1 },
  { key: "elbowMaxDegrees", label: "Elbow maximum°", min: -14, max: 170, step: 1 },
  { key: "kneeMinDegrees", label: "Knee minimum°", min: -10, max: 80, step: 1 },
  { key: "kneeMaxDegrees", label: "Knee maximum°", min: -9, max: 170, step: 1 },
];

const IMPACT_FIELDS: readonly NumericField[] = [
  { key: "impulseX", label: "Impulse X", min: -30, max: 30, step: 0.1 },
  { key: "impulseY", label: "Impulse Y", min: -10, max: 30, step: 0.1 },
  { key: "impulseZ", label: "Impulse Z", min: -30, max: 30, step: 0.1 },
];

const ARCHER_TIMING_FIELDS: readonly ArcherNumericField[] = [
  { key: "trackSeconds", label: "Track", min: 0.03, max: 0.8, step: 0.01 },
  { key: "nockSeconds", label: "Nock", min: 0.05, max: 0.8, step: 0.01 },
  { key: "raiseSeconds", label: "Raise", min: 0.05, max: 0.8, step: 0.01 },
  { key: "drawSeconds", label: "Draw", min: 0.1, max: 1.5, step: 0.01 },
  { key: "anchorSeconds", label: "Anchor", min: 0.03, max: 0.5, step: 0.01 },
  { key: "aimSeconds", label: "Aim hold", min: 0.05, max: 2, step: 0.01 },
  { key: "releaseSeconds", label: "Release", min: 0.02, max: 0.25, step: 0.005 },
  { key: "followThroughSeconds", label: "Follow-through", min: 0.08, max: 1, step: 0.01 },
  { key: "recoverSeconds", label: "Recover", min: 0.08, max: 1.5, step: 0.01 },
];

const ARCHER_POSE_FIELDS: readonly ArcherNumericField[] = [
  { key: "drawLength", label: "Draw length", min: 0.35, max: 1.1, step: 0.01 },
  { key: "bowArmExtension", label: "Bow arm extension", min: 0.5, max: 0.82, step: 0.01 },
  { key: "bowGripHeight", label: "Grip height", min: 0.05, max: 0.55, step: 0.01 },
  { key: "bowGripSide", label: "Grip side offset", min: 0.05, max: 0.45, step: 0.01 },
  { key: "bowHeight", label: "Bow height", min: 0.8, max: 2.4, step: 0.01 },
  { key: "bowBend", label: "Limb bend", min: 0, max: 0.35, step: 0.005 },
  { key: "bowCantDegrees", label: "Bow cant°", min: -30, max: 30, step: 1 },
  { key: "aimYawDegrees", label: "Aim yaw°", min: -50, max: 50, step: 1 },
  { key: "aimPitchDegrees", label: "Aim pitch°", min: -20, max: 45, step: 1 },
  { key: "aimDrift", label: "Organic aim drift", min: 0, max: 0.08, step: 0.001 },
];

const ARCHER_TARGET_FIELDS: readonly ArcherNumericField[] = [
  { key: "targetDistance", label: "Distance", min: 2, max: 12, step: 0.1 },
  { key: "targetHeight", label: "Height", min: 0.35, max: 3.5, step: 0.01 },
  { key: "targetRadius", label: "Hit radius", min: 0.08, max: 1.5, step: 0.01 },
  { key: "targetMovement", label: "Travel width", min: 0, max: 3, step: 0.05 },
  { key: "targetSpeed", label: "Travel speed", min: 0, max: 3, step: 0.05 },
];

const ARCHER_PROJECTILE_FIELDS: readonly ArcherNumericField[] = [
  { key: "projectileFlightSeconds", label: "Flight time", min: 0.2, max: 2, step: 0.01 },
  { key: "projectileGravity", label: "Gravity", min: -30, max: 0, step: 0.1 },
  { key: "projectileSweepRadius", label: "Sweep radius", min: 0.005, max: 0.25, step: 0.005 },
  { key: "projectileStickSeconds", label: "Stuck lifetime", min: 0.25, max: 15, step: 0.25 },
  { key: "projectileCapacity", label: "Pool capacity", min: 16, max: 1024, step: 16 },
  { key: "volleyCount", label: "Volley arrows", min: 1, max: 12, step: 1 },
  { key: "volleySpreadDegrees", label: "Spread°", min: 0, max: 8, step: 0.1 },
];

const MELEE_TIMING_FIELDS: readonly MeleeNumericField[] = [
  { key: "acquireSeconds", label: "Acquire", min: 0.02, max: 0.8, step: 0.01 },
  { key: "windupSeconds", label: "Windup", min: 0.08, max: 1.2, step: 0.01 },
  { key: "strikeSeconds", label: "Strike", min: 0.05, max: 0.6, step: 0.005 },
  { key: "contactSeconds", label: "Contact hold", min: 0.02, max: 0.25, step: 0.005 },
  { key: "followThroughSeconds", label: "Follow-through", min: 0.05, max: 1, step: 0.01 },
  { key: "recoverSeconds", label: "Recover", min: 0.05, max: 1.5, step: 0.01 },
];

const MELEE_POSE_FIELDS: readonly MeleeNumericField[] = [
  { key: "attackArcDegrees", label: "Attack arc°", min: 35, max: 220, step: 1 },
  { key: "reach", label: "Reach", min: 0.6, max: 3, step: 0.01 },
  { key: "torsoWeight", label: "Torso drive", min: 0, max: 1, step: 0.01 },
  { key: "stepThrough", label: "Step-through", min: 0, max: 0.6, step: 0.01 },
  { key: "impactStrength", label: "Impact response", min: 0, max: 20, step: 0.1 },
];

const MELEE_TARGET_FIELDS: readonly MeleeNumericField[] = [
  { key: "targetDistance", label: "Distance", min: 0.7, max: 3, step: 0.01 },
  { key: "targetHeight", label: "Height", min: 0.25, max: 2.6, step: 0.01 },
  { key: "targetMovement", label: "Travel width", min: 0, max: 1.5, step: 0.01 },
  { key: "targetSpeed", label: "Travel speed", min: 0, max: 3, step: 0.05 },
];

export const CharacterGymControls = (props: CharacterGymControlsProps) => (
  <aside className="order-2 max-h-[48vh] overflow-y-auto border-t border-white/10 bg-[#0b111b] lg:order-1 lg:max-h-none lg:border-t-0 lg:border-r">
    <div className="space-y-3 p-4">
      <div className="border border-violet-300/15 bg-violet-300/[0.045] p-3 text-xs leading-relaxed text-slate-300">
        Tune archers, melee knights, the procedural horse, or a mounted Paladin. Projectile releases, weapon contacts,
        swappable cosmetics, rider sockets, and the exact Jolt handoff share one production runtime.
      </div>
      <CollisionGymControls {...props} />
      <CharacterControls {...props} />
      {props.config.kind === "archer" && <ArcherControls {...props} />}
      {isMeleeKind(props.config.kind) && <MeleeControls {...props} />}
      {isMountedKind(props.config.kind) ? (
        <HorseMotionControls config={props.config.horse} onPatchConfig={props.onPatchConfig} />
      ) : (
        <MotionControls config={props.config.humanoid} onPatchConfig={props.onPatchConfig} />
      )}
      <BodyControls config={props.config.humanoid} onPatchConfig={props.onPatchConfig} />
      <NumericControlSection
        title="Joint limits"
        icon={<Swords />}
        fields={JOINT_FIELDS}
        config={props.config.humanoid}
        onPatchConfig={props.onPatchConfig}
      />
      <NumericControlSection
        title="Impact"
        icon={<Zap />}
        fields={IMPACT_FIELDS}
        config={props.config.humanoid}
        onPatchConfig={props.onPatchConfig}
      />
      <DebugControls {...props} />
      <Link
        to="/debug/procedural-character-benchmark"
        className="flex items-center justify-between border border-cyan-300/20 bg-cyan-300/[0.04] px-3 py-2 text-xs uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-300/[0.09] hover:text-white"
      >
        Crowd benchmark <ChevronRight className="h-4 w-4" />
      </Link>
      <Link
        to="/debug/three-chunks"
        className="flex items-center justify-between border border-white/10 bg-white/[0.025] px-3 py-2 text-xs uppercase tracking-wider text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
      >
        Three.js chunk lab <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  </aside>
);

const CollisionGymControls = ({ collisionConfig, onPatchCollisionConfig }: CharacterGymControlsProps) => (
  <ControlSection title="Collision bench" icon={<FlaskConical />} defaultOpen>
    <ToggleControl
      label="Multi-actor simulation"
      checked={collisionConfig.enabled}
      onChange={(enabled) => onPatchCollisionConfig({ enabled })}
    />
    {collisionConfig.enabled && (
      <>
        <SelectControl
          label="Scenario"
          value={collisionConfig.scenario}
          options={PROCEDURAL_COLLISION_GYM_SCENARIOS.map(({ id, label }) => ({ value: id, label }))}
          onChange={(scenario) => onPatchCollisionConfig({ scenario: scenario as ProceduralCollisionGymScenario })}
        />
        {(collisionConfig.scenario === "crossflow" || collisionConfig.scenario === "crowd") && (
          <RangeControl
            label="Actors"
            value={collisionConfig.actorCount}
            min={2}
            max={100}
            step={1}
            onChange={(actorCount) => onPatchCollisionConfig({ actorCount })}
          />
        )}
        <RangeControl
          label="Travel speed"
          value={collisionConfig.speed}
          min={0.1}
          max={4}
          step={0.05}
          onChange={(speed) => onPatchCollisionConfig({ speed })}
        />
        <NumberControl
          label="Scenario seed"
          value={collisionConfig.seed}
          min={0}
          max={2_147_483_647}
          step={1}
          onChange={(seed) => onPatchCollisionConfig({ seed })}
        />
        <ToggleControl
          label="Collider diagnostics"
          checked={collisionConfig.showDebug}
          onChange={(showDebug) => onPatchCollisionConfig({ showDebug })}
        />
      </>
    )}
  </ControlSection>
);

const MeleeControls = ({ config, onPatchConfig }: CharacterGymControlsProps) => (
  <>
    <ControlSection title="Melee loadout" icon={<Swords />} defaultOpen>
      <SelectControl
        label="Weapon cosmetic"
        value={config.melee.weaponId}
        options={PROCEDURAL_MELEE_WEAPONS.map(({ id, label }) => ({ value: id, label }))}
        onChange={(weaponId) => onPatchConfig({ melee: { weaponId: weaponId as ProceduralMeleeWeaponId } })}
      />
      <SelectControl
        label="Offhand cosmetic"
        value={config.melee.offhandId}
        options={PROCEDURAL_MELEE_OFFHANDS.map(({ id, label }) => ({ value: id, label }))}
        onChange={(offhandId) => onPatchConfig({ melee: { offhandId: offhandId as ProceduralMeleeOffhandId } })}
      />
      <ToggleControl
        label="Load cosmetic GLBs"
        checked={config.melee.detailedEquipment}
        onChange={(detailedEquipment) => onPatchConfig({ melee: { detailedEquipment } })}
      />
    </ControlSection>
    <ControlSection title="Melee attack cycle" icon={<Crosshair />} defaultOpen>
      <ToggleControl
        label="Auto attack"
        checked={config.melee.autoAttack}
        onChange={(autoAttack) => onPatchConfig({ melee: { autoAttack } })}
      />
      <MeleeRangeFieldList fields={MELEE_TIMING_FIELDS} config={config.melee} onPatchConfig={onPatchConfig} />
    </ControlSection>
    <ControlSection title="Weapon pose" icon={<Activity />} defaultOpen>
      <MeleeRangeFieldList fields={MELEE_POSE_FIELDS} config={config.melee} onPatchConfig={onPatchConfig} />
      <ToggleControl
        label="Contact arc"
        checked={config.melee.showArc}
        onChange={(showArc) => onPatchConfig({ melee: { showArc } })}
      />
      <ToggleControl
        label="Socket diagnostics"
        checked={config.melee.showSockets}
        onChange={(showSockets) => onPatchConfig({ melee: { showSockets } })}
      />
    </ControlSection>
    <ControlSection title="Melee target lane" icon={<Target />} defaultOpen>
      <MeleeRangeFieldList fields={MELEE_TARGET_FIELDS} config={config.melee} onPatchConfig={onPatchConfig} />
    </ControlSection>
  </>
);

const ArcherControls = ({ config, onPatchConfig }: CharacterGymControlsProps) => (
  <>
    <ControlSection title="Archer shot cycle" icon={<Crosshair />} defaultOpen>
      <ToggleControl
        label="Auto fire"
        checked={config.archer.autoFire}
        onChange={(autoFire) => onPatchConfig({ archer: { autoFire } })}
      />
      <ArcherRangeFieldList fields={ARCHER_TIMING_FIELDS} config={config.archer} onPatchConfig={onPatchConfig} />
    </ControlSection>
    <ControlSection title="Bow and aim" icon={<Swords />} defaultOpen>
      <ToggleControl
        label="Close-detail equipment"
        checked={config.archer.detailedEquipment}
        onChange={(detailedEquipment) => onPatchConfig({ archer: { detailedEquipment } })}
      />
      <ArcherRangeFieldList fields={ARCHER_POSE_FIELDS} config={config.archer} onPatchConfig={onPatchConfig} />
      <ToggleControl
        label="Socket diagnostics"
        checked={config.archer.showSockets}
        onChange={(showSockets) => onPatchConfig({ archer: { showSockets } })}
      />
    </ControlSection>
    <ControlSection title="Target lane" icon={<Target />} defaultOpen>
      <ArcherRangeFieldList fields={ARCHER_TARGET_FIELDS} config={config.archer} onPatchConfig={onPatchConfig} />
    </ControlSection>
    <ControlSection title="Projectile pool" icon={<Zap />} defaultOpen>
      <SelectControl
        label="Projectile fixed step"
        value={String(config.archer.projectileFixedStep)}
        options={[
          { value: String(1 / 30), label: "30 Hz" },
          { value: String(1 / 60), label: "60 Hz" },
          { value: String(1 / 120), label: "120 Hz" },
          { value: String(1 / 240), label: "240 Hz" },
        ]}
        onChange={(value) => onPatchConfig({ archer: { projectileFixedStep: Number(value) } })}
      />
      <ArcherRangeFieldList fields={ARCHER_PROJECTILE_FIELDS} config={config.archer} onPatchConfig={onPatchConfig} />
      <ToggleControl
        label="Trajectory guide"
        checked={config.archer.showTrajectory}
        onChange={(showTrajectory) => onPatchConfig({ archer: { showTrajectory } })}
      />
    </ControlSection>
  </>
);

const CharacterControls = ({ config, selectedPreset, onApplyPreset, onPatchConfig }: CharacterGymControlsProps) => (
  <ControlSection title="Character" icon={<Shield />} defaultOpen>
    <SelectControl
      label="Unit"
      value={config.kind}
      options={PROCEDURAL_UNIT_KINDS.map(({ id, label }) => ({ value: id, label }))}
      onChange={(kind) => onPatchConfig({ kind: kind as ProceduralUnitKind })}
    />
    <SelectControl
      label="Preset"
      value={selectedPreset}
      options={[
        ...PROCEDURAL_CHARACTER_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
        { value: "custom", label: "Custom", disabled: true },
      ]}
      onChange={(value) => onApplyPreset(value as ProceduralCharacterPresetId)}
    />
    <SegmentedControl
      label="Upgrade tier"
      value={String(config.humanoid.tier)}
      options={[
        { value: "1", label: "T1" },
        { value: "2", label: "T2" },
        { value: "3", label: "T3" },
      ]}
      onChange={(value) => {
        const tier = Number(value) as 1 | 2 | 3;
        onPatchConfig({ humanoid: { tier }, horse: { tier } });
      }}
    />
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <NumberControl
        label="Seed"
        value={config.humanoid.seed}
        min={0}
        max={2_147_483_647}
        step={1}
        onChange={(seed) => onPatchConfig({ humanoid: { seed } })}
      />
      <button
        type="button"
        onClick={() => onPatchConfig({ humanoid: { seed: Math.floor(Math.random() * 2_147_483_647) } })}
        className="mt-[1.35rem] grid h-9 w-9 place-items-center border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"
        aria-label="Randomize deterministic character seed"
      >
        <Dices className="h-4 w-4" />
      </button>
    </div>
    <ColorControl
      label="Heraldry"
      value={config.humanoid.primaryColor}
      onChange={(primaryColor) => onPatchConfig({ humanoid: { primaryColor }, horse: { primaryColor } })}
    />
    <RangeFieldList fields={APPEARANCE_FIELDS} config={config.humanoid} onPatchConfig={onPatchConfig} />
  </ControlSection>
);

const MotionControls = ({
  config,
  onPatchConfig,
}: {
  config: ProceduralCharacterConfig;
  onPatchConfig: CharacterGymControlsProps["onPatchConfig"];
}) => (
  <ControlSection title="Procedural motion" icon={<Activity />} defaultOpen>
    <SegmentedControl
      label="State"
      value={config.animationMode}
      options={[
        { value: "idle", label: "Idle" },
        { value: "walk", label: "Walk" },
        { value: "run", label: "Run" },
      ]}
      onChange={(animationMode) =>
        onPatchConfig({ humanoid: { animationMode: animationMode as ProceduralCharacterMotionMode } })
      }
    />
    <RangeFieldList fields={MOTION_FIELDS} config={config} onPatchConfig={onPatchConfig} />
  </ControlSection>
);

const HorseMotionControls = ({
  config,
  onPatchConfig,
}: {
  config: ProceduralHorseConfig;
  onPatchConfig: CharacterGymControlsProps["onPatchConfig"];
}) => (
  <ControlSection title="Horse gait and grounding" icon={<Activity />} defaultOpen>
    <SelectControl
      label="Gait"
      value={config.gait}
      options={[
        { value: "idle", label: "Idle" },
        { value: "walk", label: "Walk" },
        { value: "trot", label: "Trot" },
        { value: "canter", label: "Canter" },
        { value: "gallop", label: "Gallop" },
      ]}
      onChange={(value) => {
        const gait = value as ProceduralHorseGait;
        onPatchConfig({ horse: { gait, speed: HORSE_GAIT_PREVIEW_SPEEDS[gait] } });
      }}
    />
    <SelectControl
      label="Terrain"
      value={config.terrainPreset}
      options={[
        { value: "flat", label: "Flat stage" },
        { value: "slope", label: "Cross slope" },
        { value: "waves", label: "Rolling ground" },
        { value: "steps", label: "Hex steps" },
      ]}
      onChange={(terrainPreset) =>
        onPatchConfig({ horse: { terrainPreset: terrainPreset as ProceduralHorseTerrainPreset } })
      }
    />
    <SegmentedControl
      label="Canter / gallop lead"
      value={config.lead}
      options={[
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ]}
      onChange={(lead) => onPatchConfig({ horse: { lead: lead as ProceduralHorseLead } })}
    />
    <HorseRangeFieldList fields={HORSE_MOTION_FIELDS} config={config} onPatchConfig={onPatchConfig} />
  </ControlSection>
);

const BodyControls = ({
  config,
  onPatchConfig,
}: {
  config: ProceduralCharacterConfig;
  onPatchConfig: CharacterGymControlsProps["onPatchConfig"];
}) => (
  <ControlSection title="Jolt bodies" icon={<FlaskConical />}>
    <RangeFieldList fields={BODY_FIELDS.slice(0, 1)} config={config} onPatchConfig={onPatchConfig} />
    <SelectControl
      label="Fixed step"
      value={String(config.fixedStep)}
      options={[
        { value: String(1 / 30), label: "30 Hz" },
        { value: String(1 / 60), label: "60 Hz" },
        { value: String(1 / 90), label: "90 Hz" },
        { value: String(1 / 120), label: "120 Hz" },
      ]}
      onChange={(value) => onPatchConfig({ humanoid: { fixedStep: Number(value) } })}
    />
    <RangeFieldList fields={BODY_FIELDS.slice(1)} config={config} onPatchConfig={onPatchConfig} />
    <ToggleControl
      label="Self collision"
      checked={config.selfCollision}
      onChange={(selfCollision) => onPatchConfig({ humanoid: { selfCollision } })}
    />
  </ControlSection>
);

const NumericControlSection = ({
  title,
  icon,
  fields,
  config,
  onPatchConfig,
}: {
  config: ProceduralCharacterConfig;
  onPatchConfig: CharacterGymControlsProps["onPatchConfig"];
  title: string;
  icon: ReactNode;
  fields: readonly NumericField[];
}) => (
  <ControlSection title={title} icon={icon}>
    <RangeFieldList fields={fields} config={config} onPatchConfig={onPatchConfig} />
  </ControlSection>
);

const DebugControls = ({ config, copied, onCopyConfig, onPatchConfig, onResetCamera }: CharacterGymControlsProps) => (
  <ControlSection title="Debug view" icon={<Activity />}>
    <ToggleControl
      label="Joint markers"
      checked={config.humanoid.showJoints || config.horse.showBones}
      onChange={(visible) => onPatchConfig({ humanoid: { showJoints: visible }, horse: { showBones: visible } })}
    />
    {isMountedKind(config.kind) && (
      <>
        <ToggleControl
          label="Hoof targets"
          checked={config.horse.showHoofTargets}
          onChange={(showHoofTargets) => onPatchConfig({ horse: { showHoofTargets } })}
        />
        <ToggleControl
          label="Rider sockets"
          checked={config.horse.showSockets}
          onChange={(showSockets) => onPatchConfig({ horse: { showSockets } })}
        />
      </>
    )}
    <ToggleControl
      label="Wireframe"
      checked={config.humanoid.wireframe || config.horse.wireframe}
      onChange={(wireframe) => onPatchConfig({ humanoid: { wireframe }, horse: { wireframe } })}
    />
    <ToggleControl
      label="Auto rotate"
      checked={config.humanoid.autoRotate}
      onChange={(autoRotate) => onPatchConfig({ humanoid: { autoRotate } })}
    />
    <ControlButton icon={<RotateCcw />} label="Reset camera" onClick={onResetCamera} />
    <ControlButton
      icon={copied ? <Check className="text-emerald-300" /> : <Copy />}
      label={copied ? "Copied" : "Copy config JSON"}
      onClick={onCopyConfig}
    />
  </ControlSection>
);

const RangeFieldList = ({
  fields,
  config,
  onPatchConfig,
}: {
  fields: readonly NumericField[];
  config: ProceduralCharacterConfig;
  onPatchConfig: CharacterGymControlsProps["onPatchConfig"];
}) => (
  <>
    {fields.map((field) => (
      <RangeControl
        key={field.key}
        label={field.label}
        value={config[field.key]}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(value) => onPatchConfig({ humanoid: { [field.key]: value } as Partial<ProceduralCharacterConfig> })}
      />
    ))}
  </>
);

const HorseRangeFieldList = ({
  fields,
  config,
  onPatchConfig,
}: {
  fields: readonly HorseNumericField[];
  config: ProceduralHorseConfig;
  onPatchConfig: CharacterGymControlsProps["onPatchConfig"];
}) => (
  <>
    {fields.map((field) => (
      <RangeControl
        key={field.key}
        label={field.label}
        value={config[field.key]}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(value) => onPatchConfig({ horse: { [field.key]: value } as Partial<ProceduralHorseConfig> })}
      />
    ))}
  </>
);

const ArcherRangeFieldList = ({
  fields,
  config,
  onPatchConfig,
}: {
  fields: readonly ArcherNumericField[];
  config: ProceduralArcherConfig;
  onPatchConfig: CharacterGymControlsProps["onPatchConfig"];
}) => (
  <>
    {fields.map((field) => (
      <RangeControl
        key={field.key}
        label={field.label}
        value={config[field.key]}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(value) => onPatchConfig({ archer: { [field.key]: value } as Partial<ProceduralArcherConfig> })}
      />
    ))}
  </>
);

const MeleeRangeFieldList = ({
  fields,
  config,
  onPatchConfig,
}: {
  fields: readonly MeleeNumericField[];
  config: ProceduralMeleeConfig;
  onPatchConfig: CharacterGymControlsProps["onPatchConfig"];
}) => (
  <>
    {fields.map((field) => (
      <RangeControl
        key={field.key}
        label={field.label}
        value={config[field.key]}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(value) => onPatchConfig({ melee: { [field.key]: value } as Partial<ProceduralMeleeConfig> })}
      />
    ))}
  </>
);

const ControlSection = ({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) => (
  <details open={defaultOpen} className="group border border-white/10 bg-black/20">
    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/[0.035]">
      <span className="flex items-center gap-2 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-violet-300">
        {icon}
        {title}
      </span>
      <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
    </summary>
    <div className="space-y-3 border-t border-white/[0.07] p-3">{children}</div>
  </details>
);

interface NumericControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(value: number): void;
}

const RangeControl = ({ label, value, min, max, step, onChange }: NumericControlProps) => (
  <label className="block">
    <span className="mb-1.5 flex items-center justify-between gap-3 text-[0.68rem] font-medium uppercase tracking-wider text-slate-400">
      {label}
      <input
        type="number"
        value={formatControlValue(value, step)}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-7 w-20 border border-white/10 bg-[#080d15] px-2 text-right font-mono text-xs text-slate-200 outline-none focus:border-violet-300/60"
      />
    </span>
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-1.5 w-full cursor-pointer accent-violet-400"
    />
  </label>
);

const NumberControl = ({ label, value, min, max, step, onChange }: NumericControlProps) => (
  <label className="block">
    <span className="mb-1.5 block text-[0.68rem] font-medium uppercase tracking-wider text-slate-400">{label}</span>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-9 w-full border border-white/10 bg-[#080d15] px-2 font-mono text-xs text-slate-200 outline-none focus:border-violet-300/60"
    />
  </label>
);

const SelectControl = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
  onChange(value: string): void;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-[0.68rem] font-medium uppercase tracking-wider text-slate-400">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full border border-white/10 bg-[#080d15] px-2 text-xs text-slate-200 outline-none focus:border-violet-300/60"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const SegmentedControl = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange(value: string): void;
}) => (
  <fieldset>
    <legend className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-wider text-slate-400">{label}</legend>
    <div className="grid grid-flow-col auto-cols-fr gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "h-8 border text-xs font-semibold transition",
            value === option.value
              ? "border-violet-300/60 bg-violet-400/15 text-violet-100"
              : "border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.06] hover:text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  </fieldset>
);

const ColorControl = ({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) => (
  <label className="flex items-center justify-between gap-3">
    <span className="text-[0.68rem] font-medium uppercase tracking-wider text-slate-400">{label}</span>
    <span className="flex items-center gap-2">
      <span className="font-mono text-xs text-slate-400">{value}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-12 cursor-pointer border border-white/10 bg-transparent p-0.5"
      />
    </span>
  </label>
);

const ToggleControl = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange(value: boolean): void;
}) => (
  <label className="flex cursor-pointer items-center justify-between gap-3 py-0.5">
    <span className="text-[0.68rem] font-medium uppercase tracking-wider text-slate-400">{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 accent-violet-400"
    />
  </label>
);

const ControlButton = ({ icon, label, onClick }: { icon: ReactNode; label: string; onClick(): void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-9 w-full items-center justify-center gap-2 border border-white/10 bg-white/[0.035] text-xs font-semibold uppercase tracking-wider text-slate-300 transition hover:bg-white/[0.08] hover:text-white [&_svg]:h-3.5 [&_svg]:w-3.5"
  >
    {icon}
    {label}
  </button>
);

function formatControlValue(value: number, step: number): number {
  if (step >= 1) return Math.round(value);
  const precision = Math.max(0, Math.ceil(-Math.log10(step)));
  return Number(value.toFixed(precision));
}

function isMountedKind(kind: ProceduralUnitKind): boolean {
  return kind === "horse" || kind === "paladin";
}

function isMeleeKind(kind: ProceduralUnitKind): kind is "knight" | "paladin" {
  return kind === "knight" || kind === "paladin";
}
