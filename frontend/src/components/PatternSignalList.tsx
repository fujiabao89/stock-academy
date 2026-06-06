import type { PatternSignal } from "../pages/StockDetail";
import PatternCard from "./PatternCard";

export default function PatternSignalList({ signals }: { signals: PatternSignal[] }) {
  if (signals.length === 0) {
    return (
      <div style={{
        textAlign: "center",
        padding: "var(--space-10)",
        color: "var(--color-text-secondary)",
        fontSize: 14,
        fontFamily: "Inter, var(--font-sans)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
      }}>
        该股票当前未触发任何形态信号
      </div>
    );
  }

  const bullish = signals.filter((s) => s.direction === "bullish");
  const bearish = signals.filter((s) => s.direction === "bearish");

  return (
    <div>
      <div style={{ display: "flex", gap: "var(--space-5)", marginBottom: "var(--space-4)" }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "Inter, var(--font-sans)",
          color: "var(--color-bullish)",
          padding: "4px 12px",
          background: "var(--color-bullish-bg)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-bullish)",
        }}>
          看涨信号 {bullish.length}
        </div>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "Inter, var(--font-sans)",
          color: "var(--color-bearish)",
          padding: "4px 12px",
          background: "var(--color-bearish-bg)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-bearish)",
        }}>
          看跌信号 {bearish.length}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {signals.map((s) => (
          <PatternCard key={`${s.date}-${s.pattern_id}`} signal={s} />
        ))}
      </div>
    </div>
  );
}
