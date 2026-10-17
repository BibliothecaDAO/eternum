import { useAutomationStore, type RealmEntityType } from "@/hooks/store/use-automation-store";
import { automationRefusal, presetLine } from "./automation-words";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { inferRealmPreset, REALM_PRESETS, type RealmPresetId } from "@bibliothecadao/eternum/automation";

export function AutomationPresetSwitch({ entityId, entityType }: { entityId: number; entityType: RealmEntityType }) {
  const realmId = String(entityId);
  const automation = useAutomationStore((state) => state.realms[realmId]);
  const hydrated = useAutomationStore((state) => state.hydrated);
  const ordersAllowed = useUIStore(canIssueOrders);
  const refusal = automationRefusal(ordersAllowed, hydrated);
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
      {REALM_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          aria-pressed={inferRealmPreset(automation) === preset.id}
          data-tip={refusal ?? presetLine(preset.id)}
          disabled={refusal !== null}
          onClick={() => selectPreset(preset.id)}
          className="px-1.5 py-1 text-[10px] normal-case tracking-normal aria-pressed:bg-gold/20 disabled:opacity-50"
        >
          {preset.label}
        </button>
      ))}
    </span>
  );
}
