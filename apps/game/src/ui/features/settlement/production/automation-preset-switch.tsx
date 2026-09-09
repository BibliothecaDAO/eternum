import { useAutomationStore, type RealmEntityType } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { inferRealmPreset, type RealmPresetId } from "@/utils/automation-presets";

const PRESETS = [
  { id: "smart", label: "Smart" },
  { id: "idle", label: "Idle" },
  { id: "custom", label: "Custom" },
] as const;

export function AutomationPresetSwitch({ entityId, entityType }: { entityId: number; entityType: RealmEntityType }) {
  const realmId = String(entityId);
  const automation = useAutomationStore((state) => state.realms[realmId]);
  const hydrated = useAutomationStore((state) => state.hydrated);
  const ordersAllowed = useUIStore(canIssueOrders);
  const selectPreset = (presetId: RealmPresetId) => {
    if (!canIssueOrders() || !hydrated) return;
    const store = useAutomationStore.getState();
    store.upsertRealm(realmId, { entityType, presetId });
    store.setRealmPreset(realmId, presetId);
  };
  return (
    <span
      role="group"
      aria-label="Production automation"
      className="inline-flex rounded border border-gold/30"
      onKeyDown={(event) => event.stopPropagation()}
    >
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          aria-pressed={inferRealmPreset(automation) === preset.id}
          disabled={!ordersAllowed || !hydrated}
          onClick={() => selectPreset(preset.id)}
          className="px-1.5 py-1 text-[10px] normal-case tracking-normal aria-pressed:bg-gold/20 disabled:opacity-50"
        >
          {preset.label}
        </button>
      ))}
    </span>
  );
}
