import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { init, dispose } from "klinecharts";
import type { Chart, KLineData as KLData, DataLoader, DeepPartial, Styles } from "klinecharts";

// ============================================================
// 类型定义
// ============================================================

export interface KlineData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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

export type Period = "d" | "w" | "m";

export interface SignalInfo {
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

interface StockChartProps {
  data: KlineData[];
  realtime?: RealtimeQuote | null;
  period?: Period;
  onPeriodChange?: (period: Period) => void;
  signals?: SignalInfo[];
  showPeriodSwitch?: boolean;
}

// ============================================================
// 配色常量
// ============================================================

const C = {
  bg: "#050608",
  surface: "#0a0c10",
  border: "#1f2937",
  up: "#FF4D4D",
  down: "#00FF9D",
  upBorder: "#CC0000",
  downBorder: "#00CC7D",
  grid: "rgba(255,255,255,0.08)",
  text: "#e0e0e0",
  textMuted: "#9ca3af",
  textDim: "#6b7280",
  ma5: "#FFD700",
  ma10: "#FF6B9D",
  ma20: "#00BFFF",
  ma60: "#9B59B6",
  ma120: "#06B6D4",
  bollUpper: "#FF4D4D",
  bollMid: "#F59E0B",
  bollLower: "#00FF9D",
  dif: "#F59E0B",
  dea: "#8B5CF6",
  volUp: "rgba(255,77,77,0.45)",
  volDown: "rgba(0,255,157,0.45)",
} as const;

const PERIOD_LABELS: [Period, string][] = [
  ["d", "日K"],
  ["w", "周K"],
  ["m", "月K"],
];

// ============================================================
// KLineChart 深色主题（绕过 DeepPartial 严格类型检查）
// ============================================================

const DARK_STYLES = {
  grid: {
    show: true,
    horizontal: {
      show: true,
      color: C.grid,
      style: "solid",
      size: 0.5,
    },
    vertical: {
      show: false,
    },
  },
  candle: {
    type: "candle_solid",
    bar: {
      compareRule: "current_open",
      upColor: C.up,
      downColor: C.down,
      noChangeColor: C.textMuted,
      upBorderColor: C.upBorder,
      downBorderColor: C.downBorder,
      noChangeBorderColor: C.textMuted,
      upWickColor: C.up,
      downWickColor: C.down,
      noChangeWickColor: C.textMuted,
    },
    priceMark: {
      show: true,
      high: { show: true, color: C.textDim },
      low: { show: true, color: C.textDim },
      last: {
        show: true,
        upColor: C.text,
        downColor: C.text,
        noChangeColor: C.text,
      },
    },
    tooltip: {
      showRule: "always",
      showType: "standard",
    },
  },
  indicator: {
    ohlc: {
      compareRule: "current_open",
      upColor: C.up,
      downColor: C.down,
      noChangeColor: C.textMuted,
    },
    bars: [
      { upColor: C.volUp, downColor: C.volDown, noChangeColor: C.textDim },
      { upColor: "rgba(255,77,77,0.55)", downColor: "rgba(0,255,157,0.55)", noChangeColor: C.textDim },
    ],
    lines: [
      { color: C.ma5, size: 1 },
      { color: C.ma10, size: 1 },
      { color: C.ma20, size: 1 },
      { color: C.ma60, size: 1 },
      { color: C.ma120, size: 1 },
      { color: C.bollUpper, size: 1, style: "dashed" },
      { color: C.bollMid, size: 1, style: "dashed" },
      { color: C.bollLower, size: 1, style: "dashed" },
      { color: C.dif, size: 1 },
      { color: C.dea, size: 1 },
    ],
    lastValueMark: {
      show: false,
    },
  },
  xAxis: {
    show: true,
    axisLine: { show: true, color: C.border, size: 1 },
    tickLine: { show: false },
    tickText: { show: true, color: C.textDim, size: 10 },
  },
  yAxis: {
    show: true,
    axisLine: { show: false },
    tickLine: { show: false },
    tickText: { show: true, color: C.textMuted, size: 10 },
  },
  separator: {
    size: 1,
    color: C.border,
    fill: true,
    activeBackgroundColor: "rgba(255,255,255,0.03)",
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: { show: true, color: "rgba(255,255,255,0.15)", style: "dashed", size: 1 },
      text: {
        show: true,
        color: C.text,
        size: 10,
        backgroundColor: "rgba(5,6,8,0.92)",
        borderColor: "rgba(255,255,255,0.12)",
        borderSize: 1,
        borderRadius: 4,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 2,
        paddingBottom: 2,
      },
    },
    vertical: {
      show: true,
      line: { show: true, color: "rgba(255,255,255,0.15)", style: "dashed", size: 1 },
      text: { show: false },
    },
  },
} satisfies DeepPartial<Styles>;

