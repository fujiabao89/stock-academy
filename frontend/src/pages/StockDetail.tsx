import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import KlineChart from "../components/KlineChart";
import PatternSignalList from "../components/PatternSignalList";
import StockOverview from "../components/StockOverview";

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
    }).finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-12)", color: "var(--color-text-secondary)" }}>
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-12)" }}>
        <p style={{ color: "var(--color-bearish)", marginBottom: "var(--space-4)" }}>{error}</p>
        <Link to="/" style={{ color: "var(--color-primary)", fontSize: 14 }}>
          ← 返回首页
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "var(--space-5)", fontSize: 14, color: "var(--color-text-secondary)" }}>
        <Link to="/" style={{ color: "var(--color-text-secondary)" }}>
          首页
        </Link>
        <span style={{ margin: "0 var(--space-2)" }}>/</span>
        <span style={{ color: "var(--color-text)" }}>
          {overview?.name ?? code} ({code})
        </span>
      </div>

      {/* Overview */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <StockOverview data={overview} />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--color-border)",
          marginBottom: "var(--space-5)",
        }}
      >
        {([
          ["kline", "K线图"],
          ["signals", `形态信号 (${signals.length})`],
        ] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 500,
              color: tab === key ? "var(--color-primary)" : "var(--color-text-secondary)",
              borderBottom: tab === key ? "2px solid var(--color-primary)" : "2px solid transparent",
              transition: "color 0.15s, border-color 0.15s",
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
