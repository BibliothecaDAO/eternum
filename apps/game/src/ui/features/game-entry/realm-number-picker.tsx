import { REALM_NUMBER, INVALID_REALM_NUMBER } from "@/ui/design-system/kit/words";
import { orders } from "@bibliothecadao/types";
import { canonicalRealm } from "@bibliothecadao/eternum";
import { HudField } from "@/ui/design-system/kit/hud-elements";

/** A Realm number from 1 to 8,000, typed. */
export const isRealmNumber = (value: string) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 8000;

function RealmNumberField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <HudField
      aria-label={REALM_NUMBER}
      id="realm-number"
      type="number"
      min={1}
      max={8000}
      step={1}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

/** A development game's settle step: any Realm by number, its name, Order and resources under it. */
export function RealmNumberPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const realm = isRealmNumber(value) ? canonicalRealm(Number(value)) : null;
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-hud-line p-3">
      <span className="text-hud-label text-hud-muted">{REALM_NUMBER}</span>
      <RealmNumberField value={value} onChange={onChange} disabled={disabled} />
      <div aria-live="polite" className="text-hud-body text-hud-ink">
        {!isRealmNumber(value) ? (
          <p>{INVALID_REALM_NUMBER}</p>
        ) : realm ? (
          <>
            <p className="text-hud-strong">{realm.name}</p>
            <p className="text-hud-muted">
              {orders.find((order) => order.orderId === realm.order)?.fullOrderName} · {realm.resources.join(", ")}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