// ============================================================
// 工具函数
// ============================================================

function toTimestamp(d: string): number {
  return new Date(d).getTime();
}

// ============================================================
// 主组件
// ============================================================

export default function StockChart({
  data,
  realtime = null,
  period = "d",
  onPeriodChange,
  signals = [],
  showPeriodSwitch = true,
}: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const navigate = useNavigate();

  // ---- 合并实时行情 ----
  const merged = useMemo(() => {
    if (!realtime || realtime.current <= 0 || data.length === 0) return data;
    const today = realtime.date;
    const last = data[data.length - 1];
    const synth: KlineData = {
      time: today,
      open: realtime.open,
      high: realtime.high,
      low: realtime.low,
      close: realtime.current,
      volume: realtime.volume,
    };
    if (last.time < today) return [...data, synth];
    if (last.time === today) return [...data.slice(0, -1), synth];
    return data;
  }, [data, realtime]);

  const isLive = realtime && realtime.current > 0;

  // ---- 转换为 KLineChart 格式 ----
  const klData = useMemo<KLData[]>(() => {
    return merged.map((d) => ({
      timestamp: toTimestamp(d.time),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }));
  }, [merged]);

  const klDataRef = useRef(klData);
  klDataRef.current = klData;

  // ---- 信号标记 ----
  const signalList = useMemo(() => {
    if (signals.length === 0) return [];
    const timeMap = new Map<string, { high: number; low: number }>();
    for (const d of merged) timeMap.set(d.time, { high: d.high, low: d.low });

    return signals
      .map((s) => {
        const bar = timeMap.get(s.date);
        if (!bar) return null;
        const isBull = s.direction === "bullish";
        return {
          timestamp: toTimestamp(s.date),
          value: isBull ? bar.high : bar.low,
          isBull,
          name: s.pattern_name,
          patternId: s.pattern_id,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [signals, merged]);

  // ---- 初始化 KLineChart ----
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 检查容器是否有有效尺寸
    const { width, height } = container.getBoundingClientRect();
    if (width === 0 && height === 0) return;

    const chart = init(container, {
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      styles: DARK_STYLES,
    });

    if (!chart) return;

    chartRef.current = chart;

    // 创建指标 — MA 和 BOLL 叠加在主图蜡烛 pane 上
    const candlePane = { id: "candle_pane" };
    chart.createIndicator({ name: "MA", calcParams: [5, 10, 20, 60, 120] }, { isStack: true, pane: candlePane });
    chart.createIndicator({ name: "BOLL", calcParams: [20, 2] }, { isStack: true, pane: candlePane });
    chart.createIndicator({ name: "VOL", calcParams: [5, 10, 20] });
    chart.createIndicator({ name: "MACD", calcParams: [12, 26, 9] });

    // DataLoader
    const dataLoader: DataLoader = {
      getBars: (params) => {
        params.callback(klDataRef.current, false);
      },
    };
    chart.setDataLoader(dataLoader);

    return () => {
      dispose(chart);
      chartRef.current = null;
    };
  }, []);

  // ---- 数据变化时通知图表重新加载 ----
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || klData.length === 0) return;
    chart.resetData();
  }, [klData]);

  // ---- ResizeObserver ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- 信号标记作为 KLineChart Overlay ----
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || signalList.length === 0) return;

    const ids: string[] = [];
    for (const sp of signalList) {
      const color = sp.isBull ? C.up : C.down;
      const id = chart.createOverlay({
        name: sp.name,
        groupId: `sig_${sp.patternId}`,
        lock: true,
        mode: "normal",
        visible: true,
        points: [{ timestamp: sp.timestamp, value: sp.value }],
        extendData: sp.patternId,
        styles: {
          point: {
            color,
            borderColor: "#fff",
            borderSize: 1.5,
            radius: 5,
            activeColor: color,
            activeBorderColor: "#fff",
            activeBorderSize: 2,
            activeRadius: 6,
          },
        },
      });
      if (id) ids.push(id as string);
    }

    return () => {
      for (const id of ids) {
        chart.removeOverlay({ id });
      }
    };
  }, [signalList]);

  // ---- Overlay 点击导航 ----
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handler = (data: unknown) => {
      const d = data as Record<string, unknown> | undefined;
      const overlay = d?.overlay as Record<string, unknown> | undefined;
      const groupId = overlay?.groupId as string | undefined;
      if (groupId && groupId.startsWith("sig_")) {
        navigate(`/learn/patterns/${groupId.slice(4)}`);
      }
    };

    chart.subscribeAction("onCrosshairFeatureClick" as never, handler as never);

    return () => {
      chart.unsubscribeAction("onCrosshairFeatureClick" as never, handler as never);
    };
  }, [navigate]);

  // ---- 价格摘要 ----
  const lastBar = merged.length > 0 ? merged[merged.length - 1] : null;
  const prevBar = merged.length > 1 ? merged[merged.length - 2] : null;
  const priceChg = lastBar && prevBar ? lastBar.close - prevBar.close : 0;
  const priceChgPct = lastBar && prevBar ? ((lastBar.close - prevBar.close) / prevBar.close) * 100 : 0;
  const priceColor = priceChg >= 0 ? C.up : C.down;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* ---- 价格头栏 + 周期切换 ---- */}
      {lastBar && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 2, padding: "2px 8px", flexShrink: 0,
          background: C.surface, border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: priceColor, fontFamily: "var(--font-mono)", lineHeight: 1 }}>
              {lastBar.close.toFixed(2)}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: priceColor, fontFamily: "var(--font-mono)" }}>
              {priceChg >= 0 ? "+" : ""}{priceChg.toFixed(2)}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 600, color: priceColor,
              background: priceColor + "18", padding: "1px 5px", borderRadius: 3,
              fontFamily: "var(--font-mono)",
            }}>
              {priceChgPct >= 0 ? "+" : ""}{priceChgPct.toFixed(2)}%
            </span>
            {isLive && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: C.down,
                background: "rgba(0,255,157,0.12)", padding: "1px 5px", borderRadius: 3,
              }}>
                ● 实时
              </span>
            )}
            <span style={{ color: C.textDim, fontSize: 10 }}>
              {([
                ["开", lastBar.open],
                ["高", lastBar.high],
                ["低", lastBar.low],
                ["昨收", realtime?.prev_close ?? prevBar?.close],
              ] as [string, number | undefined][]).map(([label, val]) => (
                <span key={label} style={{ marginLeft: 8 }}>
                  <span style={{ color: C.textDim }}>{label} </span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{val != null ? val.toFixed(2) : "-"}</span>
                </span>
              ))}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {showPeriodSwitch && (
              <div style={{ display: "flex", gap: 2 }}>
                {PERIOD_LABELS.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => onPeriodChange?.(key)}
                    style={{
                      padding: "2px 10px",
                      fontSize: 12,
                      fontWeight: period === key ? 600 : 400,
                      borderRadius: 3,
                      border: `1px solid ${period === key ? "var(--color-primary)" : "transparent"}`,
                      background: period === key ? "var(--color-primary-alpha, rgba(59,130,246,0.15))" : "transparent",
                      color: period === key ? "var(--color-primary)" : C.textDim,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- 图表区 ---- */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            inset: 0,
            background: C.bg,
            borderRadius: "0 0 var(--radius-md) var(--radius-md)",
            overflow: "hidden",
          }}
        />
      </div>
    </div>
  );
}
