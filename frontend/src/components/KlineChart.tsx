import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as echarts from "echarts";

interface MarkPointItem {
  name: string;
  coord: [string, number];
  value: string;
  symbol: string;
  symbolRotate?: number;
  symbolOffset?: [number, number];
  symbolSize: number;
  itemStyle: Record<string, string | number>;
  _pid: string;
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

interface SignalInfo {
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

/* ========== 技术指标 ========== */

function ema(prices: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = new Array(prices.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i];
  out[period - 1] = sum / period;
  for (let i = period; i < prices.length; i++) {
    out[i] = prices[i] * k + (out[i - 1] ?? 0) * (1 - k);
  }
  return out;
}

function calcMACD(closes: number[]) {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const n = closes.length;
  const dif: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (ema12[i] != null && ema26[i] != null) dif[i] = ema12[i]! - ema26[i]!;
  }
  const difClean = dif.filter((v): v is number => v != null);
  const deaRaw = ema(difClean, 9);
  const dea: (number | null)[] = new Array(n).fill(null);
  let offset = 0;
  for (let i = 0; i < n; i++) {
    if (dif[i] == null) { offset++; continue; }
    const di = i - offset;
    if (di >= 8) dea[i] = deaRaw[di];
  }
  const histogram: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (dif[i] != null && dea[i] != null) {
      histogram[i] = +(2 * (dif[i]! - dea[i]!)).toFixed(4);
    }
  }
  return { dif, dea, histogram };
}

function calcBOLL(closes: number[], period = 20, mult = 2) {
  const n = closes.length;
  const upper: (number | null)[] = new Array(n).fill(null);
  const middle: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    middle[i] = +mean.toFixed(3);
    upper[i] = +(mean + mult * std).toFixed(3);
    lower[i] = +(mean - mult * std).toFixed(3);
  }
  return { upper, middle, lower };
}

/* ========== 配色 ========== */

const C = {
  bg: "#0F172A",
  surface: "#1E293B",
  border: "#334155",
  grid: "#1E293B",
  muted: "#94A3B8",
  text: "#F1F5F9",
  text2: "#CBD5E1",
  bullish: "#EF4444",
  bearish: "#22C55E",
  ma5: "#F59E0B",
  ma20: "#EC4899",
  ma60: "#8B5CF6",
  ma120: "#06B6D4",
  bollUpper: "#F87171",
  bollMid: "#FBBF24",
  bollLower: "#34D399",
  dif: "#F59E0B",
  dea: "#8B5CF6",
} as const;

/* ========== 数据窗 ========== */

