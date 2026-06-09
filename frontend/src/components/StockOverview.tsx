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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "var(--space-2)",
      }}
    >
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
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: "4px 10px",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color ?? "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}
