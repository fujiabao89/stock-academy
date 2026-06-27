/** 回测结果展示 — 胜率、收益分布、牛熊拆分、随机基线 */

interface WindowData {
  win_rate: number | null;
  avg_return: number | null;
  max_return?: number;
  max_loss?: number;
  occurrences: number;
  regime_splits?: {
    bull: { win_rate: number | null; avg_return: number | null; occurrences: number };
    bear: { win_rate: number | null; avg_return: number | null; occurrences: number };
    shock: { win_rate: number | null; avg_return: number | null; occurrences: number };
  };
  random_baseline?: {
    win_rate: number | null;
    avg_return: number | null;
    occurrences: number;
  };
}

interface BacktestResultData {
  conditions: Array<Record<string, unknown>>;
  total_matched: number;
  stocks_checked: number;
  windows: Record<string, WindowData>;
}

interface Props {
  result: BacktestResultData;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

function WinRateBadge({ rate }: { rate: number | null }) {
  if (rate == null) return <span style={{ color: "var(--color-text-secondary)" }}>—</span>;
  const ok = rate >= 0.55;
  return (
    <span style={{ color: ok ? "var(--color-bullish)" : "var(--color-bearish)", fontWeight: 700 }}>
      {fmtPct(rate)}
    </span>
  );
}

function RegimeRow({ label, data }: { label: string; data: { win_rate: number | null; avg_return: number | null; occurrences: number } }) {
  if (!data || data.occurrences === 0) return null;
  return (
    <tr>
      <td style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</td>
      <td style={{ fontSize: 13 }}><WinRateBadge rate={data.win_rate} /></td>
      <td style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{fmtPct(data.avg_return)}</td>
      <td style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{data.occurrences}</td>
    </tr>
  );
}

export default function BacktestResult({ result }: Props) {
  const window20 = result.windows["forward_20d"];
  const window10 = result.windows["forward_10d"];
  const window5 = result.windows["forward_5d"];

  return (
    <div style={{ marginTop: "var(--space-4)" }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 var(--space-3) 0" }}>
        回测结果（全市场 {result.stocks_checked} 只股票，最近 3 年）
      </h3>

      {/* 胜率卡片 */}
      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        {[
          { label: "5日胜率", data: window5 },
          { label: "10日胜率", data: window10 },
          { label: "20日胜率", data: window20 },
        ].map(({ label, data }) => (
          <div
            key={label}
            style={{
              flex: "1 1 120px", minWidth: 140,
              padding: "var(--space-3)",
              border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
              background: "var(--color-surface)", textAlign: "center",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              <WinRateBadge rate={data?.win_rate ?? null} />
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              均收益 {fmtPct(data?.avg_return)} · n={data?.occurrences ?? 0}
            </div>
          </div>
        ))}
      </div>

      {/* 总匹配 */}
      <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "var(--space-4)" }}>
        历史匹配次数：{result.total_matched} 次
      </div>

      {/* 20日详细拆分 */}
      {window20 && window20.occurrences > 0 && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 var(--space-2) 0" }}>20日前瞻窗口 — 市场环境拆分</h4>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th style={thStyle}>环境</th>
                <th style={thStyle}>胜率</th>
                <th style={thStyle}>均收益</th>
                <th style={thStyle}>次数</th>
              </tr>
            </thead>
            <tbody>
              {window20.regime_splits && (
                <>
                  <RegimeRow label="牛市" data={window20.regime_splits.bull} />
                  <RegimeRow label="震荡" data={window20.regime_splits.shock} />
                  <RegimeRow label="熊市" data={window20.regime_splits.bear} />
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 随机基线对比 */}
      {window20?.random_baseline && window20.random_baseline.occurrences > 0 && (
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>
          随机入场基线（20日）：胜率{" "}
          <span style={{ fontWeight: 600 }}>{fmtPct(window20.random_baseline.win_rate)}</span>
          {" · "}均收益 {fmtPct(window20.random_baseline.avg_return)}
          {" · "}n={window20.random_baseline.occurrences}
        </div>
      )}

      {/* 极值 */}
      {window20 && window20.occurrences > 0 && (
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
          20日最佳：{fmtPct(window20.max_return)} · 最差：{fmtPct(window20.max_loss)}
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--color-text-secondary)",
};
