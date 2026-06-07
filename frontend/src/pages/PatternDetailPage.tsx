import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import PatternCard from "../components/PatternCard";
import KlineChart from "../components/KlineChart";
import ConfidenceBadge from "../components/ConfidenceBadge";
import DistributionBar from "../components/DistributionBar";
import Skeleton, { SkeletonCard, SkeletonTable } from "../components/Skeleton";
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

interface DistributionBin {
  bin_start: number;
  bin_end: number;
  count: number;
}

interface RegimeSplit {
  regime: string;
  label: string;
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
    distribution: DistributionBin[] | null;
    regime_splits: RegimeSplit[] | null;
    confidence_grade: string | null;
    random_baseline: {
      win_rate: number | null;
      avg_return: number | null;
      occurrences: number;
    } | null;
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

const sectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "var(--color-text)",
  margin: "0 0 var(--space-3) 0",
  fontFamily: "Inter, var(--font-sans)",
};

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
    let cancelled = false;
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
      if (cancelled) return;
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
          if (!cancelled) setExampleKline(Array.isArray(kl) ? kl : []);
        } catch {
          if (!cancelled) setExampleKline([]);
        }
      }
    }).catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [patternId]);

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <Skeleton width={48} height={13} />
          <Skeleton width={12} height={13} />
          <Skeleton width={100} height={13} />
        </div>
        <Skeleton width="60%" height={28} />
        <SkeletonCard lines={3} />
        <Skeleton width="100%" height={280} radius="var(--radius-md)" />
        <SkeletonTable rows={3} cols={3} />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-12)" }}>
        <p style={{ color: "var(--color-destructive)", marginBottom: "var(--space-4)", fontFamily: "Inter, var(--font-sans)", fontSize: 14 }}>
          {error ?? "形态不存在"}
        </p>
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
      <div style={{
        marginBottom: "var(--space-6)",
        fontSize: 13,
        color: "var(--color-text-secondary)",
        fontFamily: "Inter, var(--font-sans)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
      }}>
        <Link to="/" style={{ color: "var(--color-muted)", textDecoration: "none" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-muted)")}>
          首页
        </Link>
        <span style={{ color: "var(--color-border)" }}>/</span>
        <Link to="/learn" style={{ color: "var(--color-muted)", textDecoration: "none" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-muted)")}>
          学堂
        </Link>
        <span style={{ color: "var(--color-border)" }}>/</span>
        <span style={{ color: "var(--color-text)", fontWeight: 500 }}>{detail.pattern_name}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "var(--space-8)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
          <h1 style={{
            fontSize: "clamp(22px, 3vw, 32px)",
            fontWeight: 700,
            color: "var(--color-text)",
            margin: 0,
            fontFamily: "Inter, var(--font-sans)",
            letterSpacing: "-0.01em",
          }}>
            {detail.pattern_name}
          </h1>
          <span style={{
            fontSize: 12, fontWeight: 600, color: directionColor, background: directionBg,
            padding: "3px 10px", borderRadius: "var(--radius-sm)", fontFamily: "Inter, var(--font-sans)",
            border: `1px solid ${directionColor}`,
          }}>
            {directionLabel}
          </span>
          <span style={{
            fontSize: 12, color: "var(--color-accent)", background: "var(--color-accent-bg)",
            padding: "3px 10px", borderRadius: "var(--radius-sm)", fontFamily: "Inter, var(--font-sans)",
            fontWeight: 600,
          }}>
            {detail.category}
          </span>
        </div>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)", lineHeight: 1.7, margin: 0, maxWidth: 720, fontFamily: "Inter, var(--font-sans)" }}>
          {detail.description}
        </p>
      </div>

      {/* 判定逻辑 */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <h2 style={sectionTitle}>判定逻辑</h2>
        <div style={{
          padding: "var(--space-5)", background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)", fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.8,
          fontFamily: "Inter, var(--font-sans)",
        }}>
          {detail.determination}
        </div>
      </section>

      {/* 形态示例 K 线图 */}
      {exampleKline.length > 0 && (
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={sectionTitle}>
            形态示例
            {exampleCode && (
              <Link to={`/stock/${exampleCode}`} style={{
                fontSize: 13, fontWeight: 400, color: "var(--color-primary)", marginLeft: "var(--space-2)",
                fontFamily: "var(--font-mono)",
              }}>
                {exampleCode} K线图 →
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
      <section style={{ marginBottom: "var(--space-8)" }}>
        <h2 style={{ ...sectionTitle, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          历史回测
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
            ({detail.backtest.sample_period})
          </span>
          <ConfidenceBadge grade={detail.backtest.confidence_grade} />
        </h2>

        {/* 多窗口统计表 */}
        <div style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: "var(--space-4)",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "var(--color-muted)", fontSize: 12, fontFamily: "Inter, var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  前瞻窗口
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "var(--color-muted)", fontSize: 12, fontFamily: "Inter, var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  胜率
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "var(--color-muted)", fontSize: 12, fontFamily: "Inter, var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  平均收益
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "var(--color-muted)", fontSize: 12, fontFamily: "Inter, var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  样本数
                </th>
              </tr>
            </thead>
            <tbody>
              {(["forward_5d", "forward_10d", "forward_20d"] as const).map((key) => {
                const w = detail.backtest[key];
                return (
                  <tr key={key} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "14px 16px", color: "var(--color-text)", fontWeight: 500, fontFamily: "Inter, var(--font-sans)" }}>
                      {WINDOW_LABELS[key]}
                    </td>
                    <td style={{
                      padding: "14px 16px", textAlign: "right",
                      color: w.win_rate != null ? "var(--color-text)" : "var(--color-muted)", fontWeight: 500,
                      fontFamily: "var(--font-mono)",
                    }}>
                      {fmtWinRate(w.win_rate)}
                    </td>
                    <td style={{
                      padding: "14px 16px", textAlign: "right",
                      color: w.avg_return != null ? (w.avg_return >= 0 ? "var(--color-bullish)" : "var(--color-bearish)") : "var(--color-muted)",
                      fontFamily: "var(--font-mono)",
                    }}>
                      {fmtPct(w.avg_return)}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
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
              fontFamily: "Inter, var(--font-sans)",
            }}>
              {detail.backtest.max_return != null && (
                <span>最大盈利 <span style={{ color: "var(--color-bullish)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{fmtPct(detail.backtest.max_return)}</span></span>
              )}
              {detail.backtest.max_loss != null && (
                <span>最大亏损 <span style={{ color: "var(--color-bearish)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{fmtPct(detail.backtest.max_loss)}</span></span>
              )}
            </div>
          )}
        </div>

        {/* 收益分布直方图 */}
        {detail.backtest.distribution && detail.backtest.distribution.length > 0 && (
          <div style={{
            background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)", padding: "var(--space-5)", marginBottom: "var(--space-4)",
          }}>
            <DistributionBar
              bins={detail.backtest.distribution}
              randomBaseline={detail.backtest.random_baseline}
            />
          </div>
        )}

        {/* 牛熊市拆分 */}
        {detail.backtest.regime_splits && detail.backtest.regime_splits.length > 0 && (
          <div style={{
            background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)", padding: "var(--space-5)", marginBottom: "var(--space-4)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text)", marginBottom: "var(--space-3)", fontFamily: "Inter, var(--font-sans)" }}>
              不同市场环境下的表现（20日窗口）
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              {detail.backtest.regime_splits.map((rs) => {
                const isBullMarket = rs.regime === "bull";
                const isBearMarket = rs.regime === "bear";
                const regimeColor = isBullMarket ? "var(--color-bullish)" : isBearMarket ? "var(--color-bearish)" : "var(--color-shock)";
                const regimeBg = isBullMarket ? "var(--color-bullish-bg)" : isBearMarket ? "var(--color-bearish-bg)" : "var(--color-shock-bg)";
                return (
                  <div
                    key={rs.regime}
                    style={{
                      flex: "1 1 140px",
                      padding: "var(--space-4)",
                      background: regimeBg,
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${regimeColor}`,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: regimeColor, marginBottom: "var(--space-2)", fontFamily: "Inter, var(--font-sans)" }}>
                      {rs.label}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", fontFamily: "var(--font-mono)" }}>
                      {fmtWinRate(rs.win_rate)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2, fontFamily: "Inter, var(--font-sans)" }}>
                      均收益 {fmtPct(rs.avg_return)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                      n={rs.occurrences.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 教育性声明 */}
        <div style={{
          marginTop: "var(--space-3)", paddingLeft: "var(--space-3)",
          borderLeft: "2px solid var(--color-border)",
          fontSize: 12, color: "var(--color-disclaimer)", fontStyle: "italic", lineHeight: 1.7,
          fontFamily: "Inter, var(--font-sans)",
        }}>
          历史统计数据仅为过去行情的概率总结，不代表对未来走势的预测。任何技术形态都可能失效，请结合市场环境、基本面等多维度信息综合判断。
        </div>
      </section>

      {/* 局限性 */}
      {detail.limitations.length > 0 && (
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={sectionTitle}>局限性</h2>
          <div style={{
            padding: "var(--space-5)", background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
          }}>
            <ul style={{ margin: 0, paddingLeft: "var(--space-5)" }}>
              {detail.limitations.map((l, i) => (
                <li key={i} style={{
                  fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.7,
                  marginBottom: i < detail.limitations.length - 1 ? 4 : 0,
                  fontFamily: "Inter, var(--font-sans)",
                }}>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 关联形态 */}
      {detail.related_patterns.length > 0 && (
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={sectionTitle}>关联形态</h2>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            {detail.related_patterns.map((pid) => (
              <Link
                key={pid}
                to={`/learn/patterns/${pid}`}
                style={{
                  fontSize: 14, fontWeight: 500,
                  fontFamily: "Inter, var(--font-sans)",
                  color: "var(--color-text-secondary)",
                  padding: "8px 16px",
                  background: "var(--color-surface)", border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)", textDecoration: "none",
                  transition: "border-color 0.15s, color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-primary)";
                  e.currentTarget.style.color = "var(--color-text)";
                  e.currentTarget.style.background = "var(--color-surface-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.color = "var(--color-text-secondary)";
                  e.currentTarget.style.background = "var(--color-surface)";
                }}
              >
                {patternNames.get(pid) ?? pid}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 触发该形态的股票 */}
      <section>
        <h2 style={sectionTitle}>
          最新触发该形态的股票
          <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-muted)", marginLeft: "var(--space-2)", fontFamily: "Inter, var(--font-sans)" }}>
            ({stocks.length} 只)
          </span>
        </h2>
        {stocks.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "var(--space-8)", color: "var(--color-text-secondary)",
            fontSize: 14, background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)", fontFamily: "Inter, var(--font-sans)",
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
                    fontSize: 13, fontWeight: 500,
                    fontFamily: "Inter, var(--font-sans)",
                    color: "var(--color-primary)", padding: "8px 16px",
                    marginTop: "var(--space-2)",
                    background: "var(--color-surface)", border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)", display: "inline-flex", alignItems: "center",
                    textDecoration: "none",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-primary)";
                    e.currentTarget.style.background = "var(--color-surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-border)";
                    e.currentTarget.style.background = "var(--color-surface)";
                  }}
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
