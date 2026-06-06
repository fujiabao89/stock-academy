interface OverviewData {
  name: string;
  latest_price: number;
  change_pct: number;
  volume: number;
  update_time: string;
}

export default function StockOverview({ data }: { data: OverviewData | null }) {
  if (!data) return null;

  const isUp = data.change_pct >= 0;
  const volStr = data.volume > 1e6
    ? `${(data.volume / 1e6).toFixed(1)}M`
    : `${(data.volume / 1e4).toFixed(1)}万`;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "var(--space-3)",
    }}>
      <Card label="最新价" value={data.latest_price.toFixed(2)} />
      <Card
        label="涨跌幅"
        value={`${isUp ? "+" : ""}${data.change_pct}%`}
        color={isUp ? "var(--color-bullish)" : "var(--color-bearish)"}
      />
      <Card label="成交量" value={volStr} />
      <Card label="更新日期" value={data.update_time} />
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-md)",
      padding: "var(--space-4)",
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "Inter, var(--font-sans)",
        color: "var(--color-muted)",
        marginBottom: "var(--space-1)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 22,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        color: color ?? "var(--color-text)",
      }}>
        {value}
      </div>
    </div>
  );
}
