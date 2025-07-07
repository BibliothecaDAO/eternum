import { formatNumberWithCommas } from "@/utils/formatting";
import { icon, stats, troop } from "./styles";

export default function BlitzTroopsLimitTable() {
  return (
    <div style={troop.limitsCard}>
      <div style={troop.header}>
        <span style={icon.wrapper}>🔣</span> Troop Limits
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
        <div>
          <div style={stats.label}>Max Field Troops Per Structure:</div>
          <div style={stats.value}>10</div>
        </div>
        <div>
          <div style={stats.label}>Max Troop Count Per Army:</div>
          <div style={stats.value}>{formatNumberWithCommas(100000)}</div>
        </div>
        <div>
          <div style={stats.label}>Guard Resurrection:</div>
          <div style={stats.value}>15 minutes</div>
        </div>
      </div>
    </div>
  );
} 