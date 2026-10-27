import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudButton, HudNumberField, HudPanel, HudSelect } from "@/ui/design-system/kit/hud-elements";
import { StaminaManager } from "@bibliothecadao/eternum";
import { RELICS, TROOP_TIERS, TROOP_TYPES, formatExact } from "@bibliothecadao/types";

import type { GuardOption, WorkingArmy } from "./battle-lab.types";
import { RelicChip } from "../../utils/relic-chip";
import { TierChip } from "../../utils/tier-chip";

const MAX_TROOPS_PER_ARMY = 500_000;

/** The relics that change a fight (damage, damage taken, stamina), by type then level, as the relic picker listed them. */
const COMBAT_RELICS = RELICS.filter((relic) => ["Damage", "Damage Reduction", "Stamina"].includes(relic.type))
  .toSorted((a, b) => (a.type === b.type ? a.level - b.level : a.type.localeCompare(b.type)))
  .map((relic) => relic.id);

const TYPES = TROOP_TYPES.map((type) => ({ value: type, label: type }));

const TIERS = TROOP_TIERS.map((tier) => ({ value: tier, label: tier }));

interface ArmyColumnProps {
  label: string;
  side: "attacker" | "defender";
  army: WorkingArmy;
  onChange: (patch: Partial<WorkingArmy>) => void;
  /** Structure-attacker guard slots (live mode). */
  guards?: GuardOption[];
  selectedGuardSlot?: number | null;
  onSelectGuard?: (slot: number) => void;
  /** Per-side post-fight readout rendered at the bottom of the card. */
  footer?: React.ReactNode;
}

/** A setting's name and its hint over its control; each control names itself, so this is a group, not a label. */
const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="flex items-center gap-1.5 text-hud-label text-hud-muted">
      {label}
      {hint && <span className="text-hud-label text-hud-cue">{hint}</span>}
    </span>
    {children}
  </div>
);

export const ArmyColumn = ({
  label,
  side,
  army,
  onChange,
  guards,
  selectedGuardSlot,
  onSelectGuard,
  footer,
}: ArmyColumnProps) => {
  const accent = side === "attacker" ? "bg-hud-enemy" : "bg-hud-ally";
  // The army's own maximum where the chain gives it, else what its type and tier allow.
  const maxStamina = StaminaManager.getMaxStamina(army.troopType, army.tier, army.maxStamina);

  return (
    <HudPanel
      title={
        <span className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", accent)} />
          {label}
        </span>
      }
      cue={<TierChip tier={String(army.tier)} />}
      collapsible={false}
    >
      <div className="flex flex-col gap-3">
        {guards && guards.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {guards.map((guard) => {
              const active = guard.slot === selectedGuardSlot;
              return (
                <HudButton
                  key={guard.slot}
                  kind="secondary"
                  size="sm"
                  onClick={() => onSelectGuard?.(guard.slot)}
                  aria-pressed={active}
                >
                  {guard.label} · {formatExact(guard.army.troopCount)}
                </HudButton>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Stamina" hint={`${army.stamina}/${maxStamina}`}>
            <HudNumberField
              label="Stamina"
              value={army.stamina}
              onChange={(stamina) => onChange({ stamina })}
              min={0}
              max={maxStamina}
              step={1}
            />
          </Field>
          <Field label="Troops" hint={formatExact(army.troopCount)}>
            <HudNumberField
              label="Troops"
              value={army.troopCount}
              onChange={(troopCount) => onChange({ troopCount })}
              min={1}
              max={MAX_TROOPS_PER_ARMY}
              step={100}
            />
          </Field>
          <Field label="Type">
            <HudSelect
              label="Troop type"
              value={army.troopType}
              options={TYPES}
              onChange={(troopType) => onChange({ troopType })}
            />
          </Field>
          <Field label="Tier">
            <HudSelect label="Tier" value={army.tier} options={TIERS} onChange={(tier) => onChange({ tier })} />
          </Field>
        </div>

        <Field label="Active Relics" hint={army.relics.length > 0 ? `${army.relics.length} on` : undefined}>
          <div role="group" aria-label="Active Relics" className="flex flex-wrap gap-1.5">
            {COMBAT_RELICS.map((relic) => {
              const chosen = army.relics.includes(relic);
              return (
                <RelicChip
                  key={relic}
                  relic={relic}
                  chosen={chosen}
                  onPress={() =>
                    onChange({
                      relics: chosen ? army.relics.filter((each) => each !== relic) : [...army.relics, relic],
                    })
                  }
                />
              );
            })}
          </div>
        </Field>

        {footer}
      </div>
    </HudPanel>
  );
};
