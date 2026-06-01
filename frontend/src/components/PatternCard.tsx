import type { PatternSignal } from "../pages/StockDetail";

export default function PatternCard({ signal }: { signal: PatternSignal }) {
  const isBullish = signal.direction === "bullish";
  const winRate = signal.backtest?.win_rate;

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-5)",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: isBullish ? "var(--color-bullish)" : "var(--color-bearish)",
            }}
          />
          <span style={{ fontWeight: 600, fontSize: 16 }}>{signal.pattern_name}</span>
          <span
            style={{
              fontSize: 12,
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              background: isBullish ? "var(--color-bullish-bg)" : "var(--color-bearish-bg)",
              color: isBullish ? "var(--color-bullish)" : "var(--color-bearish)",
            }}
          >
            {isBullish ? "看涨" : "看跌"}
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-secondary)",
            background: "var(--color-accent-bg)",
            padding: "2px 8px",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {signal.category}
        </span>
      </div>

      {/* Description */}
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.7, marginBottom: "var(--space-4)" }}>
        {signal.description}
      </p>

      {/* Win Rate */}
      {winRate != null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            marginBottom: "var(--space-3)",
            padding: "var(--space-3)",
            background: "var(--color-primary-bg)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>20日胜率</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: "var(--color-primary)", fontVariantNumeric: "tabular-nums" }}>
            {(winRate * 100).toFixed(1)}%
          </span>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
            ({signal.backtest?.occurrences ?? 0} 次历史样本)
          </span>
        </div>
      )}

      {/* Limitations */}
      {signal.limitations.length > 0 && (
        <div style={{ fontSize: 12 }}>
          <span style={{ color: "var(--color-muted)" }}>局限：</span>
          {signal.limitations.map((l, i) => (
            <span key={i} style={{ color: "var(--color-text-secondary)" }}>
              {l}{i < signal.limitations.length - 1 ? "；" : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
