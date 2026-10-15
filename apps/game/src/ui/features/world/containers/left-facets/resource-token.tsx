import "./resource-token.css";
import { useState } from "react";
import { ProductionStatusBadge } from "@/ui/shared/components/production-status-badge";

export function ResourceToken({
  label,
  amount,
  detail,
  producing,
  seconds,
  buildings,
  accrualTime = 0,
}: {
  label: string;
  amount: string;
  detail: string;
  producing: boolean;
  seconds: number | null;
  buildings?: string;
  accrualTime?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [accrual, setAccrual] = useState({ amount, at: accrualTime, key: 0 });
  if (amount !== accrual.amount) {
    const sweep = accrualTime - accrual.at >= 60_000;
    setAccrual({ amount, at: sweep ? accrualTime : accrual.at, key: accrual.key + Number(sweep) });
  }
  return (
    <button
      type="button"
      data-notice
      className="resource-item resource-token"
      aria-label={`${label} production`}
      title={detail}
      aria-expanded={expanded}
      onClick={() => setExpanded((value) => !value)}
    >
      <ProductionStatusBadge
        resourceLabel={label}
        tooltipText={detail}
        isProducing={producing}
        timeRemainingSeconds={seconds}
        cornerTopLeft={buildings}
        size="xs"
        accrualKey={accrual.key}
        showTooltip
      />
      <span>
        <b>{label.replace(/T([23])$/, " T$1")}</b>
        <strong>{amount}</strong>
      </span>
      {expanded && (
        <span role="status" className="resource-detail">
          {detail}
        </span>
      )}
    </button>
  );
}
