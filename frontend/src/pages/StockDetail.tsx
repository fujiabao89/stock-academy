import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import StockChart, { type KlineData, type Period, type SignalInfo } from "../components/StockChart";
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

export interface RealtimeQuote {
  name: string;
  open: number;
  prev_close: number;
  current: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  date: string;
  time: string;
  change: number;
  change_pct: number;
}

type TabKey = "kline" | "signals";

function isTradingHours(): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const t = now.getHours() * 100 + now.getMinutes();
  return t >= 930 && t <= 1505;
}

export default function StockDetail() {
  const { code } = useParams<{ code: string }>();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [kline, setKline] = useState<KlineItem[]>([]);
  const [signals, setSignals] = useState<PatternSignal[]>([]);
  const [realtime, setRealtime] = useState<RealtimeQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("kline");
  const [period, setPeriod] = useState<Period>("d");
  const tabContentRef = useRef<HTMLDivElement>(null);

  // 将 API KlineItem[] 映射为 StockChart 的 KlineData[]
  const chartData: KlineData[] = useMemo(
    () =>
      kline.map((b) => ({
        time: b.date,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      })),
    [kline],
  );

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
      fetchJson(`/api/stocks/${code}/kline?period=${period}&limit=500`),
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
  }, [code, period]);

  // 实时行情轮询
  useEffect(() => {
    if (!code || period !== "d") return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (!isTradingHours()) {
        setRealtime(null);
        return;
      }
      try {
        const resp = await fetch(`/api/stocks/${code}/realtime`);
        if (resp.ok) {
          const data: RealtimeQuote = await resp.json();
          if (data.current > 0) setRealtime(data);
        }
      } catch { /* 轮询失败静默忽略 */ }
    };

    poll();
    timer = setInterval(poll, 5000);

    return () => { if (timer) clearInterval(timer); };
  }, [code, period]);

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
        <Link to="/" style={{ color: "var(--color-primary)", fontSize: 14, display: "inline-flex", alignItems: "center", minHeight: 44, padding: "4px 0" }}>
          ← 返回首页
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 4, marginBottom: 2, flexShrink: 0 }}>
        <Link to="/" style={{ color: "var(--color-text-secondary)" }}>首页</Link>
        <span>/</span>
        <span style={{ color: "var(--color-text)" }}>
          {overview?.name ?? code} ({code})
        </span>
      </div>

      {/* Overview */}
      <div style={{ marginBottom: 2, flexShrink: 0 }}>
        <StockOverview data={realtime ? { ...overview!, latest_price: realtime.current, change_pct: realtime.change_pct, volume: realtime.volume, amount: realtime.amount, update_time: `${realtime.date} ${realtime.time}` } : overview} />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex", alignItems: "center",
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 2, flexShrink: 0,
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
              padding: "4px 14px", fontSize: 13, fontWeight: 500,
              color: tab === key ? "var(--color-primary)" : "var(--color-text-secondary)",
              borderBottom: tab === key ? "2px solid var(--color-primary)" : "2px solid transparent",
              transition: "color 0.15s, border-color 0.15s",
              background: "none", border: "none", cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div ref={tabContentRef} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {tab === "kline" && (
          <StockChart
            data={chartData}
            realtime={realtime}
            period={period}
            onPeriodChange={setPeriod}
            signals={signals as SignalInfo[]}
            code={code!}
          />
        )}
        {tab === "signals" && <PatternSignalList signals={signals} />}
      </div>
    </div>
  );
}