function DataWindow({
  item,
  prevClose,
}: {
  item: KlineItem;
  prevClose: number | null;
}) {
  const chg = prevClose != null ? ((item.close - prevClose) / prevClose) * 100 : 0;
  const chgColor = chg >= 0 ? C.bullish : C.bearish;

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        background: "rgba(15, 23, 42, 0.95)",
        border: "1px solid #334155",
        borderRadius: 6,
        padding: "10px 14px",
        fontSize: 12,
        lineHeight: "1.9",
        zIndex: 10,
        pointerEvents: "none",
        fontVariantNumeric: "tabular-nums",
        minWidth: 175,
        backdropFilter: "blur(6px)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <span style={{ color: C.muted }}>日期</span>
        <span style={{ color: C.text, fontWeight: 600 }}>{item.date}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <span style={{ color: C.muted }}>开</span>
        <span style={{ color: C.text }}>{item.open.toFixed(2)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <span style={{ color: C.muted }}>高</span>
        <span style={{ color: C.text }}>{item.high.toFixed(2)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <span style={{ color: C.muted }}>低</span>
        <span style={{ color: C.text }}>{item.low.toFixed(2)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <span style={{ color: C.muted }}>收</span>
        <span style={{ color: C.text }}>{item.close.toFixed(2)}</span>
      </div>
      {prevClose != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
          <span style={{ color: C.muted }}>涨幅</span>
          <span style={{ color: chgColor, fontWeight: 600 }}>
            {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
          </span>
        </div>
      )}
      <div style={{ marginTop: 2, borderTop: "1px solid #1E293B" }} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <span style={{ color: C.muted }}>量</span>
        <span style={{ color: C.text }}>
          {item.volume > 1e6 ? `${(item.volume / 1e6).toFixed(1)}M` : `${(item.volume / 1e4).toFixed(0)}万`}
        </span>
      </div>
    </div>
  );
}

/* ========== 主组件 ========== */

export default function KlineChart({ data, signals = [] }: { data: KlineItem[]; signals?: SignalInfo[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  const [showMA, setShowMA] = useState(true);
  const [showBOLL, setShowBOLL] = useState(false);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const closes = useMemo(() => data.map((d) => d.close), [data]);
  const macd = useMemo(() => calcMACD(closes), [closes]);
  const boll = useMemo(() => calcBOLL(closes), [closes]);

  const markPoints = useMemo(() => {
    if (signals.length === 0) return [];
    const dates = data.map((d) => d.date);
    const byDate = new Map<string, SignalInfo[]>();
    for (const s of signals) {
      const arr = byDate.get(s.date) || [];
      arr.push(s);
      byDate.set(s.date, arr);
    }
    const result: MarkPointItem[] = [];
    for (const [date, sigs] of byDate) {
      const idx = dates.indexOf(date);
      if (idx === -1) continue;
      const bar = data[idx];
      let bullCount = 0, bearCount = 0;
      for (const s of sigs) {
        const isBull = s.direction === "bullish";
        const step = isBull ? bullCount : bearCount;
        const color = isBull ? C.bullish : C.bearish;
        const offset: [number, number] = isBull
          ? [step * 6, -(step * 22 + 18)]
          : [step * 6, step * 22 + 18];
        if (isBull) bullCount++;
        else bearCount++;
        result.push({
          name: s.pattern_name,
          coord: [date, isBull ? bar.high : bar.low],
          value: s.pattern_name,
          symbol: "arrow",
          symbolRotate: isBull ? 0 : 180,
          symbolSize: 14,
          symbolOffset: offset,
          itemStyle: {
            color,
            borderColor: "#F1F5F9",
            borderWidth: 1.5,
            shadowBlur: 4,
            shadowColor: "rgba(0,0,0,0.5)",
          },
          _pid: s.pattern_id,
        });
      }
    }
    return result;
  }, [signals, data]);

  const navigate = useNavigate();

  const buildOption = useCallback((): echarts.EChartsOption => {
    const dates = data.map((d) => d.date);
    const ohlc = data.map((d) => [d.open, d.close, d.low, d.high]);
    const volumes = data.map((d) => d.volume);
    const n = data.length;

    const series: echarts.EChartsOption["series"] = [];

    // K 线
    const candlestick: Record<string, unknown> = {
      type: "candlestick",
      name: "K",
      data: ohlc,
      xAxisIndex: 0,
      yAxisIndex: 0,
      itemStyle: {
        color: C.bullish,
        color0: C.bearish,
        borderColor: C.bullish,
        borderColor0: C.bearish,
      },
      barWidth: "55%",
      barMaxWidth: 20,
    };
    if (markPoints.length > 0) {
      candlestick.markPoint = {
        data: markPoints,
        symbol: "arrow",
        symbolSize: 14,
        animation: false,
        tooltip: {
          trigger: "item",
          formatter: (p: { data: { value: string } }) => p.data.value,
        },
      };
    }
    series.push(candlestick);

    // MA
    if (showMA) {
      const mas: [string, string, (number | null)[]][] = [
        ["MA5", C.ma5, data.map((d) => d.ma5)],
        ["MA20", C.ma20, data.map((d) => d.ma20)],
        ["MA60", C.ma60, data.map((d) => d.ma60)],
        ["MA120", C.ma120, data.map((d) => d.ma120)],
      ];
      for (const [name, color, values] of mas) {
        series.push({
          type: "line",
          name,
          data: values,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color },
          emphasis: { lineStyle: { width: 2 } },
        });
      }
    }

    // BOLL
    if (showBOLL) {
      series.push(
        {
          type: "line", name: "BOLL上轨", data: boll.upper,
          xAxisIndex: 0, yAxisIndex: 0, smooth: true, showSymbol: false,
          lineStyle: { width: 1, color: C.bollUpper, type: "dashed" },
        },
        {
          type: "line", name: "BOLL中轨", data: boll.middle,
          xAxisIndex: 0, yAxisIndex: 0, smooth: true, showSymbol: false,
          lineStyle: { width: 1, color: C.bollMid, type: "dashed" },
        },
        {
          type: "line", name: "BOLL下轨", data: boll.lower,
          xAxisIndex: 0, yAxisIndex: 0, smooth: true, showSymbol: false,
          lineStyle: { width: 1, color: C.bollLower, type: "dashed" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(248, 113, 113, 0.04)" },
              { offset: 1, color: "rgba(52, 211, 153, 0.04)" },
            ]),
          },
        },
      );
    }

    // 成交量
    series.push({
      type: "bar",
      name: "VOL",
      data: volumes.map((v, i) => {
        const up = i === 0 || data[i].close >= data[i - 1].close;
        return {
          value: v,
          itemStyle: {
            color: up ? "rgba(239, 68, 68, 0.45)" : "rgba(34, 197, 94, 0.45)",
          },
        };
      }),
      xAxisIndex: 1,
      yAxisIndex: 1,
    });

    // MACD
    series.push(
      {
        type: "line", name: "DIF", data: macd.dif,
        xAxisIndex: 2, yAxisIndex: 2, showSymbol: false,
        lineStyle: { width: 1, color: C.dif },
      },
      {
        type: "line", name: "DEA", data: macd.dea,
        xAxisIndex: 2, yAxisIndex: 2, showSymbol: false,
        lineStyle: { width: 1, color: C.dea },
      },
      {
        type: "bar", name: "MACD+",
        data: macd.histogram.map((v) => (v != null && v >= 0 ? v : null)),
        xAxisIndex: 2, yAxisIndex: 2,
        itemStyle: { color: "rgba(239, 68, 68, 0.55)" },
      },
      {
        type: "bar", name: "MACD-",
        data: macd.histogram.map((v) => (v != null && v < 0 ? v : null)),
        xAxisIndex: 2, yAxisIndex: 2,
        itemStyle: { color: "rgba(34, 197, 94, 0.55)" },
      },
    );

    return {
      backgroundColor: C.bg,
      animation: true,
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          crossStyle: { color: "#64748B" },
          lineStyle: { color: "#475569", type: "dashed", width: 1 },
        },
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: C.border,
        textStyle: { color: C.text, fontSize: 12 },
      },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      grid: [
        { left: "8%", right: "2%", top: "3%", height: "44%" },
        { left: "8%", right: "2%", top: "53%", height: "15%" },
        { left: "8%", right: "2%", top: "74%", height: "13%" },
      ],
      xAxis: [
        {
          type: "category", data: dates, gridIndex: 0,
          axisLine: { lineStyle: { color: C.border } },
          axisTick: { show: false },
          axisLabel: { color: C.muted, fontSize: 11 },
        },
        {
          type: "category", data: dates, gridIndex: 1,
          axisLine: { lineStyle: { color: C.border } },
          axisTick: { show: false },
          axisLabel: { show: false },
        },
        {
          type: "category", data: dates, gridIndex: 2,
          axisLine: { lineStyle: { color: C.border } },
          axisTick: { show: false },
          axisLabel: { show: false },
        },
      ],
      yAxis: [
        {
          type: "value", gridIndex: 0, scale: true,
          splitLine: { lineStyle: { color: C.grid, width: 0.5 } },
          axisLabel: { color: C.muted, fontSize: 11 },
          nameTextStyle: { color: C.muted },
        },
        {
          type: "value", gridIndex: 1,
          axisLabel: {
            color: C.muted, fontSize: 10,
            formatter: (v: number) => v > 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e4).toFixed(0)}万`,
          },
          splitLine: { show: false },
        },
        {
          type: "value", gridIndex: 2, scale: true,
          splitLine: { lineStyle: { color: C.grid, width: 0.5 } },
          axisLabel: { color: C.muted, fontSize: 10 },
        },
      ],
      dataZoom: [
        {
          type: "inside", xAxisIndex: [0, 1, 2],
          zoomOnMouseWheel: true, moveOnMouseWheel: false, moveOnMouseMove: true,
        },
        {
          type: "slider", xAxisIndex: [0, 1, 2], bottom: 2, height: 28,
          borderColor: "transparent", backgroundColor: C.surface,
          fillerColor: "rgba(59, 130, 246, 0.12)",
          handleStyle: { color: "#3B82F6" },
          textStyle: { color: C.muted, fontSize: 10 },
          start: Math.max(0, 100 - (80 / n) * 100), end: 100,
        },
      ],
      series,
    };
  }, [data, showMA, showBOLL, boll, macd, markPoints]);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, null, { renderer: "svg" });
    }
    instanceRef.current.setOption(buildOption(), true);
  }, [buildOption, data]);

  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst) return;

    const onMouseOver = (params: Record<string, unknown>) => {
      if (params.dataIndex != null) setHoveredIndex(params.dataIndex as number);
    };
    const onMouseOut = () => setHoveredIndex(null);
    const onClick = (params: Record<string, unknown>) => {
      if (params.componentType === "markPoint") {
        const data = params.data as Record<string, unknown> | undefined;
        const patternId = data?._pid as string | undefined;
        if (patternId) navigate(`/learn/patterns/${patternId}`);
        return;
      }
      if (params.dataIndex != null) {
        const idx = params.dataIndex as number;
        setPinnedIndex((prev) => (prev === idx ? null : idx));
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinnedIndex(null);
    };

    inst.on("mouseover", onMouseOver);
    inst.on("mouseout", onMouseOut);
    inst.on("click", onClick);
    window.addEventListener("keydown", onKeyDown);

    const onResize = () => inst.resize();
    window.addEventListener("resize", onResize);

    return () => {
      inst.off("mouseover", onMouseOver);
      inst.off("mouseout", onMouseOut);
      inst.off("click", onClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [navigate]);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  const activeIndex = pinnedIndex ?? hoveredIndex;

  return (
    <div style={{ position: "relative" }}>
      {/* 工具栏 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
        {([
          ["MA", showMA, () => setShowMA((v) => !v), C.ma5],
          ["BOLL", showBOLL, () => setShowBOLL((v) => !v), C.bollMid],
        ] as [string, boolean, () => void, string][]).map(([label, active, toggle, color]) => (
          <button
            key={label}
            onClick={toggle}
            style={{
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 500,
              borderRadius: 4,
              border: `1px solid ${active ? color : "transparent"}`,
              background: active ? `${color}18` : "transparent",
              color: active ? color : C.muted,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ fontSize: 10, color: C.muted, marginLeft: "auto", opacity: 0.6 }}>
          滚轮缩放 · 拖拽平移 · 点击固定
        </span>
      </div>

      {/* 图表 */}
      <div style={{ position: "relative" }}>
        <div
          ref={chartRef}
          style={{
            width: "100%",
            height: "var(--chart-height)",
            background: C.bg,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
          }}
        />
        {activeIndex != null && data[activeIndex] && (
          <DataWindow
            item={data[activeIndex]}
            prevClose={activeIndex > 0 ? data[activeIndex - 1].close : null}
          />
        )}
      </div>
    </div>
  );
}
