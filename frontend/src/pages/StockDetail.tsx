import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import KlineChart from "../components/KlineChart";
import PatternSignalList from "../components/PatternSignalList";
import StockOverview from "../components/StockOverview";
import Skeleton, { SkeletonTable } from "../components/Skeleton";

interface OverviewData {
  code: string;
  name: string;
  market: string;
  latest_price: number;
  change_pct: number;
  volume: number;
  amount: number;
  update_time: string;
}

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

export interface PatternSignal {
  code: string;
  date: string;
  pattern_id: string;
  pattern_name: string;
  category: string;
  direction: string;
  confidence: number;
  description: string;
  backtest: { win_rate: number; avg_return: number; occurrences: number } | null;
  limitations: string[];
  related_patterns: string[];
}

type TabKey = "kline" | "signals";

export default function StockDetail() {
  const { code } = useParams<{ code: string }>();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [kline, setKline] = useState<KlineItem[]>([]);
  const [signals, setSignals] = useState<PatternSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("kline");

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchJson = (url: string) =>
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });

    Promise.allSettled([
      fetchJson(`/api/stocks/${code}/overview`),
      fetchJson(`/api/stocks/${code}/kline?period=d&limit=180`),
      fetchJson(`/api/stocks/${code}/signals`),
    ]).then(([ov, kl, sg]) => {
      if (cancelled) return;
      if (ov.status === "fulfilled") {
        const data = ov.value;
        if (data.detail) { setError(data.detail); return; }
        setOverview(data);
      } else {
        setError("获取股票信息失败");
        return;
      }
      setKline(kl.status === "fulfilled" && Array.isArray(kl.value) ? kl.value : []);
      setSignals(sg.status === "fulfilled" && Array.isArray(sg.value) ? sg.value : []);
    }).finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [code]);

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: "var(--space-6)", display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <Skeleton width={48} height={13} />
          <Skeleton width={12} height={13} />
          <Skeleton width={120} height={13} />
        </div>
        <Skeleton width="100%" height={320} radius="var(--radius-md)" style={{ marginBottom: "var(--space-5)" }} />
        <SkeletonTable rows={4} cols={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-12)" }}>
        <p style={{ color: "var(--color-destructive)", marginBottom: "var(--space-4)", fontFamily: "Inter, var(--font-sans)", fontSize: 14 }}>{error}</p>
        <Link to="/" style={{ color: "var(--color-primary)", fontSize: 14 }}>← 返回首页</Link>
      </div>
    );
  }

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
        <span style={{ color: "var(--color-text)", fontWeight: 500 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-muted)" }}>{code}</span>
          <span style={{ marginLeft: "var(--space-2)" }}>{overview?.name ?? ""}</span>
        </span>
      </div>

      {/* Overview */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <StockOverview data={overview} />
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--color-border)",
        marginBottom: "var(--space-5)",
      }}>
        {([
          ["kline", "K线图"],
          ["signals", `形态信号 (${signals.length})`],
        ] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "12px 20px",
              fontSize: 14,
              fontFamily: "Inter, var(--font-sans)",
              fontWeight: 600,
              color: tab === key ? "var(--color-primary)" : "var(--color-text-secondary)",
              borderBottom: tab === key ? "2px solid var(--color-primary)" : "2px solid transparent",
              transition: "color 0.15s, border-color 0.15s",
              background: "none",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "kline" && <KlineChart data={kline} />}
      {tab === "signals" && <PatternSignalList signals={signals} />}
    </div>
  );
}
