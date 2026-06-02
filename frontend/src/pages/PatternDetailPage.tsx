import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import PatternCard from "../components/PatternCard";
import KlineChart from "../components/KlineChart";
import type { PatternSignal } from "./StockDetail";

interface KlineItem {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma5: number | null;
  ma20: number | null;
  ma60: number | null;
  ma120: number | null;
}

interface BacktestWindow {
  win_rate: number | null;
  avg_return: number | null;
  occurrences: number;
}

interface PatternDetail {
  pattern_id: string;
  pattern_name: string;
  category: string;
  direction: string;
  description: string;
  determination: string;
  backtest: {
    forward_5d: BacktestWindow;
    forward_10d: BacktestWindow;
    forward_20d: BacktestWindow;
    sample_period: string;
    max_return: number | null;
    max_loss: number | null;
  };
  limitations: string[];
  related_patterns: string[];
}

interface PatternSummary {
  pattern_id: string;
  pattern_name: string;
  category: string;
  direction: string;
}

const WINDOW_LABELS: Record<string, string> = {
  forward_5d: "5 日",
  forward_10d: "10 日",
  forward_20d: "20 日",
};

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "-";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
}

function fmtWinRate(v: number | null | undefined): string {
  if (v == null) return "-";
  return `${(v * 100).toFixed(1)}%`;
}

export default function PatternDetailPage() {
  const { patternId } = useParams<{ patternId: string }>();
  const [detail, setDetail] = useState<PatternDetail | null>(null);
  const [stocks, setStocks] = useState<PatternSignal[]>([]);
  const [patternNames, setPatternNames] = useState<Map<string, string>>(new Map());
  const [exampleCode, setExampleCode] = useState<string | null>(null);
  const [exampleKline, setExampleKline] = useState<KlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patternId) return;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      fetch("/api/patterns").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/patterns/${patternId}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch(`/api/patterns/${patternId}/stocks`).then((r) => (r.ok ? r.json() : [])),
    ]).then(async ([all, detailRes, stocksRes]) => {
      if (detailRes.status === "rejected") {
        setError(detailRes.reason?.message ?? "加载失败");
        return;
      }
      setDetail(detailRes.value);
      if (all.status === "fulfilled" && Array.isArray(all.value)) {
        const map = new Map<string, string>();
        for (const p of all.value as PatternSummary[]) {
          map.set(p.pattern_id, p.pattern_name);
        }
        setPatternNames(map);
      }
      const stockList: PatternSignal[] = stocksRes.status === "fulfilled" && Array.isArray(stocksRes.value) ? stocksRes.value : [];
      setStocks(stockList);

      if (stockList.length > 0) {
        const code = stockList[0].code;
        setExampleCode(code);
        try {
          const kl = await fetch(`/api/stocks/${code}/kline?period=d&limit=120`).then((r) => (r.ok ? r.json() : []));
          setExampleKline(Array.isArray(kl) ? kl : []);
        } catch {
          setExampleKline([]);
        }
      }
    }).catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [patternId]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-12)", color: "var(--color-text-secondary)" }}>
        加载中...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-12)" }}>
        <p style={{ color: "var(--color-bearish)", marginBottom: "var(--space-4)" }}>{error ?? "形态不存在"}</p>
        <Link to="/learn" style={{ color: "var(--color-primary)", fontSize: 14 }}>← 返回学堂</Link>
      </div>
    );
  }

  const isBullish = detail.direction === "bullish";

  const directionLabel = isBullish ? "看涨" : "看跌";
  const directionColor = isBullish ? "var(--color-bullish)" : "var(--color-bearish)";
  const directionBg = isBullish ? "var(--color-bullish-bg)" : "var(--color-bearish-bg)";

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "var(--space-5)", fontSize: 14, color: "var(--color-text-secondary)" }}>
        <Link to="/" style={{ color: "var(--color-text-secondary)", display: "inline-flex", alignItems: "center", minHeight: 44 }}>
          首页
        </Link>
        <span style={{ margin: "0 var(--space-2)" }}>/</span>
        <Link to="/learn" style={{ color: "var(--color-text-secondary)", display: "inline-flex", alignItems: "center", minHeight: 44 }}>
          学堂
        </Link>
        <span style={{ margin: "0 var(--space-2)" }}>/</span>
        <span style={{ color: "var(--color-text)" }}>{detail.pattern_name}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
          <h1 style={{ fontSize: "clamp(20px, 3vw, 24px)", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
            {detail.pattern_name}
          </h1>
          <span style={{
            fontSize: 12, fontWeight: 500, color: directionColor, background: directionBg,
            padding: "3px 10px", borderRadius: "var(--radius-sm)",
          }}>
            {directionLabel}
          </span>
          <span style={{
            fontSize: 12, color: "var(--color-text-secondary)", background: "var(--color-accent-bg)",
            padding: "3px 10px", borderRadius: "var(--radius-sm)",
          }}>
            {detail.category}
          </span>
        </div>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)", lineHeight: 1.7, margin: 0, maxWidth: 720 }}>
          {detail.description}
        </p>
      </div>

      {/* 判定逻辑 */}
      <section style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)", margin: "0 0 var(--space-3) 0" }}>
          判定逻辑
        </h2>
        <div style={{
          padding: "var(--space-5)", background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)", fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.8,
        }}>
          {detail.determination}
        </div>
      </section>

      {/* 形态示例 K 线图 */}
      {exampleKline.length > 0 && (
        <section style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)", margin: "0 0 var(--space-3) 0" }}>
            形态示例
            {exampleCode && (
              <Link
                to={`/stock/${exampleCode}`}
                style={{
                  fontSize: 13, fontWeight: 400, color: "var(--color-primary)", marginLeft: "var(--space-2)",
                  display: "inline-flex", alignItems: "center", minHeight: 32,
                }}
              >
                ({exampleCode} K线图 →)
              </Link>
            )}
          </h2>
          <KlineChart
            data={exampleKline}
            signals={stocks.filter((s) => s.code === exampleCode)}
          />
        </section>
      )}

      {/* 历史回测 */}
      <section style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)", margin: "0 0 var(--space-3) 0" }}>
          历史回测
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-muted)", marginLeft: "var(--space-2)" }}>
            ({detail.backtest.sample_period})
          </span>
        </h2>
        <div style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)", overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 500, color: "var(--color-muted)", fontSize: 13 }}>
                  前瞻窗口
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 500, color: "var(--color-muted)", fontSize: 13 }}>
                  胜率
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 500, color: "var(--color-muted)", fontSize: 13 }}>
                  平均收益
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 500, color: "var(--color-muted)", fontSize: 13 }}>
                  样本数
                </th>
              </tr>
            </thead>
            <tbody>
              {(["forward_5d", "forward_10d", "forward_20d"] as const).map((key) => {
                const w = detail.backtest[key];
                return (
                  <tr key={key} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "12px 16px", color: "var(--color-text)", fontWeight: 500 }}>
                      {WINDOW_LABELS[key]}
                    </td>
                    <td style={{
                      padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums",
                      color: w.win_rate != null ? "var(--color-text)" : "var(--color-muted)", fontWeight: 500,
                    }}>
                      {fmtWinRate(w.win_rate)}
                    </td>
                    <td style={{
                      padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums",
                      color: w.avg_return != null ? (w.avg_return >= 0 ? "var(--color-bullish)" : "var(--color-bearish)") : "var(--color-muted)",
                    }}>
                      {fmtPct(w.avg_return)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--color-text-secondary)" }}>
                      {w.occurrences > 0 ? w.occurrences.toLocaleString() : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(detail.backtest.max_return != null || detail.backtest.max_loss != null) && (
            <div style={{
              padding: "10px 16px", fontSize: 12, color: "var(--color-text-secondary)",
              borderTop: "1px solid var(--color-border)", display: "flex", gap: "var(--space-5)",
            }}>
              {detail.backtest.max_return != null && (
                <span>最大盈利 <span style={{ color: "var(--color-bullish)", fontWeight: 500 }}>{fmtPct(detail.backtest.max_return)}</span></span>
              )}
              {detail.backtest.max_loss != null && (
                <span>最大亏损 <span style={{ color: "var(--color-bearish)", fontWeight: 500 }}>{fmtPct(detail.backtest.max_loss)}</span></span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 局限性 */}
      {detail.limitations.length > 0 && (
        <section style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)", margin: "0 0 var(--space-3) 0" }}>
            局限性
          </h2>
          <div style={{
            padding: "var(--space-5)", background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
          }}>
            <ul style={{ margin: 0, paddingLeft: "var(--space-5)" }}>
              {detail.limitations.map((l, i) => (
                <li key={i} style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.7, marginBottom: i < detail.limitations.length - 1 ? 4 : 0 }}>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 关联形态 */}
      {detail.related_patterns.length > 0 && (
        <section style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)", margin: "0 0 var(--space-3) 0" }}>
            关联形态
          </h2>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            {detail.related_patterns.map((pid) => (
              <Link
                key={pid}
                to={`/learn/patterns/${pid}`}
                style={{
                  fontSize: 14, color: "var(--color-primary)", padding: "8px 16px",
                  background: "var(--color-surface)", border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)", display: "inline-flex", alignItems: "center",
                  minHeight: 44, transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
              >
                {patternNames.get(pid) ?? pid}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 触发该形态的股票 */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)", margin: "0 0 var(--space-3) 0" }}>
          最新触发该形态的股票
          <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-muted)", marginLeft: "var(--space-2)" }}>
            ({stocks.length} 只)
          </span>
        </h2>
        {stocks.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "var(--space-8)", color: "var(--color-text-secondary)",
            fontSize: 14, background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
          }}>
            当前没有股票触发该形态
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {stocks.map((s) => (
              <div key={s.code}>
                <PatternCard signal={s} />
                <Link
                  to={`/stock/${s.code}`}
                  style={{
                    fontSize: 12, color: "var(--color-primary)", padding: "6px 12px",
                    marginTop: "var(--space-2)",
                    background: "var(--color-surface)", border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)", display: "inline-flex", alignItems: "center",
                    minHeight: 32, transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
                >
                  查看K线 →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
